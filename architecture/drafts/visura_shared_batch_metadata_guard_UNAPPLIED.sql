-- VISURA 04 — batch header immutability & state machine: ONLY test PG16.
-- Not a production migration. No permissions, schema exposures or RPC changes.
-- Complements the isolated bc_lines_staging_guard; never edits existing tables
-- outside a disposable PostgreSQL container when run via GitHub Actions.
BEGIN;

CREATE FUNCTION visura_shared.bc_batch_header_guard_isolated()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog
AS $fn$
BEGIN
 IF TG_OP <> 'UPDATE' THEN
  RAISE EXCEPTION 'invalid metadata guard operation' USING ERRCODE='23514';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR
    NEW.warehouse_code IS DISTINCT FROM OLD.warehouse_code OR
    NEW.file_name IS DISTINCT FROM OLD.file_name OR
    NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256 OR
    NEW.source IS DISTINCT FROM OLD.source OR
    NEW.source_date IS DISTINCT FROM OLD.source_date OR
    NEW.expected_rows IS DISTINCT FROM OLD.expected_rows OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'BC source metadata is immutable after batch creation'
    USING ERRCODE='23514';
 END IF;
 IF NEW.state IS DISTINCT FROM OLD.state THEN
  IF NOT (
    (OLD.state='staged' AND NEW.state IN ('validated','rejected')) OR
    (OLD.state='validated' AND NEW.state IN ('published','rejected')) OR
    (OLD.state='published' AND NEW.state='superseded')
  ) THEN
   RAISE EXCEPTION 'invalid BC batch state transition % -> %',OLD.state,NEW.state
    USING ERRCODE='23514';
  END IF;
 END IF;
 IF (NEW.validated_rows IS DISTINCT FROM OLD.validated_rows OR
     NEW.validated_at IS DISTINCT FROM OLD.validated_at) AND
      NOT (OLD.state='staged' AND NEW.state='validated') THEN
  RAISE EXCEPTION 'validated count/time may change only on validation'
   USING ERRCODE='23514';
 END IF;
 IF OLD.state='staged' AND NEW.state='validated' AND
    (NEW.validated_at IS NULL OR NEW.validated_rows<>NEW.expected_rows) THEN
  RAISE EXCEPTION 'incomplete batch cannot become validated'
   USING ERRCODE='23514';
 END IF;
 IF (NEW.published_at IS DISTINCT FROM OLD.published_at) AND
    NOT (OLD.state='validated' AND NEW.state='published') THEN
  RAISE EXCEPTION 'published time may change only on publication'
   USING ERRCODE='23514';
 END IF;
 IF OLD.state='validated' AND NEW.state='published' AND NEW.published_at IS NULL THEN
  RAISE EXCEPTION 'published batch requires timestamp' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$fn$;

CREATE TRIGGER bc_batch_header_guard_isolated
BEFORE UPDATE ON visura_shared.bc_batches
FOR EACH ROW EXECUTE FUNCTION visura_shared.bc_batch_header_guard_isolated();

REVOKE ALL ON FUNCTION visura_shared.bc_batch_header_guard_isolated()
 FROM PUBLIC,anon,authenticated;
COMMIT;

-- Still not a complete privilege boundary: a high-privilege DB owner can
-- disable triggers; validation must also bind server-verified actor and digest.
