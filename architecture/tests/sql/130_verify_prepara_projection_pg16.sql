-- VISURA 04: disposable PG16 only. Verify source-only PREPARA projection.
\set ON_ERROR_STOP on
DO $test$
DECLARE n integer;
DECLARE rel text;
BEGIN
 FOR rel IN SELECT unnest(ARRAY[
  'prepara_fixed_stock_rows_v1',
  'prepara_fixed_import_provenance_v1'
 ]) LOOP
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='visura_shared' AND c.relname=rel
   AND c.relkind='v' AND c.reloptions @> ARRAY['security_invoker=true'];
  IF n<>1 THEN RAISE EXCEPTION 'private projection % missing security_invoker',rel; END IF;
  IF has_table_privilege('anon',format('visura_shared.%I',rel),'SELECT')
  OR has_table_privilege('authenticated',format('visura_shared.%I',rel),'SELECT')
  THEN RAISE EXCEPTION 'client SELECT leaked on projection %',rel; END IF;
 END LOOP;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='visura_reporting';
 IF n<>0 THEN RAISE EXCEPTION 'duplicate reporting schema was introduced'; END IF;

 -- Current COR_01_COR is D4 published 12.25; no fabricated zero.
 SELECT count(*) INTO n FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_01_COR' AND location_code='A-01'
   AND product_code='0000123' AND stock_calculated=12.25;
 IF n<>1 THEN RAISE EXCEPTION 'COR stock projection wrong'; END IF;
 SELECT count(*) INTO n FROM visura_shared.prepara_fixed_stock_rows_v1
 WHERE warehouse_code='COR_02_NAR';
 IF n<>0 THEN
  RAISE EXCEPTION 'incomplete Ferrol pointer leaked stock as valid';
 END IF;

 SELECT count(*) INTO n FROM visura_shared.prepara_fixed_import_provenance_v1
 WHERE warehouse_code='COR_01_COR' AND import_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
   AND stock_expected_rows=1 AND stock_validated_rows=1 AND stock_rows=1
   AND source='bc_excel_manual' AND state='published';
 IF n<>1 THEN RAISE EXCEPTION 'COR provenance row missing'; END IF;

 SELECT count(*) INTO n FROM visura_shared.prepara_fixed_import_provenance_v1
 WHERE warehouse_code='COR_02_NAR' AND import_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
   AND stock_expected_rows=1 AND stock_validated_rows=0
   AND stock_rows=1 AND state='published';
 IF n<>1 THEN RAISE EXCEPTION 'FER provenance must flag count mismatch'; END IF;
END;
$test$;

SET ROLE anon;
DO $test$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM 1 FROM visura_shared.prepara_fixed_stock_rows_v1;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'anon can select private stock projection'; END IF;
END;
$test$;
RESET ROLE;
SET ROLE authenticated;
DO $test$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM 1 FROM visura_shared.prepara_fixed_import_provenance_v1;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'authenticated can select private provenance'; END IF;
END;
$test$;
RESET ROLE;
SELECT 'VISURA_PREPARA_PRIVATE_PROJECTION_OK' AS result;
