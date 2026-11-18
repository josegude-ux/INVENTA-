#!/usr/bin/env bash
# INVENTA TRAMOS LAB ONLY · aplica migraciones y pruebas sobre una base PostgreSQL desechable.
# Uso: PGDATABASE=inventa_tramos_test bash tests/tramos-lab/run.sh   (base recién creada y vacía)
set -euo pipefail
[ "${PGDATABASE:-}" = "inventa_tramos_test" ] || { echo "INVENTA TRAMOS LAB ONLY: PGDATABASE debe ser inventa_tramos_test"; exit 1; }
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LAB="$ROOT/tests/tramos-lab"
run(){ echo "▶ $1"; psql -X -q -v ON_ERROR_STOP=1 -f "$1"; }
run "$LAB/000_supabase_stub.sql"
for m in 20261024034448_inventa_core_secure_roles 20261024034818_inventa_harden_snapshot_and_corrections \
         20261024104814_inventa_approved_accounts_and_permission_guards 20261024105059_inventa_admin_verified_account_directory \
         20261117220000_inventa_fase_b_tramos; do
 run "$ROOT/supabase/migrations/$m.sql"
done
run "$LAB/010_fixtures.sql"
run "$LAB/020_tramos_tests.sql" 2>&1 | grep -E 'OK:|FALLO|ERROR|TRAMOS LAB|▶' 
bash "$LAB/030_concurrent_assign.sh"
echo "TRAMOS LAB COMPLETO"
