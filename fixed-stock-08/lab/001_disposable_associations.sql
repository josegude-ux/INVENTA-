-- VISURA INVENTA 08: LABORATORIO POSTGRESQL 16 DESCARTABLE.
-- NO es una migración ni un esquema propuesto para producción.
-- Nunca ejecutar en Supabase, aunque exista permiso de conexión.
DO $safety$
BEGIN
 IF current_database()<>'inventa08_test' THEN
  RAISE EXCEPTION 'INVENTA08 LAB ONLY: wrong database %', current_database();
 END IF;
END
$safety$;
CREATE SCHEMA inv08_disposable;
CREATE TABLE inv08_disposable.associations(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 warehouse text NOT NULL CHECK(btrim(warehouse)<>''),
 product_code text NOT NULL CHECK(btrim(product_code)<>''),
 location_code text NOT NULL CHECK(btrim(location_code)<>''),
 active boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Un artículo puede tener varias posiciones y cada posición varios artículos;
-- no dos pares idénticos activos dentro del mismo almacén.
CREATE UNIQUE INDEX unique_active_pair ON inv08_disposable.associations
 (warehouse,product_code,location_code) WHERE active;
CREATE TABLE inv08_disposable.history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 association_id bigint NOT NULL REFERENCES inv08_disposable.associations(id) ON DELETE RESTRICT,
 warehouse text NOT NULL,
 product_code text NOT NULL,
 location_code text NOT NULL,
 actor text NOT NULL CHECK(btrim(actor)<>''),
 previous_state text NOT NULL CHECK(previous_state IN ('ACTIVA','RETIRADA')),
 next_state text NOT NULL CHECK(next_state IN ('ACTIVA','RETIRADA')),
 reason text NOT NULL CHECK(reason IN ('REUBICACION','BAJA_ARTICULO','CAMBIO_OPERATIVO','ERROR_ASIGNACION','OTROS')),
 reason_detail text,
 revision integer NOT NULL CHECK(revision>=2),
 happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(previous_state<>next_state),
 CHECK(reason<>'OTROS' OR length(btrim(coalesce(reason_detail,'')))>0),
 UNIQUE(association_id,revision)
);
CREATE FUNCTION inv08_disposable.reject_mutation() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 RAISE EXCEPTION 'INVENTA08_HISTORY_IMMUTABLE';
END $fn$;
CREATE TRIGGER history_append_only
 BEFORE UPDATE OR DELETE ON inv08_disposable.history
 FOR EACH ROW EXECUTE FUNCTION inv08_disposable.reject_mutation();
CREATE TRIGGER associations_no_delete
 BEFORE DELETE ON inv08_disposable.associations
 FOR EACH ROW EXECUTE FUNCTION inv08_disposable.reject_mutation();
-- Contrato de transición ATÓMICA a nivel de fila, no contrato Auth.
-- No autoriza usuarios reales; el servidor deberá autenticar a su actor.
CREATE FUNCTION inv08_disposable.transition(
 p_association_id bigint,p_expected_revision integer,
 p_action text,p_reason text,p_other text,p_actor text
) RETURNS integer LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE v inv08_disposable.associations%ROWTYPE;
        new_active boolean;
        new_revision integer;
BEGIN
 IF p_action NOT IN ('RETIRAR','REACTIVAR') OR p_action IS NULL THEN
  RAISE EXCEPTION 'INVALID_ACTION';
 END IF;
 IF p_reason IS NULL OR p_reason NOT IN
   ('REUBICACION','BAJA_ARTICULO','CAMBIO_OPERATIVO','ERROR_ASIGNACION','OTROS') THEN
  RAISE EXCEPTION 'INVALID_REASON';
 END IF;
 IF p_reason='OTROS' AND btrim(coalesce(p_other,''))='' THEN
  RAISE EXCEPTION 'REASON_DETAIL_REQUIRED';
 END IF;
 IF btrim(coalesce(p_actor,''))='' THEN
  RAISE EXCEPTION 'ACTOR_REQUIRED';
 END IF;
 SELECT * INTO STRICT v FROM inv08_disposable.associations
 WHERE id=p_association_id FOR UPDATE;
 IF p_expected_revision IS DISTINCT FROM v.revision THEN
  RAISE EXCEPTION 'REVISION_CONFLICT';
 END IF;
 new_active=(p_action='REACTIVAR');
 IF new_active=v.active THEN
  RAISE EXCEPTION 'INVALID_TRANSITION';
 END IF;
 new_revision=v.revision+1;
 UPDATE inv08_disposable.associations
 SET active=new_active,revision=new_revision WHERE id=v.id;
 INSERT INTO inv08_disposable.history(
   association_id,warehouse,product_code,location_code,
   actor,previous_state,next_state,reason,reason_detail,revision)
 VALUES(v.id,v.warehouse,v.product_code,v.location_code,
  p_actor,CASE WHEN v.active THEN 'ACTIVA' ELSE 'RETIRADA' END,
  CASE WHEN new_active THEN 'ACTIVA' ELSE 'RETIRADA' END,
  p_reason,CASE WHEN p_reason='OTROS' THEN btrim(p_other) ELSE NULL END,new_revision);
 RETURN new_revision;
END $fn$;
