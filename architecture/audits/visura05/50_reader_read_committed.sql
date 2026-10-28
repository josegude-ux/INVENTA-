-- VISURA 05 negative control: READ COMMITTED is NOT a coherent multi-query snapshot.
\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ ONLY;
DO $audit$
DECLARE v_batch uuid; v_stock numeric(20,6);
BEGIN
 SELECT batch_id INTO v_batch FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_01_COR';
 IF v_batch IS DISTINCT FROM 'ffffffff-ffff-4fff-8fff-fffffffffff6'::uuid
 THEN RAISE EXCEPTION 'unexpected initial pointer in READ COMMITTED fixture'; END IF;
 SELECT stock_calculated INTO v_stock FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_01_COR' AND product_code='0000123'
 AND location_code='A-01' AND lot='';
 IF v_stock IS DISTINCT FROM 7 THEN RAISE EXCEPTION 'unexpected initial quantity'; END IF;
END;
$audit$;
\! touch /tmp/visura05_rc_ready
\! timeout 30 sh -c 'until test -f /tmp/visura05_rc_published; do sleep 0.1; done'
-- In READ COMMITTED these *separate* SQL statements see a later committed batch.
-- A gateway combining previous pointer and these newer lines could fabricate a hybrid snapshot.
DO $audit$
DECLARE v_batch uuid; v_stock numeric(20,6); v_nar uuid;
BEGIN
 SELECT batch_id INTO v_batch FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_01_COR';
 IF v_batch IS DISTINCT FROM '77777777-7777-4777-8777-777777777777'::uuid
 THEN RAISE EXCEPTION 'negative control did not observe changed pointer'; END IF;
 SELECT stock_calculated INTO v_stock FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_01_COR' AND product_code='0000123'
 AND location_code='A-01' AND lot='';
 IF v_stock IS DISTINCT FROM -3.5
 THEN RAISE EXCEPTION 'negative control did not observe changed stock'; END IF;
 SELECT batch_id INTO v_nar FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_02_NAR';
 IF v_nar IS DISTINCT FROM 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid
 THEN RAISE EXCEPTION 'secondary warehouse unexpectedly changed'; END IF;
END;
$audit$;
COMMIT;
SELECT 'VISURA05_READ_COMMITTED_OBSERVED_TWO_BATCHES_OK' AS result;
