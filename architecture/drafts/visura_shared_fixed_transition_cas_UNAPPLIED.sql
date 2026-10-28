-- VISURA 04 / DRAFT ONLY / disposable PostgreSQL 16.
-- This is the single CAS + append-only event operation for existing
-- warehouse_fixed_positions; does not create a second association master.
-- NO GRANTS TO CLIENT ROLES, NO AUTH CLAIMS, NO PROD APPLICATION.
-- p_actor remains a server-only laboratory input: it is NOT a verified JWT.
BEGIN;
CREATE FUNCTION visura_shared.transition_fixed_association_cas_isolated(
 p_association_id uuid,
 p_warehouse text,
 p_expected_revision integer,
 p_action text,
 p_reason text,
 p_reason_detail text,
 p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
DECLARE
 v_old visura_shared.warehouse_fixed_positions%ROWTYPE;
 v_new_active boolean;
 v_next_revision integer;
 v_event_id bigint;
BEGIN
 IF p_association_id IS NULL OR p_warehouse IS NULL OR
    p_expected_revision IS NULL OR p_expected_revision<1 OR
    p_actor IS NULL OR
    p_action NOT IN ('RETIRAR','REACTIVAR') OR p_action IS NULL OR
    p_reason NOT IN ('REUBICACION','BAJA_ARTICULO',
                     'CAMBIO_OPERATIVO','ERROR_ASIGNACION','OTROS') OR
    p_reason IS NULL OR
    (p_reason='OTROS' AND length(btrim(coalesce(p_reason_detail,'')))=0) THEN
   RAISE EXCEPTION 'Invalid fixed association transition parameters'
     USING ERRCODE='22023';
 END IF;
 -- Simulated server authority: a private SQL caller must also be a currently
 -- approved inventory admin for precisely this warehouse. Never expose the
 -- function to a browser or equate p_actor with auth.uid() in production.
 IF NOT EXISTS (
    SELECT 1 FROM visura_shared.user_module_warehouses g
    JOIN visura_shared.warehouses w ON w.code=g.warehouse_code
    WHERE g.user_id=p_actor AND g.module='inventa'
      AND g.warehouse_code=p_warehouse AND g.module_role='admin'
      AND g.enabled AND g.approved_by IS NOT NULL
      AND g.approved_at IS NOT NULL AND w.enabled
 ) THEN
   RAISE EXCEPTION 'Admin permission denied for warehouse'
     USING ERRCODE='42501';
 END IF;
 v_new_active := p_action='REACTIVAR';
 -- UPDATE itself acquires the row lock, verifies warehouse, expected revision
 -- and expected prior state. A second concurrent writer cannot both succeed.
 UPDATE visura_shared.warehouse_fixed_positions AS a
 SET active=v_new_active, revision=a.revision+1
 WHERE a.association_id=p_association_id
   AND a.warehouse_code=p_warehouse
   AND a.revision=p_expected_revision
   AND a.active=(NOT v_new_active)
 RETURNING a.* INTO v_old;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Association changed, wrong warehouse or action'
     USING ERRCODE='40001';
 END IF;
 v_next_revision := v_old.revision;
 -- The event is inserted as part of the SAME SQL statement/transaction.
 -- If this INSERT fails, PostgreSQL rolls back the UPDATE as well.
 INSERT INTO visura_shared.fixed_association_events (
   warehouse_code,location_code,product_code,association_id,
   previous_active,new_active,previous_revision,new_revision,
   action,reason,reason_detail,actor_id
 ) VALUES (
   v_old.warehouse_code,v_old.location_code,v_old.product_code,
   v_old.association_id,NOT v_new_active,v_new_active,
   v_next_revision-1,v_next_revision,p_action,p_reason,
   coalesce(p_reason_detail,''),p_actor
 ) RETURNING event_id INTO v_event_id;
 RETURN pg_catalog.jsonb_build_object(
   'associationId',v_old.association_id,'warehouse',v_old.warehouse_code,
   'active',v_new_active,'revision',v_next_revision,'eventId',v_event_id
 );
END;
$fn$;

REVOKE ALL ON FUNCTION visura_shared.transition_fixed_association_cas_isolated(
 uuid,text,integer,text,text,text,uuid
) FROM PUBLIC,anon,authenticated;
COMMIT;
-- LAB LIMITATION: a DB owner can UPDATE tables directly or forge p_actor.
-- Real implementation needs a separately reviewed server principal, session
-- identity binding, account revocation, transaction boundary and table-level
-- privilege hardening; these are NOT approved here.
