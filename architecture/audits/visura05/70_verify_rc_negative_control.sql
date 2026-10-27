-- VISURA 05: database remains coherent; only a READ COMMITTED multi-query consumer can tear its view.
\set ON_ERROR_STOP on
DO $audit$
DECLARE v_qty numeric(20,6); v_events bigint; v_count bigint;
BEGIN
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_01_COR') IS DISTINCT FROM
 '77777777-7777-4777-8777-777777777777'::uuid
 THEN RAISE EXCEPTION 'expected final pointer missing'; END IF;
 SELECT stock_calculated INTO v_qty FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_01_COR' AND product_code='0000123'
 AND location_code='A-01' AND lot='';
 IF v_qty IS DISTINCT FROM -3.5
 THEN RAISE EXCEPTION 'final stock not committed correctly'; END IF;
 SELECT count(*) INTO v_count FROM visura_shared.prepara_fixed_import_provenance_v1
 WHERE warehouse_code='COR_01_COR'
 AND import_id='77777777-7777-4777-8777-777777777777'
 AND stock_rows=1 AND state='published';
 IF v_count<>1 THEN RAISE EXCEPTION 'final provenance missing'; END IF;
 SELECT count(*) INTO v_events FROM visura_shared.bc_publication_events
 WHERE warehouse_code='COR_01_COR';
 IF v_events<>3 THEN RAISE EXCEPTION 'expected 3 synthetic publication audit events'; END IF;
END;
$audit$;
SELECT 'VISURA05_RC_DATABASE_INTEGRITY_OK' AS result;
