-- VISURA 04: additive, lab-only evolution of the SINGLE fixed-position master.
-- Do not apply to any real Supabase project. Deliberately outside migrations.
-- Historical public.fixed_positions remains untouched and NOT backfilled.
BEGIN;
ALTER TABLE visura_shared.warehouse_fixed_positions
 ADD COLUMN association_id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN active boolean NOT NULL DEFAULT true,
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>=1);
ALTER TABLE visura_shared.warehouse_fixed_positions
 ADD CONSTRAINT fixed_association_identity_unique UNIQUE(association_id),
 ADD CONSTRAINT fixed_association_scoped_identity UNIQUE
 (warehouse_code,location_code,product_code,association_id);

CREATE TABLE visura_shared.fixed_association_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 warehouse_code text NOT NULL,
 location_code text NOT NULL,
 product_code text NOT NULL,
 association_id uuid NOT NULL,
 previous_active boolean NOT NULL,
 new_active boolean NOT NULL,
 previous_revision integer NOT NULL CHECK(previous_revision>=1),
 new_revision integer NOT NULL CHECK(new_revision=previous_revision+1),
 action text NOT NULL CHECK(action IN ('RETIRAR','REACTIVAR')),
 reason text NOT NULL CHECK(reason IN
  ('REUBICACION','BAJA_ARTICULO','CAMBIO_OPERATIVO','ERROR_ASIGNACION','OTROS')),
 reason_detail text NOT NULL DEFAULT '',
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (warehouse_code,location_code,product_code,association_id)
 REFERENCES visura_shared.warehouse_fixed_positions
 (warehouse_code,location_code,product_code,association_id),
 CHECK ((action='RETIRAR' AND previous_active AND NOT new_active)
     OR (action='REACTIVAR' AND NOT previous_active AND new_active)),
 CHECK (reason<>'OTROS' OR length(btrim(reason_detail))>0)
);
ALTER TABLE visura_shared.fixed_association_events ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION visura_shared.fixed_event_append_only_isolated()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
BEGIN
 RAISE EXCEPTION 'Fixed association audit events are append-only'
   USING ERRCODE='23514';
END;
$fn$;
CREATE TRIGGER fixed_event_append_only
 BEFORE UPDATE OR DELETE ON visura_shared.fixed_association_events
 FOR EACH ROW EXECUTE FUNCTION visura_shared.fixed_event_append_only_isolated();

CREATE VIEW visura_shared.inventa08_associations_v1
WITH (security_invoker=true) AS
SELECT warehouse_code,association_id,location_code,product_code,
       active,revision,origin,assigned_at,assigned_by
 FROM visura_shared.warehouse_fixed_positions;

REVOKE ALL ON visura_shared.fixed_association_events,
 visura_shared.inventa08_associations_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE visura_shared.fixed_association_events_event_id_seq
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION visura_shared.fixed_event_append_only_isolated()
 FROM PUBLIC,anon,authenticated;
COMMIT;

-- The link between a state change, server-verified actor and event is NOT
-- implemented as a safe production write API. Future server transaction MUST
-- CAS on association_id/revision and write event atomically. A DB owner
-- may bypass triggers: no production claim. Do not publish while pending.
