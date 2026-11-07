-- Disposable PG16 only: session A holds the COR warehouse row lock.
\set ON_ERROR_STOP on
BEGIN;
SELECT code FROM visura_shared.warehouses WHERE code='COR_01_COR' FOR UPDATE;
\! touch /tmp/visura_shared_cor_lock_ready
SELECT pg_sleep(4);
COMMIT;
