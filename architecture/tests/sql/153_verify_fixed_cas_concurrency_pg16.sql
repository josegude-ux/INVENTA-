-- Verify exactly one concurrent state change and one concurrent event.
\set ON_ERROR_STOP on
DO $test$
DECLARE v_id uuid;
BEGIN
 SELECT association_id INTO v_id FROM visura_shared.warehouse_fixed_positions
 WHERE warehouse_code='COR_01_COR' AND location_code='A-01';
 IF (SELECT revision FROM visura_shared.warehouse_fixed_positions
      WHERE association_id=v_id)<>5 OR
    (SELECT active FROM visura_shared.warehouse_fixed_positions
      WHERE association_id=v_id) IS DISTINCT FROM true OR
    (SELECT count(*) FROM visura_shared.fixed_association_events
      WHERE association_id=v_id)<>4 OR
    (SELECT count(*) FROM visura_shared.fixed_association_events
      WHERE association_id=v_id AND new_revision=5)<>1 THEN
   RAISE EXCEPTION 'CAS race produced partial, missing or duplicate state/event';
 END IF;
 IF (SELECT revision FROM visura_shared.warehouse_fixed_positions
     WHERE warehouse_code='COR_02_NAR')<>1 THEN
   RAISE EXCEPTION 'CAS race altered the independent Ferrol association';
 END IF;
END;
$test$;
SELECT 'VISURA_FIXED_CAS_TWO_SESSION_ATOMIC_OK' AS result;
