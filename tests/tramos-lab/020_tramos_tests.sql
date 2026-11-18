-- INVENTA TRAMOS LAB ONLY · pruebas de tramos, pareja, solapes, RLS y trazabilidad.
\set ON_ERROR_STOP 1
do $$ begin
 if current_database()<>'inventa_tramos_test' then raise exception 'INVENTA TRAMOS LAB ONLY'; end if;
end $$;

create schema lab;
grant usage on schema lab to authenticated,anon;
create function lab.ok(cond boolean,msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FALLO: %',msg; end if; raise notice 'OK: %',msg; end $$;
create function lab.fails(stmt text,pattern text,msg text) returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then
  if sqlerrm ~* pattern then raise notice 'OK: % (%)',msg,sqlerrm; return; end if;
  raise exception 'FALLO: % → error inesperado: %',msg,sqlerrm;
 end;
 raise exception 'FALLO: % → no dio error',msg;
end $$;
create table lab.state(k text primary key,v text);
-- Envoltorios de prueba: generan un identificador de orden nuevo en cada llamada (primer recuento).
create function lab.assign(c uuid,f text,t text,op uuid,pa uuid,fp text) returns uuid language sql as $$
 select (inventa.assign_segment(gen_random_uuid(),c,f,t,1::smallint,op,pa,fp)->>'segment_id')::uuid $$;
create function lab.reassign(s uuid,op uuid,pa uuid,r text,v bigint) returns bigint language sql as $$
 select (inventa.reassign_segment(gen_random_uuid(),s,op,pa,r,v)->>'version')::bigint $$;
create function lab.release(s uuid,r text,v bigint) returns void language plpgsql as $$
begin perform inventa.release_segment(gen_random_uuid(),s,r,v); end $$;
grant select,insert,update on lab.state to authenticated;
grant execute on all functions in schema lab to authenticated,anon;

-- ── 1. Orden natural y formato (superusuario, funciones internas) ──
select lab.ok(inventa_internal.location_sort_key('Z2-P1') collate "C" < inventa_internal.location_sort_key('Z10-P1') collate "C",'Z2-P1 va antes que Z10-P1');
select lab.ok(inventa_internal.location_sort_key('K09-P08') collate "C" < inventa_internal.location_sort_key('K10-P01') collate "C",'K09-P08 va antes que K10-P01');
select lab.ok(inventa_internal.location_sort_key('k2-p1')=inventa_internal.location_sort_key('K02-P01'),'mayúsculas y ceros no cambian el orden');
select lab.ok(inventa_internal.location_shape('K00-P01')=inventa_internal.location_shape('K9-P8'),'K00-P01 y K9-P8 comparten formato');
select lab.ok(inventa_internal.location_shape('K00-P01')<>inventa_internal.location_shape('K03-P03-A'),'K03-P03-A tiene otro formato');

-- ── 2. Un Operario no puede previsualizar, asignar ni crear asignaciones a mano ──
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',false);
set role authenticated;
select lab.fails($q$select inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K00-P01','K09-P08')$q$,'Supervisor o Administrador','Operario no previsualiza tramos');
select lab.fails($q$select lab.assign('00000000-0000-4000-8000-00000000ca01','K00-P01','K09-P08','00000000-0000-4000-8000-0000000000c3',null,'x')$q$,'Supervisor o Administrador','Operario no asigna tramos');
select lab.fails($q$insert into inventa.assignments(campaign_id,location_code,operator_id,assigned_by) values('00000000-0000-4000-8000-00000000ca01','K00-P01','00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000c3')$q$,'permission denied|permiso','Operario no inserta asignaciones');
select lab.fails($q$select * from inventa.list_segments('00000000-0000-4000-8000-00000000ca01')$q$,'Supervisor o Administrador','Operario no ve el seguimiento');
reset role;

-- ── 3. Supervisor: vista previa del ejemplo K00-P01 → K09-P08 ──
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000b1',false);
set role authenticated;
select lab.fails($q$insert into inventa.assignments(campaign_id,location_code,operator_id,assigned_by) values('00000000-0000-4000-8000-00000000ca01','K00-P01','00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000b1')$q$,'permission denied|permiso','Ni el Supervisor inserta asignaciones fuera del tramo');
do $$ declare p jsonb; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-00000000ca01',' k00-p01 ','K09-P08');
 perform lab.ok((p->>'total')::int=79,'80 ubicaciones K00..K09 menos 1 deshabilitada = 79 (fue '||(p->>'total')||')');
 perform lab.ok(p->>'first'='K00-P01' and p->>'last'='K09-P08','primera y última correctas');
 perform lab.ok((p->'excluded_format'->>'count')::int=2,'K05 y K03-P03-A avisados por formato distinto');
 perform lab.ok((p->>'disabled')::int=1,'K04-P04 avisada como deshabilitada');
 perform lab.ok((p->'conflicts'->>'count')::int=0,'sin solapes al principio');
 perform lab.ok(not (p ? 'codes') and jsonb_array_length(p->'sample')=12,'al navegador solo va una muestra');
 perform lab.ok(not (p::text ~* 'quantity|stock|theor'),'la vista previa no contiene cantidades');
 insert into lab.state values('fp1',p->>'fingerprint');
end $$;
select lab.fails($q$select inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K09-P08','K00-P01')$q$,'va después','desde posterior a hasta se rechaza');
select lab.fails($q$select inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K00-P01','K03-P03-A')$q$,'mismo formato','formatos distintos se rechazan');
select lab.fails($q$select inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K00-P01','K99-P99')$q$,'No existe la ubicación final','ubicación inexistente se rechaza');
select lab.fails($q$select inventa.preview_segment('00000000-0000-4000-8000-00000000ca02','K00-P01','K00-P02')$q$,'cerrada','campaña cerrada se rechaza');

-- ── 4. Asignación en un paso a una pareja ──
select lab.fails($q$select lab.assign('00000000-0000-4000-8000-00000000ca01','K00-P01','K09-P08','00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c1',(select v from lab.state where k='fp1'))$q$,'otra persona','la pareja no puede ser la misma persona');
select lab.fails($q$select lab.assign('00000000-0000-4000-8000-00000000ca01','K00-P01','K09-P08','00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000d1',(select v from lab.state where k='fp1'))$q$,'no es una cuenta habilitada','cuenta deshabilitada rechazada');
select lab.fails($q$select lab.assign('00000000-0000-4000-8000-00000000ca01','K00-P01','K09-P08','00000000-0000-4000-8000-0000000000c1',null,'huella-antigua')$q$,'han cambiado','vista previa obsoleta rechazada');
do $$ declare v_id uuid; begin
 v_id=lab.assign('00000000-0000-4000-8000-00000000ca01','K00-P01','K09-P08',
   '00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c2',(select v from lab.state where k='fp1'));
 insert into lab.state values('seg1',v_id::text);
 perform lab.ok((select count(*) from inventa.segment_locations where segment_id=v_id)=79,'79 ubicaciones guardadas en el tramo');
 perform lab.ok((select count(*) from inventa.assignments where segment_id=v_id and active)=158,'79 × 2 personas = 158 asignaciones activas');
 perform lab.ok((select min(position)=1 and max(position)=79 from inventa.segment_locations where segment_id=v_id),'posiciones 1..79 en orden');
 perform lab.ok((select position from inventa.segment_locations where segment_id=v_id and location_code='K01-P01')=9,'K01-P01 es la posición 9');
end $$;

-- ── 5. Solapes ──
do $$ declare p jsonb; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K09-P01','K10-P08');
 perform lab.ok((p->'conflicts'->>'count')::int=8,'el tramo K09-P01..K10-P08 choca en 8 ubicaciones');
 perform lab.ok(p->'conflicts'->'items'->0->>'people' ~ 'Operario','el aviso indica quién la tiene');
 insert into lab.state values('fp_overlap',p->>'fingerprint');
end $$;
select lab.fails($q$select lab.assign('00000000-0000-4000-8000-00000000ca01','K09-P01','K10-P08','00000000-0000-4000-8000-0000000000c3',null,(select v from lab.state where k='fp_overlap'))$q$,'ya están asignadas en este recuento','un tramo solapado se rechaza');
reset role;
select lab.fails($q$do $x$ declare s uuid; begin
 insert into inventa.segments(campaign_id,from_code,to_code,operator_id,created_by)
  values('00000000-0000-4000-8000-00000000ca01','K00-P01','K00-P01','00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000a1') returning id into s;
 insert into inventa.segment_locations(segment_id,campaign_id,location_code,cycle,position) values(s,'00000000-0000-4000-8000-00000000ca01','K00-P01',1,1);
end $x$$q$,'segment_location_single_active','índice único: ni escribiendo directo hay dos tramos activos en una ubicación');

-- ── 6. Lectura del Operario: solo lo suyo y sin teórico ──
update inventa.campaigns set status='active',starts_at=now() where id='00000000-0000-4000-8000-00000000ca01';
insert into inventa.stock_snapshot(campaign_id,location_code,product_code,quantity) values('00000000-0000-4000-8000-00000000ca01','K00-P01','ART-LAB-1',7);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c2',false);
set role authenticated;
select lab.ok((select count(*) from inventa.segments)=1,'Operario Dos (pareja) ve su tramo');
select lab.ok((select count(*) from inventa.segment_locations)=79,'y sus 79 ubicaciones');
select lab.ok((select count(*) from inventa.assignments where active)=79,'y solo sus propias asignaciones');
select lab.ok((select count(*) from inventa.stock_snapshot)=0,'el Operario no lee el teórico');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',false);
set role authenticated;
select lab.ok((select count(*) from inventa.segments)=0 and (select count(*) from inventa.segment_locations)=0,'Operario Tres no ve tramos ajenos');
select lab.fails($q$insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id) values('00000000-0000-4000-8000-00000000ca01','K00-P01','ART-LAB-1',1,'00000000-0000-4000-8000-0000000000c3',gen_random_uuid())$q$,'row-level security','Operario Tres no cuenta fuera de su tramo');
reset role;

-- ── 7. La pareja cuenta en su tramo ──
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',false);
set role authenticated;
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,partner_id,client_mutation_id)
 values('00000000-0000-4000-8000-00000000ca01','K00-P01','ART-LAB-1',5,'00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c2',gen_random_uuid());
select lab.ok(true,'Operario Uno cuenta K00-P01 con su pareja');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c2',false);
set role authenticated;
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,partner_id,client_mutation_id)
 values('00000000-0000-4000-8000-00000000ca01','K00-P02','ART-LAB-1',3,'00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000c1',gen_random_uuid());
select lab.ok(true,'Operario Dos toma el relevo en K00-P02');
reset role;

-- ── 8. Reasignar: sale Operario Dos, entra Operario Tres ──
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000b1',false);
set role authenticated;
select lab.fails($q$select lab.reassign((select v::uuid from lab.state where k='seg1'),'00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c3','cambio de turno',99)$q$,'otro dispositivo','versión obsoleta rechazada');
select lab.fails($q$select lab.reassign((select v::uuid from lab.state where k='seg1'),'00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c3','',0)$q$,'motivo','reasignar exige motivo');
select lab.ok(lab.reassign((select v::uuid from lab.state where k='seg1'),'00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c3','cambio de turno',0)=1,'reasignación aplicada, versión 1');
reset role;
select lab.ok((select count(*) from inventa.assignments where operator_id='00000000-0000-4000-8000-0000000000c2' and active)=0,'Operario Dos ya no tiene asignaciones activas');
select lab.ok((select count(*) from inventa.assignments where operator_id='00000000-0000-4000-8000-0000000000c2')=79,'pero sus filas se conservan (sin borrar)');
select lab.ok((select count(*) from inventa.assignments where operator_id='00000000-0000-4000-8000-0000000000c3' and active)=79,'Operario Tres recibe las 79');
select lab.ok((select count(*) from inventa.counts where actor_id='00000000-0000-4000-8000-0000000000c2')=1,'el recuento de Operario Dos sigue intacto');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c2',false);
set role authenticated;
select lab.fails($q$insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id) values('00000000-0000-4000-8000-00000000ca01','K00-P03','ART-LAB-1',1,'00000000-0000-4000-8000-0000000000c2',gen_random_uuid())$q$,'row-level security','Operario Dos ya no puede contar en el tramo');
reset role;

-- ── 9. Seguimiento sin cantidades ──
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000b1',false);
set role authenticated;
do $$ declare r record; begin
 select * into r from inventa.list_segments('00000000-0000-4000-8000-00000000ca01');
 perform lab.ok(r.total=79 and r.counted=2,'avance 2/79 (fue '||r.counted||'/'||r.total||')');
 perform lab.ok(r.operator_name='Operario Uno' and r.partner_name='Operario Tres' and r.version=1,'nombres y versión actuales');
end $$;
select lab.ok(not exists(select 1 from information_schema.routines r join information_schema.parameters p
 on p.specific_name=r.specific_name where r.routine_name='list_segments' and p.parameter_name ~* 'quantity|stock'),'list_segments no devuelve cantidades');
-- El Supervisor solo puede cambiar el estado de una asignación.
select lab.fails($q$update inventa.assignments set location_code='K10-P01' where segment_id=(select v::uuid from lab.state where k='seg1')$q$,'permission denied|permiso','no se puede mover una asignación a mano');
update inventa.assignments set status='in_progress' where segment_id=(select v::uuid from lab.state where k='seg1') and location_code='K00-P01';
select lab.ok(true,'el estado sí se puede actualizar');

-- ── 10. Liberar el tramo y volver a crearlo (partir = liberar + crear dos) ──
select lab.fails($q$select lab.release((select v::uuid from lab.state where k='seg1'),'no',1)$q$,'motivo','liberar exige motivo');
select lab.release((select v::uuid from lab.state where k='seg1'),'partir en dos tramos',1);
select lab.fails($q$select lab.release((select v::uuid from lab.state where k='seg1'),'otra vez más',2)$q$,'ya está liberado','no se libera dos veces');
do $$ declare p jsonb; a uuid; b uuid; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K00-P01','K04-P08');
 perform lab.ok((p->'conflicts'->>'count')::int=0,'tras liberar ya no hay solapes');
 a=lab.assign('00000000-0000-4000-8000-00000000ca01','K00-P01','K04-P08','00000000-0000-4000-8000-0000000000c1',null,p->>'fingerprint');
 p=inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K05-P01','K09-P08');
 b=lab.assign('00000000-0000-4000-8000-00000000ca01','K05-P01','K09-P08','00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000c3',p->>'fingerprint');
 perform lab.ok((select count(*) from inventa.list_segments('00000000-0000-4000-8000-00000000ca01') where status='active')=2,'dos tramos activos tras partir');
 perform lab.ok((select counted from inventa.list_segments('00000000-0000-4000-8000-00000000ca01') where id=a)=2,'lo ya contado sigue contando en el tramo nuevo');
 perform lab.ok((select count(*) from inventa.assignments where segment_id=a and active)=39,'K00..K04: 40 − 1 deshabilitada = 39');
 perform lab.ok((select count(*) from inventa.assignments where segment_id=b and active)=80,'K05..K09: 40 × 2 personas = 80');
end $$;
reset role;
select lab.ok((select count(*) from inventa.counts)=2,'ningún recuento se ha borrado');
select lab.ok((select count(*) from inventa.audit_events where relation_name='segments')>=5,'altas, reasignación y liberación de tramos auditadas');
select lab.ok((select count(*) from inventa.audit_events where relation_name='assignments' and operation='UPDATE')>0,'cambios de asignaciones auditados');

-- ── 12. Idempotencia por identificador de orden (idea de F2 CP012) ──
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000b1',false);
set role authenticated;
do $$ declare p jsonb; r1 jsonb; r2 jsonb; m uuid:='00000000-0000-4000-8000-0000000000e1'; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','Z2-P1','Z10-P1');
 perform lab.ok((p->>'total')::int=2 and p->>'first'='Z2-P1' and p->>'last'='Z10-P1','orden natural en el rango Z2-P1 → Z10-P1');
 r1=inventa.assign_segment(m,'00000000-0000-4000-8000-00000000ca01','Z2-P1','Z10-P1',1::smallint,'00000000-0000-4000-8000-0000000000c3',null,p->>'fingerprint');
 r2=inventa.assign_segment(m,'00000000-0000-4000-8000-00000000ca01','Z2-P1','Z10-P1',1::smallint,'00000000-0000-4000-8000-0000000000c3',null,p->>'fingerprint');
 perform lab.ok(r1->>'segment_id'=r2->>'segment_id' and (r1->>'replayed')::boolean=false and (r2->>'replayed')::boolean,'la misma orden repetida devuelve el mismo tramo sin duplicar');
 perform lab.ok((select count(*) from inventa.segments where from_code='Z2-P1')=1,'solo existe un tramo Z2-P1');
 insert into lab.state values('segz',r1->>'segment_id');
end $$;
select lab.fails($q$select inventa.assign_segment('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-00000000ca01','Z2-P1','Z10-P1',1::smallint,'00000000-0000-4000-8000-0000000000c1',null,'otra')$q$,'otros datos','reutilizar el identificador con otros datos se rechaza');
do $$ declare r1 jsonb; r2 jsonb; m uuid:='00000000-0000-4000-8000-0000000000e2'; s uuid:=(select v::uuid from lab.state where k='segz'); begin
 r1=inventa.reassign_segment(m,s,'00000000-0000-4000-8000-0000000000c1',null,'cambio de turno',0);
 r2=inventa.reassign_segment(m,s,'00000000-0000-4000-8000-0000000000c1',null,'cambio de turno',0);
 perform lab.ok((r1->>'version')::int=1 and (r2->>'version')::int=1 and (r2->>'replayed')::boolean,'reasignación repetida: misma respuesta');
 perform lab.ok((select version from inventa.segments where id=s)=1,'y la versión solo sube una vez');
end $$;

-- ── 13. Segundo recuento ciego (ciclo 2) ──
do $$ declare p jsonb; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-00000000ca01','K00-P01','K00-P08',2::smallint);
 perform lab.ok((p->>'total')::int=2 and p->>'first'='K00-P01' and p->>'last'='K00-P02','ciclo 2 solo incluye ubicaciones con primer recuento (2)');
 perform lab.ok((p->'without_first_count'->>'count')::int=6,'avisa de 6 ubicaciones sin primer recuento');
 perform lab.ok((p->'conflicts'->>'count')::int=0,'el tramo del primer recuento no bloquea el segundo');
 insert into lab.state values('fp_c2',p->>'fingerprint');
end $$;
select lab.fails($q$select inventa.assign_segment(gen_random_uuid(),'00000000-0000-4000-8000-00000000ca01','K00-P01','K00-P08',2::smallint,'00000000-0000-4000-8000-0000000000c1',null,(select v from lab.state where k='fp_c2'))$q$,'participó en el primer recuento','quien contó el primer recuento no hace el segundo');
select lab.fails($q$select inventa.assign_segment(gen_random_uuid(),'00000000-0000-4000-8000-00000000ca01','K00-P01','K00-P08',2::smallint,'00000000-0000-4000-8000-0000000000c4','00000000-0000-4000-8000-0000000000c2',(select v from lab.state where k='fp_c2'))$q$,'participó en el primer recuento','tampoco quien fue pareja en el primero');
select lab.fails($q$select inventa.assign_segment(gen_random_uuid(),'00000000-0000-4000-8000-00000000ca01','K00-P01','K00-P08',2::smallint,'00000000-0000-4000-8000-0000000000c3',null,(select v from lab.state where k='fp_c2'))$q$,'participó en el primer recuento','ni quien tuvo asignado el primer recuento aunque se liberara');
do $$ declare r jsonb; begin
 r=inventa.assign_segment(gen_random_uuid(),'00000000-0000-4000-8000-00000000ca01','K00-P01','K00-P08',2::smallint,
   '00000000-0000-4000-8000-0000000000c4',null,(select v from lab.state where k='fp_c2'));
 perform lab.ok((r->>'cycle')::int=2 and (r->>'total')::int=2,'segundo recuento asignado a otra persona (2 ubicaciones)');
 insert into lab.state values('segc2',r->>'segment_id');
end $$;
select lab.fails($q$select inventa.assign_segment(gen_random_uuid(),'00000000-0000-4000-8000-00000000ca01','K00-P01','K00-P08',2::smallint,'00000000-0000-4000-8000-0000000000a1',null,(select v from lab.state where k='fp_c2'))$q$,'ya están asignadas en este recuento','no hay dos segundos recuentos de la misma ubicación');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c4',false);
set role authenticated;
select lab.ok((select count(*) from inventa.counts)=0,'el segundo contador no ve el primer recuento (ciego)');
select lab.ok((select count(*) from inventa.stock_snapshot)=0,'ni el teórico');
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
 values('00000000-0000-4000-8000-00000000ca01','K00-P01','ART-LAB-1',6,'00000000-0000-4000-8000-0000000000c4',gen_random_uuid());
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',false);
set role authenticated;
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,cycle,client_mutation_id)
 values('00000000-0000-4000-8000-00000000ca01','K00-P03','ART-LAB-1',2,'00000000-0000-4000-8000-0000000000c1',2,gen_random_uuid());
reset role;
select lab.ok((select cycle from inventa.counts where actor_id='00000000-0000-4000-8000-0000000000c4')=2,'el recuento del segundo contador queda como ciclo 2');
select lab.ok((select cycle from inventa.counts where location_code='K00-P03')=1,'el navegador no puede forzar el ciclo 2');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000b1',false);
set role authenticated;
select lab.ok((select counted from inventa.list_segments('00000000-0000-4000-8000-00000000ca01') where id=(select v::uuid from lab.state where k='segc2'))=1,'avance del segundo recuento: 1 de 2');
select lab.ok((select count(*) from inventa.list_segments('00000000-0000-4000-8000-00000000ca01') where status='active' and cycle=1 and from_code='K00-P01' and counted=3)=1,'el primer recuento cuenta solo ciclo 1 (3 ubicaciones)');
reset role;

-- ── 11. Anónimo sin acceso ──
set role anon;
select lab.fails($q$select count(*) from inventa.segments$q$,'permission denied|permiso','anon no lee tramos');
reset role;
\echo 'TRAMOS LAB: TODAS LAS PRUEBAS SQL SUPERADAS'
