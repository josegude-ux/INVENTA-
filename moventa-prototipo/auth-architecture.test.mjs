import test from 'node:test';
import assert from 'node:assert/strict';
import { puedeReutilizarSesion, estadoIntegracion } from './auth-architecture.mjs';

test('INVENTA y MOVENTA comparten proyecto de autenticación', () => {
  assert.equal(puedeReutilizarSesion('moventa', 'inventa'), true);
});
test('KONTROLA no admite reutilización directa de sesión MOVENTA', () => {
  assert.equal(puedeReutilizarSesion('moventa', 'kontrola'), false);
});
test('un permiso del lanzador no equivale a sesión compartida', () => {
  assert.deepEqual(estadoIntegracion('inventa', [{ app_id: 'inventa' }]), {
    visible: true, sesionCompartida: false, requiereFederacion: false
  });
  assert.deepEqual(estadoIntegracion('kontrola', [{ app_id: 'kontrola' }]), {
    visible: true, sesionCompartida: false, requiereFederacion: true
  });
});
test('módulos no asignados y desconocidos no son visibles', () => {
  assert.equal(estadoIntegracion('kontrola', []).visible, false);
  assert.equal(estadoIntegracion('desconocida', [{ app_id: 'desconocida' }]).visible, false);
  assert.equal(puedeReutilizarSesion('moventa', 'desconocida'), false);
});
