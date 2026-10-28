#!/usr/bin/env bash
# Ensayo de snapshot REPEATABLE READ frente a publicar BC-B en otra sesión.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "inventa08_test" ]]; then
 echo "INVENTA08 LAB ONLY: wrong database" >&2; exit 1
fi
scratch="$(mktemp -d)"
reader=""
cleanup() {
 if [[ -n "$reader" ]]; then kill "$reader" 2>/dev/null || true; fi
 rm -rf "$scratch"
}
trap cleanup EXIT
ready="$scratch/snapshot-taken"
psql -X -At -v ON_ERROR_STOP=1 >"$scratch/reader.log" 2>&1 <<SQL &
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT 'BEFORE='||import_id FROM inv08_disposable.active_batch WHERE warehouse='COR_01_COR';
\! touch $ready
SELECT pg_sleep(3);
SELECT 'AFTER='||import_id FROM inv08_disposable.active_batch WHERE warehouse='COR_01_COR';
SELECT 'TOTAL='||sum(quantity)::text FROM inv08_disposable.stock_lines
 WHERE warehouse='COR_01_COR'
 AND product_code='00100'
 AND import_id=(SELECT import_id FROM inv08_disposable.active_batch WHERE warehouse='COR_01_COR');
COMMIT;
SQL
reader=$!
for _ in {1..80}; do
 [[ -f "$ready" ]] && break
 if ! kill -0 "$reader" 2>/dev/null; then
  cat "$scratch/reader.log";echo "Reader failed before snapshot" >&2;exit 1
 fi
 sleep .1
done
[[ -f "$ready" ]] || { echo "Reader never took snapshot" >&2;exit 1; }
psql -X -v ON_ERROR_STOP=1 -c "
UPDATE inv08_disposable.active_batch
SET import_id='BC-B',published_at=clock_timestamp()
WHERE warehouse='COR_01_COR' AND import_id='BC-A';" >"$scratch/writer.log" 2>&1
wait "$reader"
reader=""
grep -qx 'BEFORE=BC-A' "$scratch/reader.log" || { cat "$scratch/reader.log";exit 1; }
grep -qx 'AFTER=BC-A' "$scratch/reader.log" || { cat "$scratch/reader.log";exit 1; }
grep -Eq '^TOTAL=0(\.0+)?$' "$scratch/reader.log" || { cat "$scratch/reader.log";exit 1; }
psql -X -At -v ON_ERROR_STOP=1 -c "
SELECT 'NOW='||import_id FROM inv08_disposable.active_batch
WHERE warehouse='COR_01_COR';" |grep -qx 'NOW=BC-B'
psql -X -At -v ON_ERROR_STOP=1 -c "
SELECT 'NOWTOTAL='||sum(quantity)::text
FROM inv08_disposable.stock_lines
WHERE warehouse='COR_01_COR' AND product_code='00100'
 AND import_id=(SELECT import_id FROM inv08_disposable.active_batch WHERE warehouse='COR_01_COR');" |
 grep -Eq '^NOWTOTAL=100(\.0+)?$'
echo "INVENTA08 BC SNAPSHOT PASS: session A sees BC-A, fresh session sees BC-B"
