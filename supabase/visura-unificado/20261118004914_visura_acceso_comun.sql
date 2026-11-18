-- VISURA: identidad compartida y acceso por aplicación. No modifica tablas existentes.
create schema if not exists visura;
revoke all on schema visura from public, anon;
grant usage on schema visura to authenticated;

create table visura.acceso_apps (
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('visura','inventa','almacen','tanques','control_horario')),
  rol text not null check (length(trim(rol)) between 1 and 40),
  activo boolean not null default false,
  motivo text not null default '',
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now(),
  primary key (user_id, app)
);
comment on table visura.acceso_apps is 'Acceso de cada persona a cada aplicación VISURA. app=visura rol=admin administra los accesos.';

create or replace function visura.tiene_acceso(p_app text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from visura.acceso_apps a join auth.users u on u.id=a.user_id
    where a.user_id=(select auth.uid()) and a.app=p_app and a.activo
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false));
$$;
create or replace function visura.rol_en(p_app text) returns text
language sql stable security definer set search_path='' as $$
  select case when visura.tiene_acceso(p_app) then
    (select a.rol from visura.acceso_apps a where a.user_id=(select auth.uid()) and a.app=p_app) end;
$$;
create or replace function visura.es_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select visura.rol_en('visura')='admin';
$$;
revoke all on function visura.tiene_acceso(text), visura.rol_en(text), visura.es_admin() from public, anon;
grant execute on function visura.tiene_acceso(text), visura.rol_en(text), visura.es_admin() to authenticated;

-- Aplicaciones visibles para el usuario en el portal.
create or replace function visura.mis_aplicaciones()
returns table(app text, rol text)
language sql stable security definer set search_path='' as $$
  select a.app, a.rol from visura.acceso_apps a join auth.users u on u.id=a.user_id
  where a.user_id=(select auth.uid()) and a.activo and u.email_confirmed_at is not null
  order by a.app;
$$;
revoke all on function visura.mis_aplicaciones() from public, anon;
grant execute on function visura.mis_aplicaciones() to authenticated;

create or replace function visura.guard_acceso() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if length(trim(new.motivo)) < 5 then raise exception 'Explica el motivo del cambio de acceso'; end if;
  if tg_op='UPDATE' and old.app='visura' and old.rol='admin' and old.activo
     and (new.rol<>'admin' or not new.activo)
     and not exists(select 1 from visura.acceso_apps x where x.app='visura' and x.rol='admin' and x.activo and x.user_id<>old.user_id) then
    raise exception 'No se puede quitar al último administrador de VISURA';
  end if;
  new.actualizado_por := (select auth.uid());
  new.actualizado_en := now();
  return new;
end; $$;
revoke all on function visura.guard_acceso() from public, anon, authenticated;
create trigger guard_acceso before insert or update on visura.acceso_apps
  for each row execute function visura.guard_acceso();

create table visura.auditoria_accesos (
  id bigint generated always as identity primary key,
  user_id uuid not null, app text not null,
  antes jsonb, despues jsonb,
  actor_id uuid, creado_en timestamptz not null default now()
);
create or replace function visura.auditar_acceso() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into visura.auditoria_accesos(user_id,app,antes,despues,actor_id)
  values(coalesce(new.user_id,old.user_id),coalesce(new.app,old.app),
    case when tg_op<>'INSERT' then to_jsonb(old) end,
    case when tg_op<>'DELETE' then to_jsonb(new) end,(select auth.uid()));
  return coalesce(new,old);
end; $$;
revoke all on function visura.auditar_acceso() from public, anon, authenticated;
create trigger auditar_acceso after insert or update or delete on visura.acceso_apps
  for each row execute function visura.auditar_acceso();

alter table visura.acceso_apps enable row level security;
alter table visura.auditoria_accesos enable row level security;
grant select, insert, update on visura.acceso_apps to authenticated;
grant select on visura.auditoria_accesos to authenticated;
create policy acceso_leer on visura.acceso_apps for select to authenticated
  using (user_id=(select auth.uid()) or (select visura.es_admin()));
create policy acceso_admin_insertar on visura.acceso_apps for insert to authenticated
  with check ((select visura.es_admin()));
create policy acceso_admin_modificar on visura.acceso_apps for update to authenticated
  using ((select visura.es_admin())) with check ((select visura.es_admin()));
create policy auditoria_admin_leer on visura.auditoria_accesos for select to authenticated
  using ((select visura.es_admin()));

-- Administrador inicial: la cuenta propietaria existente.
insert into visura.acceso_apps(user_id,app,rol,activo,motivo)
select u.id, x.app, x.rol, true, 'Alta inicial del propietario al unificar VISURA'
from auth.users u
cross join (values ('visura','admin'),('inventa','admin'),('almacen','admin'),('tanques','operaciones')) as x(app,rol)
where u.email='<correo-propietario>';
