-- VISURA INVENTA 07 synthetic provisional cases, independent of Business Central API.
\set ON_ERROR_STOP on
UPDATE inventa07_lab.campaigns SET status='open'
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
UPDATE inventa07_lab.actors SET active=true
 WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
INSERT INTO inventa07_lab.assignments(campaign_id,location_code,actor_id,active)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P02',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
DO $two_scans$
DECLARE denied boolean:=false; r jsonb;
BEGIN
 BEGIN
  PERFORM inventa07_lab.register_provisional(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   '000X-9','11111111-1111-4111-8111-111111111112','scanner',
   '000X-9','11111111-1111-4111-8111-111111111112','scanner',
   'Artículo sin etiqueta oficial',2,false,'50000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN OTHERS THEN denied:=position('Two independent matching' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'One scan event accepted twice'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_provisional(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   '000X-9','11111111-1111-4111-8111-111111111112','scanner',
   'X-9','11111111-1111-4111-8111-111111111113','scanner',
   'Artículo sin etiqueta oficial',2,false,'50000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN OTHERS THEN denied:=position('Two independent matching' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Barcode mismatch accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_provisional(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   '000X-9','11111111-1111-4111-8111-111111111112','scanner',
   '000X-9','11111111-1111-4111-8111-111111111113','scanner',
   '',2,false,'50000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN OTHERS THEN denied:=position('Short description is mandatory' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Empty description accepted'; END IF;
 r:=inventa07_lab.register_provisional(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   '000X-9','11111111-1111-4111-8111-111111111112','scanner',
   '000X-9','11111111-1111-4111-8111-111111111113','scanner',
   'Artículo sin etiqueta oficial',2,false,'50000000-0000-4000-8000-000000000004');
 IF r->>'status'<>'pending' OR r->>'barcode'<>'000X-9' THEN
  RAISE EXCEPTION 'Invalid provisional saved: %',r; END IF;
 IF (SELECT count(*) FROM inventa07_lab.provisionals)<>1 THEN
  RAISE EXCEPTION 'Provisional not readable to its operator'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_provisional(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   '000X-9','11111111-1111-4111-8111-111111111114','scanner',
   '000X-9','11111111-1111-4111-8111-111111111115','scanner',
   'Duplicado misma ubicación',2,false,'50000000-0000-4000-8000-000000000005');
 EXCEPTION WHEN OTHERS THEN denied:=position('Duplicate provisional' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Duplicate within location accepted'; END IF;
END $two_scans$;
DO $deny_pending_list$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM inventa07_lab.admin_pending_provisionals();
 EXCEPTION WHEN OTHERS THEN denied:=position('Only enabled Administration' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Operario accedió a la cola administrativa'; END IF;
END $deny_pending_list$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','22222222-2222-4222-8222-222222222222',false);
DO $second_location$
DECLARE r jsonb;
BEGIN
 r:=inventa07_lab.register_provisional(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P02',
   '000X-9','22222222-2222-4222-8222-222222222223','scanner',
   '000X-9','22222222-2222-4222-8222-222222222224','scanner',
   'Mismo desconocido en otro lugar',4,false,'50000000-0000-4000-8000-000000000006');
 IF r->>'status'<>'pending' THEN RAISE EXCEPTION 'Other location rejected'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.provisionals)<>1 THEN
  RAISE EXCEPTION 'Second operator saw recuentos de otros'; END IF;
END $second_location$;
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
SELECT set_config('request.jwt.claim.session_id','33333333-3333-4333-8333-333333333333',false);
-- Admin does not receive automatic reference suggestions. Selection is manual.
DO $admin_review$
DECLARE id_a uuid; id_b uuid; r jsonb; denied boolean:=false;
BEGIN
 -- This is a fixture-only setup lookup: in production, an authenticated
 -- admin review RPC must enumerate pending work under a separate policy.
 -- SQL function with own privileges may read the synthetic pending rows.
 SELECT id INTO id_a FROM inventa07_lab.provisionals
   WHERE location_code='K00-P01';
 SELECT id INTO id_b FROM inventa07_lab.provisionals
   WHERE location_code='K00-P02';
 -- The client role sees no rows belonging to either operator, intentionally.
 IF id_a IS NOT NULL OR id_b IS NOT NULL THEN
  RAISE EXCEPTION 'Admin received a private operator row through raw SELECT'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.admin_pending_provisionals())<>2 THEN
  RAISE EXCEPTION 'Authorized admin did not receive two pending provisionals'; END IF;
END $admin_review$;
-- The authorized admin RPC supplies each provisional ID without SKU suggestions.
DO $manual_admin$
DECLARE a uuid; b uuid; denied boolean:=false; r jsonb;
BEGIN
 -- Temporary fixture table is not necessarily readable after role switch.
 -- Instead, resolve test IDs via a trusted fixture function in the script.
 SELECT id INTO a FROM inventa07_lab.admin_pending_provisionals() WHERE location_code='K00-P01';
 SELECT id INTO b FROM inventa07_lab.admin_pending_provisionals() WHERE location_code='K00-P02';
 BEGIN
  PERFORM inventa07_lab.review_provisional(a,'NOT_IN_CATALOG','duplicate',
    'No debe crearse referencia oficial','50000000-0000-4000-8000-000000000007');
 EXCEPTION WHEN OTHERS THEN denied:=position('Official reference must be imported' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonexistent official reference accepted'; END IF;
 r:=inventa07_lab.review_provisional(a,'SKU0001','duplicate',
   'Unidades ya contabilizadas en la misma ubicación','50000000-0000-4000-8000-000000000008');
 IF r->>'status'<>'resolved_duplicate' THEN RAISE EXCEPTION 'Wrong duplicate resolution'; END IF;
 r:=inventa07_lab.review_provisional(b,'SKU0002','additional',
   'Se verificó que no estaba incluida','50000000-0000-4000-8000-000000000009');
 IF r->>'status'<>'awaiting_consolidation' THEN
  RAISE EXCEPTION 'Additional inventory was incorrectly auto consolidated'; END IF;
END $manual_admin$;
RESET ROLE;
DO $provisional_audit$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.provisionals WHERE barcode='000X-9')<>2 THEN
  RAISE EXCEPTION 'Same barcode across locations was merged'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.provisional_reviews)<>2 THEN
  RAISE EXCEPTION 'Administrative review events missing'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.provisionals WHERE status='awaiting_consolidation')<>1 THEN
  RAISE EXCEPTION 'Outstanding consolidation was silently closed'; END IF;
 IF (SELECT confirmed_qty FROM inventa07_lab.reference_states
  WHERE product_code='SKU0001')<>7 THEN
  RAISE EXCEPTION 'Administrative review modified confirmed physical count'; END IF;
END $provisional_audit$;
SELECT 'inventa07 provisional contract PASS' AS result;
