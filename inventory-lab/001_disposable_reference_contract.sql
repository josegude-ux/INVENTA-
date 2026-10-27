-- VISURA INVENTA 07 — EPHEMERAL CONTRACT TEST ONLY
-- Run on a disposable PostgreSQL 16 database. DO NOT APPLY TO SUPABASE OR PRODUCTION.
-- Request claims below are fake, set by psql tests; real Supabase must verify JWTs.
-- Fail closed: these fixtures must NEVER be executed on the Supabase 'postgres' database.
DO $inventa07_guard$
BEGIN
 IF current_database() <> 'inventa07_test' THEN
   RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %', current_database();
 END IF;
END $inventa07_guard$;
BEGIN;
CREATE SCHEMA inventa07_lab;
REVOKE ALL ON SCHEMA inventa07_lab FROM PUBLIC;
CREATE ROLE inventa07_lab_client NOLOGIN;
GRANT USAGE ON SCHEMA inventa07_lab TO inventa07_lab_client;

CREATE TABLE inventa07_lab.actors (
  id uuid PRIMARY KEY,
  active boolean NOT NULL,
  role text NOT NULL CHECK (role IN ('operator','supervisor','admin'))
);
CREATE TABLE inventa07_lab.campaigns (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('open','closed'))
);
CREATE TABLE inventa07_lab.products (code text PRIMARY KEY);
CREATE TABLE inventa07_lab.assignments (
  campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns,
  location_code text NOT NULL,
  actor_id uuid NOT NULL REFERENCES inventa07_lab.actors,
  active boolean NOT NULL,
  PRIMARY KEY (campaign_id,location_code,actor_id)
);
CREATE TABLE inventa07_lab.bc_theoretical (
  campaign_id uuid NOT NULL, location_code text NOT NULL, product_code text NOT NULL,
  theoretical_qty numeric(16,3) NOT NULL
);
CREATE TABLE inventa07_lab.reference_states (
  campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns,
  location_code text NOT NULL,
  product_code text NOT NULL REFERENCES inventa07_lab.products,
  revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  status text NOT NULL DEFAULT 'uncounted' CHECK(status IN ('uncounted','draft','confirmed')),
  ever_started boolean NOT NULL DEFAULT false,
  draft_qty numeric(16,3),
  draft_zero boolean NOT NULL DEFAULT false,
  confirmed_qty numeric(16,3),
  confirmed_zero boolean NOT NULL DEFAULT false,
  PRIMARY KEY(campaign_id,location_code,product_code),
  CHECK(draft_qty IS NULL OR draft_qty>=0),
  CHECK(confirmed_qty IS NULL OR confirmed_qty>=0),
  CHECK(status<>'confirmed' OR confirmed_qty IS NOT NULL)
);
CREATE TABLE inventa07_lab.reference_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id uuid NOT NULL,
  location_code text NOT NULL,
  product_code text NOT NULL,
  kind text NOT NULL CHECK(kind='confirmed'),
  quantity numeric(16,3) NOT NULL,
  explicit_zero boolean NOT NULL,
  actor_id uuid NOT NULL,
  authenticated_session_id uuid NOT NULL,
  mutation_id uuid NOT NULL UNIQUE,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventa07_lab.mutation_receipts (
  mutation_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  request jsonb NOT NULL,
  response jsonb NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA inventa07_lab FROM PUBLIC;
-- The data-facing RLS must also revoke SELECT once an account is disabled.
-- This helper exposes only the enabled predicate, not other users' profiles.
CREATE FUNCTION inventa07_lab.current_actor_active() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $
 SELECT EXISTS (SELECT 1 FROM inventa07_lab.actors
  WHERE id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid AND active)
 $;
REVOKE ALL ON FUNCTION inventa07_lab.current_actor_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.current_actor_active() TO inventa07_lab_client;
ALTER TABLE inventa07_lab.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY only_current_assignments ON inventa07_lab.assignments
 FOR SELECT TO inventa07_lab_client USING (
  actor_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
   AND inventa07_lab.current_actor_active()
   AND active
 );
ALTER TABLE inventa07_lab.reference_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.reference_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.bc_theoretical ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.reference_states FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.reference_events FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.bc_theoretical FORCE ROW LEVEL SECURITY;
GRANT SELECT ON inventa07_lab.reference_states,inventa07_lab.reference_events TO inventa07_lab_client;
CREATE POLICY assigned_reference_read ON inventa07_lab.reference_states
 FOR SELECT TO inventa07_lab_client USING (
  EXISTS (SELECT 1 FROM inventa07_lab.assignments a
     WHERE a.campaign_id=reference_states.campaign_id
       AND a.location_code=reference_states.location_code
       AND a.actor_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
       AND a.active)
 );
-- For this synthetic RLS test only, allow reading assignments to evaluate the policy.
GRANT SELECT ON inventa07_lab.assignments TO inventa07_lab_client;
CREATE POLICY assigned_event_read ON inventa07_lab.reference_events
 FOR SELECT TO inventa07_lab_client USING (
  EXISTS (SELECT 1 FROM inventa07_lab.assignments a
     WHERE a.campaign_id=reference_events.campaign_id
       AND a.location_code=reference_events.location_code
       AND a.actor_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
       AND a.active)
 );

-- Only the callable RPC can insert/update; direct client writes are denied.
-- SECURITY DEFINER is deliberately used IN THIS THROWAWAY TEST ONLY, and
-- all authorization is checked inside it before any data access.
CREATE FUNCTION inventa07_lab.apply_reference(
  p_campaign uuid,p_location text,p_product text,p_operation text,
  p_mutation uuid,p_expected_revision bigint,
  p_quantity numeric DEFAULT NULL,p_explicit_zero boolean DEFAULT false,
  p_review_revision bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_actor uuid;
  v_session uuid;
  v_state inventa07_lab.reference_states%ROWTYPE;
  v_receipt inventa07_lab.mutation_receipts%ROWTYPE;
  v_request jsonb;
  v_response jsonb;
BEGIN
  v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
  IF v_actor IS NULL OR v_session IS NULL THEN RAISE EXCEPTION 'Missing authenticated session'; END IF;
  IF p_mutation IS NULL OR p_campaign IS NULL OR p_location IS NULL OR p_product IS NULL
     OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
    RAISE EXCEPTION 'Invalid count identity or version';
  END IF;
  IF p_operation NOT IN ('draft','confirm') OR p_operation IS NULL THEN
    RAISE EXCEPTION 'Unsupported operation';
  END IF;
  -- This checked authorization is not derived from any client-supplied boolean or role.
  IF NOT EXISTS (SELECT 1 FROM inventa07_lab.actors WHERE id=v_actor AND active) THEN
    RAISE EXCEPTION 'Account disabled or unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM inventa07_lab.assignments
                 WHERE campaign_id=p_campaign AND location_code=p_location
                   AND actor_id=v_actor AND active) THEN
    RAISE EXCEPTION 'Assignment revoked';
  END IF;
  -- Normalize typed JSON to compare idempotent retries (including revision and zero).
  v_request:=jsonb_build_object('campaign',p_campaign,'location',p_location,
    'product',p_product,'operation',p_operation,'revision',p_expected_revision,
    'quantity',p_quantity,'zero',p_explicit_zero,'review',p_review_revision);
  -- Serialized per mutation key; a repeated network request sees the prior result.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
  SELECT * INTO v_receipt FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
  IF FOUND THEN
    IF v_receipt.actor_id<>v_actor OR v_receipt.request<>v_request THEN
      RAISE EXCEPTION 'Idempotency key conflict';
    END IF;
    RETURN v_receipt.response;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM inventa07_lab.campaigns WHERE id=p_campaign AND status='open') THEN
    RAISE EXCEPTION 'Campaign is closed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM inventa07_lab.products WHERE code=p_product) THEN
    RAISE EXCEPTION 'Unknown official product; use provisional flow';
  END IF;
  INSERT INTO inventa07_lab.reference_states(campaign_id,location_code,product_code)
    VALUES(p_campaign,p_location,p_product) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT v_state FROM inventa07_lab.reference_states
    WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product FOR UPDATE;
  IF v_state.revision<>p_expected_revision THEN RAISE EXCEPTION 'Stale reference revision'; END IF;
  IF v_state.status='confirmed' THEN RAISE EXCEPTION 'Confirmed reference requires justified correction flow'; END IF;
  IF p_operation='draft' THEN
    IF p_quantity IS NULL OR p_quantity<0 OR p_quantity>9999999999999.999
        OR p_quantity<>round(p_quantity,3)
        OR (p_quantity=0 AND NOT p_explicit_zero)
        OR (p_quantity>0 AND p_explicit_zero) THEN
      RAISE EXCEPTION 'Invalid draft quantity or explicit zero';
    END IF;
    UPDATE inventa07_lab.reference_states SET revision=revision+1,status='draft',
      ever_started=true,draft_qty=p_quantity,draft_zero=p_explicit_zero
      WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product;
    v_response:=jsonb_build_object('revision',v_state.revision+1,'status','draft',
      'physicalQuantity',p_quantity,'explicitZero',p_explicit_zero);
  ELSE
    IF p_quantity IS NOT NULL OR p_review_revision IS DISTINCT FROM v_state.revision
        OR v_state.status<>'draft' OR v_state.draft_qty IS NULL THEN
      RAISE EXCEPTION 'Review version invalid or draft missing';
    END IF;
    UPDATE inventa07_lab.reference_states SET revision=revision+1,status='confirmed',
      draft_qty=NULL,draft_zero=false,confirmed_qty=v_state.draft_qty,
      confirmed_zero=v_state.draft_zero
      WHERE campaign_id=p_campaign AND location_code=p_location AND product_code=p_product;
    INSERT INTO inventa07_lab.reference_events(campaign_id,location_code,product_code,
      kind,quantity,explicit_zero,actor_id,authenticated_session_id,mutation_id)
      VALUES(p_campaign,p_location,p_product,'confirmed',v_state.draft_qty,
        v_state.draft_zero,v_actor,v_session,p_mutation);
    v_response:=jsonb_build_object('revision',v_state.revision+1,'status','confirmed',
      'physicalQuantity',v_state.draft_qty,'explicitZero',v_state.draft_zero);
  END IF;
  INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
    VALUES(p_mutation,v_actor,v_request,v_response);
  RETURN v_response;
END $$;
REVOKE ALL ON FUNCTION inventa07_lab.apply_reference(uuid,text,text,text,uuid,bigint,numeric,boolean,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.apply_reference(uuid,text,text,text,uuid,bigint,numeric,boolean,bigint)
  TO inventa07_lab_client;
COMMIT;
