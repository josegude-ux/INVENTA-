#!/usr/bin/env bash
# VISURA INVENTA 07 — concurrent start of original pair on PostgreSQL 16 TEST DB ONLY.
set -euo pipefail
if [[ "$PGDATABASE" != "inventa07_test" ]]; then
  echo "INVENTA07 LAB ONLY: wrong database"; exit 1
fi
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO inventa07_lab.assignments(campaign_id,location_code,actor_id,active) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P04',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P04',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
INSERT INTO inventa07_lab.device_sessions(id,actor_id,device_id) VALUES
 ('91000000-0000-4000-8000-000000000040',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'd0000000-0000-4000-8000-000000000040'),
 ('92000000-0000-4000-8000-000000000040',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'd0000000-0000-4000-8000-000000000040');
INSERT INTO inventa07_lab.team_terminals(team_id,campaign_id,location_code,
 device_id,original_a,original_b) VALUES
 ('f0000000-0000-4000-8000-000000000040',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P04',
  'd0000000-0000-4000-8000-000000000040',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SQL
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
one(){
 local actor="$1" session="$2" mutation="$3"
 psql -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','$actor',true);
SELECT set_config('request.jwt.claim.session_id','$session',true);
SELECT inventa07_lab.team_operate(
 'f0000000-0000-4000-8000-000000000040',
 'activate','pair',0,'$mutation');
COMMIT;
SQL
}
one 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' \
 '91000000-0000-4000-8000-000000000040' \
 '80000000-0000-4000-8000-000000000040' >"$dir/A" 2>&1 & a=$!
one 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' \
 '92000000-0000-4000-8000-000000000040' \
 '80000000-0000-4000-8000-000000000041' >"$dir/B" 2>&1 & b=$!
rca=0;rcb=0
wait "$a" || rca=$?
wait "$b" || rcb=$?
if [[ "$rca" == "$rcb" ]]; then
  echo "Expected one authenticated session to acquire lease; A=$rca B=$rcb"
  cat "$dir/A" "$dir/B"; exit 1
fi
if [[ "$rca" != 0 ]] && ! grep -q "Stale team revision" "$dir/A"; then
 echo "A failed for the wrong reason"; cat "$dir/A"; exit 1
fi
if [[ "$rcb" != 0 ]] && ! grep -q "Stale team revision" "$dir/B"; then
 echo "B failed for the wrong reason"; cat "$dir/B"; exit 1
fi
actual=$(psql -XAt -v ON_ERROR_STOP=1 -c "SELECT t.revision || ':' ||
 (SELECT count(*) FROM inventa07_lab.team_terminal_events e
 WHERE e.team_id=t.team_id) || ':' || t.mode
 FROM inventa07_lab.team_terminals t
 WHERE t.team_id='f0000000-0000-4000-8000-000000000040'")
if [[ "$actual" != "1:1:pair" ]]; then
 echo "Bad concurrent lease outcome: $actual"; exit 1
fi
echo "PASS concurrent team activation: one lease, one immutable event, $actual"
