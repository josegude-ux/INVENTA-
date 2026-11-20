-- VISURA INVENTA 07: authenticated-by-lab-claims receipt lookup, disposable DB only.
DO $guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $guard$;
BEGIN;
CREATE FUNCTION inventa07_lab.lot_v2_receipt(p_mutation uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $receipt$
DECLARE
 actor uuid; sess uuid;
 saved inventa07_lab.mutation_receipts%ROWTYPE;
 req jsonb; mapped jsonb; op text; physical numeric; server_revision bigint;
BEGIN
 actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 sess:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF actor IS NULL OR sess IS NULL OR NOT EXISTS(
  SELECT 1 FROM inventa07_lab.actors WHERE id=actor AND active)
 THEN RAISE EXCEPTION 'Enabled authenticated session required'; END IF;
 IF p_mutation IS NULL THEN RAISE EXCEPTION 'Mutation ID is required'; END IF;
 SELECT * INTO saved FROM inventa07_lab.mutation_receipts
  WHERE mutation_id=p_mutation AND actor_id=actor;
 IF NOT FOUND THEN RETURN NULL; END IF; -- Do not reveal another account's UUID.
 req:=saved.request;
 IF req->>'operation' NOT IN ('draft','confirm')
    OR NOT (req ? 'lot') OR NOT (req ? 'campaign')
    OR NOT (req ? 'product') OR NOT (req ? 'location')
    OR NOT (req ? 'revision') OR (saved.response->>'revision') IS NULL
 THEN RETURN NULL; END IF;
 op:=req->>'operation';
 server_revision:=(saved.response->>'revision')::bigint;
 mapped:=jsonb_build_object('campaignId',req->>'campaign',
   'locationCode',req->>'location','productCode',req->>'product',
   'lot',req->>'lot',
   'operation',CASE WHEN op='draft' THEN 'save-draft' ELSE 'confirm-draft' END,
   'expectedRevision',(req->>'revision')::bigint);
 IF op='draft' THEN
   physical:=inventa07_lab.lot_quantity(req->'breakdown',(req->>'zero')::boolean);
   mapped:=mapped||jsonb_build_object('quantity',trim(trailing '.' from
     trim(trailing '0' from to_char(physical,'FM9999999999999.999'))),
     'explicitZero',(req->>'zero')::boolean,'breakdown',req->'breakdown');
 ELSE
   mapped:=mapped||jsonb_build_object('reviewRevision',(req->>'reviewRevision')::bigint);
 END IF;
 -- JSONB numbers and strings are normalized for exact logical request matching.
 RETURN jsonb_build_object('protocol','visura-count-v2','status','committed',
  'mutationId',saved.mutation_id,'ownerUserId',actor,'request',mapped,
  'serverRevision',server_revision);
END $receipt$;
REVOKE ALL ON FUNCTION inventa07_lab.lot_v2_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION inventa07_lab.lot_v2_receipt(uuid) TO inventa07_lab_client;
COMMIT;
