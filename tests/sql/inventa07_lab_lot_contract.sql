-- VISURA INVENTA 07 lot-aware contract test, disposable PostgreSQL 16 only.
\set ON_ERROR_STOP on
UPDATE inventa07_lab.campaigns SET status='open'
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
UPDATE inventa07_lab.actors SET active=true WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE inventa07_lab.assignments SET active=true
 WHERE campaign_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  AND location_code='K00-P01'
  AND actor_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
DO $quantity$
DECLARE v numeric;failed boolean:=false;
BEGIN
 v:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0001','LOT-A','draft',
  '70000000-0000-4000-8000-000000000001',0,
  '[{"type":"loose","units":"1.125"},
    {"type":"boxes","boxes":"2","unitsPerBox":"8","subtotal":"16"},
    {"type":"pallet-group","layers":"5","boxesPerBase":"4",
     "unitsPerBox":"6","subtotal":"120"}]'::jsonb,false,NULL)::text::numeric;
EXCEPTION WHEN OTHERS THEN
 RAISE EXCEPTION 'Unexpected lot draft error: %',SQLERRM;
END $quantity$;
-- Validate exact physical total without theoretical stock.
DO $check_a$
DECLARE report jsonb;again jsonb;failed boolean:=false;
BEGIN
 SELECT jsonb_build_object('quantity',draft_qty,'status',status)
 INTO report FROM inventa07_lab.lot_states WHERE lot='LOT-A';
 IF (report->>'quantity')::numeric<>137.125 OR report->>'status'<>'draft'
 THEN RAISE EXCEPTION 'Incorrect group formula in LOT-A: %',report; END IF;
 again:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0001','LOT-A','draft',
  '70000000-0000-4000-8000-000000000001',0,
  '[{"type":"loose","units":"1.125"},
    {"type":"boxes","boxes":"2","unitsPerBox":"8","subtotal":"16"},
    {"type":"pallet-group","layers":"5","boxesPerBase":"4",
     "unitsPerBox":"6","subtotal":"120"}]'::jsonb,false,NULL);
 IF (again->>'quantity')::numeric<>137.125 THEN
  RAISE EXCEPTION 'Idempotent lot replay changed quantity'; END IF;
 BEGIN
  PERFORM inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0001','LOT-A','draft',
   '70000000-0000-4000-8000-000000000001',0,
   '[{"type":"loose","units":"999"}]'::jsonb,false,NULL);
 EXCEPTION WHEN OTHERS THEN failed:=position('Idempotency key conflict' in SQLERRM)>0; END;
 IF NOT failed THEN RAISE EXCEPTION 'Changed payload reused same id'; END IF;
END $check_a$;
DO $subtotals$
DECLARE failed boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0001','LOT-X','draft',
   '70000000-0000-4000-8000-000000000002',0,
   '[{"type":"boxes","boxes":"3","unitsPerBox":"8","subtotal":"25"}]'::jsonb,
   false,NULL);
 EXCEPTION WHEN OTHERS THEN
  failed:=position('Subtotal differs from server recomputation' in SQLERRM)>0;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Forged client subtotal accepted'; END IF;
 failed:=false;
 BEGIN
  PERFORM inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0001','LOT-X','draft',
   '70000000-0000-4000-8000-000000000003',0,
   '[{"type":"loose","units":"0"}]'::jsonb,false,NULL);
 EXCEPTION WHEN OTHERS THEN failed:=position('explicit zero' in SQLERRM)>0; END;
 IF NOT failed THEN RAISE EXCEPTION 'Unmarked zero accepted'; END IF;
 failed:=false;
 BEGIN
  PERFORM inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0001','LOT-X','draft',
   '70000000-0000-4000-8000-000000000004',0,'[]'::jsonb,false,NULL);
 EXCEPTION WHEN OTHERS THEN failed:=position('Empty quantity' in SQLERRM)>0; END;
 IF NOT failed THEN RAISE EXCEPTION 'Blank count accepted'; END IF;
END $subtotals$;
DO $different_lot$
DECLARE response jsonb;failed boolean:=false;
BEGIN
 response:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0001','LOT-B','draft',
  '70000000-0000-4000-8000-000000000005',0,'[]'::jsonb,true,NULL);
 IF (response->>'quantity')::numeric<>0 OR response->>'lot'<>'LOT-B'
 THEN RAISE EXCEPTION 'LOT-B explicit zero failed'; END IF;
 response:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0001','LOT-B','confirm',
  '70000000-0000-4000-8000-000000000006',1,NULL,false,1);
 IF response->>'operation'<>'confirmed' THEN
  RAISE EXCEPTION 'LOT-B confirmation failed'; END IF;
 BEGIN
  PERFORM inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'K00-P01','SKU0001','LOT-A','confirm',
   '70000000-0000-4000-8000-000000000007',1,NULL,false,0);
 EXCEPTION WHEN OTHERS THEN failed:=position('Reviewed lot version invalid' in SQLERRM)>0; END;
 IF NOT failed THEN RAISE EXCEPTION 'Stale review approved for LOT-A'; END IF;
 response:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0001','LOT-A','confirm',
  '70000000-0000-4000-8000-000000000008',1,NULL,false,1);
 IF (response->>'quantity')::numeric<>137.125 THEN
  RAISE EXCEPTION 'LOT-A quantity changed during confirmation'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.lot_states WHERE product_code='SKU0001'
     AND lot IN ('LOT-A','LOT-B') AND status='confirmed')<>2 THEN
  RAISE EXCEPTION 'Lots of same product were merged'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.lot_confirmation_events
  WHERE product_code='SKU0001' AND lot IN ('LOT-A','LOT-B'))<>2 THEN
  RAISE EXCEPTION 'Immutable confirmations are missing'; END IF;
END $different_lot$;
DO $empty_lot$
DECLARE response jsonb;
BEGIN
 response:=inventa07_lab.apply_lot('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'K00-P01','SKU0001','','draft',
  '70000000-0000-4000-8000-000000000009',0,
  '[{"type":"loose","units":"3.500"}]'::jsonb,false,NULL);
 IF (response->>'lot')<>'' OR (response->>'quantity')::numeric<>3.5
 THEN RAISE EXCEPTION 'Empty lot should not merge with LOT-A/B'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.lot_states
  WHERE product_code='SKU0001' AND lot IN ('LOT-A','LOT-B',''))<>3
 THEN RAISE EXCEPTION 'No-lot reference merged with existing lots'; END IF;
END $empty_lot$;
RESET ROLE;
DO $integrity$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.lot_confirmation_events
  WHERE quantity=137.125 AND lot='LOT-A')<>1 THEN
  RAISE EXCEPTION 'LOT-A original event missing'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.lot_confirmation_events
  WHERE quantity=0 AND explicit_zero AND lot='LOT-B')<>1 THEN
  RAISE EXCEPTION 'LOT-B explicit zero missing'; END IF;
END $integrity$;
SELECT 'inventa07 lot-aware contract PASS' AS result;
