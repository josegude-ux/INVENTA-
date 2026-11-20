-- VISURA INVENTA 07 — Lot-aware draft and confirmed reference, disposable PostgreSQL ONLY.
DO $guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $guard$;
BEGIN;
CREATE TABLE inventa07_lab.lot_states(
 campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns,
 location_code text NOT NULL,
 product_code text NOT NULL REFERENCES inventa07_lab.products(code),
 lot text NOT NULL DEFAULT '',
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 status text NOT NULL DEFAULT 'uncounted' CHECK(status IN('uncounted','draft','confirmed')),
 ever_started boolean NOT NULL DEFAULT false,
 draft_qty numeric(16,3),
 draft_zero boolean NOT NULL DEFAULT false,
 draft_breakdown jsonb,
 confirmed_qty numeric(16,3),
 confirmed_zero boolean NOT NULL DEFAULT false,
 confirmed_breakdown jsonb,
 PRIMARY KEY(campaign_id,location_code,product_code,lot),
 CHECK(draft_qty IS NULL OR draft_qty>=0),
 CHECK(confirmed_qty IS NULL OR confirmed_qty>=0),
 CHECK(status<>'confirmed' OR confirmed_qty IS NOT NULL)
);
CREATE TABLE inventa07_lab.lot_confirmation_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 campaign_id uuid NOT NULL,
 location_code text NOT NULL,
 product_code text NOT NULL,
 lot text NOT NULL,
 quantity numeric(16,3) NOT NULL,
 explicit_zero boolean NOT NULL,
 breakdown jsonb NOT NULL,
 actor_id uuid NOT NULL,
 session_id uuid NOT NULL,
 mutation_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON inventa07_lab.lot_states,inventa07_lab.lot_confirmation_events FROM PUBLIC;
ALTER TABLE inventa07_lab.lot_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.lot_states FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.lot_confirmation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.lot_confirmation_events FORCE ROW LEVEL SECURITY;
GRANT SELECT ON inventa07_lab.lot_states TO inventa07_lab_client;
CREATE POLICY lot_assigned_read ON inventa07_lab.lot_states
 FOR SELECT TO inventa07_lab_client USING (
  inventa07_lab.current_actor_active() AND EXISTS(
   SELECT 1 FROM inventa07_lab.assignments a
   WHERE a.campaign_id=lot_states.campaign_id AND
     a.location_code=lot_states.location_code AND a.active
     AND a.actor_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)
 );
-- Every quantity is recomputed from structure. Subtotals and client totals cannot
-- silently override the physical breakdown. This is not yet production code.
CREATE FUNCTION inventa07_lab.lot_quantity(p_items jsonb,p_zero boolean)
 RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $compute$
DECLARE item jsonb;kind text;total numeric:=0;subtotal numeric;
 a text;b text;c text;
BEGIN
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' THEN
  RAISE EXCEPTION 'Physical breakdown must be an array'; END IF;
 IF p_zero IS TRUE THEN
  IF jsonb_array_length(p_items)<>0 THEN
   RAISE EXCEPTION 'Explicit zero cannot include other physical amounts'; END IF;
  RETURN 0;
 END IF;
 IF jsonb_array_length(p_items)=0 THEN
  RAISE EXCEPTION 'Empty quantity is not an explicit zero'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items)
 LOOP
  IF jsonb_typeof(item)<>'object' THEN RAISE EXCEPTION 'Invalid physical group'; END IF;
  kind:=item->>'type';
  IF kind='loose' THEN
    a:=item->>'units';
    IF a IS NULL OR a !~ '^[0-9]+(\.[0-9]{1,3})?$' THEN
      RAISE EXCEPTION 'Invalid loose units'; END IF;
    subtotal:=a::numeric;
  ELSIF kind='boxes' OR kind='pallet-group' THEN
    a:=CASE WHEN kind='boxes' THEN item->>'boxes' ELSE item->>'layers' END;
    b:=CASE WHEN kind='boxes' THEN item->>'unitsPerBox' ELSE item->>'boxesPerBase' END;
    c:=CASE WHEN kind='boxes' THEN NULL ELSE item->>'unitsPerBox' END;
    IF a IS NULL OR b IS NULL OR a !~ '^[0-9]+$'
       OR b !~ '^[0-9]+$' OR (kind='pallet-group' AND
           (c IS NULL OR c !~ '^[0-9]+$')) THEN
      RAISE EXCEPTION 'Invalid boxes or pallet group'; END IF;
    IF a::numeric<1 OR b::numeric<1 OR
       (c IS NOT NULL AND c::numeric<1) THEN
      RAISE EXCEPTION 'Packaging factors must be positive integers'; END IF;
    subtotal:=a::numeric*b::numeric*coalesce(c::numeric,1);
    IF item->>'subtotal' IS NULL OR
       (item->>'subtotal')::numeric IS DISTINCT FROM subtotal THEN
      RAISE EXCEPTION 'Subtotal differs from server recomputation'; END IF;
  ELSE
    RAISE EXCEPTION 'Unknown breakdown item type'; END IF;
  total:=total+subtotal;
  IF total>9999999999999.999 THEN RAISE EXCEPTION 'Physical quantity exceeds numeric 16,3'; END IF;
 END LOOP;
 IF total<=0 THEN RAISE EXCEPTION 'Use explicit zero instead of a blank/zero breakdown'; END IF;
 RETURN total;
END $compute$;
REVOKE ALL ON FUNCTION inventa07_lab.lot_quantity(jsonb,boolean) FROM PUBLIC;

CREATE FUNCTION inventa07_lab.apply_lot(
 p_campaign uuid,p_location text,p_product text,p_lot text,
 p_operation text,p_mutation uuid,p_expected_revision bigint,
 p_breakdown jsonb DEFAULT NULL,p_explicit_zero boolean DEFAULT false,
 p_review_revision bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $lot_rpc$
DECLARE
 actor uuid;sess uuid;
 row_state inventa07_lab.lot_states%ROWTYPE;
 past inventa07_lab.mutation_receipts%ROWTYPE;
 request_body jsonb;response_body jsonb;
 physical numeric;
BEGIN
 actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 sess:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF actor IS NULL OR sess IS NULL OR NOT EXISTS(
   SELECT 1 FROM inventa07_lab.actors WHERE id=actor AND active)
 THEN RAISE EXCEPTION 'Enabled authenticated user required'; END IF;
 IF p_campaign IS NULL OR p_location IS NULL OR p_location='' OR p_product IS NULL
   OR p_product='' OR p_lot IS NULL OR p_operation NOT IN ('draft','confirm')
   OR p_operation IS NULL OR p_mutation IS NULL OR
   p_expected_revision IS NULL OR p_expected_revision<0 THEN
  RAISE EXCEPTION 'Invalid lot reference or mutation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.assignments
  WHERE campaign_id=p_campaign AND location_code=p_location
  AND actor_id=actor AND active) THEN RAISE EXCEPTION 'Assignment revoked'; END IF;
 request_body:=jsonb_build_object('campaign',p_campaign,'location',p_location,
   'product',p_product,'lot',p_lot,'operation',p_operation,
   'revision',p_expected_revision,'breakdown',p_breakdown,'zero',p_explicit_zero,
   'reviewRevision',p_review_revision);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
 SELECT * INTO past FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF past.actor_id<>actor OR past.request<>request_body
  THEN RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN past.response;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.campaigns
  WHERE id=p_campaign AND status='open') THEN RAISE EXCEPTION 'Campaign closed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inventa07_lab.products WHERE code=p_product)
 THEN RAISE EXCEPTION 'Unknown official reference'; END IF;
 INSERT INTO inventa07_lab.lot_states(campaign_id,location_code,product_code,lot)
 VALUES(p_campaign,p_location,p_product,p_lot) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT row_state FROM inventa07_lab.lot_states
 WHERE campaign_id=p_campaign AND location_code=p_location
  AND product_code=p_product AND lot=p_lot FOR UPDATE;
 IF row_state.revision<>p_expected_revision THEN
  RAISE EXCEPTION 'Stale lot reference revision'; END IF;
 IF row_state.status='confirmed' THEN
  RAISE EXCEPTION 'Confirmed lot requires justified correction'; END IF;
 IF p_operation='draft' THEN
  physical:=inventa07_lab.lot_quantity(p_breakdown,p_explicit_zero);
  UPDATE inventa07_lab.lot_states SET status='draft',revision=revision+1,
   ever_started=true,draft_qty=physical,draft_zero=p_explicit_zero,
   draft_breakdown=p_breakdown
  WHERE campaign_id=p_campaign AND location_code=p_location
   AND product_code=p_product AND lot=p_lot;
  response_body:=jsonb_build_object('operation','draft','lot',p_lot,
   'quantity',physical,'revision',row_state.revision+1);
 ELSE
  IF p_breakdown IS NOT NULL OR p_review_revision IS DISTINCT FROM row_state.revision
    OR row_state.status<>'draft' THEN
   RAISE EXCEPTION 'Reviewed lot version invalid'; END IF;
  UPDATE inventa07_lab.lot_states SET status='confirmed',revision=revision+1,
    draft_qty=NULL,draft_zero=false,draft_breakdown=NULL,
    confirmed_qty=row_state.draft_qty,confirmed_zero=row_state.draft_zero,
    confirmed_breakdown=row_state.draft_breakdown
  WHERE campaign_id=p_campaign AND location_code=p_location
    AND product_code=p_product AND lot=p_lot;
  INSERT INTO inventa07_lab.lot_confirmation_events(campaign_id,location_code,
    product_code,lot,quantity,explicit_zero,breakdown,actor_id,session_id,mutation_id)
  VALUES(p_campaign,p_location,p_product,p_lot,row_state.draft_qty,
    row_state.draft_zero,row_state.draft_breakdown,actor,sess,p_mutation);
  response_body:=jsonb_build_object('operation','confirmed','lot',p_lot,
   'quantity',row_state.draft_qty,'revision',row_state.revision+1);
 END IF;
 INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
 VALUES(p_mutation,actor,request_body,response_body);
 RETURN response_body;
END $lot_rpc$;
REVOKE ALL ON FUNCTION inventa07_lab.apply_lot(uuid,text,text,text,text,uuid,bigint,jsonb,boolean,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.apply_lot(uuid,text,text,text,text,uuid,bigint,jsonb,boolean,bigint)
 TO inventa07_lab_client;
COMMIT;
