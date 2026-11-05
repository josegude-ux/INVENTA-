-- Roles FICTICIOS en PostgreSQL efímero inventa08_test.
-- Esto NO audita Auth/RLS de Supabase ni aplica privilegios productivos.
DO $guard$
BEGIN
 IF current_database()<>'inventa08_test' THEN
  RAISE EXCEPTION 'INVENTA08 LAB ONLY: wrong database';
 END IF;
END $guard$;
CREATE ROLE inv08_lab_reader NOLOGIN;
CREATE ROLE inv08_lab_operator NOLOGIN;
GRANT USAGE ON SCHEMA inv08_disposable TO inv08_lab_reader,inv08_lab_operator;
-- No grant al operario sobre stock teórico o eventos administrativos.
GRANT SELECT ON inv08_disposable.stock_lines,
 inv08_disposable.active_batch,
 inv08_disposable.associations,
 inv08_disposable.history TO inv08_lab_reader;
-- Sin UPDATE/DELETE/INSERT para el lector en ninguna tabla del laboratorio.
