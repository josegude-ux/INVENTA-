import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const roles = require('../lib/roles.js');

test('normalizeRole maps demo labels', () => {
  assert.equal(roles.normalizeRole('Operario 1'), 'operario');
  assert.equal(roles.normalizeRole('Supervisor (demo)'), 'supervisor');
  assert.equal(roles.normalizeRole('Administrador (demo)'), 'administrador');
  assert.equal(roles.normalizeRole('admin'), 'administrador');
});

test('operario blocked from consult during active campaign', () => {
  assert.equal(roles.canConsultDuringCampaign('operario', true), false);
  assert.equal(roles.canConsultDuringCampaign('supervisor', true), true);
  assert.equal(roles.canConsultDuringCampaign('administrador', true), true);
  assert.equal(roles.canConsultDuringCampaign('operario', false), true);
});

test('theoretical stock only for staff', () => {
  assert.equal(roles.canSeeTheoretical('operario', true), false);
  assert.equal(roles.canSeeTheoretical('operario', false), false);
  assert.equal(roles.canSeeTheoretical('supervisor', true), true);
  assert.equal(roles.canSeeTheoretical('administrador', false), true);
});

test('warehouse and admin gates', () => {
  assert.equal(roles.canManageWarehouse('operario'), false);
  assert.equal(roles.canManageWarehouse('supervisor'), true);
  assert.equal(roles.canAdministerUsers('supervisor'), false);
  assert.equal(roles.canAdministerUsers('administrador'), true);
  assert.equal(roles.canOpenCloseCampaign('administrador'), true);
  assert.equal(roles.canResolveIncidents('supervisor'), true);
});

test('pair session rules preserved', () => {
  const rules = roles.pairSessionRules();
  assert.equal(rules.oneDevice, true);
  assert.equal(rules.oneResult, true);
  assert.equal(rules.identifyBothAtStart, true);
  assert.equal(rules.noDoubleConfirmPerArticle, true);
});
