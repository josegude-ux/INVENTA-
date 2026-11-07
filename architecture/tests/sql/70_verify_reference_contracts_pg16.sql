-- VISURA 04 private data contracts, PostgreSQL 16 disposable only.
\set ON_ERROR_STOP on
DO $test$
DECLARE n integer;
DECLARE view_name text;
BEGIN
 FOR view_name IN SELECT unnest(ARRAY['products_v1','locations_v1','fixed_positions_v1'])
 LOOP
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='visura_shared' AND c.relname=view_name AND c.relkind='v'
    AND c.reloptions @> ARRAY['security_invoker=true'];
  IF n<>1 THEN RAISE EXCEPTION 'private view % not security invoker', view_name; END IF;
  IF has_table_privilege('anon',format('%I.%I','visura_shared',view_name),'SELECT')
     OR has_table_privilege('authenticated',format('%I.%I','visura_shared',view_name),'SELECT') THEN
    RAISE EXCEPTION 'private view % accidentally exposed', view_name;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM visura_shared.products_v1)<>1 THEN
   RAISE EXCEPTION 'catalog view did not reuse existing products master';
 END IF;
 IF (SELECT count(*) FROM visura_shared.locations_v1)<>2 THEN
   RAISE EXCEPTION 'warehouse locations view missing data';
 END IF;
 IF (SELECT count(*) FROM visura_shared.locations_v1
    WHERE location_code='A-01'
      AND warehouse_code IN ('COR_01_COR','COR_02_NAR'))<>2 THEN
   RAISE EXCEPTION 'same location code not independently addressable';
 END IF;
 IF (SELECT count(*) FROM visura_shared.fixed_positions_v1)<>0 THEN
   RAISE EXCEPTION 'fijos should not auto-backfill from old single warehouse';
 END IF;
END;
$test$;

INSERT INTO visura_shared.warehouse_fixed_positions
 (warehouse_code,location_code,product_code,origin)
 VALUES
 ('COR_01_COR','A-01','0000123','admin'),
 ('COR_02_NAR','A-01','0000123','bc_excel');

DO $test$
DECLARE n integer;
DECLARE blocked boolean := false;
BEGIN
 SELECT count(*) INTO n FROM visura_shared.fixed_positions_v1;
 IF n<>2 THEN RAISE EXCEPTION 'scoped fixed-position contract count wrong'; END IF;
 IF (SELECT origin FROM visura_shared.fixed_positions_v1
     WHERE warehouse_code='COR_01_COR')<>'admin' THEN
   RAISE EXCEPTION 'Coruna origin wrong';
 END IF;
 IF (SELECT origin FROM visura_shared.fixed_positions_v1
     WHERE warehouse_code='COR_02_NAR')<>'bc_excel' THEN
   RAISE EXCEPTION 'Ferrol origin wrong';
 END IF;

 BEGIN
  INSERT INTO visura_shared.warehouse_fixed_positions
   (warehouse_code,location_code,product_code,origin)
   VALUES ('COR_01_COR','MISSING-LOC','0000123','admin');
 EXCEPTION WHEN foreign_key_violation THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'invalid location could be fixed'; END IF;
END;
$test$;
SELECT 'VISURA_REFERENCE_CONTRACTS_PRIVATE_OK' AS result;
