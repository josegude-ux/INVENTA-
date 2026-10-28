-- Disposable PostgreSQL 16; session A holds the association row until commit.
\set ON_ERROR_STOP on
BEGIN;
SELECT visura_shared.transition_fixed_association_cas_isolated(
 (SELECT association_id FROM visura_shared.warehouse_fixed_positions
  WHERE warehouse_code='COR_01_COR' AND location_code='A-01'),
 'COR_01_COR',4,'REACTIVAR','REUBICACION','',
 '11111111-1111-4111-8111-111111111111');
\! touch /tmp/visura_fixed_cas_lock_ready
SELECT pg_sleep(3);
COMMIT;
SELECT 'VISURA_FIXED_CAS_HOLDER_COMMITTED' AS result;
