-- VISURA INVENTA 07 — SERVER-SIDE TEAM TERMINAL LEASE, EPHEMERAL PG16 ONLY.
-- Fake JWT claims in this laboratory are NOT production-grade authentication.
DO $guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $guard$;
BEGIN;
CREATE TABLE inventa07_lab.device_sessions (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES inventa07_lab.actors(id),
 device_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT true,
 issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventa07_lab.team_terminals (
 team_id uuid PRIMARY KEY,
 campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns(id),
 location_code text NOT NULL,
 device_id uuid NOT NULL,
 original_a uuid NOT NULL REFERENCES inventa07_lab.actors(id),
 original_b uuid REFERENCES inventa07_lab.actors(id),
 mode text NOT NULL DEFAULT 'inactive' CHECK(mode IN ('inactive','individual','pair')),
 holder_actor uuid REFERENCES inventa07_lab.actors(id),
 holder_session uuid REFERENCES inventa07_lab.device_sessions(id),
 expires_at timestamptz,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 UNIQUE(campaign_id,location_code),
 CHECK(original_b IS NULL OR original_a<>original_b),
 CHECK((mode='inactive' AND holder_actor IS NULL AND holder_session IS NULL AND expires_at IS NULL)
    OR (mode<>'inactive' AND holder_actor IS NOT NULL AND holder_session IS NOT NULL AND expires_at IS NOT NULL)),
 CHECK(mode<>'pair' OR original_b IS NOT NULL)
);
-- One physical device cannot simultaneously hold two active team leases.
CREATE UNIQUE INDEX one_active_team_per_physical_terminal
 ON inventa07_lab.team_terminals(device_id) WHERE mode<>'inactive';
CREATE TABLE inventa07_lab.team_terminal_events (
 mutation_id uuid PRIMARY KEY,
 team_id uuid NOT NULL REFERENCES inventa07_lab.team_terminals(team_id),
 actor_id uuid NOT NULL,
 session_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('activate','switch','renew','release')),
 old_mode text NOT NULL,
 new_mode text NOT NULL,
 previous_holder uuid,
 new_holder uuid,
 revision bigint NOT NULL,
 request jsonb NOT NULL,
 response jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON inventa07_lab.device_sessions,inventa07_lab.team_terminals,
 inventa07_lab.team_terminal_events FROM PUBLIC;
ALTER TABLE inventa07_lab.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.device_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.team_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.team_terminals FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.team_terminal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.team_terminal_events FORCE ROW LEVEL SECURITY;
-- Enrollment and revocation are fixture-owner operations, never client-controlled.

CREATE FUNCTION inventa07_lab.team_authorized(
 p_campaign uuid,p_location text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $authz$
DECLARE v_actor uuid;v_session uuid;v_team inventa07_lab.team_terminals%ROWTYPE;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL THEN RETURN false; END IF;
 SELECT * INTO v_team FROM inventa07_lab.team_terminals
  WHERE campaign_id=p_campaign AND location_code=p_location;
 IF NOT FOUND OR v_team.mode='inactive' OR v_team.expires_at<=now()
   OR v_team.holder_actor IS DISTINCT FROM v_actor
   OR v_team.holder_session IS DISTINCT FROM v_session
   OR v_actor NOT IN (v_team.original_a,coalesce(v_team.original_b,v_team.original_a))
 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.device_sessions d
   JOIN inventa07_lab.actors a ON a.id=d.actor_id AND a.active
   WHERE d.id=v_session AND d.actor_id=v_actor AND d.device_id=v_team.device_id
      AND d.active) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.campaigns WHERE id=p_campaign AND status='open')
 OR NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments
   WHERE campaign_id=p_campaign AND location_code=p_location
    AND actor_id=v_actor AND active) THEN RETURN false; END IF;
 IF v_team.mode='pair' AND (
   NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments x
     JOIN inventa07_lab.actors a ON a.id=x.actor_id AND a.active
     WHERE x.campaign_id=p_campaign AND x.location_code=p_location
       AND x.actor_id=v_team.original_a AND x.active)
   OR NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments x
     JOIN inventa07_lab.actors a ON a.id=x.actor_id AND a.active
     WHERE x.campaign_id=p_campaign AND x.location_code=p_location
       AND x.actor_id=v_team.original_b AND x.active)
 ) THEN RETURN false; END IF;
 RETURN true;
END $authz$;
REVOKE ALL ON FUNCTION inventa07_lab.team_authorized(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.team_authorized(uuid,text)
 TO inventa07_lab_client;

CREATE FUNCTION inventa07_lab.team_operate(
 p_team uuid,p_action text,p_mode text,p_expected_revision bigint,p_mutation uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $operate$
DECLARE
 v_actor uuid;v_session uuid;
 v_team inventa07_lab.team_terminals%ROWTYPE;
 v_prev inventa07_lab.team_terminal_events%ROWTYPE;
 v_request jsonb;v_response jsonb;v_next_mode text;v_next_holder uuid;
 v_next_session uuid;v_expiry timestamptz;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL OR p_mutation IS NULL OR p_team IS NULL
    OR p_expected_revision IS NULL OR p_expected_revision<0
    OR p_action NOT IN ('activate','switch','renew','release') OR p_action IS NULL
 THEN RAISE EXCEPTION 'Invalid team operation or authenticated context'; END IF;
 IF NOT EXISTS (SELECT 1 FROM inventa07_lab.actors WHERE id=v_actor AND active)
 THEN RAISE EXCEPTION 'Account disabled'; END IF;
 -- Team row lock serializes handovers, concurrent starts and CAS revisions.
 SELECT * INTO v_team FROM inventa07_lab.team_terminals WHERE team_id=p_team FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Team not enrolled'; END IF;
 IF v_actor NOT IN (v_team.original_a,coalesce(v_team.original_b,v_team.original_a))
 THEN RAISE EXCEPTION 'Not an original team member'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.device_sessions
   WHERE id=v_session AND actor_id=v_actor AND active
    AND device_id=v_team.device_id) THEN
   RAISE EXCEPTION 'No active personal session on the enrolled terminal'; END IF;
 IF NOT EXISTS (SELECT 1 FROM inventa07_lab.campaigns
   WHERE id=v_team.campaign_id AND status='open')
 THEN RAISE EXCEPTION 'Campaign closed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM inventa07_lab.assignments
   WHERE campaign_id=v_team.campaign_id AND location_code=v_team.location_code
    AND actor_id=v_actor AND active)
 THEN RAISE EXCEPTION 'Assignment revoked'; END IF;
 v_request:=jsonb_build_object('team',p_team,'action',p_action,'mode',p_mode,
   'expectedRevision',p_expected_revision);
 SELECT * INTO v_prev FROM inventa07_lab.team_terminal_events WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF v_prev.actor_id<>v_actor OR v_prev.session_id<>v_session OR v_prev.request<>v_request
  THEN RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN v_prev.response;
 END IF;
 IF v_team.revision<>p_expected_revision THEN
  RAISE EXCEPTION 'Stale team revision'; END IF;
 IF p_action='activate' THEN
  IF v_team.mode<>'inactive' THEN RAISE EXCEPTION 'Terminal already leased'; END IF;
 ELSIF v_team.mode='inactive' THEN
  RAISE EXCEPTION 'No active team terminal';
 END IF;
 IF p_action IN ('renew','release') THEN
  IF v_team.holder_actor IS DISTINCT FROM v_actor
    OR v_team.holder_session IS DISTINCT FROM v_session THEN
    RAISE EXCEPTION 'Only current authenticated holder can renew or release'; END IF;
  IF p_mode IS NOT NULL THEN RAISE EXCEPTION 'Renew/release cannot change team mode'; END IF;
  v_next_mode:=CASE WHEN p_action='release' THEN 'inactive' ELSE v_team.mode END;
 ELSE
  IF p_mode NOT IN ('individual','pair') OR p_mode IS NULL THEN
   RAISE EXCEPTION 'Individual or original pair mode required'; END IF;
  v_next_mode:=p_mode;
 END IF;
 IF v_next_mode='pair' THEN
  IF v_team.original_b IS NULL THEN RAISE EXCEPTION 'No original pair to join'; END IF;
  IF NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments x
    JOIN inventa07_lab.actors a ON a.id=x.actor_id AND a.active
    WHERE x.campaign_id=v_team.campaign_id AND x.location_code=v_team.location_code
     AND x.actor_id=v_team.original_a AND x.active)
  OR NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments x
    JOIN inventa07_lab.actors a ON a.id=x.actor_id AND a.active
    WHERE x.campaign_id=v_team.campaign_id AND x.location_code=v_team.location_code
     AND x.actor_id=v_team.original_b AND x.active)
  THEN RAISE EXCEPTION 'Original pair assignment revoked'; END IF;
 END IF;
 IF v_next_mode='inactive' THEN
  v_next_holder:=NULL;v_next_session:=NULL;v_expiry:=NULL;
 ELSE
  v_next_holder:=v_actor;v_next_session:=v_session;v_expiry:=now()+interval '15 minutes';
 END IF;
 UPDATE inventa07_lab.team_terminals
 SET mode=v_next_mode,holder_actor=v_next_holder,holder_session=v_next_session,
    expires_at=v_expiry,revision=revision+1 WHERE team_id=p_team;
 v_response:=jsonb_build_object('teamId',p_team,'revision',v_team.revision+1,
   'mode',v_next_mode,'holderActor',v_next_holder,'expiresAt',v_expiry);
 INSERT INTO inventa07_lab.team_terminal_events(
 mutation_id,team_id,actor_id,session_id,action,old_mode,new_mode,
 previous_holder,new_holder,revision,request,response)
 VALUES(p_mutation,p_team,v_actor,v_session,p_action,v_team.mode,v_next_mode,
   v_team.holder_actor,v_next_holder,v_team.revision+1,v_request,v_response);
 RETURN v_response;
END $operate$;
REVOKE ALL ON FUNCTION inventa07_lab.team_operate(uuid,text,text,bigint,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.team_operate(uuid,text,text,bigint,uuid)
 TO inventa07_lab_client;

-- New confirmations retain immutable team identity at time of count.
-- Earlier events are intentionally left untouched (NULL team metadata).
ALTER TABLE inventa07_lab.lot_confirmation_events
 ADD COLUMN team_id uuid REFERENCES inventa07_lab.team_terminals(team_id),
 ADD COLUMN original_a uuid,
 ADD COLUMN original_b uuid;
CREATE FUNCTION inventa07_lab.stamp_original_team_on_confirmation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $stamp$
DECLARE team inventa07_lab.team_terminals%ROWTYPE;
BEGIN
 SELECT * INTO STRICT team FROM inventa07_lab.team_terminals
  WHERE campaign_id=NEW.campaign_id AND location_code=NEW.location_code;
 NEW.team_id:=team.team_id;
 NEW.original_a:=team.original_a;
 NEW.original_b:=team.original_b;
 RETURN NEW;
END $stamp$;
REVOKE ALL ON FUNCTION inventa07_lab.stamp_original_team_on_confirmation() FROM PUBLIC;
-- Remove the legacy direct lot entrypoint and replace it with the team gate.
-- The old function remains callable internally by owner, but NEVER by client.
REVOKE EXECUTE ON FUNCTION inventa07_lab.apply_lot(
 uuid,text,text,text,text,uuid,bigint,jsonb,boolean,bigint)
 FROM inventa07_lab_client;
CREATE FUNCTION inventa07_lab.team_apply_lot(
 p_campaign uuid,p_location text,p_product text,p_lot text,
 p_operation text,p_mutation uuid,p_expected_revision bigint,
 p_breakdown jsonb DEFAULT NULL,p_explicit_zero boolean DEFAULT false,
 p_review_revision bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $gate$
BEGIN
 IF NOT inventa07_lab.team_authorized(p_campaign,p_location) THEN
  RAISE EXCEPTION 'Team terminal lease or individual session invalid';
 END IF;
 RETURN inventa07_lab.apply_lot(p_campaign,p_location,p_product,p_lot,
  p_operation,p_mutation,p_expected_revision,p_breakdown,p_explicit_zero,p_review_revision);
END $gate$;
REVOKE ALL ON FUNCTION inventa07_lab.team_apply_lot(
 uuid,text,text,text,text,uuid,bigint,jsonb,boolean,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.team_apply_lot(
 uuid,text,text,text,text,uuid,bigint,jsonb,boolean,bigint)
 TO inventa07_lab_client;

-- Lost-response receipts are also restricted to the current authenticated holder.
REVOKE EXECUTE ON FUNCTION inventa07_lab.lot_v2_receipt(uuid)
 FROM inventa07_lab_client;
CREATE FUNCTION inventa07_lab.team_lot_v2_receipt(
 p_campaign uuid,p_location text,p_mutation uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $receipt_gate$
DECLARE saved inventa07_lab.mutation_receipts%ROWTYPE;
BEGIN
 IF NOT inventa07_lab.team_authorized(p_campaign,p_location) THEN
  RAISE EXCEPTION 'Team terminal lease or individual session invalid'; END IF;
 SELECT * INTO saved FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF NOT FOUND OR saved.request->>'campaign'<>p_campaign::text
   OR saved.request->>'location'<>p_location THEN
  RETURN NULL; END IF;
 RETURN inventa07_lab.lot_v2_receipt(p_mutation);
END $receipt_gate$;
REVOKE ALL ON FUNCTION inventa07_lab.team_lot_v2_receipt(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.team_lot_v2_receipt(uuid,text,uuid)
 TO inventa07_lab_client;

-- Earlier reference/correction RPCs lack the new team/terminal contract.
-- They are intentionally disabled for this POST-INSTALL team laboratory stage.
REVOKE EXECUTE ON FUNCTION inventa07_lab.apply_reference(
 uuid,text,text,text,uuid,bigint,numeric,boolean,bigint)
 FROM inventa07_lab_client;
REVOKE EXECUTE ON FUNCTION inventa07_lab.apply_correction(
 uuid,text,text,text,uuid,bigint,bigint,numeric,boolean,text,text,uuid)
 FROM inventa07_lab_client;
-- Fail-closed database barrier even if an old count RPC forgets the team.
-- Existing laboratory tests run BEFORE this additive module is installed.
CREATE FUNCTION inventa07_lab.block_unleased_lot_write()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $guard_write$
BEGIN
 IF NOT inventa07_lab.team_authorized(NEW.campaign_id,NEW.location_code)
 THEN RAISE EXCEPTION 'Team terminal lease or individual session invalid'; END IF;
 RETURN NEW;
END $guard_write$;
REVOKE ALL ON FUNCTION inventa07_lab.block_unleased_lot_write() FROM PUBLIC;
CREATE TRIGGER enforce_team_lease_lot BEFORE INSERT OR UPDATE
 ON inventa07_lab.lot_states FOR EACH ROW
 EXECUTE FUNCTION inventa07_lab.block_unleased_lot_write();
CREATE TRIGGER enforce_team_lease_event BEFORE INSERT
 ON inventa07_lab.lot_confirmation_events FOR EACH ROW
 EXECUTE FUNCTION inventa07_lab.block_unleased_lot_write();
CREATE TRIGGER stamp_original_team_on_confirmation BEFORE INSERT
 ON inventa07_lab.lot_confirmation_events FOR EACH ROW
 EXECUTE FUNCTION inventa07_lab.stamp_original_team_on_confirmation();
COMMIT;
