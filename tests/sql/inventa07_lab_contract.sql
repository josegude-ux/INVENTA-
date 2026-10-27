-- SQL assertions for ephemeral PostgreSQL 16 only.
\set ON_ERROR_STOP on
INSERT INTO inventa07_lab.actors(id,active,role) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'operator'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,'operator');
INSERT INTO inventa07_lab.campaigns(id,status)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','open');
INSERT INTO inventa07_lab.products(code) VALUES ('SKU0001'),('SKU0002');
INSERT INTO inventa07_lab.assignments(campaign_id,location_code,actor_id,active)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
INSERT INTO inventa07_lab.bc_theoretical(campaign_id,location_code,product_code,theoretical_qty)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001',999);

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);

DO $$
DECLARE v_denied boolean:=false;
BEGIN
 BEGIN
   EXECUTE 'SELECT theoretical_qty FROM inventa07_lab.bc_theoretical LIMIT 1';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Stock teórico BC se ha filtrado'; END IF;
END $$;
DO $$
DECLARE v_denied boolean:=false;
BEGIN
 BEGIN
   EXECUTE 'UPDATE inventa07_lab.reference_states SET revision=99';
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'UPDATE directo de recuentos permitido'; END IF;
END $$;
-- Explicit zero is a counted value. A missing quantity is rejected.
DO $$
DECLARE resp jsonb; blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','draft',
    '10000000-0000-4000-8000-000000000009',0,0,false,NULL);
 EXCEPTION WHEN OTHERS THEN
   blocked:=position('explicit zero' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Zero without explicit mark accepted'; END IF;
 resp:=inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','draft',
    '10000000-0000-4000-8000-000000000001',0,0,true,NULL);
 IF resp->>'status'<>'draft' OR resp->>'revision'<>'1' OR resp->>'explicitZero'<>'true'
   THEN RAISE EXCEPTION 'Draft zero response is incorrect: %',resp; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_events)<>0
   THEN RAISE EXCEPTION 'Draft must not emit a confirmation'; END IF;
END $$;
-- Lost HTTP response: replay the same idempotency key recovers stored result.
DO $$
DECLARE a jsonb; b jsonb; blocked boolean:=false;
BEGIN
 a:=inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','draft',
    '10000000-0000-4000-8000-000000000001',0,0,true,NULL);
 b:=inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','draft',
    '10000000-0000-4000-8000-000000000001',0,0,true,NULL);
 IF a<>b THEN RAISE EXCEPTION 'Idempotent retry differs'; END IF;
 BEGIN
  PERFORM inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','draft',
    '10000000-0000-4000-8000-000000000001',0,1,false,NULL);
 EXCEPTION WHEN OTHERS THEN
   blocked:=position('Idempotency key conflict' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Changed payload reused same mutation ID'; END IF;
END $$;
-- A separate (unassigned) actor cannot modify, even with a well-formed request.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_reference(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','confirm',
   '10000000-0000-4000-8000-000000000002',1,NULL,false,1);
 EXCEPTION WHEN OTHERS THEN blocked:=position('Assignment revoked' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unassigned partner can confirm'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_states)<>0
   THEN RAISE EXCEPTION 'Unassigned operator read another assignment'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $$
DECLARE resp jsonb; blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','confirm',
    '10000000-0000-4000-8000-000000000003',1,NULL,false,0);
 EXCEPTION WHEN OTHERS THEN blocked:=position('Review version invalid' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale review accepted'; END IF;
 resp:=inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','confirm',
    '10000000-0000-4000-8000-000000000002',1,NULL,false,1);
 IF resp->>'status'<>'confirmed' OR (resp->>'physicalQuantity')::numeric<>0
    OR resp->>'explicitZero'<>'true' THEN RAISE EXCEPTION 'Confirmation incorrect: %',resp; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_events)<>1 THEN
   RAISE EXCEPTION 'Confirmation not append-only'; END IF;
 BEGIN
  PERFORM inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','draft',
    '10000000-0000-4000-8000-000000000004',2,7,false,NULL);
 EXCEPTION WHEN OTHERS THEN
   blocked:=position('Confirmed reference requires' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Confirmed reference edited without correction'; END IF;
END $$;
RESET ROLE;
UPDATE inventa07_lab.campaigns SET status='closed'
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
SET ROLE inventa07_lab_client;
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_reference(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0002','draft',
    '10000000-0000-4000-8000-000000000005',0,3,false,NULL);
 EXCEPTION WHEN OTHERS THEN blocked:=position('Campaign is closed' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Closed campaign accepts new draft'; END IF;
END $$;
RESET ROLE;
-- Reopen ONLY this synthetic campaign for independent CAS concurrency check.
UPDATE inventa07_lab.campaigns SET status='open'
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
SELECT 'inventa07 reference contract PASS' AS result;
