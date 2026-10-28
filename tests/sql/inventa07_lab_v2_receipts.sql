-- Contract receipts: only the original account receives the exact V2 request.
\set ON_ERROR_STOP on
UPDATE inventa07_lab.actors SET active=true
 WHERE id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
DO $owner$
DECLARE draft jsonb;confirmed jsonb;zero jsonb;
BEGIN
 draft:=inventa07_lab.lot_v2_receipt('70000000-0000-4000-8000-000000000001');
 IF draft->>'status'<>'committed' OR draft->>'protocol'<>'visura-count-v2'
  OR draft->>'mutationId'<>'70000000-0000-4000-8000-000000000001'
  OR draft->>'ownerUserId'<>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  OR (draft->>'serverRevision')::bigint<>1 THEN
  RAISE EXCEPTION 'Missing authenticated V2 draft receipt: %',draft;
 END IF;
 IF draft->'request'->>'operation'<>'save-draft'
   OR draft->'request'->>'lot'<>'LOT-A'
   OR draft->'request'->>'quantity'<>'137.125'
   OR draft->'request'->>'explicitZero'<>'false'
   OR (draft->'request'->>'expectedRevision')::bigint<>0
   OR jsonb_array_length(draft->'request'->'breakdown')<>3 THEN
  RAISE EXCEPTION 'V2 draft receipt lost lot or physical breakdown: %',draft;
 END IF;
 confirmed:=inventa07_lab.lot_v2_receipt('70000000-0000-4000-8000-000000000008');
 IF confirmed->'request'->>'operation'<>'confirm-draft'
   OR confirmed->'request'->>'lot'<>'LOT-A'
   OR (confirmed->'request'->>'reviewRevision')::bigint<>1
   OR confirmed->'request' ? 'quantity' THEN
  RAISE EXCEPTION 'V2 confirmation incorrectly contains a new quantity: %',confirmed;
 END IF;
 zero:=inventa07_lab.lot_v2_receipt('70000000-0000-4000-8000-000000000005');
 IF zero->'request'->>'lot'<>'LOT-B'
  OR zero->'request'->>'quantity'<>'0'
  OR zero->'request'->>'explicitZero'<>'true' THEN
  RAISE EXCEPTION 'Explicit zero V2 receipt failed: %',zero;
 END IF;
 IF inventa07_lab.lot_v2_receipt('70000000-0000-4000-8000-000000000099') IS NOT NULL THEN
  RAISE EXCEPTION 'Receipt lookup fabricated nonexistent mutation'; END IF;
END $owner$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','22222222-2222-4222-8222-222222222222',false);
DO $other$
BEGIN
 IF inventa07_lab.lot_v2_receipt('70000000-0000-4000-8000-000000000001') IS NOT NULL THEN
  RAISE EXCEPTION 'Other user can read original actor receipt'; END IF;
END $other$;
RESET ROLE;
UPDATE inventa07_lab.actors SET active=false WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $disabled$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.lot_v2_receipt('70000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN OTHERS THEN denied:=position('Enabled authenticated session required' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Disabled account can recover receipts'; END IF;
END $disabled$;
RESET ROLE;
UPDATE inventa07_lab.actors SET active=true WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT 'inventa07 V2 lot receipts PASS' AS result;
