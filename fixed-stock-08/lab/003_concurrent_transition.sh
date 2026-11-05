#!/usr/bin/env bash
# Exclusivo del servicio PostgreSQL descartable de GitHub Actions.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "inventa08_test" ]]; then
 echo "INVENTA08 LAB ONLY: wrong database" >&2
 exit 1
fi
scratch="$(mktemp -d)"
first=""
cleanup() {
 if [[ -n "$first" ]]; then kill "$first" 2>/dev/null || true; fi
 rm -rf "$scratch"
}
trap cleanup EXIT
ready="$scratch/row-locked"
# Transacción A bloquea una única asociación; señal al proceso B
# cuando ya tomó la fila y está reteniendo la transacción abierta.
psql -X -v ON_ERROR_STOP=1 >"$scratch/a.log" 2>&1 <<SQL &
BEGIN;
SELECT inv08_disposable.transition(id,1,'RETIRAR','CAMBIO_OPERATIVO',null,'admin-A')
FROM inv08_disposable.associations
WHERE warehouse='COR_01_COR' AND product_code='00200' AND location_code='K02';
\! touch $ready
SELECT pg_sleep(3);
COMMIT;
SQL
first=$!
for _ in {1..80}; do
 [[ -f "$ready" ]] && break
 if ! kill -0 "$first" 2>/dev/null; then
  cat "$scratch/a.log"; echo "Writer A terminó antes de adquirir el bloqueo" >&2;exit 1
 fi
 sleep .1
done
if [[ ! -f "$ready" ]]; then
 cat "$scratch/a.log"
 echo "Writer A did not signal row lock" >&2;exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "
SELECT inv08_disposable.transition(id,1,'RETIRAR','REUBICACION',null,'admin-B')
FROM inv08_disposable.associations
WHERE warehouse='COR_01_COR' AND product_code='00200' AND location_code='K02';
" >"$scratch/b.log" 2>&1; then
 echo "ERROR: ambos escritores confirmaron la misma revisión" >&2
 exit 1
fi
grep -q "REVISION_CONFLICT" "$scratch/b.log" || { cat "$scratch/b.log";exit 1; }
wait "$first"
first=""
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $check$
DECLARE c integer; is_active boolean; ver integer; actor_name text;
BEGIN
 IF current_database()<>'inventa08_test' THEN RAISE EXCEPTION 'INVENTA08 LAB ONLY'; END IF;
 SELECT active,revision INTO STRICT is_active,ver FROM inv08_disposable.associations
 WHERE warehouse='COR_01_COR' AND product_code='00200' AND location_code='K02';
 IF is_active OR ver<>2 THEN RAISE EXCEPTION 'LOST_UPDATE'; END IF;
 SELECT count(*),max(actor) INTO c,actor_name FROM inv08_disposable.history
 WHERE product_code='00200' AND location_code='K02' AND warehouse='COR_01_COR';
 IF c<>1 OR actor_name<>'admin-A' THEN RAISE EXCEPTION 'AUDIT_DUPLICATED'; END IF;
 RAISE NOTICE 'INVENTA08 CONCURRENCY PASS: first writer committed, second rejected';
END
$check$;
SQL
