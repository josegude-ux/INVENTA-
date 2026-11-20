#!/usr/bin/env bash
# Disposable PostgreSQL only. Parallel sessions validate a compare-and-swap revision.
set -euo pipefail
base=$(mktemp -d)
trap 'rm -rf "$base"' EXIT
run_one() {
  local suffix="$1" quantity="$2"
  psql -X -v ON_ERROR_STOP=1 <<SQL
SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
SELECT inventa07_lab.apply_reference(
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0002','draft',
 '20000000-0000-4000-8000-00000000000$suffix',0,$quantity,false,NULL);
SQL
}
run_one 1 5 >"$base/one.log" 2>&1 & pid1=$!
run_one 2 9 >"$base/two.log" 2>&1 & pid2=$!
rc1=0; rc2=0
wait "$pid1" || rc1=$?
wait "$pid2" || rc2=$?
if [[ "$rc1" == "$rc2" ]]; then
 echo "Expected exactly one successful competing write: rc1=$rc1 rc2=$rc2"
 cat "$base/one.log" "$base/two.log"
 exit 1
fi
if [[ "$rc1" != 0 ]] && ! grep -q "Stale reference revision" "$base/one.log"; then
 echo "First competing write failed for unexpected reason"; cat "$base/one.log"; exit 1
fi
if [[ "$rc2" != 0 ]] && ! grep -q "Stale reference revision" "$base/two.log"; then
 echo "Second competing write failed for unexpected reason"; cat "$base/two.log"; exit 1
fi
actual=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT revision || ':' || draft_qty || ':' || (SELECT count(*) FROM inventa07_lab.mutation_receipts WHERE mutation_id::text LIKE '20000000-%') FROM inventa07_lab.reference_states WHERE campaign_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND location_code='K00-P01' AND product_code='SKU0002'")
case "$actual" in
  1:5.000:1|1:9.000:1) echo "PASS concurrent CAS: $actual" ;;
  *) echo "Unexpected CAS state: $actual"; exit 1 ;;
esac
