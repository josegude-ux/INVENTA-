-- Disposable PG16 only, after holder has committed.
\set ON_ERROR_STOP on
DO $test$
BEGIN
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
     WHERE warehouse_code='COR_01_COR') <>
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid THEN
    RAISE EXCEPTION 'contending session changed the COR pointer';
 END IF;
 IF (SELECT count(*) FROM visura_shared.bc_publication_events)<>1 THEN
    RAISE EXCEPTION 'contending session unexpectedly wrote audit';
 END IF;
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
     WHERE warehouse_code='COR_02_NAR') <>
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid THEN
    RAISE EXCEPTION 'contending session changed the Ferrol pointer';
 END IF;
END;
$test$;
SELECT 'WAREHOUSE_CONCURRENT_ISOLATION_OK' AS result;
