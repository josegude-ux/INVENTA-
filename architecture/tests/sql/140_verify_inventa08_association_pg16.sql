-- VISURA 04: test only PG16, no business data, no Auth/JWT or RPC.
\set ON_ERROR_STOP on
-- Reuse the two synthetic warehouse-specific rows inserted by
-- architecture/tests/sql/70_verify_reference_contract_pg16.sql.
-- The additive schema draft assigns each a stable association ID.
DO $test$
DECLARE n integer;
DECLARE corid uuid;
DECLARE ferid uuid;
BEGIN
 SELECT count(*) INTO n FROM visura_shared.inventa08_associations_v1
 WHERE location_code='A-01' AND product_code='0000123'
   AND active=true AND revision=1;
 IF n<>2 THEN RAISE EXCEPTION 'warehouse-scoped associations lost'; END IF;
 SELECT association_id INTO corid FROM visura_shared.inventa08_associations_v1
 WHERE warehouse_code='COR_01_COR';
 SELECT association_id INTO ferid FROM visura_shared.inventa08_associations_v1
 WHERE warehouse_code='COR_02_NAR';
 IF corid IS NULL OR ferid IS NULL OR corid=ferid THEN
   RAISE EXCEPTION 'scoped stable IDs absent or duplicated';
 END IF;
 IF has_table_privilege('anon','visura_shared.inventa08_associations_v1','SELECT') OR
    has_table_privilege('authenticated','visura_shared.fixed_association_events','SELECT')
 THEN RAISE EXCEPTION 'client can access private association model'; END IF;
END;
$test$;

UPDATE visura_shared.warehouse_fixed_positions
 SET active=false,revision=2
 WHERE warehouse_code='COR_01_COR' AND location_code='A-01'
   AND product_code='0000123' AND revision=1 AND active=true;

INSERT INTO visura_shared.fixed_association_events
 (warehouse_code,location_code,product_code,association_id,
  previous_active,new_active,previous_revision,new_revision,
  action,reason,actor_id)
 SELECT warehouse_code,location_code,product_code,association_id,
  true,false,1,2,'RETIRAR','REUBICACION',
  '11111111-1111-4111-8111-111111111111'
 FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_01_COR' AND location_code='A-01'
 AND product_code='0000123';

DO $test$
DECLARE rejected boolean;
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM visura_shared.inventa08_associations_v1
 WHERE warehouse_code='COR_01_COR' AND NOT active AND revision=2
 ) OR NOT EXISTS (
 SELECT 1 FROM visura_shared.inventa08_associations_v1
 WHERE warehouse_code='COR_02_NAR' AND active AND revision=1
 ) THEN RAISE EXCEPTION 'one-warehouse logical retirement altered another'; END IF;

 rejected:=false;
 BEGIN
  UPDATE visura_shared.fixed_association_events
  SET reason='BAJA_ARTICULO';
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'append-only history could be changed'; END IF;

 rejected:=false;
 BEGIN
  DELETE FROM visura_shared.fixed_association_events;
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'append-only history could be erased'; END IF;
 IF (SELECT count(*) FROM visura_shared.fixed_association_events)<>1 THEN
  RAISE EXCEPTION 'history was not preserved';
 END IF;
END;
$test$;

SET ROLE anon;
DO $test$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM 1 FROM visura_shared.inventa08_associations_v1;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'anon could read fixed associations'; END IF;
END;
$test$;
RESET ROLE;
SELECT 'VISURA_INVENTA08_SHARED_ASSOCIATION_DRAFT_OK' AS result;
