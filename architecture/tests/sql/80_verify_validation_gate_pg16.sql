-- Disposable PG16 staged-to-validated gate tests. No real Excel or users.
\set ON_ERROR_STOP on
INSERT INTO visura_shared.bc_batches
 (id,warehouse_code,file_name,file_sha256,expected_rows,state,created_by)
 VALUES
 ('88888888-8888-4888-8888-888888888888','COR_01_COR','new.xlsx',
   repeat('8',64),1,'staged','11111111-1111-4111-8111-111111111111'),
 ('77777777-7777-4777-8777-777777777777','COR_01_COR','incomplete.xlsx',
   repeat('7',64),2,'staged','11111111-1111-4111-8111-111111111111');

INSERT INTO visura_shared.bc_batch_lines
 (batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
 VALUES
 ('88888888-8888-4888-8888-888888888888','COR_01_COR',1,'0000123','Producto','UD','A-01','',0),
 ('77777777-7777-4777-8777-777777777777','COR_01_COR',1,'0000123','Producto','UD','A-01','',10);

DO $test$
DECLARE rejected boolean;
DECLARE result jsonb;
BEGIN
 IF has_function_privilege('anon',
    'visura_shared.validate_bc_batch_isolated(uuid,text,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated',
    'visura_shared.validate_bc_batch_isolated(uuid,text,uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'unapproved client EXECUTE on internal validation';
 END IF;
 rejected:=false;
 BEGIN
  PERFORM visura_shared.validate_bc_batch_isolated(
   '88888888-8888-4888-8888-888888888888','COR_01_COR',
   '11111111-1111-4111-8111-111111111111',repeat('f',64));
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'wrong file SHA passed validation'; END IF;

 rejected:=false;
 BEGIN
  PERFORM visura_shared.validate_bc_batch_isolated(
   '77777777-7777-4777-8777-777777777777','COR_01_COR',
   '11111111-1111-4111-8111-111111111111',repeat('7',64));
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'incomplete lines passed validation'; END IF;

 result:=visura_shared.validate_bc_batch_isolated(
  '88888888-8888-4888-8888-888888888888','COR_01_COR',
  '11111111-1111-4111-8111-111111111111',repeat('8',64));
 IF result->>'status'<>'validated' OR (result->>'rows')::int<>1 THEN
   RAISE EXCEPTION 'complete batch was not validated: %',result;
 END IF;
 result:=visura_shared.validate_bc_batch_isolated(
  '88888888-8888-4888-8888-888888888888','COR_01_COR',
  '11111111-1111-4111-8111-111111111111',repeat('8',64));
 IF result->>'status'<>'already_validated' THEN
   RAISE EXCEPTION 'validation retry was not idempotent';
 END IF;
 rejected:=false;
 BEGIN
  UPDATE visura_shared.bc_batch_lines SET stock_calculated=123
   WHERE batch_id='88888888-8888-4888-8888-888888888888';
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'validated lines remained editable'; END IF;

 IF (SELECT stock_calculated FROM visura_shared.bc_batch_lines
    WHERE batch_id='88888888-8888-4888-8888-888888888888')<>0 THEN
   RAISE EXCEPTION 'validated zero value was corrupted';
 END IF;
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
    WHERE warehouse_code='COR_01_COR') <>
   'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid THEN
   RAISE EXCEPTION 'validation changed published stock pointer';
 END IF;
END;
$test$;
SELECT 'VISURA_INTERNAL_VALIDATION_GATE_OK' AS result;
