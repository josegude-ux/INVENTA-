#!/usr/bin/env bash
# INVENTA TRAMOS LAB ONLY · dos Supervisores asignan a la vez tramos que se solapan.
set -euo pipefail
[ "${PGDATABASE:-}" = "inventa_tramos_test" ] || { echo "INVENTA TRAMOS LAB ONLY: base rechazada"; exit 1; }
SUP=00000000-0000-4000-8000-0000000000b1
CAMP=00000000-0000-4000-8000-00000000ca01
FP=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$SUP',false)" -c "set role authenticated" \
  -c "select inventa.preview_segment('$CAMP','K10-P01','K10-P08')->>'fingerprint'" | tail -1)
assign() { # $1 persona, $2 espera dentro de la transacción
 psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
select set_config('request.jwt.claim.sub','$SUP',false);
set role authenticated;
begin;
select inventa.assign_segment(gen_random_uuid(),'$CAMP','K10-P01','K10-P08',1::smallint,'$1',null,'$FP');
select pg_sleep($2);
commit;
SQL
}
assign 00000000-0000-4000-8000-0000000000c1 2 >/tmp/tramos-a.log 2>&1 & A=$!
sleep 0.5
set +e
assign 00000000-0000-4000-8000-0000000000c3 0 >/tmp/tramos-b.log 2>&1; B=$?
wait $A; A_RC=$?
set -e
cat /tmp/tramos-a.log /tmp/tramos-b.log
[ $A_RC -eq 0 ] || { echo "FALLO: la primera asignación debía completarse"; exit 1; }
[ $B -ne 0 ] && grep -q 'ya están asignadas en este recuento' /tmp/tramos-b.log || { echo "FALLO: la segunda debía rechazarse por solape"; exit 1; }
N=$(psql -X -qAt -c "select count(*) from inventa.segment_locations where campaign_id='$CAMP' and active and location_code like 'K10-%'")
[ "$N" = "8" ] || { echo "FALLO: se esperaban 8 ubicaciones K10 activas, hay $N"; exit 1; }
echo "OK: dos asignaciones simultáneas solapadas → una gana, la otra se rechaza sin duplicar"
