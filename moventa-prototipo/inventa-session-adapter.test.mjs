import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventaSessionAdapter} from './inventa-session-adapter.js';
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
function fakeClient(initial = null) {
  let listener;
  const auth = {
    getSession: async () => ({data: {session: initial}, error: null}),
    getUser: async () => ({data: {user: initial?.user ?? null}, error: null}),
    onAuthStateChange: fn => {listener = fn; return {data: {subscription: {unsubscribe() {listener = null;}}}};}
  };
  return {auth, trigger: (event, session) => listener?.(event, session)};
}
test('no session calls signed out', async () => {
  const events = [];
  const adapter = createInventaSessionAdapter(fakeClient(), {onSignedOut: e => events.push(e)});
  await adapter.ready;
  assert.deepEqual(events, ['INITIAL_SESSION']);
  adapter.dispose();
});
test('valid session emits identity', async () => {
  const user = {id: 'u1'};
  const client = fakeClient({user});
  const events = [];
  const adapter = createInventaSessionAdapter(client, {onSession: v => events.push(v.user.id)});
  await adapter.ready;
  assert.deepEqual(events, ['u1']);
  adapter.dispose();
});
test('sign out and dispose stop further updates', async () => {
  const client = fakeClient();
  const events = [];
  const adapter = createInventaSessionAdapter(client, {onSignedOut: e => events.push(e)});
  await adapter.ready;
  client.trigger('SIGNED_OUT', null);
  await tick();
  adapter.dispose();
  client.trigger('SIGNED_OUT', null);
  await tick();
  assert.deepEqual(events, ['INITIAL_SESSION', 'SIGNED_OUT']);
});
