-- VISURA 05 / isolated second session. The first reader has already taken its snapshot.
\set ON_ERROR_STOP on
DO $audit$
DECLARE v_result jsonb;
BEGIN
 SELECT visura_shared.publish_bc_batch_isolated(
   'ffffffff-ffff-4fff-8fff-fffffffffff6',
   'COR_01_COR',
   '11111111-1111-4111-8111-111111111111',
   'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
 ) INTO v_result;
 IF v_result->>'status' <> 'published'
 OR v_result->>'batch_id' <> 'ffffffff-ffff-4fff-8fff-fffffffffff6'
 THEN RAISE EXCEPTION 'concurrent publisher did not commit expected batch: %',v_result; END IF;
END;
$audit$;
\! touch /tmp/visura05_writer_published
SELECT 'VISURA05_WRITER_COMMITTED_OK' AS result;
