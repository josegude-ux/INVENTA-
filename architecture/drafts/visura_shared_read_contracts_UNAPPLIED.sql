-- VISURA shared-core v1 private contracts. DRAFT ONLY, NOT A PRODUCTION MIGRATION.
-- Intentionally outside supabase/migrations and not referenced by the live PWAs.
-- PostgreSQL >=15 required for security_invoker views.
-- Owner execution for synthetic tests is NOT a grant to user roles.
BEGIN;
CREATE VIEW visura_shared.stock_current_v1
WITH (security_invoker = true)
AS
SELECT
  c.warehouse_code,
  l.product_code,
  p.description AS product_description,
  p.unit AS master_unit,
  l.location_code,
  wl.aisle,
  wl.zone,
  l.lot,
  l.expiry_date,
  l.stock_calculated,
  b.id AS import_id,
  c.published_at,
  b.expected_rows,
  b.validated_rows,
  b.source AS import_source
FROM visura_shared.bc_current_by_warehouse AS c
JOIN visura_shared.bc_batches AS b
  ON b.id = c.batch_id AND b.warehouse_code = c.warehouse_code
JOIN visura_shared.bc_batch_lines AS l
  ON l.batch_id = c.batch_id AND l.warehouse_code = c.warehouse_code
JOIN visura_shared.warehouses AS w ON w.code = c.warehouse_code
JOIN visura_shared.warehouse_locations AS wl
  ON wl.warehouse_code = l.warehouse_code AND wl.location_code = l.location_code
JOIN public.products AS p ON p.code = l.product_code
WHERE b.state = 'published'
  AND b.expected_rows = b.validated_rows
  AND w.enabled
  AND wl.enabled;
-- No public API, no client grants, no cross-module access.
REVOKE ALL ON visura_shared.stock_current_v1 FROM PUBLIC, anon, authenticated;
COMMIT;

-- Missing (warehouse, SKU, location, lot) rows are UNKNOWN, not certified ZERO.
-- The consuming application must check source completeness and freshness.
-- SECURITY INVOKER does not grant privileges: separate approved grants/RLS
-- are mandatory before anyone other than database owner can query this view.
