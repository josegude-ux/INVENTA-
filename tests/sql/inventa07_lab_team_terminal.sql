-- VISURA INVENTA 07: physical terminal, original pair, individual login and revocation.
-- Fixtures only. Never use the fake test JWT claims as production authorization.
\set ON_ERROR_STOP on
UPDATE inventa07_lab.campaigns SET status='open'
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
UPDATE inventa07_lab.actors SET active=true
 WHERE id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
UPDATE inventa07_lab.assignments SET active=true
 WHERE campaign_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  AND location_code='K00-P01'
  AND actor_id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO inventa07_lab.actors(id,active,role)
 VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true,'operator');
INSERT INTO inventa07_lab.assignments(campaign_id,location_code,actor_id,active)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
INSERT INTO inventa07_lab.device_sessions(id,actor_id,device_id) VALUES
 ('91000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','d0000000-0000-4000-8000-000000000001'),
 ('92000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','d0000000-0000-4000-8000-000000000001'),
 ('91000000-0000-4000-8000-000000000099','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','d0000000-0000-4000-8000-000000000099'),
 ('93000000-0000-4000-8000-000000000003','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','d0000000-0000-4000-8000-000000000001'),
 ('92000000-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','d0000000-0000-4000-8000-000000000001');
INSERT INTO inventa07_lab.team_terminals(team_id,campaign_id,location_code,device_id,
 original_a,original_b) VALUES
 ('f0000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'd0000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','91000000-0000-4000-8000-000000000001',false);
DO $initial$
DECLARE rejected boolean:=false;r jsonb;again jsonb;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_lot(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0002','LOT-TEAM','draft',
   '81000000-0000-4000-8000-000000000001',0,
   '[{"type":"loose","units":"5"}]'::jsonb,false,NULL);
 EXCEPTION WHEN OTHERS THEN
  rejected:=position('Team terminal lease' in SQLERRM)>0; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Existing RPC wrote without active team lease'; END IF;
 r:=inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
  'activate','pair',0,'80000000-0000-4000-8000-000000000001');
 again:=inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
  'activate','pair',0,'80000000-0000-4000-8000-000000000001');
 IF r<>again OR r->>'mode'<>'pair' OR (r->>'revision')::bigint<>1 THEN
  RAISE EXCEPTION 'Original pair activation/idempotent retry failed: %',r; END IF;
 IF NOT inventa07_lab.team_authorized('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01') THEN RAISE EXCEPTION 'Original active holder not authorized'; END IF;
 r:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0002','LOT-TEAM','draft',
   '81000000-0000-4000-8000-000000000001',0,
   '[{"type":"loose","units":"5"}]'::jsonb,false,NULL);
 IF r->>'operation'<>'draft' OR (r->>'quantity')::numeric<>5
  THEN RAISE EXCEPTION 'Active pair failed to save one draft'; END IF;
 rejected:=false;
 BEGIN
  PERFORM inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
   'switch','individual',0,'80000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN OTHERS THEN
  rejected:=position('Idempotency key conflict' in SQLERRM)>0
    OR position('Stale team revision' in SQLERRM)>0; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Stale team revision accepted'; END IF;
END $initial$;
-- Session A from a different physical terminal must not be able to take over.
SELECT set_config('request.jwt.claim.session_id','91000000-0000-4000-8000-000000000099',false);
DO $device_attack$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
   'switch','pair',1,'80000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN OTHERS THEN
  denied:=position('enrolled terminal' in SQLERRM)>0; END;
 IF NOT denied OR inventa07_lab.team_authorized(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01') THEN
  RAISE EXCEPTION 'Other device obtained same team'; END IF;
END $device_attack$;
SELECT set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
SELECT set_config('request.jwt.claim.session_id','93000000-0000-4000-8000-000000000003',false);
DO $third$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
   'switch','individual',1,'80000000-0000-4000-8000-000000000004');
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Not an original team member' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Assigned third person joined original team'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0002','LOT-THIRD','draft',
   '81000000-0000-4000-8000-000000000004',0,
   '[{"type":"loose","units":"100"}]'::jsonb,false,NULL);
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Team terminal lease' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Old count RPC bypassed original team barrier'; END IF;
END $third$;
-- B logs in with their OWN account on the SAME terminal, taking over the lease.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000002',false);
DO $handover$
DECLARE r jsonb;
BEGIN
 r:=inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
  'switch','individual',1,'80000000-0000-4000-8000-000000000005');
 IF r->>'mode'<>'individual' OR (r->>'revision')::bigint<>2 THEN
  RAISE EXCEPTION 'Handover B failed'; END IF;
 IF NOT inventa07_lab.team_authorized('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01')
 THEN RAISE EXCEPTION 'B cannot continue initial physical draft'; END IF;
 r:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0002','LOT-TEAM','confirm',
  '81000000-0000-4000-8000-000000000002',1,NULL,false,1);
 IF r->>'operation'<>'confirmed' OR (r->>'quantity')::numeric<>5 THEN
  RAISE EXCEPTION 'B confirmation of A draft failed'; END IF;
END $handover$;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','91000000-0000-4000-8000-000000000001',false);
DO $old_holder$
DECLARE denied boolean:=false;
BEGIN
 IF inventa07_lab.team_authorized('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01')
 THEN RAISE EXCEPTION 'A old session remains count holder after B handover'; END IF;
 BEGIN
  PERFORM inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0002','LOT-STALE-A','draft',
   '81000000-0000-4000-8000-000000000003',0,
   '[{"type":"loose","units":"7"}]'::jsonb,false,NULL);
 EXCEPTION WHEN OTHERS THEN denied:=position('Team terminal lease' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Old session wrote after handover'; END IF;
END $old_holder$;
-- Only B currently holds the terminal, may renew or release.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000002',false);
DO $release$
DECLARE r jsonb;
BEGIN
 r:=inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
  'renew',NULL,2,'80000000-0000-4000-8000-000000000006');
 IF (r->>'revision')::bigint<>3 THEN RAISE EXCEPTION 'Renew failed'; END IF;
 r:=inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
  'release',NULL,3,'80000000-0000-4000-8000-000000000007');
 IF r->>'mode'<>'inactive' OR inventa07_lab.team_authorized(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01') THEN
  RAISE EXCEPTION 'Release did not revoke holder'; END IF;
END $release$;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','91000000-0000-4000-8000-000000000001',false);
SELECT inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
 'activate','pair',4,'80000000-0000-4000-8000-000000000008');
RESET ROLE;
-- Authorized assignment revocation must block active access immediately.
UPDATE inventa07_lab.assignments SET active=false
 WHERE campaign_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND location_code='K00-P01'
 AND actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE inventa07_lab_client;
DO $revoked_partner$
DECLARE denied boolean:=false;
BEGIN
 IF inventa07_lab.team_authorized('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01')
 THEN RAISE EXCEPTION 'Pair continues with revoked partner'; END IF;
 BEGIN
  PERFORM inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
   'renew',NULL,5,'80000000-0000-4000-8000-000000000009');
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Original pair assignment revoked' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Renew pair after partner revoked'; END IF;
END $revoked_partner$;
RESET ROLE;
UPDATE inventa07_lab.assignments SET active=true
 WHERE campaign_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND location_code='K00-P01'
 AND actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
-- Revoke A's SESSION, not account: A loses device/count rights even if JWT is cached.
UPDATE inventa07_lab.device_sessions SET active=false
 WHERE id='91000000-0000-4000-8000-000000000001';
SET ROLE inventa07_lab_client;
DO $old_session_revoked$
DECLARE denied boolean:=false;
BEGIN
 IF inventa07_lab.team_authorized('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01')
 THEN RAISE EXCEPTION 'Revoked session still authorizes counts'; END IF;
 BEGIN
  PERFORM inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
   'renew',NULL,5,'80000000-0000-4000-8000-000000000010');
 EXCEPTION WHEN OTHERS THEN denied:=position('active personal session' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Revoked session renewed lease'; END IF;
END $old_session_revoked$;
-- New B session, still on original terminal, can hand over without adding a member.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000004',false);
DO $relogin$
DECLARE r jsonb;
BEGIN
 r:=inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
  'switch','individual',5,'80000000-0000-4000-8000-000000000011');
 IF r->>'mode'<>'individual' OR (r->>'revision')::bigint<>6
 THEN RAISE EXCEPTION 'Reauthenticated original B could not take over'; END IF;
 IF NOT inventa07_lab.team_authorized('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01')
 THEN RAISE EXCEPTION 'New B session missing count rights'; END IF;
END $relogin$;
RESET ROLE;
UPDATE inventa07_lab.team_terminals SET expires_at=now()-interval '1 second'
 WHERE team_id='f0000000-0000-4000-8000-000000000001';
SET ROLE inventa07_lab_client;
DO $expiry$
DECLARE r jsonb;
BEGIN
 IF inventa07_lab.team_authorized('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01')
 THEN RAISE EXCEPTION 'Expired terminal lease grants write permission'; END IF;
 r:=inventa07_lab.team_operate('f0000000-0000-4000-8000-000000000001',
  'renew',NULL,6,'80000000-0000-4000-8000-000000000012');
 IF (r->>'revision')::bigint<>7 OR NOT inventa07_lab.team_authorized(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01')
 THEN RAISE EXCEPTION 'Valid B could not renew expired terminal'; END IF;
END $expiry$;
RESET ROLE;
DO $audit$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.team_terminals
   WHERE team_id='f0000000-0000-4000-8000-000000000001'
    AND original_a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND original_b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND revision=7 AND holder_actor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1
 THEN RAISE EXCEPTION 'Original team or final holder unexpectedly changed'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.team_terminal_events
  WHERE team_id='f0000000-0000-4000-8000-000000000001')<>7
 THEN RAISE EXCEPTION 'Missing or duplicated immutable terminal transitions'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.lot_confirmation_events
    WHERE lot='LOT-TEAM' AND original_a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     AND original_b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     AND actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     AND team_id='f0000000-0000-4000-8000-000000000001'
     AND quantity=5)<>1
 THEN RAISE EXCEPTION 'Count was not attributed to both originals and actual authenticated B'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.lot_states WHERE lot='LOT-THIRD')<>0 THEN
  RAISE EXCEPTION 'Third operator contaminated count states'; END IF;
END $audit$;
SELECT 'inventa07 original team and one-terminal session lease PASS' AS result;
