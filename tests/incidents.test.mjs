import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const incidents = require('../lib/incidents.js');

test('tolerance zero: any nonzero delta requires incident', () => {
  assert.equal(incidents.differenceRequiresIncident(10, 10), false);
  assert.equal(incidents.differenceRequiresIncident(10, 11), true);
  assert.equal(incidents.differenceRequiresIncident(0, 1), true);
  assert.equal(incidents.differenceRequiresIncident(5, 5.0), false);
});

test('buildIncident hides theoretical from operator payload', () => {
  const issue = incidents.buildIncident({
    locationId: 'K00-P01',
    articleId: 'PRD1',
    countedQty: 8,
    theoreticalQty: 10,
    workers: ['a', 'b'],
    countMode: 'pair',
  });
  assert.equal(issue.status, 'pending');
  assert.equal(issue.theoreticalHidden, true);
  assert.equal(issue.deltaHiddenFromOperator, true);
  assert.equal(issue._deltaForStaffOnly, -2);
  assert.deepEqual(issue.workers, ['a', 'b']);
});

test('listFromDemoLocations flattens pending issues', () => {
  const list = incidents.listFromDemoLocations({
    'K00-P01': {
      incidents: {
        PRD1: { amount: 1, status: 'pending', notFound: false, reason: 'diff', at: '2026-01-02', worker: 'Operario 1', workers: ['Operario 1'], countMode: 'single' },
      },
    },
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].articleId, 'PRD1');
  assert.equal(list[0].kind, 'qty_mismatch');
});
