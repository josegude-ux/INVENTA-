-- Synthetic admin-only alternate barcode tests. NO Business Central access.
\set ON_ERROR_STOP on
INSERT INTO inventa07_lab.actors(id,active,role)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',true,'admin');
INSERT INTO inventa07_lab.official_barcodes(barcode,product_code)
 VALUES('OFF-0001','SKU0001');

SET ROLE inventa07_lab_client;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT set_config('request.jwt.claim.session_id','11111111-1111-4111-8111-111111111111',false);
DO $operator_denied$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.manage_alternate_barcode('activate','ALT-0002','SKU0001',
   'Operario no autorizado','40000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Only enabled Administration' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Operator created alternate barcode'; END IF;
END $operator_denied$;
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
SELECT set_config('request.jwt.claim.session_id','33333333-3333-4333-8333-333333333333',false);
DO $admin_barcode$
DECLARE blocked boolean:=false; r jsonb; again jsonb;
BEGIN
 BEGIN
  PERFORM inventa07_lab.manage_alternate_barcode('activate','OFF-0001','SKU0002',
   'Intento de código oficial','40000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Official barcode cannot' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Official barcode collision accepted'; END IF;
 r:=inventa07_lab.manage_alternate_barcode('activate','ALT-0002','SKU0001',
   'Identificación administrativa validada','40000000-0000-4000-8000-000000000003');
 again:=inventa07_lab.manage_alternate_barcode('activate','ALT-0002','SKU0001',
   'Identificación administrativa validada','40000000-0000-4000-8000-000000000003');
 IF r<>again OR r->>'active'<>'true' OR r->>'productCode'<>'SKU0001'
 THEN RAISE EXCEPTION 'Wrong association or replay: %',r; END IF;
 BEGIN
  PERFORM inventa07_lab.manage_alternate_barcode('activate','ALT-0002','SKU0002',
   'No debe sobreescribir','40000000-0000-4000-8000-000000000004');
 EXCEPTION WHEN OTHERS THEN blocked:=position('already active' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Active alternate code reassigned automatically'; END IF;
 blocked:=false;
 BEGIN
  PERFORM inventa07_lab.manage_alternate_barcode('deactivate','ALT-0002',NULL,
   '','40000000-0000-4000-8000-000000000005');
 EXCEPTION WHEN OTHERS THEN blocked:=position('audit reason required' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Deactivate without reason accepted'; END IF;
 r:=inventa07_lab.manage_alternate_barcode('deactivate','ALT-0002',NULL,
   'Asociación original incorrecta','40000000-0000-4000-8000-000000000006');
 IF r->>'active'<>'false' OR r->>'version'<>'2' THEN
  RAISE EXCEPTION 'Deactivation incorrect: %',r; END IF;
 IF (SELECT count(*) FROM inventa07_lab.alternate_barcodes WHERE barcode='ALT-0002')<>0
 THEN RAISE EXCEPTION 'Deactivated barcode still available for new lookups'; END IF;
 r:=inventa07_lab.manage_alternate_barcode('activate','ALT-0002','SKU0002',
   'Validación de nueva vinculación','40000000-0000-4000-8000-000000000007');
 IF r->>'active'<>'true' OR r->>'productCode'<>'SKU0002' OR r->>'version'<>'3'
 THEN RAISE EXCEPTION 'New association failed: %',r; END IF;
END $admin_barcode$;
RESET ROLE;
DO $audit_check$
BEGIN
 IF (SELECT count(*) FROM inventa07_lab.alternate_barcode_events
      WHERE barcode='ALT-0002')<>3 THEN
  RAISE EXCEPTION 'Expected activation, justified deactivation and new activation'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.alternate_barcode_events
      WHERE operation='activated' AND old_product_code='SKU0001'
       AND new_product_code='SKU0002')<>1 THEN
  RAISE EXCEPTION 'Historical association lost or silently replaced'; END IF;
 IF (SELECT count(*) FROM inventa07_lab.reference_events WHERE kind='corrected')<>1 THEN
  RAISE EXCEPTION 'Barcode change unexpectedly changed counted quantities'; END IF;
END $audit_check$;
UPDATE inventa07_lab.actors SET active=false WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
SET ROLE inventa07_lab_client;
DO $disabled_admin$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM inventa07_lab.manage_alternate_barcode('deactivate','ALT-0002',NULL,
   'Administrador deshabilitado','40000000-0000-4000-8000-000000000008');
 EXCEPTION WHEN OTHERS THEN blocked:=position('Only enabled Administration' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Disabled administrator could change associations'; END IF;
END $disabled_admin$;
RESET ROLE;
SELECT 'inventa07 alternate barcode contract PASS' AS result;
