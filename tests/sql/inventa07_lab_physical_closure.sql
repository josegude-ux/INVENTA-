-- VISURA INVENTA 07 — physical manual close + derived segments/aisle, disposable PG16 only.
\set ON_ERROR_STOP on
-- Fixture enrolment is administrator-owned and never exposed to operator clients.
INSERT INTO inventa07_lab.physical_locations(
 campaign_id,location_code,aisle,aisle_position,original_team) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','K00',1,
  'f0000000-0000-4000-8000-000000000001'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P02','K00',2,
  'f0000000-0000-4000-8000-000000000002'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05','K00',3,
  'f0000000-0000-4000-8000-000000000005');
INSERT INTO inventa07_lab.physical_segments(
 campaign_id,aisle,team_id,first_position,last_position) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00',
  'f0000000-0000-4000-8000-000000000001',1,1),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00',
  'f0000000-0000-4000-8000-000000000002',2,2),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00',
  'f0000000-0000-4000-8000-000000000005',3,3);
UPDATE inventa07_lab.assignments SET active=true
 WHERE campaign_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
 AND location_code='K00-P02'
 AND actor_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
-- Separate never-counted location: no fabricated quantity, new individual sessions.
INSERT INTO inventa07_lab.assignments(campaign_id,location_code,actor_id,active) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
INSERT INTO inventa07_lab.device_sessions(id,actor_id,device_id) VALUES(
 '92000000-0000-4000-8000-000000000055',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'd0000000-0000-4000-8000-000000000055');
INSERT INTO inventa07_lab.team_terminals(team_id,campaign_id,location_code,device_id,
 original_a,original_b) VALUES(
 'f0000000-0000-4000-8000-000000000055',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05',
 'd0000000-0000-4000-8000-000000000055',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
UPDATE inventa07_lab.physical_locations SET original_team=
 'f0000000-0000-4000-8000-000000000055'
 WHERE location_code='K00-P05';
UPDATE inventa07_lab.physical_segments SET team_id=
 'f0000000-0000-4000-8000-000000000055'
 WHERE aisle='K00' AND first_position=3;

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000004',false);
DO $first_location$
DECLARE stale jsonb; fresh jsonb; result jsonb; repeat_result jsonb;denied boolean:=false;
BEGIN
 stale:=inventa07_lab.physical_snapshot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01');
 IF jsonb_array_length(stale->'references')<2 OR
    jsonb_array_length(stale->'provisionals')<1 OR
    stale ? 'theoretical' THEN
  RAISE EXCEPTION 'Physical snapshot missing entries or leaked theoretical stock'; END IF;
 BEGIN
  PERFORM inventa07_lab.physical_finish(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',0,
   stale,'a1000000-0000-4000-8000-000000000001',true);
 EXCEPTION WHEN OTHERS THEN
  denied:=position('All physical references' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Location closed while one lot remained in draft'; END IF;
 -- The earlier draft is confirmed by B, the authenticated original team member,
 -- after the session change; it is never interpreted as blank or zero.
 result:=inventa07_lab.team_apply_lot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0001','','confirm',
  'a1000000-0000-4000-8000-000000000002',1,NULL,false,1);
 IF result->>'operation'<>'confirmed' THEN
  RAISE EXCEPTION 'Previously drafted reference did not confirm'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.physical_finish(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',0,
   stale,'a1000000-0000-4000-8000-000000000003',true);
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Physical review changed' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale physical review accepted'; END IF;
 fresh:=inventa07_lab.physical_snapshot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01');
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.physical_finish(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',0,
   fresh,'a1000000-0000-4000-8000-000000000004',false);
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Manual location acceptance required' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Automatic close without manual acceptance'; END IF;
 result:=inventa07_lab.physical_finish(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',0,
  fresh,'a1000000-0000-4000-8000-000000000005',true);
 repeat_result:=inventa07_lab.physical_finish(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',0,
  fresh,'a1000000-0000-4000-8000-000000000005',true);
 IF result<>repeat_result OR result->>'status'<>'finished'
 THEN RAISE EXCEPTION 'Manual close or lost-response retry failed'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.team_apply_lot(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0002','LOT-AFTER-CLOSE','draft',
   'a1000000-0000-4000-8000-000000000006',0,
   '[{"type":"loose","units":"1"}]'::jsonb,false,NULL);
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Physical location finished' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Closed location accepted a new physical count'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_incident(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   'illegible-code','Error físico después del cierre',1,false,NULL,
   'a1000000-0000-4000-8000-000000000007');
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Physical location finished' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Closed location accepted new physical incident'; END IF;
END $first_location$;

-- P02 already contains a physically counted provisional from prior tests.
-- Its administrative consolidation is pending, and MUST NOT block physical close.
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000022',false);
DO $second_location$
DECLARE review jsonb;r jsonb;
BEGIN
 review:=inventa07_lab.physical_snapshot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P02');
 IF jsonb_array_length(review->'provisionals')<1 THEN
  RAISE EXCEPTION 'Historical provisional at P02 was erased'; END IF;
 r:=inventa07_lab.physical_finish(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P02',0,
  review,'a2000000-0000-4000-8000-000000000004',true);
 IF r->>'status'<>'finished' OR (r->>'confirmedPhysicalEntries')::int<1 THEN
  RAISE EXCEPTION 'Physically confirmed provisional failed manual close'; END IF;
END $second_location$;

-- P05 is genuinely untouched: its empty review cannot be misread as confirmed zero.
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000055',false);
DO $third_location$
DECLARE review jsonb;fresh jsonb;r jsonb;denied boolean:=false;
BEGIN
 r:=inventa07_lab.team_operate(
   'f0000000-0000-4000-8000-000000000055',
   'activate','pair',0,'a5000000-0000-4000-8000-000000000001');
 IF r->>'mode'<>'pair' THEN RAISE EXCEPTION 'New location lease not activated'; END IF;
 review:=inventa07_lab.physical_snapshot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05');
 IF review->'references'<>'[]'::jsonb OR review->'provisionals'<>'[]'::jsonb THEN
  RAISE EXCEPTION 'Never-counted P05 unexpectedly has physical entries'; END IF;
 BEGIN
  PERFORM inventa07_lab.physical_finish(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05',0,
   review,'a5000000-0000-4000-8000-000000000002',true);
 EXCEPTION WHEN OTHERS THEN
  denied:=position('separate empty-verification procedure' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Untouched physical location auto-closed'; END IF;
 r:=inventa07_lab.team_apply_lot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P05','SKU0001','LOT-ZERO','draft',
  'a5000000-0000-4000-8000-000000000003',0,'[]'::jsonb,true,NULL);
 IF (r->>'quantity')::numeric<>0 THEN RAISE EXCEPTION 'Explicit zero draft failed'; END IF;
 r:=inventa07_lab.team_apply_lot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P05','SKU0001','LOT-ZERO','confirm',
  'a5000000-0000-4000-8000-000000000004',1,NULL,false,1);
 IF r->>'operation'<>'confirmed' THEN RAISE EXCEPTION 'Zero review confirmation failed'; END IF;
 fresh:=inventa07_lab.physical_snapshot(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05');
 r:=inventa07_lab.physical_finish(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P05',0,
  fresh,'a5000000-0000-4000-8000-000000000005',true);
 IF r->>'status'<>'finished' THEN RAISE EXCEPTION 'P05 manual close failed'; END IF;
END $third_location$;

-- A global physical rollup is for administration; it contains NO theoretical stock.
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
SELECT set_config('request.jwt.claim.session_id','33333333-3333-4333-8333-333333333333',false);
DO $admin_rollup$
DECLARE r jsonb;reopened jsonb;
BEGIN
 r:=inventa07_lab.physical_aisle_progress(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00');
 IF r->>'completed'<>'true' OR (r->>'finished')::int<>3
  OR (r->>'total')::int<>3 OR jsonb_array_length(r->'segments')<>3
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(r->'segments') x
    WHERE (x->>'complete')::boolean IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'Two completed manual locations must auto-complete the segments/aisle: %',r; END IF;
 reopened:=inventa07_lab.physical_reopen(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',1,
  'Administración autoriza comprobación física adicional',
  'a3000000-0000-4000-8000-000000000001');
 IF reopened->>'status'<>'open' THEN RAISE EXCEPTION 'Admin reopen failed'; END IF;
 r:=inventa07_lab.physical_aisle_progress(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00');
 IF r->>'completed'<>'false' OR (r->>'finished')::int<>2
  OR (SELECT count(*) FROM jsonb_array_elements(r->'segments') x
       WHERE (x->>'complete')::boolean=true)<>2
 THEN RAISE EXCEPTION 'Reopen did not automatically invalidate segment and aisle: %',r; END IF;
END $admin_rollup$;
RESET ROLE;

DO $history$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.physical_closure_events)<>4 THEN
  RAISE EXCEPTION 'Expected exactly three immutable finishes and one authorized reopen'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.physical_closure_events
  WHERE action='finish' AND reviewed_physical IS NOT NULL)<>3 THEN
  RAISE EXCEPTION 'Manual physical audit snapshots missing'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.physical_locations WHERE status='finished')<>2
 THEN RAISE EXCEPTION 'Incorrect physical location state after admin reopen'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.provisionals
  WHERE barcode='NEW-PROV-1' AND status='awaiting_consolidation')<>1
 THEN RAISE EXCEPTION 'Physical closure silently resolved a provisional'; END IF;
END $history$;
SELECT 'inventa07 physical manual close + automatic aisle progress PASS' AS result;
