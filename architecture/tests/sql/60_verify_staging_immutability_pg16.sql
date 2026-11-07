-- Disposable PostgreSQL 16 immutability tests, synthetic rows only.
\set ON_ERROR_STOP on
INSERT INTO visura_shared.bc_batches
 (id,warehouse_code,file_name,file_sha256,expected_rows,validated_rows,
  state,created_by)
 VALUES ('99999999-9999-4999-8999-999999999999','COR_01_COR',
  'staging.xlsx',repeat('9',64),1,0,'staged',
  '11111111-1111-4111-8111-111111111111');

INSERT INTO visura_shared.bc_batch_lines
 (batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
 VALUES ('99999999-9999-4999-8999-999999999999',
  'COR_01_COR',1,'0000123','Synthetic','UD','A-01','',1.5);
UPDATE visura_shared.bc_batch_lines SET stock_calculated=2.5
 WHERE batch_id='99999999-9999-4999-8999-999999999999';
UPDATE visura_shared.bc_batches SET state='validated',validated_rows=1,validated_at=now()
 WHERE id='99999999-9999-4999-8999-999999999999';

DO $test$
DECLARE rejected boolean;
BEGIN
 rejected := false;
 BEGIN
  UPDATE visura_shared.bc_batch_lines SET stock_calculated=999
  WHERE batch_id='99999999-9999-4999-8999-999999999999';
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'validated batch could be mutated'; END IF;

 rejected := false;
 BEGIN
  DELETE FROM visura_shared.bc_batch_lines
   WHERE batch_id='99999999-9999-4999-8999-999999999999';
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'validated batch could be deleted'; END IF;

 rejected := false;
 BEGIN
  INSERT INTO visura_shared.bc_batch_lines
   (batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
   VALUES ('99999999-9999-4999-8999-999999999999',
    'COR_01_COR',2,'0000123','Synthetic','UD','A-01','another',100);
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'validated batch could be appended'; END IF;

 rejected := false;
 BEGIN
  UPDATE visura_shared.bc_batch_lines
   SET batch_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'
   WHERE batch_id='99999999-9999-4999-8999-999999999999';
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'line could move between batches'; END IF;

 IF (SELECT stock_calculated FROM visura_shared.bc_batch_lines
     WHERE batch_id='99999999-9999-4999-8999-999999999999')<>2.5 THEN
   RAISE EXCEPTION 'immutability guard changed validated quantity';
 END IF;
END;
$test$;
SELECT 'VISURA_BC_STAGING_IMMUTABILITY_OK' AS result;
