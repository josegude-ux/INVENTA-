-- VISURA 05: only synthetic, unused next batch; do not apply to business databases.
\set ON_ERROR_STOP on
INSERT INTO visura_shared.bc_batches
(id,warehouse_code,file_name,file_sha256,expected_rows,validated_rows,
 state,created_by,validated_at)
VALUES
('77777777-7777-4777-8777-777777777777','COR_01_COR',
 'fictitious-next.xlsx',repeat('7',64),1,1,
 'validated','11111111-1111-4111-8111-111111111111',now());
INSERT INTO visura_shared.bc_batch_lines
(batch_id,warehouse_code,row_number,product_code,description,unit,
 location_code,lot,stock_calculated)
VALUES
('77777777-7777-4777-8777-777777777777','COR_01_COR',1,
 '0000123','Producto','UD','A-01','',-3.5);
SELECT 'VISURA05_RC_FIXTURE_STAGED_OK' AS result;
