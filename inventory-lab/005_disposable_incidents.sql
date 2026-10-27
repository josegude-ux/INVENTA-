-- VISURA INVENTA 07 — incident server contract, POSTGRESQL 16 LAB ONLY.
-- This schema is synthetic and MUST NOT be deployed to Supabase.
DO $guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $guard$;
BEGIN;
CREATE TABLE inventa07_lab.incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns,
 location_code text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('illegible-code','used-alias-misattribution','other-physical-incident')),
 description text NOT NULL CHECK(length(trim(description))>0),
 physical_qty numeric(16,3),
 explicit_zero boolean NOT NULL DEFAULT false,
 affected_count_event bigint REFERENCES inventa07_lab.reference_events(id),
 reported_by uuid NOT NULL REFERENCES inventa07_lab.actors,
 reported_session uuid NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','awaiting_correction','resolved')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK(kind<>'illegible-code' OR physical_qty IS NOT NULL),
 CHECK(kind<>'used-alias-misattribution' OR affected_count_event IS NOT NULL),
 CHECK(physical_qty IS NULL OR (physical_qty>=0 AND
  ((physical_qty=0 AND explicit_zero) OR (physical_qty>0 AND NOT explicit_zero))))
);
CREATE TABLE inventa07_lab.incident_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 incident_id uuid NOT NULL REFERENCES inventa07_lab.incidents,
 event_kind text NOT NULL CHECK(event_kind IN ('opened','reviewed','correction-verified')),
 actor_id uuid NOT NULL,
 authenticated_session uuid NOT NULL,
 resolution text,
 reason text,
 correction_event_id bigint REFERENCES inventa07_lab.reference_events(id),
 mutation_id uuid NOT NULL UNIQUE,
 at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventa07_lab.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.incident_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON inventa07_lab.incidents,inventa07_lab.incident_events FROM PUBLIC;
GRANT SELECT ON inventa07_lab.incidents TO inventa07_lab_client;
CREATE POLICY report_owner_read ON inventa07_lab.incidents
 FOR SELECT TO inventa07_lab_client USING (
  reported_by=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
   AND inventa07_lab.current_actor_active()
 );
CREATE FUNCTION inventa07_lab.register_incident(
 p_campaign uuid,p_location text,p_kind text,p_description text,
 p_quantity numeric,p_zero boolean,p_affected_event bigint,p_mutation uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $create$
DECLARE
 actor uuid; sess uuid; request_body jsonb;
 old_receipt inventa07_lab.mutation_receipts%ROWTYPE;
 result_body jsonb; incident_id uuid;
BEGIN
 actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 sess:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF actor IS NULL OR sess IS NULL OR NOT EXISTS(SELECT 1 FROM inventa07_lab.actors
   WHERE id=actor AND active) THEN RAISE EXCEPTION 'Enabled authenticated user required'; END IF;
 IF p_mutation IS NULL OR p_campaign IS NULL OR p_location IS NULL OR p_location=''
   OR p_description IS NULL OR trim(p_description)=''
   OR p_kind NOT IN ('illegible-code','used-alias-misattribution','other-physical-incident')
   OR p_kind IS NULL THEN
   RAISE EXCEPTION 'Invalid incident identity, type or description'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments
  WHERE campaign_id=p_campaign AND location_code=p_location AND actor_id=actor AND active)
 THEN RAISE EXCEPTION 'Assignment revoked'; END IF;
 IF p_kind='illegible-code' AND p_quantity IS NULL THEN
  RAISE EXCEPTION 'Illegible item requires its physical count'; END IF;
 IF p_quantity IS NOT NULL AND (p_quantity<0 OR p_quantity>9999999999999.999
   OR p_quantity<>round(p_quantity,3)
   OR (p_quantity=0 AND NOT p_zero) OR (p_quantity>0 AND p_zero)) THEN
  RAISE EXCEPTION 'Invalid physical quantity or explicit zero'; END IF;
 IF p_kind='used-alias-misattribution' THEN
  IF p_affected_event IS NULL OR NOT EXISTS(SELECT 1 FROM inventa07_lab.reference_events
   WHERE id=p_affected_event AND campaign_id=p_campaign AND location_code=p_location)
  THEN RAISE EXCEPTION 'Actually used count event required'; END IF;
 ELSIF p_affected_event IS NOT NULL THEN
  RAISE EXCEPTION 'Historic count event only allowed for used aliases'; END IF;
 request_body:=jsonb_build_object('campaign',p_campaign,'location',p_location,
  'kind',p_kind,'description',p_description,'quantity',p_quantity,
  'zero',p_zero,'affected',p_affected_event);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
 SELECT * INTO old_receipt FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF old_receipt.actor_id<>actor OR old_receipt.request<>request_body
   THEN RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN old_receipt.response;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.campaigns
  WHERE id=p_campaign AND status='open') THEN RAISE EXCEPTION 'Campaign closed'; END IF;
 INSERT INTO inventa07_lab.incidents(campaign_id,location_code,kind,description,
  physical_qty,explicit_zero,affected_count_event,reported_by,reported_session)
 VALUES(p_campaign,p_location,p_kind,p_description,p_quantity,coalesce(p_zero,false),
  p_affected_event,actor,sess) RETURNING id INTO incident_id;
 INSERT INTO inventa07_lab.incident_events(incident_id,event_kind,actor_id,authenticated_session,mutation_id)
 VALUES(incident_id,'opened',actor,sess,p_mutation);
 result_body:=jsonb_build_object('incidentId',incident_id,'status','open','physicalQuantity',p_quantity);
 INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
 VALUES(p_mutation,actor,request_body,result_body);
 RETURN result_body;
END $create$;
CREATE FUNCTION inventa07_lab.review_incident(
 p_incident uuid,p_decision text,p_reason text,
 p_expected_revision bigint,p_mutation uuid,p_correction_event bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $review$
DECLARE
 actor uuid;sess uuid;
 item inventa07_lab.incidents%ROWTYPE;
 old_receipt inventa07_lab.mutation_receipts%ROWTYPE;
 request_body jsonb;result_body jsonb;new_status text;
BEGIN
 actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 sess:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF actor IS NULL OR sess IS NULL OR NOT EXISTS(SELECT 1 FROM inventa07_lab.actors
   WHERE id=actor AND active AND role='admin') THEN
   RAISE EXCEPTION 'Only enabled Administration can resolve incidents'; END IF;
 IF p_incident IS NULL OR p_mutation IS NULL OR p_expected_revision IS NULL
   OR p_decision NOT IN ('resolved','manual-correction-required','correction-verified')
   OR p_decision IS NULL OR p_reason IS NULL OR trim(p_reason)=''
 THEN RAISE EXCEPTION 'Decision, version and reason required'; END IF;
 request_body:=jsonb_build_object('incident',p_incident,'decision',p_decision,
   'reason',p_reason,'revision',p_expected_revision,'correction',p_correction_event);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
 SELECT * INTO old_receipt FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF old_receipt.actor_id<>actor OR old_receipt.request<>request_body THEN
   RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN old_receipt.response;
 END IF;
 SELECT * INTO item FROM inventa07_lab.incidents WHERE id=p_incident FOR UPDATE;
 IF NOT FOUND OR item.revision<>p_expected_revision THEN RAISE EXCEPTION 'Stale or missing incident'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.campaigns
  WHERE id=item.campaign_id AND status='open') THEN RAISE EXCEPTION 'Campaign closed'; END IF;
 IF p_decision='correction-verified' THEN
  IF item.status<>'awaiting_correction' OR p_correction_event IS NULL OR NOT EXISTS(
    SELECT 1 FROM inventa07_lab.reference_events
    WHERE id=p_correction_event AND kind='corrected' AND
     campaign_id=item.campaign_id AND location_code=item.location_code)
  THEN RAISE EXCEPTION 'Verified correction event required'; END IF;
  new_status:='resolved';
 ELSE
  IF item.status<>'open' OR p_correction_event IS NOT NULL
  THEN RAISE EXCEPTION 'Incident is not open or correction evidence mismatches'; END IF;
  new_status:=CASE WHEN p_decision='resolved' THEN 'resolved' ELSE 'awaiting_correction' END;
 END IF;
 UPDATE inventa07_lab.incidents SET status=new_status,revision=revision+1 WHERE id=item.id;
 INSERT INTO inventa07_lab.incident_events(
  incident_id,event_kind,actor_id,authenticated_session,resolution,
  reason,correction_event_id,mutation_id)
 VALUES(item.id,CASE WHEN p_decision='correction-verified' THEN 'correction-verified' ELSE 'reviewed' END,
  actor,sess,p_decision,p_reason,p_correction_event,p_mutation);
 result_body:=jsonb_build_object('incidentId',item.id,'status',new_status,'revision',item.revision+1);
 INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
 VALUES(p_mutation,actor,request_body,result_body);
 RETURN result_body;
END $review$;
CREATE FUNCTION inventa07_lab.admin_pending_incidents()
 RETURNS TABLE(id uuid,location_code text,kind text,status text,description text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $queue$
DECLARE actor uuid;sess uuid;
BEGIN
 actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 sess:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF actor IS NULL OR sess IS NULL OR NOT EXISTS(SELECT 1 FROM inventa07_lab.actors
   WHERE actors.id=actor AND active AND role='admin') THEN
  RAISE EXCEPTION 'Only enabled Administration can review incidents'; END IF;
 RETURN QUERY SELECT i.id,i.location_code,i.kind,i.status,i.description
 FROM inventa07_lab.incidents i WHERE i.status<>'resolved'
 ORDER BY i.id LIMIT 500;
END $queue$;
REVOKE ALL ON FUNCTION inventa07_lab.register_incident(uuid,text,text,text,numeric,boolean,bigint,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION inventa07_lab.review_incident(uuid,text,text,bigint,uuid,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION inventa07_lab.admin_pending_incidents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.register_incident(uuid,text,text,text,numeric,boolean,bigint,uuid) TO inventa07_lab_client;
GRANT EXECUTE ON FUNCTION inventa07_lab.review_incident(uuid,text,text,bigint,uuid,bigint) TO inventa07_lab_client;
GRANT EXECUTE ON FUNCTION inventa07_lab.admin_pending_incidents() TO inventa07_lab_client;
COMMIT;
