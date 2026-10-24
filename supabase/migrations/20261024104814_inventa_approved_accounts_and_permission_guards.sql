
-- INVENTA only: approved accounts, server-side permission changes and audit identity.
alter table public.profiles alter column enabled set default false;
alter table public.profiles add column version bigint not null default 0;
alter table public.profiles add column permission_reason text not null default '';

create or replace function internal.is_enabled() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.user_id
 where p.user_id=(select auth.uid()) and p.enabled and u.email_confirmed_at is not null
 and not coalesce(u.is_anonymous,false));
$$;
create or replace function internal.is_manager() returns boolean
language sql stable security definer set search_path='' as $$
 select internal.is_enabled() and exists(select 1 from public.profiles p
 where p.user_id=(select auth.uid()) and p.role in ('supervisor','admin'));
$$;
create or replace function internal.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select internal.is_enabled() and exists(select 1 from public.profiles p
 where p.user_id=(select auth.uid()) and p.role='admin');
$$;
create or replace function internal.on_user_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,display_name,role,enabled)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'Usuario'),100),'operator',false);
 return new;
end; $$;

create or replace function internal.guard_profile_permissions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.user_id<>old.user_id or new.created_at<>old.created_at then
  raise exception 'La identidad del perfil es inmutable'; end if;
 if new.role is distinct from old.role or new.enabled is distinct from old.enabled then
  perform pg_advisory_xact_lock(724281903);
  if length(trim(new.permission_reason))<5 then raise exception 'Explica el motivo del cambio de permisos'; end if;
  if new.enabled and not exists(select 1 from auth.users u where u.id=new.user_id
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then
   raise exception 'El usuario debe confirmar primero su correo'; end if;
  if old.role='admin' and old.enabled and (new.role<>'admin' or not new.enabled)
   and not exists(select 1 from public.profiles p where p.user_id<>old.user_id and p.role='admin' and p.enabled) then
   raise exception 'No se puede desactivar ni degradar al último Administrador'; end if;
 end if;
 new.version=old.version+1;
 return new;
end; $$;
revoke all on function internal.guard_profile_permissions() from public,anon,authenticated;
create trigger guard_profile_permissions before update on public.profiles
 for each row execute function internal.guard_profile_permissions();

create or replace function internal.record_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
 payload=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 insert into public.audit_events(actor_id,relation_name,record_id,operation,before_row,after_row)
 values((select auth.uid()),TG_TABLE_NAME,coalesce(payload->>'id',payload->>'user_id',payload->>'code',''),
 TG_OP,case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
 case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) else null end);
 return case when TG_OP='DELETE' then OLD else NEW end;
end; $$;
-- A correction chain must have a single successor even if two devices submit together.
create unique index counts_single_correction on public.counts(previous_id) where previous_id is not null;
