/**
 * Local incident helpers for INVENTA (tolerance zero).
 * A difference ≠ 0 always becomes a pending incident; never auto-validates.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InventaIncidents = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function differenceRequiresIncident(countedQty, theoreticalQty) {
    const c = Number(countedQty);
    const t = Number(theoreticalQty);
    if (!Number.isFinite(c) || !Number.isFinite(t)) return true;
    return c !== t;
  }

  function buildIncident(input) {
    const counted = Number(input.countedQty);
    const theoretical = input.theoreticalQty;
    const delta =
      theoretical === undefined || theoretical === null || !Number.isFinite(Number(theoretical))
        ? null
        : counted - Number(theoretical);
    return {
      clientId: input.clientId || null,
      campaignId: input.campaignId || null,
      locationId: input.locationId,
      articleId: input.articleId,
      kind: input.kind || (input.notFound ? 'not_found' : 'qty_mismatch'),
      status: 'pending',
      countedQty: Number.isFinite(counted) ? counted : null,
      theoreticalHidden: true,
      deltaHiddenFromOperator: true,
      note: input.note || '',
      workers: Array.isArray(input.workers) ? input.workers.slice() : [],
      countMode: input.countMode || 'single',
      createdBy: input.createdBy || null,
      createdAt: input.createdAt || new Date().toISOString(),
      payload: input.payload || {},
      _deltaForStaffOnly: delta,
    };
  }

  function listFromDemoLocations(locations) {
    const out = [];
    if (!locations || typeof locations !== 'object') return out;
    for (const [loc, data] of Object.entries(locations)) {
      const incidents = (data && data.incidents) || {};
      for (const [articleId, issue] of Object.entries(incidents)) {
        out.push({
          locationId: loc,
          articleId,
          status: issue.status || 'pending',
          countedQty: issue.amount,
          kind: issue.notFound ? 'not_found' : 'qty_mismatch',
          note: issue.reason || '',
          workers: issue.workers || [],
          countMode: issue.countMode || 'single',
          createdAt: issue.at || null,
          createdBy: issue.worker || null,
        });
      }
    }
    out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return out;
  }

  return {
    differenceRequiresIncident,
    buildIncident,
    listFromDemoLocations,
  };
});
