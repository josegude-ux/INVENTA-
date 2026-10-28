-- Additional disposable PostgreSQL 16 assertions: staged justified corrections.
\set ON_ERROR_STOP on
INSERT INTO inventa07_lab.assignments(campaign_id,location_code,actor_id,active)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
INSERT INTO inventa07_lab.original_team_members(campaign_id,location_code,actor_id)
 VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','stage',
   '30000000-0000-4000-8000-000000000099',2,NULL,7,false,'other','',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 EXCEPTION WHEN OTHERS THEN blocked:=position('correction reason' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Empty Other explanation allowed'; END IF;
 blocked:=false;
 BEGIN
  PERFORM inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','stage',
   '30000000-0000-4000-8000-000000000098',2,NULL,7,false,'other','Investigación',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Declared author' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unassigned declared author allowed'; END IF;
END $$;
DO $$
DECLARE r jsonb; r2 jsonb; blocked boolean:=false;
BEGIN
 r:=inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','stage',
   '30000000-0000-4000-8000-000000000001',2,NULL,7,false,'other',
   'Se contaron las cajas equivocadas','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 IF r->>'phase'<>'review' OR (r->>'previousPhysical')::numeric<>0
   OR (r->>'proposedPhysical')::numeric<>7 OR r->>'revision'<>'3'
 THEN RAISE EXCEPTION 'Wrong correction preview %',r; END IF;
 r2:=inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','stage',
   '30000000-0000-4000-8000-000000000001',2,NULL,7,false,'other',
   'Se contaron las cajas equivocadas','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 IF r<>r2 THEN RAISE EXCEPTION 'Staged correction retry differs'; END IF;
 IF (SELECT confirmed_qty FROM inventa07_lab.reference_states
   WHERE product_code='SKU0001')<>0 THEN RAISE EXCEPTION 'Original was overwritten during staging'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_events WHERE kind='corrected')<>0
 THEN RAISE EXCEPTION 'Correction event created before review'; END IF;
 BEGIN
  PERFORM inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','stage',
   '30000000-0000-4000-8000-000000000001',2,NULL,8,false,'other',
   'Se contaron las cajas equivocadas','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Idempotency key conflict' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Changed staged payload reused mutation ID'; END IF;
END $$;
-- Second original partner cannot execute a staged correction authored in A's session.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','commit',
   '30000000-0000-4000-8000-000000000003',3,3);
 EXCEPTION WHEN OTHERS THEN blocked:=position('Correction author or baseline' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Other session committed A correction'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE blocked boolean:=false; r jsonb; repeat_result jsonb;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','commit',
   '30000000-0000-4000-8000-000000000004',3,2);
 EXCEPTION WHEN OTHERS THEN blocked:=position('review token mismatch' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale correction review accepted'; END IF;
 r:=inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','commit',
   '30000000-0000-4000-8000-000000000002',3,3);
 repeat_result:=inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','commit',
   '30000000-0000-4000-8000-000000000002',3,3);
 IF r<>repeat_result OR (r->>'newPhysical')::numeric<>7 OR (r->>'originalPhysical')::numeric<>0
 THEN RAISE EXCEPTION 'Wrong corrected result %',r; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_events WHERE kind='corrected')<>1
 THEN RAISE EXCEPTION 'Expected exactly one corrected event'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_events WHERE kind='corrected'
       AND previous_quantity=0 AND quantity=7 AND correction_reason='other'
       AND declared_author='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
       AND actor_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       AND authenticated_session_id='11111111-1111-4111-8111-111111111111')<>1
 THEN RAISE EXCEPTION 'Correction trace is incomplete'; END IF;
 IF (SELECT confirmed_qty FROM inventa07_lab.reference_states WHERE product_code='SKU0001')<>7
 THEN RAISE EXCEPTION 'Corrected quantity not committed'; END IF;
END $$;
RESET ROLE;
UPDATE inventa07_lab.campaigns SET status='closed'
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
SET ROLE inventa07_lab_client;
DO $$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_correction(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','stage',
   '30000000-0000-4000-8000-000000000005',4,NULL,12,false,
   'initial_count_error',NULL,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Campaign closed' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Correction accepted after campaign closure'; END IF;
END $$;
RESET ROLE;
SELECT 'inventa07 correction contract PASS' AS result;
