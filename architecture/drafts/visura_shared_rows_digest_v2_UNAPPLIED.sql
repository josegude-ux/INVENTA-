-- VISURA 04: PostgreSQL half of length-prefixed normalized row digest V2.
-- STRICTLY UNAPPLIED / PRIVATE. Disposable PG16 only, outside migrations.
-- No GRANT to client roles, no exposed API; not a validation/publication RPC.
-- Does NOT bind original XLSX bytes to the parser, nor cover expiry_date yet.
BEGIN;

CREATE FUNCTION visura_shared.bc_frame_field_v2(p_text text)
RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog
AS $fn$
 SELECT
   pg_catalog.decode(
     pg_catalog.lpad(
       pg_catalog.to_hex(
         pg_catalog.octet_length(pg_catalog.convert_to(p_text,'UTF8'))
       ),8,'0'
     ),'hex'
   ) || pg_catalog.convert_to(p_text,'UTF8');
$fn$;

CREATE FUNCTION visura_shared.bc_batch_rows_sha256_v2(
 p_batch uuid,p_warehouse text
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog
AS $fn$
DECLARE
 v_expected integer;
 v_count bigint;
 v_min integer;
 v_max integer;
 v_rows bytea;
 v_payload bytea;
BEGIN
 SELECT expected_rows INTO v_expected
 FROM visura_shared.bc_batches
 WHERE id=p_batch AND warehouse_code=p_warehouse;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'batch not found for requested warehouse' USING ERRCODE='22023';
 END IF;
 SELECT count(*),min(row_number),max(row_number)
 INTO v_count,v_min,v_max
 FROM visura_shared.bc_batch_lines
 WHERE batch_id=p_batch AND warehouse_code=p_warehouse;
 IF v_count<>v_expected OR v_min<>1 OR v_max<>v_expected THEN
  RAISE EXCEPTION 'rows incomplete or non-contiguous'
   USING ERRCODE='23514';
 END IF;

 SELECT pg_catalog.string_agg(
    visura_shared.bc_frame_field_v2(l.warehouse_code) ||
    visura_shared.bc_frame_field_v2(l.product_code) ||
    visura_shared.bc_frame_field_v2(l.description) ||
    visura_shared.bc_frame_field_v2(l.unit) ||
    visura_shared.bc_frame_field_v2(l.location_code) ||
    visura_shared.bc_frame_field_v2(l.lot) ||
    visura_shared.bc_frame_field_v2(
      CASE WHEN l.stock_calculated = 0 THEN '0'
      ELSE pg_catalog.rtrim(
       pg_catalog.rtrim(l.stock_calculated::text,'0'),'.'
      ) END),
    pg_catalog.decode('','hex') ORDER BY l.row_number
  ) INTO v_rows
  FROM visura_shared.bc_batch_lines AS l
  WHERE l.batch_id=p_batch AND l.warehouse_code=p_warehouse;
 v_payload :=
    visura_shared.bc_frame_field_v2('visura-bc-rows-len32-v1') ||
    visura_shared.bc_frame_field_v2('visura-bc-batch-v1') ||
    visura_shared.bc_frame_field_v2(p_warehouse) ||
    visura_shared.bc_frame_field_v2(v_expected::text) || v_rows;

 RETURN pg_catalog.encode(pg_catalog.sha256(v_payload),'hex');
END;
$fn$;

REVOKE ALL ON FUNCTION visura_shared.bc_frame_field_v2(text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION visura_shared.bc_batch_rows_sha256_v2(uuid,text)
 FROM PUBLIC,anon,authenticated;
COMMIT;

-- V2 is row-field integrity evidence, not standalone approval.
-- To migrate to production, first test file parser trust, real Auth mapping,
-- attested input against DB digest, expiry_date mapping, and privilege model.
