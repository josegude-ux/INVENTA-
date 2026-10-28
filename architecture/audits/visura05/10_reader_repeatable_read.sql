-- VISURA 05 / PR #22 fixture. Never run against real databases.
-- Begin the consistent snapshot BEFORE the second session publishes a new BC batch.
\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $audit$
DECLARE v_batch uuid; v_stock numeric(20,6); v_count bigint;
BEGIN
 SELECT batch_id INTO v_batch FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_01_COR';
 IF v_batch IS DISTINCT FROM 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid
 THEN RAISE EXCEPTION 'wrong initial batch in reader'; END IF;
 SELECT stock_calculated INTO v_stock FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_01_COR' AND product_code='0000123'
   AND location_code='A-01' AND lot='';
 IF v_stock IS DISTINCT FROM 12.25
 THEN RAISE EXCEPTION 'wrong initial stock in reader'; END IF;
 SELECT count(*) INTO v_count FROM visura_shared.prepara_fixed_import_provenance_v1
 WHERE warehouse_code='COR_01_COR' AND import_id=v_batch
   AND stock_expected_rows=1 AND stock_validated_rows=1
   AND stock_rows=1 AND state='published';
 IF v_count<>1 THEN RAISE EXCEPTION 'initial provenance not coherent'; END IF;
END;
$audit$;
\! touch /tmp/visura05_reader_ready
-- The writer's separate transaction commits here; hold the snapshot open.
\! timeout 30 sh -c 'until test -f /tmp/visura05_writer_published; do sleep 0.1; done'
DO $audit$
DECLARE v_batch uuid; v_stock numeric(20,6); v_count bigint; v_nar uuid;
BEGIN
 SELECT batch_id INTO v_batch FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_01_COR';
 IF v_batch IS DISTINCT FROM 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid
 THEN RAISE EXCEPTION 'torn snapshot: pointer changed inside REPEATABLE READ'; END IF;
 SELECT stock_calculated INTO v_stock FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_01_COR' AND product_code='0000123'
   AND location_code='A-01' AND lot='';
 IF v_stock IS DISTINCT FROM 12.25
 THEN RAISE EXCEPTION 'torn snapshot: reader saw newer stock'; END IF;
 SELECT count(*) INTO v_count FROM visura_shared.prepara_fixed_import_provenance_v1
 WHERE warehouse_code='COR_01_COR' AND import_id=v_batch
   AND state='published' AND stock_expected_rows=1 AND stock_rows=1;
 IF v_count<>1 THEN RAISE EXCEPTION 'torn snapshot: provenance crossed commits'; END IF;
 SELECT batch_id INTO v_nar FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_02_NAR';
 IF v_nar IS DISTINCT FROM 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid
 THEN RAISE EXCEPTION 'other warehouse pointer changed'; END IF;
END;
$audit$;
COMMIT;
SELECT 'VISURA05_REPEATABLE_READ_SNAPSHOT_OK' AS result;
