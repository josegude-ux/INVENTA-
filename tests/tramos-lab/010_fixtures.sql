-- INVENTA TRAMOS LAB ONLY · datos ficticios. Ninguna persona ni ubicación real.
do $$ begin
 if current_database()<>'inventa_tramos_test' then raise exception 'INVENTA TRAMOS LAB ONLY'; end if;
end $$;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-4000-8000-0000000000a1','admin@lab.invalid',now(),'{"display_name":"Admin Lab"}'),
 ('00000000-0000-4000-8000-0000000000b1','super@lab.invalid',now(),'{"display_name":"Supervisora Lab"}'),
 ('00000000-0000-4000-8000-0000000000c1','op1@lab.invalid',now(),'{"display_name":"Operario Uno"}'),
 ('00000000-0000-4000-8000-0000000000c2','op2@lab.invalid',now(),'{"display_name":"Operario Dos"}'),
 ('00000000-0000-4000-8000-0000000000c3','op3@lab.invalid',now(),'{"display_name":"Operario Tres"}'),
 ('00000000-0000-4000-8000-0000000000d1','baja@lab.invalid',now(),'{"display_name":"Cuenta Deshabilitada"}');
-- El trigger de alta crea perfiles Operario deshabilitados; se habilitan con motivo.
update public.profiles set role='admin',enabled=true,permission_reason='alta de laboratorio' where user_id='00000000-0000-4000-8000-0000000000a1';
update public.profiles set role='supervisor',enabled=true,permission_reason='alta de laboratorio' where user_id='00000000-0000-4000-8000-0000000000b1';
update public.profiles set enabled=true,permission_reason='alta de laboratorio'
 where user_id in ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000c3');

-- K00..K10 × P01..P08, con formato K##-P##.
insert into public.locations(code,aisle)
select format('K%s-P%s',lpad(k::text,2,'0'),lpad(p::text,2,'0')),format('K%s',lpad(k::text,2,'0'))
from generate_series(0,10) k,generate_series(1,8) p;
-- Formatos distintos dentro del rango y una ubicación deshabilitada.
insert into public.locations(code,aisle) values ('K05','K05'),('K03-P03-A','K03');
update public.locations set enabled=false where code='K04-P04';
-- Un código sin ceros, del mismo formato, para comprobar el orden natural.
insert into public.locations(code,aisle) values ('Z2-P1','Z2'),('Z10-P1','Z10');

insert into public.products(code,description) values ('ART-LAB-1','Artículo ficticio');

insert into public.campaigns(id,name,kind,status,created_by) values
 ('00000000-0000-4000-8000-00000000ca01','Campaña laboratorio','annual','draft','00000000-0000-4000-8000-0000000000a1'),
 ('00000000-0000-4000-8000-00000000ca02','Campaña cerrada','micro','draft','00000000-0000-4000-8000-0000000000a1');
update public.campaigns set status='active' where id='00000000-0000-4000-8000-00000000ca02';
update public.campaigns set status='closed' where id='00000000-0000-4000-8000-00000000ca02';
