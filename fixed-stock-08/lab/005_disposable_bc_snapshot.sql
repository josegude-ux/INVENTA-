-- VISURA INVENTA 08: muestras FICTICIAS de dos lotes publicados.
-- Solo para PostgreSQL temporal inventa08_test; SIN importación BC real.
DO $guard$
BEGIN
 IF current_database()<>'inventa08_test' THEN
  RAISE EXCEPTION 'INVENTA08 LAB ONLY: wrong database';
 END IF;
END $guard$;
CREATE TABLE inv08_disposable.active_batch(
 warehouse text PRIMARY KEY,
 import_id text NOT NULL,
 certified boolean NOT NULL,
 published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inv08_disposable.stock_lines(
 warehouse text NOT NULL,
 import_id text NOT NULL,
 product_code text NOT NULL,
 location_code text NOT NULL,
 lot text NOT NULL DEFAULT '',
 quantity numeric(38,12) NOT NULL,
 UNIQUE(warehouse,import_id,product_code,location_code,lot)
);
INSERT INTO inv08_disposable.active_batch(warehouse,import_id,certified) VALUES
 ('COR_01_COR','BC-A',true),('COR_02_NAR','BC-B',true);
INSERT INTO inv08_disposable.stock_lines
 (warehouse,import_id,product_code,location_code,lot,quantity) VALUES
 ('COR_01_COR','BC-A','00100','NO_FIJA_01','','-8.0'),
 ('COR_01_COR','BC-A','00100','NO_FIJA_02','','8.0'),
 ('COR_01_COR','BC-A','00200','Z99','','-12.125'),
 ('COR_01_COR','BC-B','00100','NO_FIJA_01','','100.0'),
 ('COR_01_COR','BC-B','00200','Z99','','40.000'),
 ('COR_02_NAR','BC-B','00100','NO_FIJA_01','','5000.000');
DO $verify$
DECLARE a numeric; b numeric; missing numeric;
BEGIN
 SELECT sum(quantity) INTO a FROM inv08_disposable.stock_lines
 WHERE warehouse='COR_01_COR' AND import_id='BC-A' AND product_code='00100';
 SELECT sum(quantity) INTO b FROM inv08_disposable.stock_lines
 WHERE warehouse='COR_01_COR' AND import_id='BC-A' AND product_code='00200';
 SELECT sum(quantity) INTO missing FROM inv08_disposable.stock_lines
 WHERE warehouse='COR_01_COR' AND import_id='BC-A' AND product_code='99999';
 IF a IS DISTINCT FROM 0 OR b IS DISTINCT FROM -12.125
 THEN RAISE EXCEPTION 'STOCK_TOTAL_CALCULATION_INVALID'; END IF;
 IF missing IS NOT NULL THEN
  RAISE EXCEPTION 'NO_STOCK_LINES_MUST_BE_NULL_NOT_ZERO';
 END IF;
 IF (SELECT import_id FROM inv08_disposable.active_batch WHERE warehouse='COR_02_NAR')<>'BC-B'
 THEN RAISE EXCEPTION 'WAREHOUSE_POINTER_CROSSED'; END IF;
 RAISE NOTICE 'INVENTA08 BC LAB PASSED: total by all locations, absent is NULL';
END $verify$;
