-- Pruebas sobre inventa08_test ÚNICAMENTE, sin tablas empresariales.
DO $guard$
BEGIN
 IF current_database()<>'inventa08_test' THEN
  RAISE EXCEPTION 'INVENTA08 LAB ONLY: wrong database %',current_database();
 END IF;
END
$guard$;
INSERT INTO inv08_disposable.associations(warehouse,product_code,location_code)
 VALUES ('COR_01_COR','00100','K02'),('COR_01_COR','00100','K10'),
 ('COR_01_COR','00200','K02'),('COR_02_NAR','00100','K02');
DO $test$
DECLARE id_a bigint; id_b bigint; id_external bigint;
        rv integer; st boolean; logs integer;
BEGIN
 SELECT id INTO STRICT id_a FROM inv08_disposable.associations
 WHERE warehouse='COR_01_COR' AND product_code='00100' AND location_code='K02';
 SELECT id INTO STRICT id_b FROM inv08_disposable.associations
 WHERE warehouse='COR_01_COR' AND product_code='00100' AND location_code='K10';
 SELECT id INTO STRICT id_external FROM inv08_disposable.associations
 WHERE warehouse='COR_02_NAR' AND product_code='00100' AND location_code='K02';
 IF id_a=id_external THEN RAISE EXCEPTION 'CROSS_WAREHOUSE_COLLISION'; END IF;
 IF (SELECT count(*) FROM inv08_disposable.associations WHERE
       location_code='K02' AND active)<>3 THEN
  RAISE EXCEPTION 'MANY_ARTICLES_ONE_POSITION_FAIL';
 END IF;
 -- Impedir par activo duplicado; mantener el índice único por almacén.
 BEGIN
  INSERT INTO inv08_disposable.associations(warehouse,product_code,location_code)
  VALUES('COR_01_COR','00100','K02');
  RAISE EXCEPTION 'EXPECTED_DUPLICATE_FAILURE';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 -- Retirada lógica con conservación de la asociación y evento.
 rv:=inv08_disposable.transition(id_a,1,'RETIRAR','REUBICACION',null,'admin-lab');
 IF rv<>2 THEN RAISE EXCEPTION 'RETIRE_REVISION_WRONG'; END IF;
 SELECT active INTO STRICT st FROM inv08_disposable.associations WHERE id=id_a;
 IF st THEN RAISE EXCEPTION 'RETIRED_STILL_ACTIVE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM inv08_disposable.history
   WHERE association_id=id_a AND previous_state='ACTIVA'
   AND next_state='RETIRADA' AND actor='admin-lab' AND revision=2)
 THEN RAISE EXCEPTION 'RETIRE_HISTORY_MISSING'; END IF;
 -- No pasar de retirada a retirada ni ejecutar con revisión antigua.
 BEGIN
  PERFORM inv08_disposable.transition(id_a,1,'REACTIVAR',
   'REUBICACION',null,'admin-lab');
  RAISE EXCEPTION 'EXPECTED_STALE_FAILURE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%REVISION_CONFLICT%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM inv08_disposable.transition(id_a,2,'RETIRAR',
   'REUBICACION',null,'admin-lab');
  RAISE EXCEPTION 'EXPECTED_STATE_FAILURE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%INVALID_TRANSITION%' THEN RAISE; END IF;
 END;
 -- El motivo OTROS exige texto y nunca puede faltar actor.
 BEGIN
  PERFORM inv08_disposable.transition(id_a,2,'REACTIVAR',
   'OTROS',' ','admin-lab');
  RAISE EXCEPTION 'EXPECTED_REASON_FAILURE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%REASON_DETAIL_REQUIRED%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM inv08_disposable.transition(id_a,2,'REACTIVAR',
   'OTROS','Comprobado',null);
  RAISE EXCEPTION 'EXPECTED_ACTOR_FAILURE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%ACTOR_REQUIRED%' THEN RAISE; END IF;
 END;
 -- Reactivación: mismo ID y una segunda entrada append-only.
 rv:=inv08_disposable.transition(id_a,2,'REACTIVAR',
  'OTROS','Revisado en almacén','admin-lab');
 IF rv<>3 OR (SELECT active FROM inv08_disposable.associations WHERE id=id_a)<>true
 THEN RAISE EXCEPTION 'REACTIVATION_FAILED'; END IF;
 SELECT count(*) INTO logs FROM inv08_disposable.history WHERE association_id=id_a;
 IF logs<>2 THEN RAISE EXCEPTION 'HISTORY_NOT_PRESERVED'; END IF;
 IF (SELECT reason_detail FROM inv08_disposable.history
   WHERE association_id=id_a AND revision=3)<>'Revisado en almacén'
 THEN RAISE EXCEPTION 'REASON_NOT_PRESERVED'; END IF;
 -- Inmutabilidad: ni borrar ni corregir antiguos eventos.
 BEGIN
  DELETE FROM inv08_disposable.history WHERE association_id=id_a;
  RAISE EXCEPTION 'EXPECTED_HISTORY_IMMUTABLE_FAILURE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%INVENTA08_HISTORY_IMMUTABLE%' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE inv08_disposable.history SET actor='otro' WHERE association_id=id_a;
  RAISE EXCEPTION 'EXPECTED_HISTORY_UPDATE_FAILURE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%INVENTA08_HISTORY_IMMUTABLE%' THEN RAISE; END IF;
 END;
 -- Tampoco se pueden borrar físicamente las asociaciones.
 BEGIN
  DELETE FROM inv08_disposable.associations WHERE id=id_a;
  RAISE EXCEPTION 'EXPECTED_ASSOC_DELETE_FAILURE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%INVENTA08_HISTORY_IMMUTABLE%' THEN RAISE; END IF;
 END;
 -- Separación por almacenes con códigos K02 coincidentes.
 IF (SELECT count(*) FROM inv08_disposable.associations WHERE
      warehouse='COR_02_NAR' AND product_code='00100' AND active)<>1
 THEN RAISE EXCEPTION 'CROSS_WAREHOUSE_AFFECTED'; END IF;
END
$test$;
-- Ensayo de deshacer transición y evento en la misma transacción.
BEGIN;
SELECT inv08_disposable.transition(id,1,'RETIRAR','CAMBIO_OPERATIVO',null,'admin-lab')
 FROM inv08_disposable.associations
 WHERE warehouse='COR_01_COR' AND product_code='00100' AND location_code='K10';
ROLLBACK;
DO $rollback$
BEGIN
 IF EXISTS(SELECT 1 FROM inv08_disposable.associations
   WHERE product_code='00100' AND location_code='K10' AND (NOT active OR revision<>1))
 THEN RAISE EXCEPTION 'ROLLBACK_ASSOCIATION_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM inv08_disposable.history h JOIN inv08_disposable.associations a
   ON a.id=h.association_id WHERE a.product_code='00100' AND a.location_code='K10')
 THEN RAISE EXCEPTION 'ROLLBACK_HISTORY_FAILED'; END IF;
 RAISE NOTICE 'INVENTA08 LAB PASSED: uniqueness, lifecycle, immutable history, rollback';
END
$rollback$;
