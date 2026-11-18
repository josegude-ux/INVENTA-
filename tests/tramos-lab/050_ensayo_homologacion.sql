-- INVENTA TRAMOS LAB ONLY · Ensayo del guion de homologación de «Mi tramo» (H02–H16).
-- Reproduce en PostgreSQL desechable lo que el guion pide comprobar en el móvil, con los
-- datos de supabase/homologacion/ficticio_mi_tramo.sql y cuatro cuentas ficticias.
\set ON_ERROR_STOP 1
do $$ begin
 if current_database()<>'inventa_tramos_test' then raise exception 'INVENTA TRAMOS LAB ONLY'; end if;
end $$;

-- Cuentas ficticias del guion (en el móvil las crea el usuario; aquí se simulan).
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-4000-8000-0000000a01ad','hom-admin@lab.invalid',now(),'{"display_name":"Prueba Administración"}'),
 ('00000000-0000-4000-8000-0000000a01a0','hom-sup@lab.invalid',now(),'{"display_name":"Prueba Supervisión"}'),
 ('00000000-0000-4000-8000-0000000a01a1','hom-uno@lab.invalid',now(),'{"display_name":"Prueba Uno"}'),
 ('00000000-0000-4000-8000-0000000a01a2','hom-dos@lab.invalid',now(),'{"display_name":"Prueba Dos"}'),
 ('00000000-0000-4000-8000-0000000a01a3','hom-tres@lab.invalid',now(),'{"display_name":"Prueba Tres"}');
update inventa.profiles set role='admin',enabled=true,permission_reason='homologación ficticia' where user_id='00000000-0000-4000-8000-0000000a01ad';
update inventa.profiles set role='supervisor',enabled=true,permission_reason='homologación ficticia' where user_id='00000000-0000-4000-8000-0000000a01a0';
update inventa.profiles set enabled=true,permission_reason='homologación ficticia'
 where user_id in ('00000000-0000-4000-8000-0000000a01a1','00000000-0000-4000-8000-0000000a01a2','00000000-0000-4000-8000-0000000a01a3');
create table lab.hom(k text primary key,v text);
grant select,insert on lab.hom to authenticated;

-- H02 · Supervisión asigna ZZH01-P01 → ZZH01-P06 a la pareja Uno + Dos.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01a0',false);
set role authenticated;
do $$ declare p jsonb; r jsonb; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZH01-P06',1::smallint);
 perform lab.ok((p->>'total')::int=6 and p->>'first'='ZZH01-P01' and p->>'last'='ZZH01-P06','H02 vista previa: 6 ubicaciones de ZZH01-P01 a ZZH01-P06');
 r=inventa.assign_segment(gen_random_uuid(),'00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZH01-P06',1::smallint,
   '00000000-0000-4000-8000-0000000a01a1','00000000-0000-4000-8000-0000000a01a2',p->>'fingerprint');
 perform lab.ok((r->>'total')::int=6,'H02 tramo asignado: 6 ubicaciones');
 insert into lab.hom values('t1',r->>'segment_id');
end $$;
-- H03 · Un tramo que se solapa avisa y no deja asignar.
do $$ declare p jsonb; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-0000000a0100','ZZH01-P05','ZZH02-P02',1::smallint);
 perform lab.ok((p->'conflicts'->>'count')::int=2 and p->'conflicts'->'items'->0->>'location_code'='ZZH01-P05'
   and p->'conflicts'->'items'->0->>'people'='Prueba Uno + Prueba Dos','H03 solape: 2 ubicaciones, primera ZZH01-P05 (Prueba Uno + Prueba Dos)');
end $$;
-- H04 · Supervisión no puede activar campañas; lo hace Administración.
update inventa.campaigns set status='active',starts_at=now() where id='00000000-0000-4000-8000-0000000a0100';
select lab.ok((select status from inventa.campaigns where id='00000000-0000-4000-8000-0000000a0100')='draft','H04 Supervisión no activa campañas (sigue en borrador)');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01ad',false);
set role authenticated;
update inventa.campaigns set status='active',starts_at=now() where id='00000000-0000-4000-8000-0000000a0100';
select lab.ok((select status from inventa.campaigns where id='00000000-0000-4000-8000-0000000a0100')='active','H04 Administración activa la campaña ficticia');
reset role;

-- H05/H06 · Prueba Uno: «Mi tramo» en pareja, sin teórico; cuenta ZZH01-P01 y ZZH01-P02.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01a1',false);
set role authenticated;
do $$ declare t jsonb; begin
 t=inventa.my_segments();
 perform lab.ok(jsonb_array_length(t)=1 and t->0->>'partner_name'='Prueba Dos' and t->0->>'from'='ZZH01-P01','H05 Mi tramo ZZH01-P01 → ZZH01-P06 con pareja Prueba Dos');
 perform lab.ok((select count(*) from jsonb_array_elements(t->0->'locations') l where (l->>'counted')::boolean)=0,'H05 avance 0 de 6');
end $$;
select lab.ok((select count(*) from inventa.stock_snapshot where campaign_id='00000000-0000-4000-8000-0000000a0100')=0,'H05 el Operario no ve el teórico ficticio (7)');
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
 values('00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZHOM-001',5,'00000000-0000-4000-8000-0000000a01a1',gen_random_uuid());
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
 values('00000000-0000-4000-8000-0000000a0100','ZZH01-P02','ZZHOM-002',2,'00000000-0000-4000-8000-0000000a01a1',gen_random_uuid());
select lab.ok((select count(*) from jsonb_array_elements(inventa.my_segments()->0->'locations') l where (l->>'counted')::boolean)=2,'H06/H08 avance 2 de 6 tras sincronizar');
reset role;

-- H09 · Relevo: Prueba Dos en el mismo móvil cuenta ZZH01-P03.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01a2',false);
set role authenticated;
select lab.ok((inventa.my_segments()->0->>'partner_name')='Prueba Uno','H09 tras el relevo, Mi tramo muestra la pareja Prueba Uno');
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
 values('00000000-0000-4000-8000-0000000a0100','ZZH01-P03','ZZHOM-001',0,'00000000-0000-4000-8000-0000000a01a2',gen_random_uuid());
select lab.ok((select count(*) from jsonb_array_elements(inventa.my_segments()->0->'locations') l where (l->>'counted')::boolean)=3,'H09 avance 3 de 6 (cero es un recuento válido)');
reset role;
select lab.ok((select count(*) from inventa.counts where campaign_id='00000000-0000-4000-8000-0000000a0100'
  and ((actor_id='00000000-0000-4000-8000-0000000a01a1' and partner_id='00000000-0000-4000-8000-0000000a01a2')
    or (actor_id='00000000-0000-4000-8000-0000000a01a2' and partner_id='00000000-0000-4000-8000-0000000a01a1')))=3,'H09 autoría: cada apunte con su autor y la otra persona como pareja');

-- H10 · Supervisión ve el avance 3 de 6.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01a0',false);
set role authenticated;
select lab.ok((select counted||'/'||total from inventa.list_segments('00000000-0000-4000-8000-0000000a0100') where id=(select v::uuid from lab.hom where k='t1'))='3/6','H10 Gestión → Tramos: 3 de 6 (50 %)');
-- H11 · Segundo recuento con alguien del primero: rechazado.
do $$ declare p jsonb; begin
 p=inventa.preview_segment('00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZH01-P06',2::smallint);
 perform lab.ok((p->>'total')::int=3 and (p->'without_first_count'->>'count')::int=3,'H11/H12 vista previa ciclo 2: 3 ubicaciones; 3 sin primer recuento quedan fuera');
 insert into lab.hom values('fp2',p->>'fingerprint');
end $$;
select lab.fails($q$select inventa.assign_segment(gen_random_uuid(),'00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZH01-P06',2::smallint,'00000000-0000-4000-8000-0000000a01a1',null,(select v from lab.hom where k='fp2'))$q$,'Prueba Uno participó en el primer recuento de ZZH01-P01','H11 Prueba Uno no puede hacer el segundo recuento');
-- H12 · Segundo recuento a Prueba Tres; H14 · doble pulsación con el mismo identificador.
do $$ declare r1 jsonb; r2 jsonb; m uuid:=gen_random_uuid(); begin
 r1=inventa.assign_segment(m,'00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZH01-P06',2::smallint,'00000000-0000-4000-8000-0000000a01a3',null,(select v from lab.hom where k='fp2'));
 r2=inventa.assign_segment(m,'00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZH01-P06',2::smallint,'00000000-0000-4000-8000-0000000a01a3',null,(select v from lab.hom where k='fp2'));
 perform lab.ok((r1->>'total')::int=3 and r1->>'segment_id'=r2->>'segment_id','H12/H14 segundo recuento a Prueba Tres; la doble pulsación no duplica');
 perform lab.ok((select count(*) from inventa.segments where campaign_id='00000000-0000-4000-8000-0000000a0100' and cycle=2)=1,'H14 un solo tramo de segundo recuento');
end $$;
reset role;

-- H13 · Prueba Tres: ciego.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01a3',false);
set role authenticated;
select lab.ok((select count(*) from inventa.counts)=0,'H13 Prueba Tres no ve los recuentos del primero');
do $$ declare t jsonb; begin
 t=inventa.my_segments();
 perform lab.ok((t->0->>'cycle')::int=2 and t->0->'partner_id'='null'::jsonb and jsonb_array_length(t->0->'locations')=3,'H13 Mi tramo: segundo recuento, individual, 3 ubicaciones');
end $$;
insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
 values('00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZHOM-001',5,'00000000-0000-4000-8000-0000000a01a3',gen_random_uuid());
select lab.ok((select cycle from inventa.counts where actor_id='00000000-0000-4000-8000-0000000a01a3')=2,'H13 su recuento queda como segundo recuento');
reset role;

-- H15 · Reasignar el primer tramo: sale Prueba Dos.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01a0',false);
set role authenticated;
select lab.ok((inventa.reassign_segment(gen_random_uuid(),(select v::uuid from lab.hom where k='t1'),'00000000-0000-4000-8000-0000000a01a1',null,'homologación: sale Prueba Dos',0)->>'version')::int=1,'H15 reasignación con motivo');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01a2',false);
set role authenticated;
select lab.ok(jsonb_array_length(inventa.my_segments())=0,'H15 Prueba Dos ya no ve el tramo');
select lab.fails($q$insert into inventa.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id) values('00000000-0000-4000-8000-0000000a0100','ZZH01-P04','ZZHOM-001',1,'00000000-0000-4000-8000-0000000a01a2',gen_random_uuid())$q$,'row-level security','H15 Prueba Dos ya no puede contar en él');
reset role;

-- H16 · Administración cierra la campaña ficticia: nada se borra.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000a01ad',false);
set role authenticated;
update inventa.campaigns set status='closed',closed_at=now() where id='00000000-0000-4000-8000-0000000a0100';
reset role;
select lab.ok((select status from inventa.campaigns where id='00000000-0000-4000-8000-0000000a0100')='closed'
  and (select count(*) from inventa.counts where campaign_id='00000000-0000-4000-8000-0000000a0100')=4,'H16 campaña cerrada; los 4 recuentos se conservan');
\echo 'ENSAYO DE HOMOLOGACIÓN: TODOS LOS PASOS SUPERADOS'
