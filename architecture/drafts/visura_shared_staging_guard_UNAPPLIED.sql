-- VISURA 04 - synthetic staging immutability guard, not approved migration.
-- Applied only after existing synthetic publisher fixtures in disposable PG16.
BEGIN;
CREATE FUNCTION visura_shared.bc_lines_staging_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE v_state text;
DECLARE v_batch_id uuid;
DECLARE v_warehouse text;
BEGIN
 IF TG_OP = 'UPDATE' AND
   (NEW.batch_id IS DISTINCT FROM OLD.batch_id OR
    NEW.warehouse_code IS DISTINCT FROM OLD.warehouse_code) THEN
   RAISE EXCEPTION 'moving BC lines between batches is forbidden'
     USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN
   v_batch_id := OLD.batch_id;
   v_warehouse := OLD.warehouse_code;
 ELSE
   v_batch_id := NEW.batch_id;
   v_warehouse := NEW.warehouse_code;
 END IF;

 -- Parent lock serializes with later validation and publication transactions.
 SELECT state INTO v_state
 FROM visura_shared.bc_batches
 WHERE id=v_batch_id AND warehouse_code=v_warehouse
 FOR UPDATE;
 IF NOT FOUND OR v_state <> 'staged' THEN
   RAISE EXCEPTION 'BC lines may be edited only while batch is staged'
     USING ERRCODE='23514';
 END IF;

 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$function$;

CREATE TRIGGER bc_lines_staging_guard
BEFORE INSERT OR UPDATE OR DELETE
ON visura_shared.bc_batch_lines
FOR EACH ROW EXECUTE FUNCTION visura_shared.bc_lines_staging_only();

REVOKE ALL ON FUNCTION visura_shared.bc_lines_staging_only()
 FROM PUBLIC,anon,authenticated;
COMMIT;

-- A production implementation must also validate source SHA-256/row digest,
-- prevent forged validated states, and gate changes through verified identities.
