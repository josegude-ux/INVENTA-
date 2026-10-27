-- VISURA 05: second synthetic publisher, executed only after READ COMMITTED reader starts.
\set ON_ERROR_STOP on
DO $audit$
DECLARE v_result jsonb;
BEGIN
 SELECT visura_shared.publish_bc_batch_isolated(
  '77777777-7777-4777-8777-777777777777',
  'COR_01_COR',
  '11111111-1111-4111-8111-111111111111',
  'ffffffff-ffff-4fff-8fff-fffffffffff6'
 ) INTO v_result;
 IF v_result->>'status'<>'published'
 OR v_result->>'batch_id'<>'77777777-7777-4777-8777-777777777777'
 THEN RAISE EXCEPTION 'negative control publisher did not commit: %', v_result; END IF;
END;
$audit$;
\! touch /tmp/visura05_rc_published
SELECT 'VISURA05_RC_WRITER_COMMITTED_OK' AS result;
