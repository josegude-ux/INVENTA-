#!/usr/bin/env bash
# Prueba de permisos SQL efímeros; NO valida JWT, Supabase Auth o RLS real.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "inventa08_test" ]]; then
 echo "INVENTA08 LAB ONLY: wrong database" >&2;exit 1
fi
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
psql -X -v ON_ERROR_STOP=1 -c "
SET ROLE inv08_lab_reader;
SELECT count(*) AS published_rows FROM inv08_disposable.stock_lines;
SELECT count(*) AS audited_events FROM inv08_disposable.history;" >"$scratch/reader.log" 2>&1
if psql -X -v ON_ERROR_STOP=1 -c "
SET ROLE inv08_lab_operator;
SELECT count(*) FROM inv08_disposable.stock_lines;" >"$scratch/operator.log" 2>&1;then
 echo "ERROR: role operator could read theoretical BC stock" >&2;exit 1
fi
grep -qi 'permission denied' "$scratch/operator.log" || { cat "$scratch/operator.log";exit 1; }
if psql -X -v ON_ERROR_STOP=1 -c "
SET ROLE inv08_lab_operator;
SELECT count(*) FROM inv08_disposable.history;" >"$scratch/events.log" 2>&1;then
 echo "ERROR: role operator could read admin history" >&2;exit 1
fi
grep -qi 'permission denied' "$scratch/events.log" || { cat "$scratch/events.log";exit 1; }
if psql -X -v ON_ERROR_STOP=1 -c "
SET ROLE inv08_lab_reader;
UPDATE inv08_disposable.active_batch SET certified=false
WHERE warehouse='COR_01_COR';" >"$scratch/write.log" 2>&1;then
 echo "ERROR: admin read role could modify BC publication" >&2;exit 1
fi
grep -qi 'permission denied' "$scratch/write.log" || { cat "$scratch/write.log";exit 1; }
psql -X -At -v ON_ERROR_STOP=1 -c "
SELECT certified FROM inv08_disposable.active_batch WHERE warehouse='COR_01_COR';" |
 grep -qx 't'
echo "INVENTA08 ROLE LAB PASS: admin read-only, operator cannot read BC theoretical"
