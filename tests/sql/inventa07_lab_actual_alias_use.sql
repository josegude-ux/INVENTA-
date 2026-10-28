-- VISURA INVENTA 07 — distinguish truly-used alternate code from catalog association.
\set ON_ERROR_STOP on
-- Artificial historical session and camera events are privileged fixtures,
-- NEVER a claim that real scanner hardware has been attested.
INSERT INTO inventa07_lab.device_sessions(id,actor_id,device_id,active) VALUES
 ('11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'd0000000-0000-4000-8000-000000000001',false);
INSERT INTO inventa07_lab.alternate_barcodes(barcode,product_code,active,version)
 VALUES('ALT-USED','SKU0002',true,1);
INSERT INTO inventa07_lab.alternate_barcode_events(
 barcode,old_product_code,new_product_code,operation,reason,actor_id,session_id,
 mutation_id,at) VALUES(
 'ALT-USED',NULL,'SKU0002','activated','Vinculación de ejemplo revisada',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '33333333-3333-4333-8333-333333333333',
 '98000000-0000-4000-8000-000000000001',now()-interval '3 minutes');
INSERT INTO inventa07_lab.trusted_scan_events(
 id,campaign_id,location_code,barcode,actor_id,session_id,device_id,source,captured_at)
VALUES
 ('97000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','ALT-USED',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'd0000000-0000-4000-8000-000000000001','camera',
  now()-interval '2 minutes'),
 ('97000000-0000-4000-8000-000000000002',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','ALT-USED',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'd0000000-0000-4000-8000-000000000001','camera',
  now()-interval '2 minutes');
INSERT INTO inventa07_lab.reference_events(
 campaign_id,location_code,product_code,kind,quantity,explicit_zero,actor_id,
 authenticated_session_id,mutation_id,recorded_at)
VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0002','confirmed',
  7,false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '99000000-0000-4000-8000-000000000001',now()-interval '1 minute'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0001','confirmed',
  9,false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '99000000-0000-4000-8000-000000000002',now()-interval '1 minute');
INSERT INTO inventa07_lab.verified_alias_use(count_event_id,scan_event_id,activation_event_id)
 SELECT counted.id, scan.id,activated.id
 FROM inventa07_lab.reference_events counted,
      inventa07_lab.trusted_scan_events scan,
      inventa07_lab.alternate_barcode_events activated
 WHERE counted.mutation_id='99000000-0000-4000-8000-000000000001'
  AND scan.id='97000000-0000-4000-8000-000000000001'
  AND activated.mutation_id='98000000-0000-4000-8000-000000000001';
-- Intentionally forged attribution: the alias really mapped SKU0002,
-- but this count was SKU0001. Even a privileged fixture row cannot make it true.
INSERT INTO inventa07_lab.verified_alias_use(count_event_id,scan_event_id,activation_event_id)
 SELECT counted.id, scan.id,activated.id
 FROM inventa07_lab.reference_events counted,
      inventa07_lab.trusted_scan_events scan,
      inventa07_lab.alternate_barcode_events activated
 WHERE counted.mutation_id='99000000-0000-4000-8000-000000000002'
  AND scan.id='97000000-0000-4000-8000-000000000002'
  AND activated.mutation_id='98000000-0000-4000-8000-000000000001';

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000004',false);
DO $evidence$
DECLARE
 valid_count bigint;false_count bigint;unlinked bigint;
 denied boolean:=false;r jsonb;
BEGIN
 SELECT id INTO valid_count FROM inventa07_lab.reference_events
  WHERE mutation_id='99000000-0000-4000-8000-000000000001';
 SELECT id INTO false_count FROM inventa07_lab.reference_events
  WHERE mutation_id='99000000-0000-4000-8000-000000000002';
 SELECT id INTO unlinked FROM inventa07_lab.reference_events
  WHERE kind='confirmed' AND product_code='SKU0001'
    AND mutation_id<>'99000000-0000-4000-8000-000000000002' LIMIT 1;
 IF valid_count IS NULL OR false_count IS NULL OR unlinked IS NULL THEN
  RAISE EXCEPTION 'Missing synthetic confirmation records'; END IF;
 BEGIN
  EXECUTE 'INSERT INTO inventa07_lab.verified_alias_use
    (count_event_id,scan_event_id,activation_event_id)
    VALUES(999999, ''97000000-0000-4000-8000-000000000001'', 1)';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Operario forged alias provenance'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_incident(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   'used-alias-misattribution','No existe una lectura de ese código en el recuento',
   NULL,false,unlinked,'96000000-0000-4000-8000-000000000011');
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Actual confirmed count with verified historical alternate scan required' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Unlinked historic count accepted as used alternate'; END IF;
 denied:=false;
 BEGIN
  PERFORM inventa07_lab.register_incident(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
   'used-alias-misattribution','Asociación histórica atribuida a producto distinto',
   NULL,false,false_count,'96000000-0000-4000-8000-000000000012');
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Actual confirmed count with verified historical alternate scan required' in SQLERRM)>0;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Forged alias/product association accepted'; END IF;
 r:=inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'used-alias-misattribution','La asociación ALT-USED se utilizó realmente en un recuento',
  NULL,false,valid_count,'96000000-0000-4000-8000-000000000013');
 IF r->>'status'<>'open' THEN RAISE EXCEPTION 'Proven alias use was rejected'; END IF;
END $evidence$;
RESET ROLE;
DO $history$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.incidents
  WHERE kind='used-alias-misattribution'
    AND description LIKE 'La asociación ALT-USED%'
    AND team_id='f0000000-0000-4000-8000-000000000001'
    AND original_a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND original_b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND reported_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1 THEN
  RAISE EXCEPTION 'Verified incident lost historic team or current authenticated author'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_events
  WHERE mutation_id IN ('99000000-0000-4000-8000-000000000001',
    '99000000-0000-4000-8000-000000000002')
   AND kind='confirmed')<>2 THEN
  RAISE EXCEPTION 'Reporting an alias incident modified earlier counts'; END IF;
END $history$;
-- An alias activated earlier and deactivated BEFORE the scan cannot be
-- used as provenance for a later confirmation, even with a valid count and camera ID.
INSERT INTO inventa07_lab.alternate_barcode_events(
 barcode,old_product_code,new_product_code,operation,reason,
 actor_id,session_id,mutation_id,at) VALUES
 ('ALT-STALE',NULL,'SKU0002','activated','Versión histórica anterior',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '33333333-3333-4333-8333-333333333333',
  '98000000-0000-4000-8000-000000000002',now()-interval '5 minutes'),
 ('ALT-STALE','SKU0002',NULL,'deactivated','Alias retirado antes del recuento',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '33333333-3333-4333-8333-333333333333',
  '98000000-0000-4000-8000-000000000003',now()-interval '3 minutes');
INSERT INTO inventa07_lab.trusted_scan_events(
 id,campaign_id,location_code,barcode,actor_id,session_id,device_id,source,captured_at)
 VALUES('97000000-0000-4000-8000-000000000003',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','ALT-STALE',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'd0000000-0000-4000-8000-000000000001','camera',
  now()-interval '2 minutes');
INSERT INTO inventa07_lab.reference_events(
 campaign_id,location_code,product_code,kind,quantity,explicit_zero,
 actor_id,authenticated_session_id,mutation_id,recorded_at)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0002',
  'confirmed',11,false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '99000000-0000-4000-8000-000000000003',now()-interval '1 minute');
INSERT INTO inventa07_lab.verified_alias_use(count_event_id,scan_event_id,activation_event_id)
 SELECT counted.id,scan.id,activated.id FROM
 inventa07_lab.reference_events counted,
 inventa07_lab.trusted_scan_events scan,
 inventa07_lab.alternate_barcode_events activated
 WHERE counted.mutation_id='99000000-0000-4000-8000-000000000003'
 AND scan.id='97000000-0000-4000-8000-000000000003'
 AND activated.mutation_id='98000000-0000-4000-8000-000000000002';
SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.session_id','92000000-0000-4000-8000-000000000004',false);
DO $stale_version$
DECLARE wrong_count bigint;denied boolean:=false;
BEGIN
 SELECT id INTO wrong_count FROM inventa07_lab.reference_events
 WHERE mutation_id='99000000-0000-4000-8000-000000000003';
 BEGIN
  PERFORM inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'used-alias-misattribution',
  'El alias fue desactivado antes de la lectura, no puede servir como prueba',
  NULL,false,wrong_count,'96000000-0000-4000-8000-000000000014');
 EXCEPTION WHEN OTHERS THEN
  denied:=position('Actual confirmed count with verified historical alternate scan required' in SQLERRM)>0; END;
 IF NOT denied THEN RAISE EXCEPTION 'Historically deactivated alias accepted after deactivation'; END IF;
END $stale_version$;
RESET ROLE;
SELECT 'inventa07 real alias use attribution PASS' AS result;
