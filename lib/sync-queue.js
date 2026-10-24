/**
 * Offline sync outbox for INVENTA (localStorage-backed).
 * Queues idempotent ops; flush is a stub until Supabase credentials exist.
 * Does not talk to any remote API without an explicit adapter.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InventaSyncQueue = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_KEY = 'inventa-sync-outbox-v1';

  function nowIso() {
    return new Date().toISOString();
  }

  function newClientId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    return (prefix || 'op') + '-' + Date.now().toString(36) + '-' + rand;
  }

  function loadStore(storage, key) {
    try {
      const raw = storage.getItem(key);
      if (!raw) return { version: 1, deviceId: null, items: [] };
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) return parsed;
    } catch (e) { /* corrupt → reset */ }
    return { version: 1, deviceId: null, items: [] };
  }

  function saveStore(storage, key, store) {
    storage.setItem(key, JSON.stringify(store));
  }

  function createQueue(options) {
    const storage = (options && options.storage) || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) throw new Error('InventaSyncQueue requires a storage object');
    const key = (options && options.key) || DEFAULT_KEY;
    let store = loadStore(storage, key);
    if (!store.deviceId) {
      store.deviceId = newClientId('dev');
      saveStore(storage, key, store);
    }

    function persist() {
      saveStore(storage, key, store);
    }

    function enqueue(op, payload, clientId) {
      if (!op || typeof op !== 'string') throw new Error('op required');
      const id = clientId || newClientId(op);
      const existing = store.items.find((x) => x.clientId === id);
      if (existing) {
        if (existing.status === 'synced') return existing;
        existing.payload = payload;
        existing.updatedAt = nowIso();
        existing.status = 'pending';
        persist();
        return existing;
      }
      const item = {
        clientId: id,
        deviceId: store.deviceId,
        op,
        payload: payload || {},
        status: 'pending',
        attempts: 0,
        lastError: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      store.items.push(item);
      persist();
      return item;
    }

    function pending() {
      return store.items.filter((x) => x.status === 'pending' || x.status === 'conflict');
    }

    function markSynced(clientId) {
      const item = store.items.find((x) => x.clientId === clientId);
      if (!item) return false;
      item.status = 'synced';
      item.updatedAt = nowIso();
      item.lastError = null;
      persist();
      return true;
    }

    function markConflict(clientId, error) {
      const item = store.items.find((x) => x.clientId === clientId);
      if (!item) return false;
      item.status = 'conflict';
      item.attempts += 1;
      item.lastError = String(error || 'conflict');
      item.updatedAt = nowIso();
      persist();
      return true;
    }

    /**
     * Flush pending ops through an adapter. Without adapter, reports blocked.
     * adapter({ op, payload, clientId, deviceId }) => Promise<'synced'|'conflict'|void>
     */
    async function flush(adapter) {
      if (typeof adapter !== 'function') {
        return {
          ok: false,
          reason: 'no_adapter',
          message: 'Sin adaptador Supabase: la cola permanece local. No se han enviado datos.',
          pending: pending().length,
        };
      }
      const results = [];
      for (const item of pending()) {
        try {
          const outcome = await adapter({
            op: item.op,
            payload: item.payload,
            clientId: item.clientId,
            deviceId: item.deviceId,
          });
          if (outcome === 'conflict') {
            markConflict(item.clientId, 'adapter_conflict');
            results.push({ clientId: item.clientId, status: 'conflict' });
          } else {
            markSynced(item.clientId);
            results.push({ clientId: item.clientId, status: 'synced' });
          }
        } catch (err) {
          markConflict(item.clientId, err && err.message ? err.message : err);
          results.push({ clientId: item.clientId, status: 'conflict', error: String(err) });
        }
      }
      return { ok: true, results, pending: pending().length };
    }

    function snapshot() {
      return {
        deviceId: store.deviceId,
        total: store.items.length,
        pending: pending().length,
        items: store.items.map((x) => ({ ...x })),
      };
    }

    function clearSynced() {
      store.items = store.items.filter((x) => x.status !== 'synced');
      persist();
    }

    return {
      enqueue,
      pending,
      markSynced,
      markConflict,
      flush,
      snapshot,
      clearSynced,
      newClientId,
      deviceId: () => store.deviceId,
    };
  }

  return { createQueue, newClientId, DEFAULT_KEY };
});
