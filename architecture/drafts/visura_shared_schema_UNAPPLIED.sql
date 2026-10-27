-- VISURA / EXCELL — UNAPPLIED DRAFT. Not an approved production migration.
-- Deliberately OUTSIDE supabase/migrations; no production operations.
-- Requires verified backup, approval, Auth mapping, PG integration tests and RLS review.
BEGIN;
CREATE SCHEMA IF NOT EXISTS visura_shared;
REVOKE ALL ON SCHEMA visura_shared FROM PUBLIC, anon, authenticated;

CREATE TABLE visura_shared.warehouses (
 code text PRIMARY KEY CHECK (code ~ '^[A-Za-z0-9][A-Za-z0-9_./-]{0,79}$'),
 name text NOT NULL, enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE visura_shared.user_module_warehouses (
 user_id uuid NOT NULL REFERENCES auth.users(id),
 module text NOT NULL CHECK(module IN ('inventa','prepara')),
 warehouse_code text NOT NULL REFERENCES visura_shared.warehouses(code),
 module_role text NOT NULL CHECK(module_role IN ('operator','supervisor','admin')),
 may_read_calculated_stock boolean NOT NULL DEFAULT false,
 enabled boolean NOT NULL DEFAULT false,
 approved_by uuid REFERENCES auth.users(id),
 approved_at timestamptz,
 PRIMARY KEY(user_id,module,warehouse_code)
);

-- WARNING: current public.locations(code) is not warehouse scoped.
-- Reject warehouse-colliding location codes before cutover.
CREATE TABLE visura_shared.warehouse_locations (
 warehouse_code text NOT NULL REFERENCES visura_shared.warehouses(code),
 location_code text NOT NULL REFERENCES public.locations(code),
 PRIMARY KEY(warehouse_code,location_code)
);

-- Not authoritative until explicit, audited cutover from public.fixed_positions.
CREATE TABLE visura_shared.warehouse_fixed_positions (
 warehouse_code text NOT NULL, location_code text NOT NULL,
 product_code text NOT NULL REFERENCES public.products(code),
 origin text NOT NULL CHECK(origin IN ('admin','bc_excel')),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 assigned_by uuid REFERENCES auth.users(id),
 PRIMARY KEY(warehouse_code,location_code,product_code),
 FOREIGN KEY(warehouse_code,location_code)
 REFERENCES visura_shared.warehouse_locations(warehouse_code,location_code)
);

CREATE TABLE visura_shared.bc_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 warehouse_code text NOT NULL REFERENCES visura_shared.warehouses(code),
 file_name text NOT NULL,
 file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
 source text NOT NULL DEFAULT 'bc_excel_manual' CHECK(source='bc_excel_manual'),
 source_date date,
 expected_rows integer NOT NULL CHECK(expected_rows BETWEEN 1 AND 200000),
 validated_rows integer NOT NULL DEFAULT 0 CHECK(validated_rows>=0),
 state text NOT NULL DEFAULT 'staged'
   CHECK(state IN ('staged','validated','published','superseded','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 validated_at timestamptz,published_at timestamptz,
 UNIQUE(id,warehouse_code), UNIQUE(warehouse_code,file_sha256)
);

CREATE TABLE visura_shared.bc_batch_lines (
 batch_id uuid NOT NULL, warehouse_code text NOT NULL,
 row_number integer NOT NULL CHECK(row_number>0),
 product_code text NOT NULL, description text NOT NULL,
 unit text NOT NULL, location_code text NOT NULL,lot text NOT NULL DEFAULT '',
 expiry_date date,stock_calculated numeric(20,6) NOT NULL,
 PRIMARY KEY(batch_id,row_number),
 UNIQUE(batch_id,product_code,location_code,lot),
 FOREIGN KEY(batch_id,warehouse_code)
 REFERENCES visura_shared.bc_batches(id,warehouse_code)
);
CREATE INDEX visura_lines_search ON visura_shared.bc_batch_lines
 (warehouse_code,product_code,location_code,lot);

-- Per-warehouse pointer; never a global singleton for all warehouses.
-- Future RPC must lock warehouse, check batch state/count/hash, and atomically
-- switch pointer plus publication audit in one transaction. NO RPC included.
CREATE TABLE visura_shared.bc_current_by_warehouse (
 warehouse_code text PRIMARY KEY REFERENCES visura_shared.warehouses(code),
 batch_id uuid NOT NULL UNIQUE,
 published_at timestamptz NOT NULL DEFAULT now(),
 published_by uuid NOT NULL REFERENCES auth.users(id),
 FOREIGN KEY(batch_id,warehouse_code)
 REFERENCES visura_shared.bc_batches(id,warehouse_code)
);
CREATE TABLE visura_shared.bc_publication_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 warehouse_code text NOT NULL REFERENCES visura_shared.warehouses(code),
 previous_batch uuid,new_batch uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Deny-by-default; permissions and invoker views come in a separately-reviewed PR.
ALTER TABLE visura_shared.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visura_shared.user_module_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visura_shared.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visura_shared.warehouse_fixed_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visura_shared.bc_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE visura_shared.bc_batch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE visura_shared.bc_current_by_warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE visura_shared.bc_publication_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA visura_shared FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA visura_shared FROM PUBLIC,anon,authenticated;
COMMIT;
-- Intentionally absent: data migration, Auth reassignments, publication RPC,
-- exposed view, permissive policy, old backend shutdown, Tanques operations.
