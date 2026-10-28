-- VISURA 05: after reader COMMIT, a new transaction MUST see the newer whole batch.
\set ON_ERROR_STOP on
DO $audit$
DECLARE v_batch uuid; v_stock numeric(20,6); v_count bigint; v_events bigint;
BEGIN
 SELECT batch_id INTO v_batch FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_01_COR';
 IF v_batch IS DISTINCT FROM 'ffffffff-ffff-4fff-8fff-fffffffffff6'::uuid
 THEN RAISE EXCEPTION 'fresh reader did not see new committed batch'; END IF;
 SELECT stock_calculated INTO v_stock FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_01_COR' AND product_code='0000123'
   AND location_code='A-01' AND lot='';
 IF v_stock IS DISTINCT FROM 7
 THEN RAISE EXCEPTION 'fresh reader got old or fabricated quantity: %',v_stock; END IF;
 SELECT count(*) INTO v_count FROM visura_shared.prepara_fixed_import_provenance_v1
 WHERE warehouse_code='COR_01_COR' AND import_id=v_batch
   AND state='published' AND stock_expected_rows=1
   AND stock_validated_rows=1 AND stock_rows=1;
 IF v_count<>1 THEN RAISE EXCEPTION 'new committed batch/provenance mismatch'; END IF;
 SELECT count(*) INTO v_count FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_02_NAR';
 IF v_count<>0 THEN RAISE EXCEPTION 'incomplete second warehouse leaked stock'; END IF;
 SELECT count(*) INTO v_events FROM visura_shared.bc_publication_events
 WHERE warehouse_code='COR_01_COR';
 IF v_events<>2 THEN RAISE EXCEPTION 'expected exactly two synthetic publication events'; END IF;
END;
$audit$;
SELECT 'VISURA05_NEW_READ_COMMITTED_BATCH_OK' AS result;
