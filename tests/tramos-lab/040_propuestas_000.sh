#!/usr/bin/env bash
# INVENTA TRAMOS LAB ONLY · prueba los scripts de supabase/propuestas-000 en bases desechables.
# Requiere PGDATABASE=inventa_tramos_test (ya con run.sh ejecutado) y permiso para crear inventa_f2_test.
set -euo pipefail
[ "${PGDATABASE:-}" = "inventa_tramos_test" ] || { echo "INVENTA TRAMOS LAB ONLY: base rechazada"; exit 1; }
ROOT=$(cd "$(dirname "$0")/../.." && pwd); P="$ROOT/supabase/propuestas-000"; F2="${F2_CONTRACT:-}"
q(){ psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
# 1. Reversión de tramos: con tramos debe negarse; sin ellos, deja el esquema de 0.30.12.
if q -f "$P/tramos_reversion.sql" >/tmp/rev1.log 2>&1; then echo "FALLO: la reversión debía bloquearse con tramos"; exit 1; fi
grep -q 'Reversión bloqueada' /tmp/rev1.log && echo "OK: reversión bloqueada mientras hay tramos"
q -c "set session_replication_role=replica; delete from public.counts where cycle<>1; truncate public.segment_actions; update public.assignments set segment_id=null; delete from public.segment_locations; delete from public.segments;" >/dev/null
q -f "$P/tramos_reversion.sql" >/dev/null
[ "$(q -c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'segment%'")" = "0" ] && echo "OK: tablas de tramos retiradas"
[ "$(q -c "select count(*) from information_schema.columns where table_schema='public' and ((table_name='counts' and column_name='cycle') or (table_name='assignments' and column_name in ('active','segment_id')))")" = "0" ] && echo "OK: columnas añadidas retiradas"
[ "$(q -c "select count(*) from pg_policies where tablename='assignments' and policyname='assignments_manager_insert'")" = "1" ] && echo "OK: política original de asignaciones restaurada"
[ "$(q -c "select pg_get_expr(polwithcheck,polrelid) ~ 'active' from pg_policy where polname='counts_insert'")" = "f" ] && echo "OK: counts_insert vuelve a la versión 0.30.12"
q -f "$ROOT/supabase/migrations/20261117220000_inventa_fase_b_tramos.sql" >/dev/null && echo "OK: la migración se puede volver a aplicar tras revertir"
# 2. F2: aplicar contrato en otra base desechable, comprobar guarda y retirada.
[ -n "$F2" ] || { echo "NO EJECUTADO: F2_CONTRACT no indicado"; exit 0; }
psql -X -q -d postgres -c "drop database if exists inventa_f2_test" -c "create database inventa_f2_test" >/dev/null
f(){ psql -X -qAt -v ON_ERROR_STOP=1 -d inventa_f2_test "$@"; }
sed 's/inventa_tramos_test/inventa_f2_test/' "$ROOT/tests/tramos-lab/000_supabase_stub.sql" | f >/dev/null
for m in 20261024034448_inventa_core_secure_roles 20261024034818_inventa_harden_snapshot_and_corrections 20261024104814_inventa_approved_accounts_and_permission_guards 20261024105059_inventa_admin_verified_account_directory; do f -f "$ROOT/supabase/migrations/$m.sql" >/dev/null; done
f -f "$F2" >/dev/null && echo "OK: contrato F2 aplicado en base desechable"
f -c "insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-0000000000f1','f2@lab.invalid',now()); insert into public.f2_k_actions(mutation_id,actor_id,action,request,result) values(gen_random_uuid(),'00000000-0000-4000-8000-0000000000f1','lab','{}','{}')" >/dev/null
if f -f "$P/f2_k_retirada.sql" >/tmp/f2r.log 2>&1; then echo "FALLO: la retirada debía bloquearse con datos"; exit 1; fi
grep -q 'Retirada bloqueada' /tmp/f2r.log && echo "OK: retirada bloqueada si f2_k_* tiene datos"
f -c "delete from public.f2_k_actions" >/dev/null
f -f "$P/f2_k_congelar.sql" >/dev/null
[ "$(f -c "select has_function_privilege('authenticated','public.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric)','EXECUTE')")" = "f" ] && echo "OK: congelar quita la ejecución a autenticados"
f -f "$P/f2_k_retirada.sql" >/dev/null
[ "$(f -c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'f2_k_%'")" = "0" ] && [ "$(f -c "select count(*) from pg_proc where proname='f2_k_command'")" = "0" ] && echo "OK: retirada de F2 completa (tablas vacías)"
psql -X -q -d postgres -c "drop database inventa_f2_test" >/dev/null
echo "PROPUESTAS 000: PRUEBAS COMPLETAS"
