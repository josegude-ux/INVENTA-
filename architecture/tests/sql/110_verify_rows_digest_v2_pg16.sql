-- VISURA 04 — independent Node / PostgreSQL cross-runtime SHA256 test.
-- All rows and UUIDs below are invented test fixtures in disposable PG16 only.
\set ON_ERROR_STOP on

INSERT INTO visura_shared.bc_batches
 (id,warehouse_code,file_name,file_sha256,expected_rows,state,created_by)
 VALUES (
 '55555555-5555-4555-8555-555555555555','COR_01_COR','rows-digest-test.xlsx',
 repeat('5',64),2,'staged','11111111-1111-4111-8111-111111111111'
 );

INSERT INTO visura_shared.bc_batch_lines
 (batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
 VALUES
 ('55555555-5555-4555-8555-555555555555','COR_01_COR',1,'0000123','Niño / Café','UD','A-01','L1',0),
 ('55555555-5555-4555-8555-555555555555','COR_01_COR',2,'0000123','Otro producto','UD','A-01','L2',-2.5);

DO $test$
DECLARE got text;
DECLARE altered text;
DECLARE rejected boolean := false;
BEGIN
 IF has_function_privilege('anon',
  'visura_shared.bc_batch_rows_sha256_v2(uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'visura_shared.bc_batch_rows_sha256_v2(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'private V2 digest function has client EXECUTE';
 END IF;
 SELECT visura_shared.bc_batch_rows_sha256_v2(
  '55555555-5555-4555-8555-555555555555','COR_01_COR'
 ) INTO got;
 IF got <> 'd9db1f1eabf30fd0fd6369315671196bada3efd7773a4e7d9d6a8a8d93ca2515' THEN
  RAISE EXCEPTION 'V2 digest mismatch against independently calculated Node/Python fixture: %',got;
 END IF;

 UPDATE visura_shared.bc_batch_lines SET stock_calculated=-2.25
 WHERE batch_id='55555555-5555-4555-8555-555555555555' AND row_number=2;
 SELECT visura_shared.bc_batch_rows_sha256_v2(
  '55555555-5555-4555-8555-555555555555','COR_01_COR'
 ) INTO altered;
 IF altered=got THEN
  RAISE EXCEPTION 'mutated calculated stock did not change DB digest';
 END IF;
 UPDATE visura_shared.bc_batch_lines SET stock_calculated=-2.5
 WHERE batch_id='55555555-5555-4555-8555-555555555555' AND row_number=2;

 UPDATE visura_shared.bc_batch_lines SET row_number=3
 WHERE batch_id='55555555-5555-4555-8555-555555555555' AND row_number=2;
 BEGIN
   PERFORM visura_shared.bc_batch_rows_sha256_v2(
    '55555555-5555-4555-8555-555555555555','COR_01_COR');
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN
   RAISE EXCEPTION 'non-contiguous rows did not fail DB digest integrity';
 END IF;
 UPDATE visura_shared.bc_batch_lines SET row_number=2
 WHERE batch_id='55555555-5555-4555-8555-555555555555' AND row_number=3;

 IF visura_shared.bc_batch_rows_sha256_v2(
   '55555555-5555-4555-8555-555555555555','COR_01_COR')<>got THEN
   RAISE EXCEPTION 'V2 reordering restore did not return same digest';
 END IF;
 rejected:=false;
 BEGIN
   PERFORM visura_shared.bc_batch_rows_sha256_v2(
    '55555555-5555-4555-8555-555555555555','COR_02_NAR');
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true;
 END;
 IF NOT rejected THEN
   RAISE EXCEPTION 'V2 wrong warehouse allowed cross-scope calculation';
 END IF;
END;
$test$;
SELECT 'VISURA_BC_ROWS_SHA256_CROSS_RUNTIME_V2_OK' AS result;
