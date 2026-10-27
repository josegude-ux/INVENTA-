-- VISURA 04 synthetic publication tests in disposable PostgreSQL 16 only.
\set ON_ERROR_STOP on

-- Existing COR publication from 30_verify_read_contract_pg16.sql is batch AAAA.
-- Existing COR_02_NAR remains published independently. Never use live data.
INSERT INTO visura_shared.bc_batches
 (id,warehouse_code,file_name,file_sha256,expected_rows,validated_rows,
  state,created_by,validated_at)
 VALUES
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','COR_01_COR','cor-2.xlsx',repeat('d',64),
  1,1,'validated','11111111-1111-4111-8111-111111111111',now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','COR_01_COR','cor-bad.xlsx',repeat('e',64),
  2,2,'validated','11111111-1111-4111-8111-111111111111',now()),
 ('ffffffff-ffff-4fff-8fff-fffffffffff6','COR_01_COR','cor-3.xlsx',repeat('f',64),
  1,1,'validated','11111111-1111-4111-8111-111111111111',now());

INSERT INTO visura_shared.bc_batch_lines
 (batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
 VALUES
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','COR_01_COR',1,'0000123','Producto','UD','A-01','',12.25),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','COR_01_COR',1,'0000123','Producto','UD','A-01','',99),
 ('ffffffff-ffff-4fff-8fff-fffffffffff6','COR_01_COR',1,'0000123','Producto','UD','A-01','',7);

DO $test$
DECLARE denied boolean := false;
BEGIN
 IF has_function_privilege('anon','visura_shared.publish_bc_batch_isolated(uuid,text,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','visura_shared.publish_bc_batch_isolated(uuid,text,uuid,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'publisher inadvertently callable by a client role';
 END IF;
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
   'dddddddd-dddd-4ddd-8ddd-ddddddddddd4','COR_01_COR',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN
  RAISE EXCEPTION 'unapproved user could publish';
 END IF;
END;
$test$;

-- This row is synthetic; it DOES NOT grant privileges in real Auth.
INSERT INTO visura_shared.user_module_warehouses
 (user_id,module,warehouse_code,module_role,may_read_calculated_stock,
  enabled,approved_by,approved_at)
 VALUES
 ('11111111-1111-4111-8111-111111111111','inventa','COR_01_COR','admin',
  true,true,'11111111-1111-4111-8111-111111111111',now());

-- Rejected attempts must leave the existing pointer untouched.
DO $test$
DECLARE rejected boolean;
BEGIN
 rejected := false;
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
   'dddddddd-dddd-4ddd-8ddd-ddddddddddd4','COR_02_NAR',
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');
 EXCEPTION WHEN insufficient_privilege THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'warehouse must have its own approved admin'; END IF;

 rejected := false;
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','COR_01_COR',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'missing lines could publish'; END IF;

 rejected := false;
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
   'dddddddd-dddd-4ddd-8ddd-ddddddddddd4','COR_01_COR',
   '11111111-1111-4111-8111-111111111111',
   NULL);
 EXCEPTION WHEN serialization_failure THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'null stale pointer must be rejected'; END IF;

 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
     WHERE warehouse_code='COR_01_COR') <>
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid THEN
  RAISE EXCEPTION 'failed attempts changed current COR stock';
 END IF;
END;
$test$;

DO $test$
DECLARE result jsonb;
DECLARE event_count int;
BEGIN
 result := visura_shared.publish_bc_batch_isolated(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4','COR_01_COR',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
 IF result->>'status'<>'published' OR (result->>'validated_rows')::int<>1 THEN
  RAISE EXCEPTION 'transactional publication failed: %', result;
 END IF;
 IF (SELECT state FROM visura_shared.bc_batches
     WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') <> 'superseded' THEN
  RAISE EXCEPTION 'prior COR batch not superseded';
 END IF;
 IF (SELECT batch_id FROM visura_shared.bc_current_by_warehouse
     WHERE warehouse_code='COR_02_NAR') <>
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid THEN
  RAISE EXCEPTION 'publishing COR changed Ferrol pointer';
 END IF;
 SELECT count(*) INTO event_count FROM visura_shared.bc_publication_events;
 IF event_count <> 1 THEN RAISE EXCEPTION 'expected one audit event'; END IF;

 -- Retried request is a no-op, even if original expected pointer was superseded.
 result := visura_shared.publish_bc_batch_isolated(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4','COR_01_COR',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
 IF result->>'status'<>'already_published' THEN
  RAISE EXCEPTION 'retry not idempotent';
 END IF;
 SELECT count(*) INTO event_count FROM visura_shared.bc_publication_events;
 IF event_count<>1 THEN RAISE EXCEPTION 'retry duplicated audit event'; END IF;
END;
$test$;

DO $test$
DECLARE stale boolean := false;
BEGIN
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
   'ffffffff-ffff-4fff-8fff-fffffffffff6','COR_01_COR',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
 EXCEPTION WHEN serialization_failure THEN stale := true;
 END;
 IF NOT stale THEN RAISE EXCEPTION 'late writer overwrote the current batch'; END IF;

 IF (SELECT stock_calculated FROM visura_shared.stock_current_v1
     WHERE warehouse_code='COR_01_COR')<>12.25 THEN
  RAISE EXCEPTION 'private read contract has wrong current calculated stock';
 END IF;
 IF (SELECT count(*) FROM visura_shared.bc_publication_events)<>1 THEN
  RAISE EXCEPTION 'failed stale writer left an audit event';
 END IF;
END;
$test$;

SELECT 'VISURA_SHARED_TRANSACTIONAL_PUBLISH_ISOLATED_OK' AS result;
