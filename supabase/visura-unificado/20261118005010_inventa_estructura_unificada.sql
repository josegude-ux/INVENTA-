-- INVENTA trasladado a VISURA: esquema inventa (datos) e inventa_internal (funciones auxiliares).
-- Estado final equivalente a las 9 migraciones del proyecto INVENTA + tablas F2-K.
create schema if not exists inventa;
create schema if not exists inventa_internal;
revoke all on schema inventa from public, anon;
revoke all on schema inventa_internal from public, anon, authenticated;
grant usage on schema inventa to authenticated;
grant usage on schema inventa_internal to authenticated;

create table inventa.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'operator' check (role in ('operator','supervisor','admin')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  version bigint not null default 0,
  permission_reason text not null default ''
);

create or replace function inventa_internal.is_enabled() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from inventa.profiles p join auth.users u on u.id=p.user_id
 where p.user_id=(select auth.uid()) and p.enabled and u.email_confirmed_at is not null
 and not coalesce(u.is_anonymous,false));
$$;
create or replace function inventa_internal.is_manager() returns boolean
language sql stable security definer set search_path='' as $$
 select inventa_internal.is_enabled() and exists(select 1 from inventa.profiles p
 where p.user_id=(select auth.uid()) and p.role in ('supervisor','admin'));
$$;
create or replace function inventa_internal.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select inventa_internal.is_enabled() and exists(select 1 from inventa.profiles p
 where p.user_id=(select auth.uid()) and p.role='admin');
$$;
grant execute on function inventa_internal.is_manager(), inventa_internal.is_admin(), inventa_internal.is_enabled() to authenticated;

create or replace function inventa_internal.on_user_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into inventa.profiles(user_id,display_name,role,enabled)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'Usuario'),100),'operator',false)
 on conflict (user_id) do nothing;
 return new;
end; $$;
revoke execute on function inventa_internal.on_user_created() from public, anon, authenticated;
create trigger inventa_profile_on_signup after insert on auth.users
for each row execute function inventa_internal.on_user_created();

create or replace function inventa_internal.guard_profile_permissions() returns trigger
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
   and not exists(select 1 from inventa.profiles p where p.user_id<>old.user_id and p.role='admin' and p.enabled) then
   raise exception 'No se puede desactivar ni degradar al último Administrador'; end if;
 end if;
 new.version=old.version+1;
 return new;
end; $$;
revoke all on function inventa_internal.guard_profile_permissions() from public,anon,authenticated;
create trigger guard_profile_permissions before update on inventa.profiles
 for each row execute function inventa_internal.guard_profile_permissions();

create table inventa.campaigns (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 kind text not null check (kind in ('micro','annual')),
 status text not null default 'draft' check(status in ('draft','active','closed')),
 starts_at timestamptz,
 closed_at timestamptz,
 created_by uuid references inventa.profiles(user_id),
 created_at timestamptz not null default now()
);
create unique index one_active_inventa_campaign on inventa.campaigns ((true)) where status='active';
create table inventa.locations (
 code text primary key,
 aisle text not null,
 zone text not null default '',
 description text not null default '',
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table inventa.products (
 code text primary key,
 description text not null,
 unit text not null default 'UD',
 barcode text,
 created_at timestamptz not null default now()
);
create table inventa.barcodes (
 code text primary key,
 product_code text not null references inventa.products(code),
 created_by uuid references inventa.profiles(user_id),
 created_at timestamptz not null default now()
);
create table inventa.fixed_positions (
 product_code text not null references inventa.products(code),
 location_code text not null references inventa.locations(code),
 priority int not null default 1 check(priority>=1),
 created_at timestamptz not null default now(),
 origin text not null default 'manual' constraint fixed_positions_origin_check check (origin in ('manual','bc')),
 primary key(product_code,location_code)
);
create index fixed_position_priority on inventa.fixed_positions(product_code,priority);
create table inventa.stock_snapshot (
 campaign_id uuid not null references inventa.campaigns(id),
 location_code text not null references inventa.locations(code),
 product_code text not null references inventa.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null default 0 check(quantity>=0),
 source text not null default 'BC',
 imported_at timestamptz not null default now(),
 primary key(campaign_id,location_code,product_code,lot)
);
create table inventa.assignments (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references inventa.campaigns(id),
 location_code text not null references inventa.locations(code),
 operator_id uuid not null references inventa.profiles(user_id),
 assigned_by uuid references inventa.profiles(user_id),
 status text not null default 'pending' check(status in ('pending','in_progress','completed','review')),
 created_at timestamptz not null default now(),
 unique(campaign_id,location_code,operator_id)
);
create index assignment_operator on inventa.assignments(operator_id,campaign_id);
create table inventa.counts (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references inventa.campaigns(id),
 location_code text not null references inventa.locations(code),
 product_code text not null references inventa.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null check(quantity>=0),
 actor_id uuid not null references inventa.profiles(user_id),
 partner_id uuid references inventa.profiles(user_id),
 previous_id uuid references inventa.counts(id),
 correction_reason text,
 client_mutation_id uuid not null unique,
 entries jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 constraint correction_requires_reason check(previous_id is null or length(trim(coalesce(correction_reason,''))) >= 5),
 constraint different_partner check (partner_id is null or partner_id<>actor_id)
);
create index count_campaign_location on inventa.counts(campaign_id,location_code,product_code);
create unique index counts_single_correction on inventa.counts(previous_id) where previous_id is not null;
create table inventa.incidents (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid references inventa.campaigns(id),
 location_code text references inventa.locations(code),
 product_code text references inventa.products(code),
 category text not null default 'other' check(category in ('difference','missing','movement','barcode','location','other')),
 description text not null,
 status text not null default 'open' check(status in ('open','review','resolved')),
 reported_by uuid not null references inventa.profiles(user_id),
 assigned_to uuid references inventa.profiles(user_id),
 resolved_by uuid references inventa.profiles(user_id),
 resolution text,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index incidents_status_campaign on inventa.incidents(campaign_id,status);
create table inventa.movements (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references inventa.campaigns(id),
 source_location text not null references inventa.locations(code),
 destination_location text not null references inventa.locations(code),
 product_code text not null references inventa.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null check(quantity>0),
 reason text not null check(length(trim(reason))>=3),
 actor_id uuid not null references inventa.profiles(user_id),
 partner_id uuid references inventa.profiles(user_id),
 client_mutation_id uuid not null unique,
 created_at timestamptz not null default now(),
 constraint different_locations check(source_location<>destination_location)
);
create table inventa.audit_events (
 id bigint generated by default as identity primary key,
 actor_id uuid,
 relation_name text not null,
 record_id text not null,
 operation text not null,
 before_row jsonb,
 after_row jsonb,
 created_at timestamptz not null default now()
);
create index audit_recent on inventa.audit_events(created_at desc);

create or replace function inventa_internal.record_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
 payload=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 insert into inventa.audit_events(actor_id,relation_name,record_id,operation,before_row,after_row)
 values((select auth.uid()),TG_TABLE_NAME,coalesce(payload->>'id',payload->>'user_id',payload->>'code',''),
 TG_OP,case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
 case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) else null end);
 return case when TG_OP='DELETE' then OLD else NEW end;
end; $$;
revoke execute on function inventa_internal.record_audit() from public,anon,authenticated;
create trigger audit_campaigns after insert or update on inventa.campaigns for each row execute function inventa_internal.record_audit();
create trigger audit_assignments after insert or update on inventa.assignments for each row execute function inventa_internal.record_audit();
create trigger audit_counts after insert on inventa.counts for each row execute function inventa_internal.record_audit();
create trigger audit_incidents after insert or update on inventa.incidents for each row execute function inventa_internal.record_audit();
create trigger audit_moves after insert on inventa.movements for each row execute function inventa_internal.record_audit();
create trigger audit_profiles after update on inventa.profiles for each row execute function inventa_internal.record_audit();
create trigger audit_snapshot after insert or update on inventa.stock_snapshot for each row execute function inventa_internal.record_audit();
create trigger audit_products after insert or update on inventa.products for each row execute function inventa_internal.record_audit();
create trigger audit_locations after insert or update on inventa.locations for each row execute function inventa_internal.record_audit();

create or replace function inventa_internal.guard_correction() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prior inventa.counts;
begin
 if jsonb_typeof(new.entries)<>'array' then raise exception 'Count entries must be a JSON array'; end if;
 if new.previous_id is not null then
   select * into prior from inventa.counts where id=new.previous_id;
   if not found then raise exception 'Original count not found'; end if;
   if prior.campaign_id<>new.campaign_id or prior.location_code<>new.location_code
      or prior.product_code<>new.product_code or prior.lot<>new.lot
   then raise exception 'Correction must refer to the same campaign, location, product and lot'; end if;
 end if;
 return new;
end; $$;
revoke execute on function inventa_internal.guard_correction() from public, anon, authenticated;
create trigger counts_correction_guard before insert on inventa.counts for each row execute function inventa_internal.guard_correction();
create or replace function inventa_internal.guard_campaign_status() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.status='closed' and new.status<>old.status then raise exception 'Closed campaigns cannot be reopened'; end if;
 if old.status='active' and new.status='draft' then raise exception 'Active campaigns cannot return to draft'; end if;
 return new;
end; $$;
revoke execute on function inventa_internal.guard_campaign_status() from public, anon, authenticated;
create trigger guard_campaign_transition before update of status on inventa.campaigns for each row execute function inventa_internal.guard_campaign_status();

alter table inventa.profiles enable row level security;
alter table inventa.campaigns enable row level security;
alter table inventa.locations enable row level security;
alter table inventa.products enable row level security;
alter table inventa.barcodes enable row level security;
alter table inventa.fixed_positions enable row level security;
alter table inventa.stock_snapshot enable row level security;
alter table inventa.assignments enable row level security;
alter table inventa.counts enable row level security;
alter table inventa.incidents enable row level security;
alter table inventa.movements enable row level security;
alter table inventa.audit_events enable row level security;

grant select on inventa.profiles,inventa.campaigns,inventa.locations,inventa.products,inventa.barcodes,inventa.fixed_positions,inventa.stock_snapshot,inventa.assignments,inventa.counts,inventa.incidents,inventa.movements,inventa.audit_events to authenticated;
grant insert on inventa.campaigns,inventa.locations,inventa.products,inventa.barcodes,inventa.fixed_positions,inventa.stock_snapshot,inventa.assignments,inventa.counts,inventa.incidents,inventa.movements to authenticated;
grant update on inventa.profiles,inventa.campaigns,inventa.locations,inventa.products,inventa.barcodes,inventa.fixed_positions,inventa.stock_snapshot,inventa.assignments,inventa.incidents to authenticated;
grant delete on inventa.fixed_positions to authenticated;

create policy profiles_read on inventa.profiles for select to authenticated using ((select auth.uid())=user_id or (select inventa_internal.is_manager()));
create policy profiles_admin_update on inventa.profiles for update to authenticated using ((select inventa_internal.is_admin())) with check ((select inventa_internal.is_admin()));
create policy campaigns_read on inventa.campaigns for select to authenticated using ((status='active' and (select inventa_internal.is_enabled())) or (select inventa_internal.is_manager()));
create policy campaigns_admin_insert on inventa.campaigns for insert to authenticated with check ((select inventa_internal.is_admin()) and created_by=(select auth.uid()));
create policy campaigns_admin_update on inventa.campaigns for update to authenticated using ((select inventa_internal.is_admin())) with check ((select inventa_internal.is_admin()));
create policy locations_read on inventa.locations for select to authenticated using ((select inventa_internal.is_enabled()));
create policy locations_manager_insert on inventa.locations for insert to authenticated with check ((select inventa_internal.is_manager()));
create policy locations_manager_update on inventa.locations for update to authenticated using ((select inventa_internal.is_manager())) with check ((select inventa_internal.is_manager()));
create policy products_read on inventa.products for select to authenticated using ((select inventa_internal.is_enabled()));
create policy products_manager_insert on inventa.products for insert to authenticated with check ((select inventa_internal.is_manager()));
create policy products_manager_update on inventa.products for update to authenticated using ((select inventa_internal.is_manager())) with check ((select inventa_internal.is_manager()));
create policy barcodes_read on inventa.barcodes for select to authenticated using ((select inventa_internal.is_enabled()));
create policy barcodes_insert on inventa.barcodes for insert to authenticated with check ((select inventa_internal.is_enabled()) and created_by=(select auth.uid()));
create policy barcodes_manager_update on inventa.barcodes for update to authenticated using ((select inventa_internal.is_manager())) with check ((select inventa_internal.is_manager()));
create policy fixed_read on inventa.fixed_positions for select to authenticated using ((select inventa_internal.is_enabled()));
create policy fixed_admin_insert on inventa.fixed_positions for insert to authenticated with check ((select inventa_internal.is_admin()));
create policy fixed_admin_update on inventa.fixed_positions for update to authenticated using ((select inventa_internal.is_admin())) with check ((select inventa_internal.is_admin()));
create policy fixed_admin_delete on inventa.fixed_positions for delete to authenticated using ((select inventa_internal.is_admin()));
create policy stock_manager_read on inventa.stock_snapshot for select to authenticated using ((select inventa_internal.is_manager()));
create policy stock_admin_insert on inventa.stock_snapshot for insert to authenticated with check ((select inventa_internal.is_admin()));
create policy stock_admin_update on inventa.stock_snapshot for update to authenticated using ((select inventa_internal.is_admin())) with check ((select inventa_internal.is_admin()));
create policy assignments_read on inventa.assignments for select to authenticated using ((operator_id=(select auth.uid()) and (select inventa_internal.is_enabled())) or (select inventa_internal.is_manager()));
create policy assignments_manager_insert on inventa.assignments for insert to authenticated with check ((select inventa_internal.is_manager()) and assigned_by=(select auth.uid()));
create policy assignments_manager_update on inventa.assignments for update to authenticated using ((select inventa_internal.is_manager())) with check ((select inventa_internal.is_manager()));
create policy counts_read on inventa.counts for select to authenticated using ((actor_id=(select auth.uid()) and (select inventa_internal.is_enabled())) or (select inventa_internal.is_manager()));
create policy counts_insert on inventa.counts for insert to authenticated with check (
 actor_id=(select auth.uid()) and (select inventa_internal.is_enabled())
 and exists(select 1 from inventa.campaigns c where c.id=campaign_id and c.status='active')
 and ( (select inventa_internal.is_manager()) or exists(select 1 from inventa.assignments a where a.campaign_id=counts.campaign_id and a.location_code=counts.location_code and a.operator_id=(select auth.uid())) ));
create policy incidents_read on inventa.incidents for select to authenticated using ((reported_by=(select auth.uid()) and (select inventa_internal.is_enabled())) or (select inventa_internal.is_manager()));
create policy incidents_insert on inventa.incidents for insert to authenticated with check (reported_by=(select auth.uid()) and (select inventa_internal.is_enabled()));
create policy incidents_manager_update on inventa.incidents for update to authenticated using ((select inventa_internal.is_manager())) with check ((select inventa_internal.is_manager()));
create policy movements_read on inventa.movements for select to authenticated using ((actor_id=(select auth.uid()) and (select inventa_internal.is_enabled())) or (select inventa_internal.is_manager()));
create policy movements_insert on inventa.movements for insert to authenticated with check (
 actor_id=(select auth.uid()) and (select inventa_internal.is_enabled()) and exists(select 1 from inventa.campaigns c where c.id=campaign_id and c.status='active'));
create policy audit_manager_read on inventa.audit_events for select to authenticated using ((select inventa_internal.is_manager()));

-- Directorio de cuentas (solo administración)
create or replace function inventa_internal.admin_user_directory()
returns table(user_id uuid,display_name text,role text,enabled boolean,created_at timestamptz,version bigint,permission_reason text,email text,email_confirmed boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not inventa_internal.is_admin() then raise exception 'Solo Administración puede consultar las cuentas' using errcode='42501'; end if;
 return query select p.user_id,p.display_name,p.role,p.enabled,p.created_at,p.version,p.permission_reason,u.email::text,(u.email_confirmed_at is not null)
 from inventa.profiles p join auth.users u on u.id=p.user_id order by p.created_at,p.user_id;
end; $$;
revoke all on function inventa_internal.admin_user_directory() from public,anon;
grant execute on function inventa_internal.admin_user_directory() to authenticated;
create or replace function inventa.admin_user_directory()
returns table(user_id uuid,display_name text,role text,enabled boolean,created_at timestamptz,version bigint,permission_reason text,email text,email_confirmed boolean)
language sql stable security invoker set search_path='' as $$ select * from inventa_internal.admin_user_directory(); $$;
revoke all on function inventa.admin_user_directory() from public,anon;
grant execute on function inventa.admin_user_directory() to authenticated;
