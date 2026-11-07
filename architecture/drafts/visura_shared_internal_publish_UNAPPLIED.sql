-- VISURA 04 - INTERNAL PUBLICATION EXPERIMENT, NEVER APPLY TO REAL SUPABASE.
-- This is not an exposed RPC and is deliberately outside supabase/migrations.
-- A trusted database owner runs synthetic tests. Do not expose this function
-- or trust p_actor in production. A future server gateway must establish
-- authenticated actor identity and enforce the approved access policy.
BEGIN;

CREATE FUNCTION visura_shared.publish_bc_batch_isolated(
 p_batch uuid,
 p_warehouse text,
 p_actor uuid,
 p_expected_previous uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
 v_enabled boolean;
 v_allowed boolean;
 v_batch visura_shared.bc_batches%ROWTYPE;
 v_current uuid;
 v_lines bigint;
BEGIN
 IF p_batch IS NULL OR p_warehouse IS NULL OR p_actor IS NULL THEN
   RAISE EXCEPTION 'missing publication arguments' USING ERRCODE = '22023';
 END IF;

 -- SERIALIZATION POINT: one exclusive row lock for each warehouse.
 -- Different warehouses have independent locks. Acquired before pointer read.
 SELECT enabled INTO v_enabled
 FROM visura_shared.warehouses
 WHERE code = p_warehouse FOR UPDATE;
 IF NOT FOUND OR NOT v_enabled THEN
   RAISE EXCEPTION 'warehouse unknown or disabled' USING ERRCODE = '22023';
 END IF;

 -- Defense in depth. Not a replacement for trusted caller/identity validation.
 SELECT EXISTS(
  SELECT 1 FROM visura_shared.user_module_warehouses u
  WHERE u.user_id = p_actor
   AND u.module = 'inventa'
   AND u.warehouse_code = p_warehouse
   AND u.module_role = 'admin'
   AND u.enabled
   AND u.may_read_calculated_stock
   AND u.approved_by IS NOT NULL
   AND u.approved_at IS NOT NULL
 ) INTO v_allowed;
 IF NOT v_allowed THEN
   RAISE EXCEPTION 'actor lacks approved INVENTA warehouse administration'
    USING ERRCODE = '42501';
 END IF;

 SELECT * INTO v_batch FROM visura_shared.bc_batches
 WHERE id = p_batch AND warehouse_code = p_warehouse FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'batch does not belong to requested warehouse'
    USING ERRCODE = '22023';
 END IF;

 SELECT batch_id INTO v_current
 FROM visura_shared.bc_current_by_warehouse
 WHERE warehouse_code = p_warehouse FOR UPDATE;

 -- Safe retry after a lost response. No second audit event is created.
 IF v_current IS NOT DISTINCT FROM p_batch AND v_batch.state = 'published' THEN
   RETURN jsonb_build_object(
    'status','already_published','warehouse',p_warehouse,
    'batch_id',p_batch,'previous_batch_id',v_current
   );
 END IF;

 -- Compare-and-swap prevents an outdated administrator's import replacing
 -- a later publication, even if concurrent sessions are serialized.
 IF v_current IS DISTINCT FROM p_expected_previous THEN
   RAISE EXCEPTION 'stale warehouse publication pointer'
    USING ERRCODE = '40001';
 END IF;

 IF v_batch.state <> 'validated' OR v_batch.validated_at IS NULL THEN
   RAISE EXCEPTION 'batch is not validated' USING ERRCODE = '23514';
 END IF;

 SELECT count(*) INTO v_lines
 FROM visura_shared.bc_batch_lines
 WHERE batch_id = p_batch AND warehouse_code = p_warehouse;
 IF v_lines = 0 OR v_lines <> v_batch.expected_rows
              OR v_lines <> v_batch.validated_rows THEN
   RAISE EXCEPTION 'incomplete BC batch' USING ERRCODE = '23514';
 END IF;

 IF v_current IS NOT NULL THEN
   UPDATE visura_shared.bc_batches SET state='superseded'
   WHERE id = v_current AND warehouse_code=p_warehouse AND state='published';
   IF NOT FOUND THEN
     RAISE EXCEPTION 'existing pointer is not a published batch'
      USING ERRCODE = '23514';
   END IF;
 END IF;

 UPDATE visura_shared.bc_batches
 SET state='published',published_at=now()
 WHERE id=p_batch AND warehouse_code=p_warehouse;
 INSERT INTO visura_shared.bc_current_by_warehouse
   (warehouse_code,batch_id,published_at,published_by)
 VALUES (p_warehouse,p_batch,now(),p_actor)
 ON CONFLICT (warehouse_code)
 DO UPDATE SET batch_id=EXCLUDED.batch_id,
               published_at=EXCLUDED.published_at,
               published_by=EXCLUDED.published_by;
 INSERT INTO visura_shared.bc_publication_events
  (warehouse_code,previous_batch,new_batch,actor_id)
 VALUES (p_warehouse,v_current,p_batch,p_actor);

 RETURN jsonb_build_object('status','published',
  'warehouse',p_warehouse,'batch_id',p_batch,
  'previous_batch_id',v_current,'validated_rows',v_lines);
END;
$function$;

REVOKE ALL ON FUNCTION visura_shared.publish_bc_batch_isolated(uuid,text,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
COMMIT;

-- No GRANT, no exposed schema, no client-side key, no automatic publishing.
-- IMPORTANT: staged lines remain mutable in this draft. A production version
-- MUST protect validation state by immutable staging and/or triggers, pinning
-- row digest and validated file hash, plus a server-verified actor gateway.
