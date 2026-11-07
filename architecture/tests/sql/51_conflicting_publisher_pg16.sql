-- Disposable PG16 only: session B must time out on COR lock.
\set ON_ERROR_STOP on
SET lock_timeout = '350ms';
DO $test$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM visura_shared.publish_bc_batch_isolated(
    'ffffffff-ffff-4fff-8fff-fffffffffff6',
    'COR_01_COR',
    '11111111-1111-4111-8111-111111111111',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
  );
 EXCEPTION WHEN lock_not_available THEN blocked := true;
 END;
 IF NOT blocked THEN
  RAISE EXCEPTION 'publisher bypassed the held warehouse lock';
 END IF;
END;
$test$;
RESET lock_timeout;
SELECT 'WAREHOUSE_LOCK_TIMEOUT_ISOLATED_OK' AS result;
