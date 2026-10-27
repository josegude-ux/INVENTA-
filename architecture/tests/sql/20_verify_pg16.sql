-- PostgreSQL 16 ephemeral test, synthetic rows only. Must run AFTER bootstrap and draft.
\set ON_ERROR_STOP on
INSERT INTO visura_shared.warehouses(code,name,enabled)
 VALUES ('COR_01_COR','Coruna',true),('FER_01_FER','Ferrol',true);
INSERT INTO visura_shared.warehouse_locations(warehouse_code,location_code)
 VALUES ('COR_01_COR','A-01'),('FER_01_FER','A-01');
INSERT INTO visura_shared.bc_batches
 (id,warehouse_code,file_name,file_sha256,expected_rows,validated_rows,state,created_by)
 VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','COR_01_COR','cor.xlsx',repeat('a',64),1,1,'validated','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','FER_01_FER','fer.xlsx',repeat('b',64),1,1,'validated','11111111-1111-4111-8111-111111111111');
INSERT INTO visura_shared.bc_batch_lines
 (batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
 VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','COR_01_COR',1,'0000123','Prueba','UD','A-01','',0),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','FER_01_FER',1,'0000123','Prueba','UD','A-01','',-2.5);
INSERT INTO visura_shared.bc_current_by_warehouse
 (warehouse_code,batch_id,published_by)
 VALUES
 ('COR_01_COR','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111'),
 ('FER_01_FER','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','11111111-1111-4111-8111-111111111111');
DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM visura_shared.bc_current_by_warehouse;
 IF n<>2 THEN RAISE EXCEPTION 'expected independent per-warehouse pointers'; END IF;
 IF (SELECT sum(stock_calculated) FROM visura_shared.bc_batch_lines WHERE warehouse_code='COR_01_COR')<>0 THEN
   RAISE EXCEPTION 'COR stock not exact';
 END IF;
 IF (SELECT sum(stock_calculated) FROM visura_shared.bc_batch_lines WHERE warehouse_code='FER_01_FER')<>-2.5 THEN
   RAISE EXCEPTION 'FER stock not exact';
 END IF;
 -- Wrong warehouse batch must be refused by composite FK.
 BEGIN
   UPDATE visura_shared.bc_current_by_warehouse
     SET batch_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
     WHERE warehouse_code='COR_01_COR';
   RAISE EXCEPTION 'cross-warehouse publication wrongly allowed';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 -- Duplicate SKU-location-lot in one batch must be refused.
 BEGIN
   INSERT INTO visura_shared.bc_batch_lines
     (batch_id,warehouse_code,row_number,product_code,description,unit,location_code,lot,stock_calculated)
     VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','COR_01_COR',2,'0000123','Dup','UD','A-01','',1);
   RAISE EXCEPTION 'duplicate position lot wrongly allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 -- Check all eight new tables start RLS enabled.
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='visura_shared' AND c.relkind='r' AND c.relrowsecurity=true;
 IF n<>8 THEN RAISE EXCEPTION 'RLS coverage wrong: %',n; END IF;
 IF has_table_privilege('authenticated','visura_shared.bc_batches','SELECT') THEN
   RAISE EXCEPTION 'authenticated unexpectedly has direct SELECT';
 END IF;
 IF has_table_privilege('anon','visura_shared.bc_batches','SELECT') THEN
   RAISE EXCEPTION 'anon unexpectedly has direct SELECT';
 END IF;
END;
$test$;
SELECT 'VISURA_PG16_DRAFT_CONTRACT_OK' AS result;
