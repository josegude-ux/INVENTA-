-- INVENTA 0.32.1 · Línea 100 · Datos FICTICIOS para homologar «Mi tramo» en móvil.
-- Solo crea elementos con prefijo ZZH / ZZHOM y una campaña en borrador. No toca nada más.
-- Se puede ejecutar dos veces sin duplicar. No borra nada.
-- NO EJECUTAR en Supabase sin decisión de 000 y «AUTORIZO» (R6 §8-§9). Pensado para el entorno LAB (D3).
-- Requiere aplicada supabase/visura-unificado-pendiente/20261118140000_inventa_tramos.sql.
begin;
do $$ begin
 if exists(select 1 from inventa.locations where code like 'ZZH%' and description not like 'FICTICIA%') then
  raise exception 'Hay ubicaciones ZZH que no son de homologación: se detiene sin cambios.'; end if;
 -- Solo puede haber UNA campaña activa (one_active_inventa_campaign). Si hay otra activa, este no es
 -- un entorno de homologación: se detiene para no mezclar datos ficticios con un inventario real.
 if exists(select 1 from inventa.campaigns where status='active' and id<>'00000000-0000-4000-8000-0000000a0100') then
  raise exception 'Hay otra campaña activa (%): la homologación se hace en el entorno LAB, no aquí.',
   (select name from inventa.campaigns where status='active' limit 1); end if;
 if exists(select 1 from inventa.campaigns where id='00000000-0000-4000-8000-0000000a0100' and status='closed') then
  raise exception 'La campaña de homologación ya está cerrada: crear una nueva versión del guion.'; end if;
end $$;

insert into inventa.locations(code,aisle,zone,description)
select format('ZZH%s-P%s',lpad(a::text,2,'0'),lpad(p::text,2,'0')),'ZZH','HOMOLOGACION','FICTICIA · homologación línea 100'
from (values (1,6),(2,4)) v(a,n), generate_series(1,6) p where p<=v.n
on conflict (code) do nothing;

insert into inventa.products(code,description,unit) values
 ('ZZHOM-001','ARTÍCULO FICTICIO HOMOLOGACIÓN A','UD'),
 ('ZZHOM-002','ARTÍCULO FICTICIO HOMOLOGACIÓN B','UD')
on conflict (code) do nothing;

insert into inventa.campaigns(id,name,kind,status)
values('00000000-0000-4000-8000-0000000a0100','HOMOLOGACIÓN 100 · DATOS FICTICIOS','micro','draft')
on conflict (id) do nothing;

-- Teórico ficticio: sirve para comprobar que ningún Operario lo ve.
insert into inventa.stock_snapshot(campaign_id,location_code,product_code,quantity,source)
values('00000000-0000-4000-8000-0000000a0100','ZZH01-P01','ZZHOM-001',7,'HOMOLOGACION-FICTICIA')
on conflict do nothing;
commit;
