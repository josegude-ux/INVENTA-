-- VISURA INVENTA 07 — correction workflow, DISPOSABLE POSTGRESQL ONLY.
-- Apply ONLY after 001_disposable_reference_contract.sql in a throwaway CI database.
-- Fail closed: these fixtures must NEVER be executed on the Supabase 'postgres' database.
DO $inventa07_guard$
BEGIN
 IF current_database() <> 'inventa07_test' THEN
   RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %', current_database();
 END IF;
END $inventa07_guard$;
BEGIN;
CREATE TABLE inventa07_lab.original_team_members (
 campaign_id uuid NOT NULL, location_code text NOT NULL, actor_id uuid NOT NULL
 REFERENCES inventa07_lab.actors, PRIMARY KEY(campaign_id,location_code,actor_id)
);
CREATE TABLE inventa07_lab.pending_corrections (
 campaign_id uuid NOT NULL,
 location_code text NOT NULL,
 product_code text NOT NULL,
 baseline_revision bigint NOT NULL,
 proposed_qty numeric(16,3) NOT NULL CHECK(proposed_qty>=0),
 explicit_zero boolean NOT NULL,
 reason text NOT NULL CHECK(reason IN
 ('initial_count_error','packaging_error','incomplete_box','double_count','other')),
 explanation text,
 declared_author uuid NOT NULL,
 staged_by uuid NOT NULL,
 PRIMARY KEY(campaign_id,location_code,product_code)
);
REVOKE ALL ON inventa07_lab.original_team_members,inventa07_lab.pending_corrections FROM PUBLIC;
ALTER TABLE inventa07_lab.pending_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.pending_corrections FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.reference_events DROP CONSTRAINT reference_events_kind_check;
ALTER TABLE inventa07_lab.reference_events ADD CONSTRAINT reference_events_kind_check
 CHECK(kind IN ('confirmed','corrected'));
ALTER TABLE inventa07_lab.reference_events
 ADD COLUMN previous_quantity numeric(16,3),
 ADD COLUMN correction_reason text,
 ADD COLUMN declared_author uuid,
 ADD COLUMN correction_explanation text;

CREATE FUNCTION inventa07_lab.apply_correction(
 p_campaign uuid,p_location text,p_product text,p_action text,
 p_mutation uuid,p_expected_revision bigint,p_review_revision bigint DEFAULT NULL,
 p_new_qty numeric DEFAULT NULL,p_explicit_zero boolean DEFAULT false,
 p_reason text DEFAULT NULL,p_explanation text DEFAULT NULL,
 p_declared_author uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 v_actor uuid;
 v_session uuid;
 v_state inventa07_lab.reference_states%ROWTYPE;
 v_proposal inventa07_lab.pending_corrections%ROWTYPE;
 v_receipt inventa07_lab.mutation_receipts%ROWTYPE;
 v_request jsonb;
 v_response jsonb;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL THEN RAISE EXCEPTION 'Missing authenticated session'; END IF;
 IF p_mutation IS NULL OR p_campaign IS NULL OR p_location IS NULL OR p_product IS NULL
    OR p_expected_revision IS NULL OR p_expected_revision<0
    OR p_action NOT IN ('stage','commit') OR p_action IS NULL
 THEN RAISE EXCEPTION 'Invalid correction identity or operation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.actors WHERE id=v_actor AND active) THEN
   RAISE EXCEPTION 'Actor disabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments
    WHERE campaign_id=p_campaign AND location_code=p_location AND actor_id=v_actor AND active)
 THEN RAISE EXCEPTION 'Assignment revoked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.original_team_members
    WHERE campaign_id=p_campaign AND location_code=p_location AND actor_id=v_actor)
 THEN RAISE EXCEPTION 'Not an original team member'; END IF;
 v_request:=jsonb_build_object('campaign',p_campaign,'location',p_location,
  'product',p_product,'action',p_action,'expected',p_expected_revision,
  'review',p_review_revision,'new',p_new_qty,'zero',p_explicit_zero,
  'reason',p_reason,'explanation',p_explanation,'declared',p_declared_author);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
 SELECT * INTO v_receipt FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF FOUND THEN
   IF v_receipt.actor_id<>v_actor OR v_receipt.request<>v_request THEN
     RAISE EXCEPTION 'Idempotency key conflict'; END IF;
   RETURN v_receipt.response;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.campaigns
    WHERE id=p_campaign AND status='open') THEN RAISE EXCEPTION 'Campaign closed'; END IF;
 SELECT * INTO STRICT v_state FROM inventa07_lab.reference_states
  WHERE campaign_id=p_campaign AND location_code=p_location
    AND product_code=p_product FOR UPDATE;
 IF v_state.revision<>p_expected_revision THEN RAISE EXCEPTION 'Stale correction revision'; END IF;
 IF v_state.status<>'confirmed' THEN RAISE EXCEPTION 'Only confirmed references can be corrected'; END IF;
 IF p_action='stage' THEN
   IF p_new_qty IS NULL OR p_new_qty<0 OR p_new_qty>9999999999999.999
      OR p_new_qty<>round(p_new_qty,3)
      OR (p_new_qty=0 AND NOT p_explicit_zero)
      OR (p_new_qty>0 AND p_explicit_zero) THEN
      RAISE EXCEPTION 'Invalid corrected quantity'; END IF;
   IF p_reason NOT IN ('initial_count_error','packaging_error',
       'incomplete_box','double_count','other') OR p_reason IS NULL
       OR (p_reason='other' AND length(trim(coalesce(p_explanation,'')))=0) THEN
      RAISE EXCEPTION 'A valid correction reason is mandatory'; END IF;
   IF p_declared_author IS NULL OR NOT EXISTS(
      SELECT 1 FROM inventa07_lab.original_team_members t
      JOIN inventa07_lab.assignments a ON a.campaign_id=t.campaign_id
       AND a.location_code=t.location_code AND a.actor_id=t.actor_id AND a.active
      JOIN inventa07_lab.actors actor ON actor.id=t.actor_id AND actor.active
      WHERE t.campaign_id=p_campaign AND t.location_code=p_location
        AND t.actor_id=p_declared_author) THEN
      RAISE EXCEPTION 'Declared author is not an authorized original member'; END IF;
   IF EXISTS(SELECT 1 FROM inventa07_lab.pending_corrections
      WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product)
   THEN RAISE EXCEPTION 'Unreviewed correction already exists'; END IF;
   INSERT INTO inventa07_lab.pending_corrections
     (campaign_id,location_code,product_code,baseline_revision,proposed_qty,
      explicit_zero,reason,explanation,declared_author,staged_by)
   VALUES (p_campaign,p_location,p_product,v_state.revision,p_new_qty,
      p_explicit_zero,p_reason,p_explanation,p_declared_author,v_actor);
   UPDATE inventa07_lab.reference_states SET revision=revision+1
     WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product;
   v_response:=jsonb_build_object('phase','review','revision',v_state.revision+1,
    'previousPhysical',v_state.confirmed_qty,'proposedPhysical',p_new_qty,
    'declaredAuthor',p_declared_author);
 ELSE
   IF p_new_qty IS NOT NULL OR p_reason IS NOT NULL OR p_declared_author IS NOT NULL
       OR p_review_revision IS DISTINCT FROM v_state.revision THEN
     RAISE EXCEPTION 'Correction review token mismatch'; END IF;
   SELECT * INTO v_proposal FROM inventa07_lab.pending_corrections
     WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product
       FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'No reviewed correction proposal'; END IF;
   IF v_proposal.baseline_revision<>v_state.revision-1
      OR v_proposal.staged_by<>v_actor THEN
     RAISE EXCEPTION 'Correction author or baseline changed'; END IF;
   IF NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments a
     JOIN inventa07_lab.actors act ON act.id=a.actor_id AND act.active
     WHERE a.campaign_id=p_campaign AND a.location_code=p_location
      AND a.actor_id=v_proposal.declared_author AND a.active) THEN
     RAISE EXCEPTION 'Declared author no longer authorized'; END IF;
   UPDATE inventa07_lab.reference_states SET revision=revision+1,
     confirmed_qty=v_proposal.proposed_qty,confirmed_zero=v_proposal.explicit_zero
     WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product;
   INSERT INTO inventa07_lab.reference_events
     (campaign_id,location_code,product_code,kind,quantity,previous_quantity,
      explicit_zero,actor_id,authenticated_session_id,mutation_id,
      correction_reason,declared_author,correction_explanation)
   VALUES (p_campaign,p_location,p_product,'corrected',v_proposal.proposed_qty,
     v_state.confirmed_qty,v_proposal.explicit_zero,v_actor,v_session,p_mutation,
     v_proposal.reason,v_proposal.declared_author,v_proposal.explanation);
   DELETE FROM inventa07_lab.pending_corrections
     WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product;
   v_response:=jsonb_build_object('phase','confirmed','revision',v_state.revision+1,
    'originalPhysical',v_state.confirmed_qty,'newPhysical',v_proposal.proposed_qty);
 END IF;
 INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
 VALUES (p_mutation,v_actor,v_request,v_response);
 RETURN v_response;
END $$;
REVOKE ALL ON FUNCTION inventa07_lab.apply_correction(uuid,text,text,text,uuid,bigint,bigint,numeric,boolean,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.apply_correction(uuid,text,text,text,uuid,bigint,bigint,numeric,boolean,text,text,uuid) TO inventa07_lab_client;
COMMIT;
