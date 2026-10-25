import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventaAccessGate} from './inventa-access-gate.js';

function fakeClient(authenticatedId, permitted = true) {
  let queries = 0;
  return {
    auth: {getUser: async () => ({data: {user: authenticatedId ? {id: authenticatedId} : null}, error: null})},
    from: () => ({
      select: () => ({eq: () => ({eq: async () => {
        queries++;
        return {data: permitted ? [{app_id:'inventa', app_role:'operator'}] : [], error: null};
      }})})
    }),
    get queries() { return queries; }
  };
}
test('rejects identity mismatch before permission query', async () => {
  const client = fakeClient('real-user');
  const denied = [];
  const gate = createInventaAccessGate(client, {onDenied: reason => denied.push(reason)});
  assert.equal(await gate.verify({id:'different-user'}), false);
  assert.deepEqual(denied, ['identity-mismatch']);
  assert.equal(client.queries, 0);
});
test('rejects absent authenticated user', async () => {
  const client = fakeClient(null);
  const gate = createInventaAccessGate(client);
  assert.equal(await gate.verify({id:'claimed-user'}), false);
  assert.equal(client.queries, 0);
});
test('denies when INVENTA permission is absent', async () => {
  const client = fakeClient('u1', false);
  const gate = createInventaAccessGate(client);
  assert.equal(await gate.verify({id:'u1'}), false);
});
test('allows matching identity with INVENTA permission', async () => {
  const client = fakeClient('u1');
  let allowed = false;
  const gate = createInventaAccessGate(client, {onAllowed: () => {allowed = true;}});
  assert.equal(await gate.verify({id:'u1'}), true);
  assert.equal(allowed, true);
});
