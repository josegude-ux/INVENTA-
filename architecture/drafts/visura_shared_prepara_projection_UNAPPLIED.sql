-- VISURA 04 — Private source projection for PREPARA PR #76 compatibility.
-- UNAPPLIED DRAFT outside migrations: NO RPC, NO GRANT, NO API access.
-- NO visura_reporting shadow tables, NO dual catalog and NO data migration.
-- Requires central server-gateway authentication and per-warehouse permission.
BEGIN;
CREATE VIEW visura_shared.prepara_fixed_stock_rows_v1
WITH (security_invoker=true) AS
SELECT
 s.warehouse_code, s.import_id, s.product_code, s.product_description,
 s.master_unit AS unit, s.location_code, s.aisle, s.zone,
 s.lot, s.expiry_date, s.stock_calculated, s.published_at
FROM visura_shared.stock_current_v1 s;

CREATE VIEW visura_shared.prepara_fixed_import_provenance_v1
WITH (security_invoker=true) AS
SELECT
 c.warehouse_code, b.id AS import_id, b.file_name,
 b.file_sha256, b.source, b.state,
 b.expected_rows AS stock_expected_rows,
 b.validated_rows AS stock_validated_rows,
 c.published_at AS pointer_published_at,
 b.published_at AS batch_published_at,
 -- This is only the count of normalized STOCK lines in the dedicated batch.
 -- It is NOT the total row count of every sheet in the original Excel.
 (SELECT count(*) FROM visura_shared.bc_batch_lines l
  WHERE l.batch_id=c.batch_id AND l.warehouse_code=c.warehouse_code) AS stock_rows,
 w.enabled AS warehouse_enabled
FROM visura_shared.bc_current_by_warehouse c
JOIN visura_shared.bc_batches b
 ON b.id=c.batch_id AND b.warehouse_code=c.warehouse_code
JOIN visura_shared.warehouses w ON w.code=c.warehouse_code;

REVOKE ALL ON visura_shared.prepara_fixed_stock_rows_v1,
 visura_shared.prepara_fixed_import_provenance_v1
 FROM PUBLIC,anon,authenticated;
COMMIT;
-- NOTE: No completeness flags are issued by these views.
-- A trusted server must independently attest parser/import completeness,
-- catalog and fixed-position reconciliation, zero omissions, freshness,
-- and actor's PREPARA/admin/warehouse permission on each request.
