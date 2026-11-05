-- Ensayo de conflicto de reactivación contra otro par activo; base ficticia.
DO $lab$
DECLARE old_id bigint; new_id bigint; was_active boolean; ver integer; events_count integer;
BEGIN
 IF current_database()<>'inventa08_test' THEN
  RAISE EXCEPTION 'INVENTA08 LAB ONLY: wrong database';
 END IF;
 INSERT INTO inv08_disposable.associations(warehouse,product_code,location_code)
 VALUES('COR_01_COR','00400','Z09') RETURNING id INTO old_id;
 PERFORM inv08_disposable.transition(old_id,1,'RETIRAR','REUBICACION',null,'admin-lab');
 INSERT INTO inv08_disposable.associations(warehouse,product_code,location_code)
 VALUES('COR_01_COR','00400','Z09') RETURNING id INTO new_id;
 IF old_id=new_id THEN RAISE EXCEPTION 'IDENTITY_REUSED'; END IF;
 BEGIN
  PERFORM inv08_disposable.transition(old_id,2,'REACTIVAR','OTROS',
    'Conflicto por asignación nueva','admin-lab');
  RAISE EXCEPTION 'REACTIVATION_DUPLICATE_ACCEPTED';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 SELECT active,revision INTO STRICT was_active,ver
 FROM inv08_disposable.associations WHERE id=old_id;
 IF was_active OR ver<>2 THEN RAISE EXCEPTION 'FAILED_REACTIVATION_DID_NOT_ROLLBACK'; END IF;
 SELECT count(*) INTO events_count FROM inv08_disposable.history
 WHERE association_id=old_id;
 IF events_count<>1 THEN RAISE EXCEPTION 'FAILED_REACTIVATION_INSERTED_EVENT'; END IF;
 IF (SELECT active FROM inv08_disposable.associations WHERE id=new_id) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'NEW_ACTIVE_ASSOCIATION_DAMAGED'; END IF;
 RAISE NOTICE 'INVENTA08 REACTIVATION COLLISION PASSED';
END
$lab$;
