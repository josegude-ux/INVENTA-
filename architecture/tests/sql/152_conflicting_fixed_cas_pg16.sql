-- Session B waits on session A, then must fail to CAS revision 4.
\set ON_ERROR_STOP on
SET lock_timeout='10000ms';
DO $test$
DECLARE v_id uuid;
DECLARE denied boolean:=false;
BEGIN
 SELECT association_id INTO v_id FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_01_COR' AND location_code='A-01';
 BEGIN
  PERFORM visura_shared.transition_fixed_association_cas_isolated(
   v_id,'COR_01_COR',4,'REACTIVAR','CAMBIO_OPERATIVO','',
   '11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN serialization_failure THEN denied:=true; END;
 IF NOT denied THEN
  RAISE EXCEPTION 'concurrent writer unexpectedly committed the same revision';
 END IF;
END;
$test$;
SELECT 'VISURA_FIXED_CAS_CONCURRENT_LOSER_REJECTED' AS result;
