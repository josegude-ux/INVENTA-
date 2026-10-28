-- VISURA INVENTA 07 — PROVISIONALS, SYNTHETIC POSTGRESQL 16 ONLY.
DO $inventa07_guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $inventa07_guard$;
BEGIN;
CREATE TABLE inventa07_lab.provisionals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns,
 location_code text NOT NULL,
 barcode text NOT NULL,
 scan_a uuid NOT NULL,
 scan_b uuid NOT NULL,
 description text NOT NULL CHECK(length(trim(description))>0),
 physical_qty numeric(16,3) NOT NULL CHECK(physical_qty>=0),
 explicit_zero boolean NOT NULL,
 photo_key text,
 counted_by uuid NOT NULL,
 counted_session_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','awaiting_consolidation','resolved_duplicate')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,location_code,barcode),
 CHECK(scan_a<>scan_b),
 CHECK((physical_qty=0 AND explicit_zero) OR (physical_qty>0 AND NOT explicit_zero))
);
CREATE TABLE inventa07_lab.provisional_reviews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provisional_id uuid NOT NULL REFERENCES inventa07_lab.provisionals,
 official_product_code text NOT NULL REFERENCES inventa07_lab.products(code),
 disposition text NOT NULL CHECK(disposition IN ('additional','duplicate')),
 reason text NOT NULL CHECK(length(trim(reason))>0),
 reviewed_by uuid NOT NULL,
 session_id uuid NOT NULL,
 mutation_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON inventa07_lab.provisionals,inventa07_lab.provisional_reviews FROM PUBLIC;
ALTER TABLE inventa07_lab.provisionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.provisionals FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.provisional_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.provisional_reviews FORCE ROW LEVEL SECURITY;
GRANT SELECT ON inventa07_lab.provisionals TO inventa07_lab_client;
CREATE POLICY own_provisional_read ON inventa07_lab.provisionals
 FOR SELECT TO inventa07_lab_client USING (
   counted_by=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
   AND inventa07_lab.current_actor_active()
 );

-- p_source_a/b are synthetic scanner provenance: NEVER treat client assertions
-- as genuine camera capture evidence in the later production implementation.
CREATE FUNCTION inventa07_lab.register_provisional(
 p_campaign uuid,p_location text,p_code_a text,p_event_a uuid,p_source_a text,
 p_code_b text,p_event_b uuid,p_source_b text,p_description text,
 p_quantity numeric,p_explicit_zero boolean,p_mutation uuid,p_photo_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $provisional$
DECLARE
 v_actor uuid;
 v_session uuid;
 v_receipt inventa07_lab.mutation_receipts%ROWTYPE;
 v_request jsonb;
 v_response jsonb;
 v_id uuid;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL OR NOT EXISTS(
    SELECT 1 FROM inventa07_lab.actors WHERE id=v_actor AND active) THEN
  RAISE EXCEPTION 'Authenticated enabled actor required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments
    WHERE campaign_id=p_campaign AND location_code=p_location
      AND actor_id=v_actor AND active) THEN RAISE EXCEPTION 'Assignment revoked'; END IF;
 IF p_mutation IS NULL OR p_event_a IS NULL OR p_event_b IS NULL
  OR p_event_a=p_event_b OR p_source_a IS DISTINCT FROM 'scanner'
  OR p_source_b IS DISTINCT FROM 'scanner' OR p_code_a IS NULL
  OR p_code_b IS NULL OR p_code_a='' OR p_code_a<>p_code_b THEN
  RAISE EXCEPTION 'Two independent matching scanner readings are mandatory'; END IF;
 IF p_description IS NULL OR length(trim(p_description))=0 THEN
  RAISE EXCEPTION 'Short description is mandatory'; END IF;
 IF p_quantity IS NULL OR p_quantity<0 OR p_quantity>9999999999999.999
  OR p_quantity<>round(p_quantity,3)
  OR (p_quantity=0 AND NOT p_explicit_zero)
  OR (p_quantity>0 AND p_explicit_zero) THEN
  RAISE EXCEPTION 'Explicit physical quantity required'; END IF;
 v_request:=jsonb_build_object('campaign',p_campaign,'location',p_location,
  'a',p_code_a,'aId',p_event_a,'aSource',p_source_a,
  'b',p_code_b,'bId',p_event_b,'bSource',p_source_b,
  'description',p_description,'quantity',p_quantity,'zero',p_explicit_zero,
  'photo',p_photo_key);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
 SELECT * INTO v_receipt FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF FOUND THEN
   IF v_receipt.actor_id<>v_actor OR v_receipt.request<>v_request THEN
      RAISE EXCEPTION 'Idempotency key conflict'; END IF;
   RETURN v_receipt.response;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.campaigns
   WHERE id=p_campaign AND status='open') THEN
  RAISE EXCEPTION 'Campaign closed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_campaign::text||p_location||p_code_a,2));
 IF EXISTS(SELECT 1 FROM inventa07_lab.provisionals
   WHERE campaign_id=p_campaign AND location_code=p_location AND barcode=p_code_a)
 THEN RAISE EXCEPTION 'Duplicate provisional at this location'; END IF;
 INSERT INTO inventa07_lab.provisionals(campaign_id,location_code,barcode,
  scan_a,scan_b,description,physical_qty,explicit_zero,photo_key,
  counted_by,counted_session_id)
 VALUES(p_campaign,p_location,p_code_a,p_event_a,p_event_b,trim(p_description),
    p_quantity,p_explicit_zero,p_photo_key,v_actor,v_session) RETURNING id INTO v_id;
 v_response:=jsonb_build_object('id',v_id,'status','pending','barcode',p_code_a,
    'physicalQuantity',p_quantity);
 INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
 VALUES(p_mutation,v_actor,v_request,v_response);
 RETURN v_response;
END $provisional$;
REVOKE ALL ON FUNCTION inventa07_lab.register_provisional(uuid,text,text,uuid,text,text,uuid,text,text,numeric,boolean,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.register_provisional(uuid,text,text,uuid,text,text,uuid,text,text,numeric,boolean,uuid,text)
 TO inventa07_lab_client;

-- Validation is ALWAYS manual: the admin supplies the official code and decision.
-- 'additional' remains awaiting_consolidation; never silently adds to counts.
CREATE FUNCTION inventa07_lab.review_provisional(
 p_provisional uuid,p_official_product text,p_disposition text,p_reason text,p_mutation uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $review$
DECLARE
 v_actor uuid;
 v_session uuid;
 v_provisional inventa07_lab.provisionals%ROWTYPE;
 v_receipt inventa07_lab.mutation_receipts%ROWTYPE;
 v_request jsonb;
 v_response jsonb;
 v_status text;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL OR NOT EXISTS(
  SELECT 1 FROM inventa07_lab.actors WHERE id=v_actor AND active AND role='admin')
 THEN RAISE EXCEPTION 'Administration authentication required'; END IF;
 IF p_mutation IS NULL OR p_provisional IS NULL OR
  p_disposition NOT IN ('additional','duplicate') OR p_disposition IS NULL
  OR p_reason IS NULL OR length(trim(p_reason))=0 THEN
  RAISE EXCEPTION 'Administrative justification and decision are mandatory'; END IF;
 v_request:=jsonb_build_object('provisional',p_provisional,
  'product',p_official_product,'decision',p_disposition,'reason',p_reason);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
 SELECT * INTO v_receipt FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF v_receipt.actor_id<>v_actor OR v_receipt.request<>v_request THEN
    RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN v_receipt.response;
 END IF;
 SELECT * INTO v_provisional FROM inventa07_lab.provisionals
   WHERE id=p_provisional FOR UPDATE;
 IF NOT FOUND OR v_provisional.status<>'pending' THEN
  RAISE EXCEPTION 'Provisional missing or already reviewed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.campaigns
   WHERE id=v_provisional.campaign_id AND status='open') THEN
  RAISE EXCEPTION 'Campaign closed'; END IF;
 IF p_official_product IS NULL OR NOT EXISTS(SELECT 1
    FROM inventa07_lab.products WHERE code=p_official_product) THEN
  RAISE EXCEPTION 'Official reference must be imported first'; END IF;
 v_status:=CASE WHEN p_disposition='duplicate'
  THEN 'resolved_duplicate' ELSE 'awaiting_consolidation' END;
 INSERT INTO inventa07_lab.provisional_reviews(provisional_id,official_product_code,
  disposition,reason,reviewed_by,session_id,mutation_id)
 VALUES(p_provisional,p_official_product,p_disposition,trim(p_reason),v_actor,v_session,p_mutation);
 UPDATE inventa07_lab.provisionals SET status=v_status WHERE id=p_provisional;
 v_response:=jsonb_build_object('status',v_status,'provisional',p_provisional,
  'officialProduct',p_official_product,'quantityUnchanged',true);
 INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
 VALUES(p_mutation,v_actor,v_request,v_response);
 RETURN v_response;
END $review$;
REVOKE ALL ON FUNCTION inventa07_lab.review_provisional(uuid,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.review_provisional(uuid,text,text,text,uuid)
 TO inventa07_lab_client;
-- Explicit authorized work queue for Administration. No automatic SKU suggestions.
CREATE FUNCTION inventa07_lab.admin_pending_provisionals()
 RETURNS TABLE(id uuid,location_code text,barcode text,description text,physical_qty numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $pending$
DECLARE
 v_actor uuid;
 v_session uuid;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL OR NOT EXISTS(
   SELECT 1 FROM inventa07_lab.actors
   WHERE actors.id=v_actor AND active AND role='admin') THEN
   RAISE EXCEPTION 'Only enabled Administration can list pending provisionals';
 END IF;
 RETURN QUERY SELECT p.id,p.location_code,p.barcode,p.description,p.physical_qty
 FROM inventa07_lab.provisionals p WHERE p.status='pending'
 ORDER BY p.created_at,p.id LIMIT 500;
END $pending$;
REVOKE ALL ON FUNCTION inventa07_lab.admin_pending_provisionals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.admin_pending_provisionals() TO inventa07_lab_client;
COMMIT;
