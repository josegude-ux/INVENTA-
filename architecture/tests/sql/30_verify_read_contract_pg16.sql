-- Disposable PG16 integration test. No production connection.
\set ON_ERROR_STOP on
DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM visura_shared.stock_current_v1;
 IF n <> 0 THEN
   RAISE EXCEPTION 'non-published BC batches appeared in read contract';
 END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
 WHERE ns.nspname='visura_shared'
   AND c.relname='stock_current_v1' AND c.relkind='v'
   AND c.reloptions @> ARRAY['security_invoker=true'];
 IF n<>1 THEN RAISE EXCEPTION 'view must be security invoker'; END IF;
 IF has_table_privilege('anon','visura_shared.stock_current_v1','SELECT')
 OR has_table_privilege('authenticated','visura_shared.stock_current_v1','SELECT') THEN
   RAISE EXCEPTION 'no client should access unapproved stock contracts';
 END IF;
END $test$;

-- Synthetic admin confirms publication states; NOT representative of real RPC.
UPDATE visura_shared.bc_batches
SET state='published',published_at=now()
WHERE id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');

DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM visura_shared.stock_current_v1;
 IF n<>2 THEN RAISE EXCEPTION 'expected two published warehouse lines, got %', n; END IF;
 SELECT count(*) INTO n FROM visura_shared.stock_current_v1
 WHERE warehouse_code='COR_01_COR'
 AND location_code='A-01' AND product_code='0000123'
 AND stock_calculated=0 AND master_unit='UD';
 IF n<>1 THEN RAISE EXCEPTION 'Coruna row should preserve true zero'; END IF;
 SELECT count(*) INTO n FROM visura_shared.stock_current_v1
 WHERE warehouse_code='COR_02_NAR' AND stock_calculated=-2.5;
 IF n<>1 THEN RAISE EXCEPTION 'Ferrol row should preserve negative calculated stock'; END IF;
END $test$;

-- Simulate an import whose declared line count was not fully validated.
UPDATE visura_shared.bc_batches SET validated_rows=0
WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM visura_shared.stock_current_v1;
 IF n<>1 THEN RAISE EXCEPTION 'incomplete publication must not be readable'; END IF;
END $test$;
SELECT 'VISURA_SHARED_PRIVATE_READ_V1_OK' AS result;
