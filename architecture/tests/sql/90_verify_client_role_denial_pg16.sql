-- VISURA 04: explicit denial tests under synthetic client roles in PG16 only.
-- Execute after the private contracts and internal validation drafts.
\set ON_ERROR_STOP on
SET ROLE anon;
DO $test$
DECLARE object_name text;
DECLARE denied boolean;
BEGIN
 IF has_schema_privilege(current_user, 'visura_shared', 'USAGE') THEN
   RAISE EXCEPTION 'anon unexpectedly has shared private schema access';
 END IF;
 FOR object_name IN SELECT unnest(ARRAY[
  'visura_shared.stock_current_v1',
  'visura_shared.products_v1',
  'visura_shared.locations_v1',
  'visura_shared.fixed_positions_v1',
  'visura_shared.bc_batches',
  'visura_shared.user_module_warehouses'
 ])
 LOOP
   denied:=false;
   BEGIN
     EXECUTE format('SELECT count(*) FROM %s',object_name);
   EXCEPTION WHEN insufficient_privilege THEN denied:=true;
   END;
   IF NOT denied THEN
     RAISE EXCEPTION 'anon could read %', object_name;
   END IF;
 END LOOP;
 denied:=false;
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid,'COR_01_COR',
    '11111111-1111-4111-8111-111111111111'::uuid,NULL::uuid);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'anon could execute publisher'; END IF;
 denied:=false;
 BEGIN
  PERFORM visura_shared.validate_bc_batch_isolated(
    '88888888-8888-4888-8888-888888888888'::uuid,'COR_01_COR',
    '11111111-1111-4111-8111-111111111111'::uuid, repeat('8',64));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'anon could execute validator'; END IF;
END;
$test$;
RESET ROLE;

SET ROLE authenticated;
DO $test$
DECLARE denied boolean := false;
BEGIN
 IF has_schema_privilege(current_user, 'visura_shared', 'USAGE') THEN
   RAISE EXCEPTION 'authenticated unexpectedly accesses private schema';
 END IF;
 BEGIN
  PERFORM 1 FROM visura_shared.stock_current_v1;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'authenticated can read calculated stock'; END IF;
 denied:=false;
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
   'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid,'COR_01_COR',
   '11111111-1111-4111-8111-111111111111'::uuid,NULL::uuid);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'authenticated can publish'; END IF;
END;
$test$;
RESET ROLE;
SELECT 'VISURA_SHARED_SYNTHETIC_ROLE_DENIAL_OK' AS result;
