-- VISURA 04. Internal batch-validation prototype: disposable PG16 only.
-- No public EXECUTE grant, no frontend exposure, not an executable migration.
-- Trusted caller must attest that file_sha256 belongs to manually uploaded Excel.
BEGIN;
CREATE FUNCTION visura_shared.validate_bc_batch_isolated(
 p_batch uuid,
 p_warehouse text,
 p_actor uuid,
 p_attested_file_sha256 text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
 v_enabled boolean;
 v_allowed boolean;
 v_batch visura_shared.bc_batches%ROWTYPE;
 v_lines bigint;
 v_disabled_locations bigint;
BEGIN
 IF p_batch IS NULL OR p_warehouse IS NULL OR p_actor IS NULL
    OR p_attested_file_sha256 IS NULL THEN
   RAISE EXCEPTION 'validation inputs missing' USING ERRCODE='22023';
 END IF;
 SELECT enabled INTO v_enabled FROM visura_shared.warehouses
 WHERE code=p_warehouse;
 IF NOT FOUND OR NOT v_enabled THEN
   RAISE EXCEPTION 'warehouse unknown or disabled' USING ERRCODE='22023';
 END IF;

 SELECT EXISTS(
  SELECT 1 FROM visura_shared.user_module_warehouses a
  WHERE a.user_id=p_actor AND a.module='inventa'
   AND a.warehouse_code=p_warehouse AND a.module_role='admin'
   AND a.enabled AND a.may_read_calculated_stock
   AND a.approved_by IS NOT NULL AND a.approved_at IS NOT NULL
 ) INTO v_allowed;
 IF NOT v_allowed THEN
   RAISE EXCEPTION 'not approved to validate BC for warehouse'
   USING ERRCODE='42501';
 END IF;

 -- Rows are protected by trigger locking this same parent while staged.
 SELECT * INTO v_batch FROM visura_shared.bc_batches
 WHERE id=p_batch AND warehouse_code=p_warehouse FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'batch not found for warehouse' USING ERRCODE='22023';
 END IF;
 IF v_batch.file_sha256 <> p_attested_file_sha256 THEN
   RAISE EXCEPTION 'attested Excel SHA mismatch' USING ERRCODE='23514';
 END IF;
 IF v_batch.state='validated' THEN
   RETURN jsonb_build_object('status','already_validated',
     'warehouse',p_warehouse,'batch_id',p_batch,'rows',v_batch.validated_rows);
 END IF;
 IF v_batch.state<>'staged' THEN
   RAISE EXCEPTION 'only staged BC batches may be validated'
    USING ERRCODE='23514';
 END IF;
 SELECT count(*) INTO v_lines FROM visura_shared.bc_batch_lines
 WHERE batch_id=p_batch AND warehouse_code=p_warehouse;
 IF v_lines=0 OR v_lines<>v_batch.expected_rows THEN
   RAISE EXCEPTION 'staged BC lines are incomplete'
    USING ERRCODE='23514';
 END IF;

 SELECT count(*) INTO v_disabled_locations
 FROM visura_shared.bc_batch_lines AS l
 LEFT JOIN visura_shared.warehouse_locations AS loc
  ON loc.warehouse_code=l.warehouse_code AND loc.location_code=l.location_code
 WHERE l.batch_id=p_batch AND l.warehouse_code=p_warehouse
  AND (loc.enabled IS DISTINCT FROM true);
 IF v_disabled_locations>0 THEN
   RAISE EXCEPTION 'BC lines contain disabled warehouse locations'
    USING ERRCODE='23514';
 END IF;

 UPDATE visura_shared.bc_batches
 SET state='validated',validated_rows=v_lines,validated_at=now()
 WHERE id=p_batch AND warehouse_code=p_warehouse;
 RETURN jsonb_build_object('status','validated',
   'warehouse',p_warehouse,'batch_id',p_batch,'rows',v_lines);
END;
$function$;
REVOKE ALL ON FUNCTION visura_shared.validate_bc_batch_isolated(uuid,text,uuid,text)
 FROM PUBLIC,anon,authenticated;
COMMIT;

-- TODO before production: bind actor to actual auth.uid/server session, hash
-- canonicalized rows (DB-side SHA256), attest original file bytes, and
-- enforce validated-state transitions with restrictive table privileges.
