import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createQueue } = require('../lib/sync-queue.js');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('enqueue is idempotent by clientId', () => {
  const q = createQueue({ storage: memoryStorage() });
  const a = q.enqueue('count_entry', { amount: 1 }, 'cid-1');
  const b = q.enqueue('count_entry', { amount: 2 }, 'cid-1');
  assert.equal(a.clientId, 'cid-1');
  assert.equal(b.clientId, 'cid-1');
  assert.equal(q.pending().length, 1);
  assert.equal(q.pending()[0].payload.amount, 2);
});

test('flush without adapter stays local', async () => {
  const q = createQueue({ storage: memoryStorage() });
  q.enqueue('incident', { kind: 'qty_mismatch' });
  const result = await q.flush();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no_adapter');
  assert.equal(result.pending, 1);
});

test('flush with adapter marks synced', async () => {
  const q = createQueue({ storage: memoryStorage() });
  q.enqueue('movement', { qty: 3 }, 'm-1');
  const result = await q.flush(async () => 'synced');
  assert.equal(result.ok, true);
  assert.equal(result.pending, 0);
  assert.equal(q.snapshot().items[0].status, 'synced');
});

test('adapter conflict is recorded', async () => {
  const q = createQueue({ storage: memoryStorage() });
  q.enqueue('count_entry', {}, 'c-1');
  await q.flush(async () => 'conflict');
  assert.equal(q.pending().length, 1);
  assert.equal(q.pending()[0].status, 'conflict');
});
