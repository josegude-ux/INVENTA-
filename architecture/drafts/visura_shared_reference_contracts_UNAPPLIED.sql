-- VISURA 04 - shared reference contracts; UNAPPLIED, NON-EXPOSED.
-- Uses existing INVENTA product master; no sync or duplicate product table.
BEGIN;
CREATE VIEW visura_shared.products_v1 WITH (security_invoker=true) AS
 SELECT code AS product_code,description,unit,barcode
 FROM public.products;

CREATE VIEW visura_shared.locations_v1 WITH (security_invoker=true) AS
 SELECT l.warehouse_code,l.location_code,l.aisle,l.zone,l.description,l.enabled
 FROM visura_shared.warehouse_locations AS l
 JOIN visura_shared.warehouses AS w ON w.code=l.warehouse_code
 WHERE w.enabled;

-- Remains intentionally EMPTY until admin reconciles fixed-position imports.
-- Never UNION with public.fixed_positions: no double authority.
CREATE VIEW visura_shared.fixed_positions_v1 WITH (security_invoker=true) AS
 SELECT f.warehouse_code,f.product_code,p.description AS product_description,
  f.location_code,l.aisle,l.zone,
  f.origin,f.assigned_at,f.assigned_by
 FROM visura_shared.warehouse_fixed_positions AS f
 JOIN visura_shared.warehouse_locations AS l
  ON l.warehouse_code=f.warehouse_code AND l.location_code=f.location_code
 JOIN visura_shared.warehouses AS w ON w.code=f.warehouse_code
 JOIN public.products AS p ON p.code=f.product_code
 WHERE w.enabled AND l.enabled;

REVOKE ALL ON visura_shared.products_v1,
 visura_shared.locations_v1,visura_shared.fixed_positions_v1
 FROM PUBLIC,anon,authenticated;
COMMIT;
-- No API exposure, no application rewiring, no roles granted, no backfill.
-- Real RLS/privileges and warehouse-scoped denial require separate approval.
