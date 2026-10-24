import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = readFileSync(join(root, 'supabase/migrations/001_inventa_schema.sql'), 'utf8');
const rls = readFileSync(join(root, 'supabase/migrations/002_inventa_rls.sql'), 'utf8');

test('schema defines three roles and campaign kinds', () => {
  assert.match(schema, /inventa_role as enum \('operario', 'supervisor', 'administrador'\)/);
  assert.match(schema, /campaign_kind as enum \('microrecuento', 'inventario_anual'\)/);
  assert.match(schema, /count_mode as enum \('single', 'pair'\)/);
  assert.match(schema, /create table public\.stock_snapshots/);
  assert.match(schema, /create table public\.count_session_members/);
  assert.match(schema, /create table public\.incidents/);
  assert.match(schema, /create table public\.sync_outbox/);
});

test('RLS enables stock_snapshots and guards operator reads', () => {
  assert.match(rls, /alter table public\.stock_snapshots enable row level security/);
  assert.match(rls, /stock_snapshots_select_guarded/);
  assert.match(rls, /not public\.has_active_campaign\(\)/);
  assert.match(rls, /public\.is_staff\(\)/);
  assert.match(rls, /revoke all on table public\.stock_snapshots from anon/);
});

test('pair model: session members table present', () => {
  assert.match(schema, /count_session_members/);
  assert.match(schema, /Pareja = dos filas/);
});

test('idempotent client_id unique constraints', () => {
  assert.match(schema, /unique \(campaign_id, client_id\)/);
  assert.match(schema, /create table public\.count_entries/);
  assert.match(schema, /create table public\.movements/);
});
