-- VISURA INVENTA 07 — incident tests on disposable PostgreSQL only.
\set ON_ERROR_STOP on
UPDATE inventa07_lab.campaigns SET status='open'
 WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
UPDATE inventa07_lab.actors SET active=true WHERE id IN(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
-- Separate artificial corrected event for a DIFFERENT product; must not
-- release an incident affecting SKU0001 even within the same location.
INSERT INTO inventa07_lab.reference_events(
 campaign_id,location_code,product_code,kind,quantity,previous_quantity,
 explicit_zero,actor_id,authenticated_session_id,mutation_id)
VALUES (
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01','SKU0002','corrected',
 8,4,false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111',
 '60000000-0000-4000-8000-000000000010');
SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
DO $operator$
DECLARE blocked boolean:=false; r jsonb;repeat_result jsonb; used_id bigint;
BEGIN
 BEGIN
  PERFORM inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'illegible-code','Etiqueta ilegible',NULL,false,NULL,
  '60000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN OTHERS THEN blocked:=position('physical count' in SQLERRM)>0; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Illegible incident without physical evidence accepted'; END IF;
 r:=inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'illegible-code','Etiqueta ilegible',0,true,NULL,
  '60000000-0000-4000-8000-000000000002');
 repeat_result:=inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'illegible-code','Etiqueta ilegible',0,true,NULL,
  '60000000-0000-4000-8000-000000000002');
 IF r<>repeat_result OR r->>'status'<>'open'
 THEN RAISE EXCEPTION 'Illegible physical zero or idempotency error %',r; END IF;
 blocked:=false;
 BEGIN
  PERFORM inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'used-alias-misattribution','Código de otra referencia',NULL,false,99999999,
  '60000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Actually used count event required' in SQLERRM)>0; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invented historical count event accepted'; END IF;
 SELECT id INTO used_id FROM inventa07_lab.reference_events WHERE kind='confirmed'
   AND product_code='SKU0001' LIMIT 1;
 IF used_id IS NULL THEN RAISE EXCEPTION 'No synthetic original count for alias-use test'; END IF;
 r:=inventa07_lab.register_incident(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','K00-P01',
  'used-alias-misattribution','La asociación alternativa usada era incorrecta',NULL,false,
  used_id,'60000000-0000-4000-8000-000000000004');
 IF r->>'status'<>'open' THEN RAISE EXCEPTION 'Wrong alias incident'; END IF;
 blocked:=false;
 BEGIN
  PERFORM * FROM inventa07_lab.admin_pending_incidents();
 EXCEPTION WHEN OTHERS THEN blocked:=position('Only enabled Administration' in SQLERRM)>0; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Operator can query admin incidents'; END IF;
 blocked:=false;
 BEGIN
  PERFORM * FROM inventa07_lab.admin_incident_corrections((r->>'incidentId')::uuid);
 EXCEPTION WHEN OTHERS THEN
  blocked:=position('Only enabled Administration' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Operator can query admin correction candidates'; END IF;
 blocked:=false;
 BEGIN
  PERFORM inventa07_lab.review_incident((r->>'incidentId')::uuid,
   'resolved','No autorizado',0,'60000000-0000-4000-8000-000000000005');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Only enabled Administration' in SQLERRM)>0; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Operator resolved incident'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.incidents)<>2
 THEN RAISE EXCEPTION 'Operator cannot see their two incident records'; END IF;
END $operator$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $other_operator$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.incidents)<>0
 THEN RAISE EXCEPTION 'A different operator can read private incident evidence'; END IF;
END $other_operator$;
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
SELECT set_config('request.jwt.claim.session_id','33333333-3333-4333-8333-333333333333',false);
DO $administrator$
DECLARE
  i_zero uuid; i_alias uuid; corrected_event bigint;
  r jsonb; replay jsonb; blocked boolean:=false;
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.admin_pending_incidents())<>2
 THEN RAISE EXCEPTION 'Admin did not receive both pending incidents'; END IF;
 SELECT id INTO i_zero FROM inventa07_lab.admin_pending_incidents()
  WHERE kind='illegible-code' LIMIT 1;
 SELECT id INTO i_alias FROM inventa07_lab.admin_pending_incidents()
  WHERE kind='used-alias-misattribution' LIMIT 1;
 r:=inventa07_lab.review_incident(i_zero,'resolved',
  'Cantidad cero comprobada e incidencia documentada',0,
  '60000000-0000-4000-8000-000000000006');
 IF r->>'status'<>'resolved' THEN RAISE EXCEPTION 'Illegible incident not reviewed'; END IF;
 r:=inventa07_lab.review_incident(i_alias,'manual-correction-required',
  'Código alternativo afectó un recuento ya confirmado',0,
  '60000000-0000-4000-8000-000000000007');
 IF r->>'status'<>'awaiting_correction' THEN
  RAISE EXCEPTION 'Incident was closed before verifying correction'; END IF;
 blocked:=false;
 BEGIN
  PERFORM inventa07_lab.review_incident(i_alias,'correction-verified',
  'Se requiere corrección validada',1,
  '60000000-0000-4000-8000-000000000008',99999999);
 EXCEPTION WHEN OTHERS THEN blocked:=position('Verified correction event required' in SQLERRM)>0; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Nonexistent correction event approved'; END IF;
 blocked:=false;
 BEGIN
  PERFORM inventa07_lab.review_incident(i_alias,'correction-verified',
    'Se intentó usar una corrección de otra referencia',1,
    '60000000-0000-4000-8000-000000000011',
    (SELECT id FROM inventa07_lab.admin_incident_corrections(i_alias)
      WHERE product_code='SKU0002' LIMIT 1));
 EXCEPTION WHEN OTHERS THEN
  blocked:=position('Verified correction event required' in SQLERRM)>0;
 END;
 IF (SELECT count(*) FROM inventa07_lab.admin_incident_corrections(i_alias)
    WHERE product_code='SKU0002')<>0 THEN
   RAISE EXCEPTION 'Admin candidate list leaked an unrelated corrected product'; END IF;
 SELECT id INTO corrected_event FROM inventa07_lab.admin_incident_corrections(i_alias)
  WHERE product_code='SKU0001' LIMIT 1;
 IF corrected_event IS NULL THEN RAISE EXCEPTION 'Missing signed correction fixture'; END IF;
 r:=inventa07_lab.review_incident(i_alias,'correction-verified',
  'Corrección administrativa previa verificada',1,
  '60000000-0000-4000-8000-000000000009',corrected_event);
 replay:=inventa07_lab.review_incident(i_alias,'correction-verified',
  'Corrección administrativa previa verificada',1,
  '60000000-0000-4000-8000-000000000009',corrected_event);
 IF r<>replay OR r->>'status'<>'resolved' THEN
  RAISE EXCEPTION 'Duplicate or lost correction review'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.admin_pending_incidents())<>0
 THEN RAISE EXCEPTION 'Resolved incidents remain blocked'; END IF;
END $administrator$;
RESET ROLE;
DO $integrity$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.incidents)<>2 THEN
  RAISE EXCEPTION 'Incident evidence was deleted'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.incident_events)<>5 THEN
  RAISE EXCEPTION 'Expected two opens, two admin reviews and one correction verification'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.incidents WHERE status<>'resolved')<>0 THEN
  RAISE EXCEPTION 'Blocking incidents remain'; END IF;
 IF (SELECT confirmed_qty FROM inventa07_lab.reference_states
  WHERE product_code='SKU0001')<>7 THEN
  RAISE EXCEPTION 'Incident handling silently changed a counted quantity'; END IF;
END $integrity$;
SELECT 'inventa07 incident contract PASS' AS result;
