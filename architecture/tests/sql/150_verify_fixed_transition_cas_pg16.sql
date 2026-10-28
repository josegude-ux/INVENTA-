-- VISURA 04 - ephemeral PG16 only. CAS, audit, revocation, rollback.
\set ON_ERROR_STOP on
INSERT INTO visura_shared.user_module_warehouses
 (user_id,module,warehouse_code,module_role,enabled,approved_by,approved_at)
 VALUES ('11111111-1111-4111-8111-111111111111',
 'inventa','COR_01_COR','admin',true,
 '11111111-1111-4111-8111-111111111111',now());

DO $test$
DECLARE v_id uuid;
DECLARE v_result jsonb;
DECLARE denied boolean;
BEGIN
 SELECT association_id INTO v_id
 FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_01_COR' AND product_code='0000123';
 IF v_id IS NULL THEN RAISE EXCEPTION 'Test fixture has no association'; END IF;
 IF has_function_privilege('anon',
  'visura_shared.transition_fixed_association_cas_isolated(uuid,text,integer,text,text,text,uuid)',
  'EXECUTE') OR has_function_privilege('authenticated',
  'visura_shared.transition_fixed_association_cas_isolated(uuid,text,integer,text,text,text,uuid)',
  'EXECUTE') THEN
   RAISE EXCEPTION 'client roles can invoke private CAS';
 END IF;

 -- Previous test 140 retired this COR association: version 2, inactive.
 SELECT visura_shared.transition_fixed_association_cas_isolated(
  v_id,'COR_01_COR',2,'REACTIVAR','REUBICACION','',
  '11111111-1111-4111-8111-111111111111') INTO v_result;
 IF v_result->>'active'<>'true' OR v_result->>'revision'<>'3'
 OR (SELECT count(*) FROM visura_shared.fixed_association_events
     WHERE association_id=v_id)<>2 THEN
   RAISE EXCEPTION 'CAS reactivation or atomic event mismatch: %',v_result;
 END IF;

 denied:=false;
 BEGIN
 PERFORM visura_shared.transition_fixed_association_cas_isolated(
  v_id,'COR_01_COR',2,'RETIRAR','BAJA_ARTICULO','',
  '11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN serialization_failure THEN denied:=true;
 END;
 IF NOT denied OR (SELECT revision FROM visura_shared.warehouse_fixed_positions
 WHERE association_id=v_id)<>3 THEN
   RAISE EXCEPTION 'stale CAS changed association';
 END IF;

 denied:=false;
 BEGIN
  PERFORM visura_shared.transition_fixed_association_cas_isolated(
    v_id,'COR_02_NAR',3,'RETIRAR','BAJA_ARTICULO','',
    '11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'warehouse permission bypassed'; END IF;
 IF (SELECT revision FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_02_NAR')<>1 THEN
  RAISE EXCEPTION 'foreign warehouse was mutated';
 END IF;
END;
$test$;

-- Explicitly inject a failure AFTER the row UPDATE, at the event INSERT.
CREATE FUNCTION visura_shared.lab_reject_event()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.reason='OTROS' THEN
  RAISE EXCEPTION 'synthetic audit event storage failed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$fn$;
CREATE TRIGGER lab_fail_event BEFORE INSERT ON visura_shared.fixed_association_events
 FOR EACH ROW EXECUTE FUNCTION visura_shared.lab_reject_event();

DO $test$
DECLARE v_id uuid;
DECLARE rejected boolean:=false;
BEGIN
 SELECT association_id INTO v_id FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_01_COR';
 BEGIN
  PERFORM visura_shared.transition_fixed_association_cas_isolated(
   v_id,'COR_01_COR',3,'RETIRAR','OTROS','REJECT_EVENT',
   '11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'synthetic event failure did not fire'; END IF;
 IF (SELECT revision FROM visura_shared.warehouse_fixed_positions
     WHERE association_id=v_id)<>3 OR
    (SELECT active FROM visura_shared.warehouse_fixed_positions
     WHERE association_id=v_id)<>true OR
    (SELECT count(*) FROM visura_shared.fixed_association_events
     WHERE association_id=v_id)<>2 THEN
  RAISE EXCEPTION 'event INSERT failure failed to rollback state UPDATE';
 END IF;
END;
$test$;
DROP TRIGGER lab_fail_event ON visura_shared.fixed_association_events;
DROP FUNCTION visura_shared.lab_reject_event();

DO $test$
DECLARE v_id uuid;
BEGIN
 SELECT association_id INTO v_id FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_01_COR';
 PERFORM visura_shared.transition_fixed_association_cas_isolated(
   v_id,'COR_01_COR',3,'RETIRAR','CAMBIO_OPERATIVO','',
   '11111111-1111-4111-8111-111111111111');
 IF (SELECT revision FROM visura_shared.warehouse_fixed_positions
  WHERE association_id=v_id)<>4 OR
  (SELECT count(*) FROM visura_shared.fixed_association_events
  WHERE association_id=v_id)<>3 THEN
   RAISE EXCEPTION 'valid third event not committed together with version 4';
 END IF;
END;
$test$;

-- An explicit rollback of the outer transaction undoes BOTH effects.
BEGIN;
SELECT visura_shared.transition_fixed_association_cas_isolated(
 (SELECT association_id FROM visura_shared.warehouse_fixed_positions
  WHERE warehouse_code='COR_01_COR'),'COR_01_COR',4,
 'REACTIVAR','REUBICACION','',
 '11111111-1111-4111-8111-111111111111'
);
ROLLBACK;

DO $test$
DECLARE v_id uuid;
DECLARE denied boolean:=false;
BEGIN
 SELECT association_id INTO v_id FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_01_COR';
 IF (SELECT revision FROM visura_shared.warehouse_fixed_positions
 WHERE association_id=v_id)<>4 OR
 (SELECT count(*) FROM visura_shared.fixed_association_events
 WHERE association_id=v_id)<>3 THEN
   RAISE EXCEPTION 'outer rollback did not preserve event/state';
 END IF;

 UPDATE visura_shared.user_module_warehouses SET enabled=false
 WHERE user_id='11111111-1111-4111-8111-111111111111'
 AND warehouse_code='COR_01_COR' AND module='inventa';
 BEGIN
  PERFORM visura_shared.transition_fixed_association_cas_isolated(
   v_id,'COR_01_COR',4,'REACTIVAR','REUBICACION','',
   '11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'revoked admin still performs CAS'; END IF;
 IF (SELECT revision FROM visura_shared.warehouse_fixed_positions
  WHERE association_id=v_id)<>4 THEN RAISE EXCEPTION 'revoked admin changed state'; END IF;
 UPDATE visura_shared.user_module_warehouses SET enabled=true
 WHERE user_id='11111111-1111-4111-8111-111111111111'
 AND warehouse_code='COR_01_COR' AND module='inventa';
END;
$test$;
SELECT 'VISURA_FIXED_CAS_AUDIT_ATOMIC_OK' AS result;
