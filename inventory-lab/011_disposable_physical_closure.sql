-- VISURA INVENTA 07 — PHYSICAL LOCATION CLOSE, EPHEMERAL PG16 ONLY.
-- This is a disposable proposal, NOT a migration for Supabase production.
DO $guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $guard$;
BEGIN;
CREATE TABLE inventa07_lab.physical_locations(
 campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns(id),
 location_code text NOT NULL,
 aisle text NOT NULL,
 aisle_position integer NOT NULL CHECK(aisle_position>=0),
 original_team uuid NOT NULL REFERENCES inventa07_lab.team_terminals(team_id),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','finished')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(campaign_id,location_code),
 UNIQUE(campaign_id,aisle,aisle_position)
);
CREATE TABLE inventa07_lab.physical_segments(
 campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns(id),
 aisle text NOT NULL,
 team_id uuid NOT NULL REFERENCES inventa07_lab.team_terminals(team_id),
 first_position integer NOT NULL,
 last_position integer NOT NULL,
 PRIMARY KEY(campaign_id,aisle,team_id),
 CHECK(first_position>=0 AND last_position>=first_position)
);
CREATE TABLE inventa07_lab.physical_closure_events(
 mutation_id uuid PRIMARY KEY,
 campaign_id uuid NOT NULL,
 location_code text NOT NULL,
 action text NOT NULL CHECK(action IN('finish','reopen')),
 actor_id uuid NOT NULL,
 session_id uuid NOT NULL,
 original_team uuid NOT NULL,
 previous_revision bigint NOT NULL,
 next_revision bigint NOT NULL,
 reviewed_physical jsonb,
 reason text,
 request jsonb NOT NULL,
 response jsonb NOT NULL,
 happened_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON inventa07_lab.physical_locations,
 inventa07_lab.physical_segments,inventa07_lab.physical_closure_events FROM PUBLIC;
ALTER TABLE inventa07_lab.physical_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.physical_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.physical_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.physical_segments FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.physical_closure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.physical_closure_events FORCE ROW LEVEL SECURITY;

-- The snapshot contains physical results ONLY, never BC theoretical stock.
-- Administrative provisional states are intentionally not included: manual
-- physical completion is independent of SKU consolidation and campaign close.
CREATE FUNCTION inventa07_lab.physical_snapshot(
 p_campaign uuid,p_location text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $snapshot$
DECLARE
 v_refs jsonb;v_provs jsonb;v_blockers jsonb;
BEGIN
 IF NOT inventa07_lab.team_authorized(p_campaign,p_location) THEN
  RAISE EXCEPTION 'Current personal team session required for physical review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.physical_locations
   WHERE campaign_id=p_campaign AND location_code=p_location)
 THEN RAISE EXCEPTION 'Unknown physical location'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'product',product_code,'lot',lot,'revision',revision,'status',status,
   'draft',draft_qty,'confirmed',confirmed_qty,'explicitZero',confirmed_zero
  ) ORDER BY product_code,lot),'[]'::jsonb) INTO v_refs
 FROM inventa07_lab.lot_states
 WHERE campaign_id=p_campaign AND location_code=p_location;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'barcode',barcode,'quantity',physical_qty,'explicitZero',explicit_zero
  ) ORDER BY barcode,id),'[]'::jsonb) INTO v_provs
 FROM inventa07_lab.provisionals
 WHERE campaign_id=p_campaign AND location_code=p_location;
 SELECT coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO v_blockers
 FROM inventa07_lab.incidents
 WHERE campaign_id=p_campaign AND location_code=p_location
  AND status='awaiting_correction';
 RETURN jsonb_build_object('references',v_refs,'provisionals',v_provs,
  'physicalCorrectionsRequired',v_blockers);
END $snapshot$;
REVOKE ALL ON FUNCTION inventa07_lab.physical_snapshot(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.physical_snapshot(uuid,text)
 TO inventa07_lab_client;

CREATE FUNCTION inventa07_lab.physical_finish(
 p_campaign uuid,p_location text,p_expected_revision bigint,p_review jsonb,
 p_mutation uuid,p_manual_confirmed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $finish$
DECLARE
 v_actor uuid;v_session uuid;v_location inventa07_lab.physical_locations%ROWTYPE;
 v_old inventa07_lab.physical_closure_events%ROWTYPE;
 v_request jsonb;v_result jsonb;v_review jsonb;
 v_confirmed bigint;v_pending bigint;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL OR p_campaign IS NULL OR p_location IS NULL
  OR p_location='' OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_mutation IS NULL THEN RAISE EXCEPTION 'Valid authenticated close request required'; END IF;
 IF NOT inventa07_lab.team_authorized(p_campaign,p_location)
 THEN RAISE EXCEPTION 'Team terminal no longer authorized'; END IF;
 SELECT * INTO v_location FROM inventa07_lab.physical_locations
  WHERE campaign_id=p_campaign AND location_code=p_location FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Physical location does not exist'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.team_terminals
  WHERE team_id=v_location.original_team AND campaign_id=p_campaign
   AND location_code=p_location)
 THEN RAISE EXCEPTION 'Location original team mismatch'; END IF;
 v_request:=jsonb_build_object('campaign',p_campaign,'location',p_location,
  'revision',p_expected_revision,'review',p_review,'manual',p_manual_confirmed);
 SELECT * INTO v_old FROM inventa07_lab.physical_closure_events WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF v_old.actor_id<>v_actor OR v_old.session_id<>v_session
   OR v_old.request<>v_request THEN RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN v_old.response;
 END IF;
 IF v_location.status<>'open' OR v_location.revision<>p_expected_revision
 THEN RAISE EXCEPTION 'Stale or finished physical location'; END IF;
 IF p_manual_confirmed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Manual location acceptance required'; END IF;
 v_review:=inventa07_lab.physical_snapshot(p_campaign,p_location);
 IF p_review IS DISTINCT FROM v_review
 THEN RAISE EXCEPTION 'Physical review changed; refresh and confirm again'; END IF;
 SELECT count(*) FILTER(WHERE status='confirmed'),
        count(*) FILTER(WHERE status<>'confirmed')
 INTO v_confirmed,v_pending FROM inventa07_lab.lot_states
 WHERE campaign_id=p_campaign AND location_code=p_location;
 v_confirmed:=v_confirmed+(SELECT count(*) FROM inventa07_lab.provisionals
  WHERE campaign_id=p_campaign AND location_code=p_location);
 IF v_confirmed=0 THEN
  RAISE EXCEPTION 'An untouched/empty location needs a separate empty-verification procedure'; END IF;
 IF v_pending>0 OR jsonb_array_length(v_review->'physicalCorrectionsRequired')>0 THEN
  RAISE EXCEPTION 'All physical references and required corrections must be confirmed'; END IF;
 UPDATE inventa07_lab.physical_locations SET status='finished',revision=revision+1
 WHERE campaign_id=p_campaign AND location_code=p_location;
 v_result:=jsonb_build_object('status','finished','revision',v_location.revision+1,
  'location',p_location,'confirmedPhysicalEntries',v_confirmed);
 INSERT INTO inventa07_lab.physical_closure_events(
  mutation_id,campaign_id,location_code,action,actor_id,session_id,original_team,
  previous_revision,next_revision,reviewed_physical,request,response)
 VALUES(p_mutation,p_campaign,p_location,'finish',v_actor,v_session,
  v_location.original_team,v_location.revision,v_location.revision+1,
  v_review,v_request,v_result);
 RETURN v_result;
END $finish$;
REVOKE ALL ON FUNCTION inventa07_lab.physical_finish(uuid,text,bigint,jsonb,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.physical_finish(uuid,text,bigint,jsonb,uuid,boolean)
 TO inventa07_lab_client;

-- Only Administration can explicitly reopen; physical history is never erased.
CREATE FUNCTION inventa07_lab.physical_reopen(
 p_campaign uuid,p_location text,p_expected_revision bigint,p_reason text,p_mutation uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $reopen$
DECLARE
 v_actor uuid;v_session uuid;v_state inventa07_lab.physical_locations%ROWTYPE;
 v_old inventa07_lab.physical_closure_events%ROWTYPE;
 v_request jsonb;v_result jsonb;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL OR NOT EXISTS(
  SELECT 1 FROM inventa07_lab.actors
  WHERE id=v_actor AND active AND role='admin')
 THEN RAISE EXCEPTION 'Only Administration can reopen a physical location'; END IF;
 IF p_campaign IS NULL OR p_location IS NULL OR p_expected_revision IS NULL
  OR p_expected_revision<0 OR p_reason IS NULL OR trim(p_reason)=''
  OR p_mutation IS NULL THEN RAISE EXCEPTION 'Reopen requires reason and version'; END IF;
 SELECT * INTO v_state FROM inventa07_lab.physical_locations
  WHERE campaign_id=p_campaign AND location_code=p_location FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(
  SELECT 1 FROM inventa07_lab.campaigns WHERE id=p_campaign AND status='open')
 THEN RAISE EXCEPTION 'Campaign closed or location not found'; END IF;
 v_request:=jsonb_build_object('campaign',p_campaign,'location',p_location,
  'revision',p_expected_revision,'reason',p_reason);
 SELECT * INTO v_old FROM inventa07_lab.physical_closure_events WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF v_old.actor_id<>v_actor OR v_old.session_id<>v_session
   OR v_old.request<>v_request THEN RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN v_old.response;
 END IF;
 IF v_state.status<>'finished' OR v_state.revision<>p_expected_revision
 THEN RAISE EXCEPTION 'Stale or not finished physical location'; END IF;
 UPDATE inventa07_lab.physical_locations SET status='open',revision=revision+1
 WHERE campaign_id=p_campaign AND location_code=p_location;
 v_result:=jsonb_build_object('status','open','revision',v_state.revision+1);
 INSERT INTO inventa07_lab.physical_closure_events(
  mutation_id,campaign_id,location_code,action,actor_id,session_id,original_team,
  previous_revision,next_revision,reason,request,response)
 VALUES(p_mutation,p_campaign,p_location,'reopen',v_actor,v_session,
  v_state.original_team,v_state.revision,v_state.revision+1,
  trim(p_reason),v_request,v_result);
 RETURN v_result;
END $reopen$;
REVOKE ALL ON FUNCTION inventa07_lab.physical_reopen(uuid,text,bigint,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.physical_reopen(uuid,text,bigint,text,uuid)
 TO inventa07_lab_client;

-- After a location finishes, new physical quantity, draft, provisional or
-- incident cannot appear until explicit reopen. Row locks serialize races.
CREATE FUNCTION inventa07_lab.guard_location_mutation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $physical_guard$
DECLARE v_status text;
BEGIN
 SELECT status INTO v_status FROM inventa07_lab.physical_locations
 WHERE campaign_id=NEW.campaign_id AND location_code=NEW.location_code FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Location not registered in physical inventory'; END IF;
 IF v_status='finished' THEN
  RAISE EXCEPTION 'Physical location finished; administrative reopen required'; END IF;
 RETURN NEW;
END $physical_guard$;
REVOKE ALL ON FUNCTION inventa07_lab.guard_location_mutation() FROM PUBLIC;
CREATE TRIGGER guard_close_lot BEFORE INSERT OR UPDATE
 ON inventa07_lab.lot_states FOR EACH ROW EXECUTE FUNCTION inventa07_lab.guard_location_mutation();
CREATE TRIGGER guard_close_provisional BEFORE INSERT
 ON inventa07_lab.provisionals FOR EACH ROW EXECUTE FUNCTION inventa07_lab.guard_location_mutation();
CREATE TRIGGER guard_close_incident BEFORE INSERT
 ON inventa07_lab.incidents FOR EACH ROW EXECUTE FUNCTION inventa07_lab.guard_location_mutation();

-- Automatic completion is a DERIVED state, not manual close of a range/aisle.
-- Reports only physical completion; administrative campaign acceptance is separate.
CREATE FUNCTION inventa07_lab.physical_aisle_progress(p_campaign uuid,p_aisle text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $summary$
DECLARE v_actor uuid;v_segments jsonb;v_total bigint;v_finished bigint;v_coverage boolean;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM inventa07_lab.actors
  WHERE id=v_actor AND active AND role IN('supervisor','admin'))
 THEN RAISE EXCEPTION 'Only Administration/supervisor can view global progress'; END IF;
 SELECT count(*),count(*) FILTER(WHERE status='finished') INTO v_total,v_finished
 FROM inventa07_lab.physical_locations
 WHERE campaign_id=p_campaign AND aisle=p_aisle;
 SELECT coalesce(jsonb_agg(jsonb_build_object('team',seg.team_id,
  'from',seg.first_position,'to',seg.last_position,
  'complete',seg.registered=(seg.last_position-seg.first_position+1)
       AND seg.finished=seg.registered,
  'finished',seg.finished,'total',seg.last_position-seg.first_position+1)
  ORDER BY seg.first_position),'[]'::jsonb) INTO v_segments
 FROM(
  SELECT s.team_id,s.first_position,s.last_position,
  count(l.*) AS registered,
  count(l.*) FILTER(WHERE l.status='finished') AS finished
  FROM inventa07_lab.physical_segments s
  LEFT JOIN inventa07_lab.physical_locations l
   ON l.campaign_id=s.campaign_id AND l.aisle=s.aisle
    AND l.aisle_position BETWEEN s.first_position AND s.last_position
    AND l.original_team=s.team_id
  WHERE s.campaign_id=p_campaign AND s.aisle=p_aisle
  GROUP BY s.team_id,s.first_position,s.last_position
 ) seg;
 SELECT NOT EXISTS(
  SELECT 1 FROM inventa07_lab.physical_locations l
  WHERE l.campaign_id=p_campaign AND l.aisle=p_aisle AND
    (SELECT count(*) FROM inventa07_lab.physical_segments s
     WHERE s.campaign_id=p_campaign AND s.aisle=p_aisle
      AND l.aisle_position BETWEEN s.first_position AND s.last_position
      AND s.team_id=l.original_team)<>1
 ) INTO v_coverage;
 RETURN jsonb_build_object('total',v_total,'finished',v_finished,
  'segments',v_segments,'completed',v_total>0 AND v_finished=v_total
   AND v_coverage AND jsonb_array_length(v_segments)>0 AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_segments) value
    WHERE (value->>'complete')::boolean IS DISTINCT FROM true));
END $summary$;
REVOKE ALL ON FUNCTION inventa07_lab.physical_aisle_progress(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.physical_aisle_progress(uuid,text)
 TO inventa07_lab_client;
COMMIT;
