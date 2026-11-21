#!/usr/bin/env bash
# INVENTA TRAMOS LAB ONLY · prueba supabase/visura-unificado-pendiente/reversion_tramos.sql.
# Requiere PGDATABASE=inventa_tramos_test con run.sh ya ejecutado.
set -euo pipefail
[ "${PGDATABASE:-}" = "inventa_tramos_test" ] || { echo "INVENTA TRAMOS LAB ONLY: base rechazada"; exit 1; }
ROOT=$(cd "$(dirname "$0")/../.." && pwd); P="$ROOT/supabase/visura-unificado-pendiente"
q(){ psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
# eq <obtenido> <esperado> <mensaje>: falla el script si no coincide.
eq(){ if [ "$1" = "$2" ]; then echo "OK: $3"; else echo "FALLO: $3 (obtenido $1, esperado $2)"; exit 1; fi; }
if q -f "$P/reversion_tramos.sql" >/tmp/rev1.log 2>&1; then echo "FALLO: la reversión debía bloquearse con tramos"; exit 1; fi
grep -q 'Reversión bloqueada' /tmp/rev1.log || { echo "FALLO: mensaje de bloqueo"; exit 1; }; echo "OK: reversión bloqueada mientras hay tramos"
q -c "set session_replication_role=replica; delete from inventa.counts where cycle<>1; truncate inventa.segment_actions; update inventa.assignments set segment_id=null; delete from inventa.segment_locations; delete from inventa.segments;" >/dev/null
q -f "$P/reversion_tramos.sql" >/dev/null
eq "$(q -c "select count(*) from information_schema.tables where table_schema='inventa' and table_name like 'segment%'")" "0" "tablas de tramos retiradas"
eq "$(q -c "select count(*) from information_schema.columns where table_schema='inventa' and ((table_name='counts' and column_name='cycle') or (table_name='assignments' and column_name in ('active','segment_id')))")" "0" "columnas añadidas retiradas"
eq "$(q -c "select count(*) from pg_policies where schemaname='inventa' and tablename='assignments' and policyname='assignments_manager_insert'")" "1" "política original de asignaciones restaurada"
eq "$(q -c "select pg_get_expr(polwithcheck,polrelid) ~ 'a\.active' from pg_policy where polname='counts_insert'")" "f" "counts_insert vuelve a la versión de la unificación"
eq "$(q -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('inventa','inventa_internal') and p.proname ~ 'segment|my_segments|location_sort_key|location_shape|counts_set_cycle|require_(person|blind)'")" "0" "funciones de tramos retiradas"
q -f "$ROOT/supabase/visura-unificado/20261118221403_inventa_tramos.sql" >/dev/null && echo "OK: la migración se puede volver a aplicar tras revertir"
echo "REVERSIÓN: PRUEBAS COMPLETAS"
