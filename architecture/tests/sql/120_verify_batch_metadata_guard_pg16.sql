-- VISURA 04 batch header / state machine tests — PostgreSQL 16 disposable.
\set ON_ERROR_STOP on
INSERT INTO visura_shared.bc_batches
(id,warehouse_code,file_name,file_sha256,expected_rows,state,created_by)
VALUES
('44444444-4444-4444-8444-444444444444','COR_01_COR',
 'header-test.xlsx',repeat('4',64),1,'staged',
 '11111111-1111-4111-8111-111111111111');

INSERT INTO visura_shared.bc_batch_lines
(batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
VALUES
('44444444-4444-4444-8444-444444444444','COR_01_COR',
 1,'0000123','Producto','UD','A-01','',0);

DO $test$
DECLARE rejected boolean;
BEGIN
 rejected:=false;
 BEGIN
  UPDATE visura_shared.bc_batches SET file_sha256=repeat('f',64)
  WHERE id='44444444-4444-4444-8444-444444444444';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'staged header file hash was editable'; END IF;

 rejected:=false;
 BEGIN
  UPDATE visura_shared.bc_batches SET expected_rows=999
  WHERE id='44444444-4444-4444-8444-444444444444';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'staged header row count was editable'; END IF;

 rejected:=false;
 BEGIN
  UPDATE visura_shared.bc_batches SET state='published',published_at=now()
  WHERE id='44444444-4444-4444-8444-444444444444';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'batch bypassed validation'; END IF;

 rejected:=false;
 BEGIN
  UPDATE visura_shared.bc_batches SET validated_rows=1
  WHERE id='44444444-4444-4444-8444-444444444444';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'validated count mutated without validation'; END IF;

 IF (SELECT state FROM visura_shared.bc_batches
    WHERE id='44444444-4444-4444-8444-444444444444') <> 'staged' THEN
  RAISE EXCEPTION 'failed metadata writes changed staging state';
 END IF;
END;
$test$;

DO $test$
DECLARE response jsonb;
DECLARE rejected boolean := false;
BEGIN
 response := visura_shared.validate_bc_batch_isolated(
  '44444444-4444-4444-8444-444444444444','COR_01_COR',
  '11111111-1111-4111-8111-111111111111',repeat('4',64));
 IF response->>'status'<>'validated' THEN
   RAISE EXCEPTION 'approved private validation failed: %',response;
 END IF;

 BEGIN
  UPDATE visura_shared.bc_batches SET state='staged'
  WHERE id='44444444-4444-4444-8444-444444444444';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'validated batch returned to mutable staged'; END IF;

 rejected:=false;
 BEGIN
  UPDATE visura_shared.bc_batches SET validated_rows=0
  WHERE id='44444444-4444-4444-8444-444444444444';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'validated count changed after validation'; END IF;

 rejected:=false;
 BEGIN
  UPDATE visura_shared.bc_batches SET file_name='other.xlsx'
  WHERE id='44444444-4444-4444-8444-444444444444';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'source file name changed post-validation'; END IF;
END;
$test$;

-- A permitted transition can still be rolled back atomically.
BEGIN;
SELECT visura_shared.publish_bc_batch_isolated(
  '44444444-4444-4444-8444-444444444444','COR_01_COR',
  '11111111-1111-4111-8111-111111111111',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4');
DO $test$
BEGIN
 IF (SELECT state FROM visura_shared.bc_batches
 WHERE id='44444444-4444-4444-8444-444444444444')<>'published' THEN
  RAISE EXCEPTION 'valid publication blocked by metadata guard';
 END IF;
END;
$test$;
ROLLBACK;

DO $test$
BEGIN
 IF (SELECT state FROM visura_shared.bc_batches
 WHERE id='44444444-4444-4444-8444-444444444444')<>'validated' THEN
  RAISE EXCEPTION 'rollback failed on guarded publication';
 END IF;
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code='COR_01_COR')<>
 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid THEN
  RAISE EXCEPTION 'rollback changed current stock by warehouse';
 END IF;
END;
$test$;
SELECT 'VISURA_BC_BATCH_HEADER_STATE_GUARD_OK' AS result;
