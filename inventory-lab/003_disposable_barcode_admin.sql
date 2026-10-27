-- VISURA INVENTA 07 — INTERNAL BARCODE ASSOCIATIONS (EPHEMERAL TEST ONLY).
-- This is NOT a migration for Supabase; no official BC codes are modified.
DO $inventa07_guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $inventa07_guard$;
BEGIN;
CREATE TABLE inventa07_lab.official_barcodes(
 barcode text PRIMARY KEY,product_code text NOT NULL REFERENCES inventa07_lab.products
);
CREATE TABLE inventa07_lab.alternate_barcodes(
 barcode text PRIMARY KEY,
 product_code text NOT NULL REFERENCES inventa07_lab.products,
 active boolean NOT NULL DEFAULT true,
 version bigint NOT NULL CHECK(version>0)
);
CREATE TABLE inventa07_lab.alternate_barcode_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 barcode text NOT NULL,
 old_product_code text,
 new_product_code text,
 operation text NOT NULL CHECK(operation IN ('activated','deactivated')),
 reason text NOT NULL CHECK(length(trim(reason))>0),
 actor_id uuid NOT NULL,
 session_id uuid NOT NULL,
 mutation_id uuid NOT NULL UNIQUE,
 at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON inventa07_lab.official_barcodes,inventa07_lab.alternate_barcodes,
 inventa07_lab.alternate_barcode_events FROM PUBLIC;
ALTER TABLE inventa07_lab.alternate_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.alternate_barcodes FORCE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.alternate_barcode_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.alternate_barcode_events FORCE ROW LEVEL SECURITY;
GRANT SELECT ON inventa07_lab.alternate_barcodes TO inventa07_lab_client;
CREATE POLICY barcode_enabled_read ON inventa07_lab.alternate_barcodes
 FOR SELECT TO inventa07_lab_client USING (inventa07_lab.current_actor_active());

CREATE FUNCTION inventa07_lab.manage_alternate_barcode(
 p_action text,p_barcode text,p_product_code text,p_reason text,p_mutation uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $alias$
DECLARE
 v_actor uuid;
 v_session uuid;
 v_row inventa07_lab.alternate_barcodes%ROWTYPE;
 v_receipt inventa07_lab.mutation_receipts%ROWTYPE;
 v_request jsonb;
 v_response jsonb;
 v_old text;
 v_new text;
 v_version bigint;
BEGIN
 v_actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 v_session:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF v_actor IS NULL OR v_session IS NULL THEN RAISE EXCEPTION 'No authenticated session'; END IF;
 IF NOT EXISTS (SELECT 1 FROM inventa07_lab.actors
    WHERE id=v_actor AND active AND role='admin') THEN
   RAISE EXCEPTION 'Only enabled Administration can manage alternate barcodes';
 END IF;
 IF p_mutation IS NULL OR p_action NOT IN ('activate','deactivate') OR p_action IS NULL
    OR p_barcode IS NULL OR length(trim(p_barcode))=0
    OR p_reason IS NULL OR length(trim(p_reason))=0 THEN
  RAISE EXCEPTION 'Operation, barcode and audit reason required';
 END IF;
 v_request:=jsonb_build_object('action',p_action,'barcode',p_barcode,
  'product',p_product_code,'reason',p_reason);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mutation::text,0));
 SELECT * INTO v_receipt FROM inventa07_lab.mutation_receipts WHERE mutation_id=p_mutation;
 IF FOUND THEN
  IF v_receipt.actor_id<>v_actor OR v_receipt.request<>v_request THEN
   RAISE EXCEPTION 'Idempotency key conflict'; END IF;
  RETURN v_receipt.response;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_barcode,1));
 SELECT * INTO v_row FROM inventa07_lab.alternate_barcodes
  WHERE barcode=p_barcode FOR UPDATE;
 IF p_action='activate' THEN
   IF p_product_code IS NULL OR NOT EXISTS(
      SELECT 1 FROM inventa07_lab.products WHERE code=p_product_code) THEN
    RAISE EXCEPTION 'Official product must already exist'; END IF;
   IF EXISTS(SELECT 1 FROM inventa07_lab.official_barcodes
      WHERE barcode=p_barcode) THEN
    RAISE EXCEPTION 'Official barcode cannot be replaced by an alias'; END IF;
   IF FOUND AND v_row.active THEN RAISE EXCEPTION 'Barcode already active'; END IF;
   IF v_row.barcode IS NULL THEN
      INSERT INTO inventa07_lab.alternate_barcodes(barcode,product_code,active,version)
       VALUES(p_barcode,p_product_code,true,1) RETURNING version INTO v_version;
   ELSE
      UPDATE inventa07_lab.alternate_barcodes SET
       product_code=p_product_code,active=true,version=version+1
       WHERE barcode=p_barcode RETURNING version INTO v_version;
   END IF;
   v_old:=v_row.product_code;v_new:=p_product_code;
 ELSE
   IF p_product_code IS NOT NULL THEN RAISE EXCEPTION 'Deactivate must not supply new product'; END IF;
   IF v_row.barcode IS NULL OR NOT v_row.active THEN
     RAISE EXCEPTION 'No active association to deactivate'; END IF;
   UPDATE inventa07_lab.alternate_barcodes SET active=false,version=version+1
      WHERE barcode=p_barcode RETURNING version INTO v_version;
   v_old:=v_row.product_code;v_new:=NULL;
 END IF;
 INSERT INTO inventa07_lab.alternate_barcode_events(
  barcode,old_product_code,new_product_code,operation,reason,actor_id,session_id,mutation_id)
 VALUES(p_barcode,v_old,v_new,CASE WHEN p_action='activate' THEN 'activated' ELSE 'deactivated' END,
  trim(p_reason),v_actor,v_session,p_mutation);
 v_response:=jsonb_build_object('barcode',p_barcode,'active',p_action='activate',
  'productCode',v_new,'version',v_version);
 INSERT INTO inventa07_lab.mutation_receipts(mutation_id,actor_id,request,response)
  VALUES(p_mutation,v_actor,v_request,v_response);
 RETURN v_response;
END $alias$;
REVOKE ALL ON FUNCTION inventa07_lab.manage_alternate_barcode(text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.manage_alternate_barcode(text,text,text,text,uuid) TO inventa07_lab_client;
COMMIT;
