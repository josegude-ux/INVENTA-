-- VISURA INVENTA 07 — physical scan ledger and team authorization tests (LAB ONLY).
\set ON_ERROR_STOP on
-- These two camera events are injected by the privileged fixture owner, NOT the client.
INSERT INTO inventa07_lab.trusted_scan_events
 (id,campaign_id,location_code,barcode,actor_id,session_id,device_id,source)
VALUES
 ('95000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','NEW-PROV-1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '92000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000001','camera'),
 ('95000000-0000-4000-8000-000000000002',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','NEW-PROV-1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '92000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000001','camera'),
 ('95000000-0000-4000-8000-000000000003',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','OTHER-CODE',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '92000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000001','camera'),
 ('95000000-0000-4000-8000-000000000004',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','NEW-PROV-1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '92000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000099','camera'),
 ('95000000-0000-4000-8000-000000000005',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','NEW-PROV-1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '92000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000001','camera');
UPDATE inventa07_lab.trusted_scan_events SET captured_at=now()-interval '30 minutes'
 WHERE id='95000000-0000-4000-8000-000000000005';

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000004',false);
DO $physical_test$
DECLARE denied boolean:=false; r jsonb;
BEGIN
 BEGIN
  EXECUTE $$INSERT INTO inventa07_lab.trusted_scan_events
  (id,campaign_id,location_code,barcode,actor_id,session_id,device_id,source)
  VALUES ('95000000-0000-4000-8000-000000000099',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','NEW-PROV-1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '92000000-0000-4000-8000-000000000004',
    'd0000000-0000-4000-8000-000000000001','camera')$$;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Client forged a trusted camera event'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_provisional(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000001','scanner',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000003','scanner',
  'Código desconocido con etiqueta parcial',2,false,
  '96000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN OTHERS THEN denied:=position('Missing, expired or reused trusted scanner' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Mixed code scan events accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_provisional(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000001','scanner',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000004','scanner',
  'Código desconocido con otro terminal',2,false,
  '96000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN OTHERS THEN denied:=position('Missing, expired or reused trusted scanner' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Other-device scan accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_provisional(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000001','scanner',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000005','scanner',
  'Código desconocido con lectura antigua',2,false,
  '96000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN OTHERS THEN denied:=position('Missing, expired or reused trusted scanner' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Expired scan event accepted'; END IF;
 r:=inventa07_lab.register_provisional(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000001','scanner',
  'NEW-PROV-1','95000000-0000-4000-8000-000000000002','scanner',
  'Código desconocido: preservadas dos lecturas de cámara',2,false,
  '96000000-0000-4000-8000-000000000004');
 IF r->>'status'<>'pending' THEN
  RAISE EXCEPTION 'Two valid independent camera events not accepted'; END IF;
 r:=inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'illegible-code','Cajas contabilizadas físicamente con código ilegible',
  2,false,NULL,'96000000-0000-4000-8000-000000000005');
 IF r->>'status'<>'open' THEN
  RAISE EXCEPTION 'Active holder could not register a physical incident'; END IF;
END $physical_test$;

-- A's previous session has been revoked in 008; A must not bypass the terminal
-- by calling a formerly-permissive provisional/incident API.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','91000000-0000-4000-8000-000000000001',false);
DO $old_actor$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'illegible-code','Sesión ya revocada',1,false,NULL,
  '96000000-0000-4000-8000-000000000006');
 EXCEPTION WHEN OTHERS THEN denied:=position('Team terminal lease' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Revoked old actor could report physical evidence'; END IF;
END $old_actor$;
RESET ROLE;
DO $scan_audit$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.trusted_scan_events
  WHERE claimed_by IS NOT NULL)<>2 THEN
  RAISE EXCEPTION 'Expected two claimed camera readings, no more'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.provisionals
  WHERE barcode='NEW-PROV-1'
    AND team_id='f0000000-0000-4000-8000-000000000001'
    AND original_a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND original_b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND counted_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND counted_session_id='92000000-0000-4000-8000-000000000004')<>1 THEN
  RAISE EXCEPTION 'Provisional lost original team or actual authenticated identity'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.incidents
  WHERE description LIKE 'Cajas contabilizadas físicamente%'
    AND team_id='f0000000-0000-4000-8000-000000000001'
    AND original_b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND reported_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1 THEN
  RAISE EXCEPTION 'Incident lost original team'; END IF;
END $scan_audit$;

-- Administrative resolution remains possible without impersonating a holder.
SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
SELECT set_config('request.jwt.claim.session_id','33333333-3333-4333-8333-333333333333',false);
DO $admin_resolve$
DECLARE p uuid;i uuid;r jsonb;
BEGIN
 SELECT id INTO p FROM inventa07_lab.admin_pending_provisionals()
  WHERE barcode='NEW-PROV-1' LIMIT 1;
 IF p IS NULL THEN RAISE EXCEPTION 'Admin cannot review newly verified provisional'; END IF;
 r:=inventa07_lab.review_provisional(p,'SKU0001','additional',
  'Verificado manualmente: pendiente de consolidación', '96000000-0000-4000-8000-000000000007');
 IF r->>'status'<>'awaiting_consolidation' THEN
  RAISE EXCEPTION 'Admin provisional review did not preserve physical count'; END IF;
 SELECT id INTO i FROM inventa07_lab.admin_pending_incidents()
  WHERE description LIKE 'Cajas contabilizadas físicamente%' LIMIT 1;
 IF i IS NULL THEN RAISE EXCEPTION 'Admin cannot review newly verified incident'; END IF;
 r:=inventa07_lab.review_incident(i,'resolved',
  'Identificación administrativa comprobada sin cambiar cantidad',0,
  '96000000-0000-4000-8000-000000000008');
 IF r->>'status'<>'resolved' THEN
  RAISE EXCEPTION 'Admin incident review failed'; END IF;
END $admin_resolve$;
RESET ROLE;
DO $immutable_physical$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.provisionals
  WHERE barcode='NEW-PROV-1' AND physical_qty=2
    AND counted_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND status='awaiting_consolidation')<>1 THEN
  RAISE EXCEPTION 'Admin changed physical evidence or counted identity'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.incidents
  WHERE description LIKE 'Cajas contabilizadas físicamente%'
    AND physical_qty=2 AND status='resolved' AND revision=1)<>1 THEN
  RAISE EXCEPTION 'Admin changed original physical incident'; END IF;
END $immutable_physical$;
SELECT 'inventa07 team and trusted scan evidence PASS' AS result;
