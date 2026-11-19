#!/usr/bin/env bash
# INVENTA TRAMOS LAB ONLY · aplica las migraciones de la unificación (esquema inventa) y la de tramos
# sobre una base PostgreSQL desechable, y ejecuta las pruebas.
# Uso: PGDATABASE=inventa_tramos_test bash tests/tramos-lab/run.sh   (base recién creada y vacía)
set -euo pipefail
[ "${PGDATABASE:-}" = "inventa_tramos_test" ] || { echo "INVENTA TRAMOS LAB ONLY: PGDATABASE debe ser inventa_tramos_test"; exit 1; }
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LAB="$ROOT/tests/tramos-lab"
run(){ echo "▶ $1"; psql -X -q -v ON_ERROR_STOP=1 -f "$1"; }
# Las migraciones se aplican cada una en una transacción, como apply_migration de Supabase.
mig(){ echo "▶ $1"; psql -X -q -1 -v ON_ERROR_STOP=1 -f "$1"; }
run "$LAB/000_supabase_stub.sql"
for m in 20261118004914_visura_acceso_comun 20261118005010_inventa_estructura_unificada \
         20261118005120_inventa_bc_posiciones_f2k 20261118005136_inventa_compat_moventa_app_access \
         20261118083051_inventa_retirada_f2; do
 mig "$ROOT/supabase/visura-unificado/$m.sql"
done
mig "$ROOT/supabase/visura-unificado/20261118221403_inventa_tramos.sql"
run "$LAB/010_fixtures.sql"
run "$LAB/020_tramos_tests.sql" 2>&1 | grep -E 'OK:|FALLO|ERROR|TRAMOS LAB|▶' 
bash "$LAB/030_concurrent_assign.sh"
echo "TRAMOS LAB COMPLETO"
