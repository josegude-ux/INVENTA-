-- Compatibilidad: INVENTA leía public.moventa_app_access; ahora el acceso vive en visura.acceso_apps.
create view inventa.moventa_app_access with (security_invoker = true) as
select a.user_id,
       case a.app when 'almacen' then 'kontrola' else a.app end as app_id,
       case when a.rol in ('admin','operator','viewer') then a.rol else 'operator' end as app_role,
       a.activo as enabled,
       a.actualizado_en as updated_at
from visura.acceso_apps a
where a.app in ('inventa','almacen');
grant select on inventa.moventa_app_access to authenticated;
