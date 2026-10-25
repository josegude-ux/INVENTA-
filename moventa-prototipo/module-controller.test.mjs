import test from 'node:test';
import assert from 'node:assert/strict';
import {createModuleController} from './module-controller.js';

test('denies missing session without mounting', async () => {
  let mounts = 0;
  const c = createModuleController({authorize: async () => true, mount: async () => { mounts++; }, unmount: async () => {}});
  assert.equal(await c.open(null, 'inventa'), false);
  assert.equal(mounts, 0);
});
test('denies when permission is missing', async () => {
  let mounts = 0;
  const c = createModuleController({authorize: async () => false, mount: async () => { mounts++; }, unmount: async () => {}});
  assert.equal(await c.open({id:'u1'}, 'inventa'), false);
  assert.equal(mounts, 0);
});
test('opens authorized module and closes on signout', async () => {
  let mounted = false;
  const c = createModuleController({authorize: async () => true, mount: async () => { mounted = true; }, unmount: async () => { mounted = false; }});
  assert.equal(await c.open({id:'u1'}, 'inventa'), true);
  assert.equal(c.active, true);
  await c.close('signed-out');
  assert.equal(c.active, false);
  assert.equal(mounted, false);
});
test('authorization errors fail closed', async () => {
  let mounts = 0;
  const c = createModuleController({authorize: async () => { throw new Error('network'); }, mount: async () => { mounts++; }, unmount: async () => {}});
  assert.equal(await c.open({id:'u1'}, 'kontrola'), false);
  assert.equal(mounts, 0);
});
