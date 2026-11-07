-- VISURA 04: transaction rollback with fictional stock, disposable PG16 only.
-- This is NOT a business-facing restore procedure or deployed function.
\set ON_ERROR_STOP on
BEGIN;
SELECT visura_shared.publish_bc_batch_isolated(
 'ffffffff-ffff-4fff-8fff-fffffffffff6'::uuid,'COR_01_COR',
 '11111111-1111-4111-8111-111111111111'::uuid,
 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid
);
DO $test$
BEGIN
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
   WHERE warehouse_code='COR_01_COR') <>
   'ffffffff-ffff-4fff-8fff-fffffffffff6'::uuid THEN
   RAISE EXCEPTION 'publication did not enter test transaction';
 END IF;
 IF (SELECT count(*) FROM visura_shared.bc_publication_events)<>2 THEN
   RAISE EXCEPTION 'audit event missing from test transaction';
 END IF;
END;
$test$;
ROLLBACK;

DO $test$
BEGIN
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
   WHERE warehouse_code='COR_01_COR') <>
   'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid THEN
   RAISE EXCEPTION 'rollback did not restore prior pointer';
 END IF;
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
   WHERE warehouse_code='COR_02_NAR') <>
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid THEN
   RAISE EXCEPTION 'rollback affected independent warehouse';
 END IF;
 IF (SELECT count(*) FROM visura_shared.bc_publication_events)<>1 THEN
   RAISE EXCEPTION 'rollback left phantom audit event';
 END IF;
 IF (SELECT state FROM visura_shared.bc_batches
   WHERE id='dddddddd-dddd-4ddd-8ddd-ddddddddddd4')<>'published' THEN
   RAISE EXCEPTION 'rollback did not restore old batch state';
 END IF;
 IF (SELECT state FROM visura_shared.bc_batches
   WHERE id='ffffffff-ffff-4fff-8fff-fffffffffff6')<>'validated' THEN
   RAISE EXCEPTION 'rollback left unpublished batch marked published';
 END IF;
END;
$test$;
SELECT 'VISURA_PUBLICATION_ROLLBACK_TRANSACTION_OK' AS result;
