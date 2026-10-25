import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicacionesPermitidas } from './app-access.js';

function cliente({ user = { id: 'usuario-prueba' }, rows = [], authError = null, queryError = null } = {}) {
  const filters = {};
  const query = {
    select(columns) { assert.equal(columns, 'app_id,app_role'); return this; },
    eq(field, value) {
      filters[field] = value;
      if (Object.keys(filters).length === 2) {
        return Promise.resolve({ data: rows.filter(row => row.user_id === filters.user_id && row.enabled === filters.enabled), error: queryError });
      }
      return this;
    }
  };
  return {
    auth: { async getUser() { return { data: { user }, error: authError }; } },
    from(table) { assert.equal(table, 'moventa_app_access'); return query; }
  };
}

test('muestra INVENTA y KONTROLA al usuario autorizado', async () => {
  const rows = [
    { user_id: 'usuario-prueba', app_id: 'inventa', app_role: 'viewer', enabled: true },
    { user_id: 'usuario-prueba', app_id: 'kontrola', app_role: 'viewer', enabled: true }
  ];
  assert.deepEqual((await aplicacionesPermitidas(cliente({ rows }))).map(x => x.app_id), ['inventa', 'kontrola']);
});
test('no muestra permisos de otro usuario ni aplicaciones deshabilitadas', async () => {
  const rows = [
    { user_id: 'otro', app_id: 'inventa', enabled: true },
    { user_id: 'usuario-prueba', app_id: 'kontrola', enabled: false }
  ];
  assert.deepEqual(await aplicacionesPermitidas(cliente({ rows })), []);
});
test('sin sesión no devuelve aplicaciones', async () => {
  assert.deepEqual(await aplicacionesPermitidas(cliente({ user: null })), []);
});
test('propaga errores de consulta', async () => {
  await assert.rejects(aplicacionesPermitidas(cliente({ queryError: new Error('RLS') })), /RLS/);
});
