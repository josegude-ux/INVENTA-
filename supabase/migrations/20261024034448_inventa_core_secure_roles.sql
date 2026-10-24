-- Exact SQL from applied Supabase migration

create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'operator' check (role in ('operator','supervisor','admin')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create or replace function internal.is_manager() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled and p.role in ('supervisor','admin'));
$$;
create or replace function internal.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled and p.role='admin');
$$;
create or replace function internal.is_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled);
$$;
grant usage on schema internal to authenticated;
grant execute on function internal.is_manager() to authenticated;
grant execute on function internal.is_admin() to authenticated;
grant execute on function internal.is_enabled() to authenticated;
create or replace function internal.on_user_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,display_name,role)
 values(new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1), 'Usuario'), 'operator');
 return new;
end; $$;
revoke execute on function internal.on_user_created() from public, anon, authenticated;
create trigger inventa_profile_on_signup after insert on auth.users
for each row execute function internal.on_user_created();

create table public.campaigns (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 kind text not null check (kind in ('micro','annual')),
 status text not null default 'draft' check(status in ('draft','active','closed')),
 starts_at timestamptz,
 closed_at timestamptz,
 created_by uuid references public.profiles(user_id),
 created_at timestamptz not null default now()
);
create unique index one_active_inventa_campaign on public.campaigns ((true)) where status='active';
create table public.locations (
 code text primary key,
 aisle text not null,
 zone text not null default '',
 description text not null default '',
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.products (
 code text primary key,
 description text not null,
 unit text not null default 'UD',
 barcode text,
 created_at timestamptz not null default now()
);
create table public.barcodes (
 code text primary key,
 product_code text not null references public.products(code),
 created_by uuid references public.profiles(user_id),
 created_at timestamptz not null default now()
);
create table public.fixed_positions (
 product_code text not null references public.products(code),
 location_code text not null references public.locations(code),
 priority int not null default 1 check(priority>=1),
 created_at timestamptz not null default now(),
 primary key(product_code,location_code)
);
create index fixed_position_priority on public.fixed_positions(product_code,priority);
create table public.stock_snapshot (
 campaign_id uuid not null references public.campaigns(id),
 location_code text not null references public.locations(code),
 product_code text not null references public.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null default 0 check(quantity>=0),
 source text not null default 'BC',
 imported_at timestamptz not null default now(),
 primary key(campaign_id,location_code,product_code,lot)
);
create table public.assignments (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id),
 location_code text not null references public.locations(code),
 operator_id uuid not null references public.profiles(user_id),
 assigned_by uuid references public.profiles(user_id),
 status text not null default 'pending' check(status in ('pending','in_progress','completed','review')),
 created_at timestamptz not null default now(),
 unique(campaign_id,location_code,operator_id)
);
create index assignment_operator on public.assignments(operator_id,campaign_id);
create table public.counts (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id),
 location_code text not null references public.locations(code),
 product_code text not null references public.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null check(quantity>=0),
 actor_id uuid not null references public.profiles(user_id),
 partner_id uuid references public.profiles(user_id),
 previous_id uuid references public.counts(id),
 correction_reason text,
 client_mutation_id uuid not null unique,
 entries jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 constraint correction_requires_reason check(previous_id is null or length(trim(coalesce(correction_reason,''))) >= 5),
 constraint different_partner check (partner_id is null or partner_id<>actor_id)
);
create index count_campaign_location on public.counts(campaign_id,location_code,product_code);
create table public.incidents (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid references public.campaigns(id),
 location_code text references public.locations(code),
 product_code text references public.products(code),
 category text not null default 'other' check(category in ('difference','missing','movement','barcode','location','other')),
 description text not null,
 status text not null default 'open' check(status in ('open','review','resolved')),
 reported_by uuid not null references public.profiles(user_id),
 assigned_to uuid references public.profiles(user_id),
 resolved_by uuid references public.profiles(user_id),
 resolution text,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index incidents_status_campaign on public.incidents(campaign_id,status);
create table public.movements (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id),
 source_location text not null references public.locations(code),
 destination_location text not null references public.locations(code),
 product_code text not null references public.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null check(quantity>0),
 reason text not null check(length(trim(reason))>=3),
 actor_id uuid not null references public.profiles(user_id),
 partner_id uuid references public.profiles(user_id),
 client_mutation_id uuid not null unique,
 created_at timestamptz not null default now(),
 constraint different_locations check(source_location<>destination_location)
);
create table public.audit_events (
 id bigint generated always as identity primary key,
 actor_id uuid,
 relation_name text not null,
 record_id text not null,
 operation text not null,
 before_row jsonb,
 after_row jsonb,
 created_at timestamptz not null default now()
);
create index audit_recent on public.audit_events(created_at desc);

create or replace function internal.record_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_id,relation_name,record_id,operation,before_row,after_row)
 values((select auth.uid()),TG_TABLE_NAME,coalesce((case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end)->>'id',(case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end)->>'code', ''),
 TG_OP,case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
 case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) else null end);
 return case when TG_OP='DELETE' then OLD else NEW end;
end; $$;
revoke execute on function internal.record_audit() from public,anon,authenticated;
create trigger audit_campaigns after insert or update on public.campaigns for each row execute function internal.record_audit();
create trigger audit_assignments after insert or update on public.assignments for each row execute function internal.record_audit();
create trigger audit_counts after insert on public.counts for each row execute function internal.record_audit();
create trigger audit_incidents after insert or update on public.incidents for each row execute function internal.record_audit();
create trigger audit_moves after insert on public.movements for each row execute function internal.record_audit();
create trigger audit_profiles after update on public.profiles for each row execute function internal.record_audit();
create trigger audit_snapshot after insert or update on public.stock_snapshot for each row execute function internal.record_audit();
create trigger audit_products after insert or update on public.products for each row execute function internal.record_audit();
create trigger audit_locations after insert or update on public.locations for each row execute function internal.record_audit();

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.locations enable row level security;
alter table public.products enable row level security;
alter table public.barcodes enable row level security;
alter table public.fixed_positions enable row level security;
alter table public.stock_snapshot enable row level security;
alter table public.assignments enable row level security;
alter table public.counts enable row level security;
alter table public.incidents enable row level security;
alter table public.movements enable row level security;
alter table public.audit_events enable row level security;

grant select on public.profiles,public.campaigns,public.locations,public.products,public.barcodes,public.fixed_positions,public.stock_snapshot,public.assignments,public.counts,public.incidents,public.movements,public.audit_events to authenticated;
grant insert on public.campaigns,public.locations,public.products,public.barcodes,public.fixed_positions,public.stock_snapshot,public.assignments,public.counts,public.incidents,public.movements to authenticated;
grant update on public.profiles,public.campaigns,public.locations,public.products,public.barcodes,public.fixed_positions,public.stock_snapshot,public.assignments,public.incidents to authenticated;

create policy profiles_read on public.profiles for select to authenticated using ((select auth.uid())=user_id or (select internal.is_manager()));
create policy profiles_admin_update on public.profiles for update to authenticated using ((select internal.is_admin())) with check ((select internal.is_admin()));
create policy campaigns_read on public.campaigns for select to authenticated using ((status='active' and (select internal.is_enabled())) or (select internal.is_manager()));
create policy campaigns_admin_insert on public.campaigns for insert to authenticated with check ((select internal.is_admin()) and created_by=(select auth.uid()));
create policy campaigns_admin_update on public.campaigns for update to authenticated using ((select internal.is_admin())) with check ((select internal.is_admin()));
create policy locations_read on public.locations for select to authenticated using ((select internal.is_enabled()));
create policy locations_manager_insert on public.locations for insert to authenticated with check ((select internal.is_manager()));
create policy locations_manager_update on public.locations for update to authenticated using ((select internal.is_manager())) with check ((select internal.is_manager()));
create policy products_read on public.products for select to authenticated using ((select internal.is_enabled()));
create policy products_manager_insert on public.products for insert to authenticated with check ((select internal.is_manager()));
create policy products_manager_update on public.products for update to authenticated using ((select internal.is_manager())) with check ((select internal.is_manager()));
create policy barcodes_read on public.barcodes for select to authenticated using ((select internal.is_enabled()));
create policy barcodes_insert on public.barcodes for insert to authenticated with check ((select internal.is_enabled()) and created_by=(select auth.uid()));
create policy barcodes_manager_update on public.barcodes for update to authenticated using ((select internal.is_manager())) with check ((select internal.is_manager()));
create policy fixed_read on public.fixed_positions for select to authenticated using ((select internal.is_enabled()));
create policy fixed_manager_insert on public.fixed_positions for insert to authenticated with check ((select internal.is_manager()));
create policy fixed_manager_update on public.fixed_positions for update to authenticated using ((select internal.is_manager())) with check ((select internal.is_manager()));
create policy stock_manager_read on public.stock_snapshot for select to authenticated using ((select internal.is_manager()));
create policy stock_manager_insert on public.stock_snapshot for insert to authenticated with check ((select internal.is_manager()));
create policy stock_manager_update on public.stock_snapshot for update to authenticated using ((select internal.is_manager())) with check ((select internal.is_manager()));
create policy assignments_read on public.assignments for select to authenticated using ((operator_id=(select auth.uid()) and (select internal.is_enabled())) or (select internal.is_manager()));
create policy assignments_manager_insert on public.assignments for insert to authenticated with check ((select internal.is_manager()) and assigned_by=(select auth.uid()));
create policy assignments_manager_update on public.assignments for update to authenticated using ((select internal.is_manager())) with check ((select internal.is_manager()));
create policy counts_read on public.counts for select to authenticated using ((actor_id=(select auth.uid()) and (select internal.is_enabled())) or (select internal.is_manager()));
create policy counts_insert on public.counts for insert to authenticated with check (
 actor_id=(select auth.uid()) and (select internal.is_enabled())
 and exists(select 1 from public.campaigns c where c.id=campaign_id and c.status='active')
 and ( (select internal.is_manager()) or exists(select 1 from public.assignments a where a.campaign_id=counts.campaign_id and a.location_code=counts.location_code and a.operator_id=(select auth.uid())) )
);
create policy incidents_read on public.incidents for select to authenticated using ((reported_by=(select auth.uid()) and (select internal.is_enabled())) or (select internal.is_manager()));
create policy incidents_insert on public.incidents for insert to authenticated with check (reported_by=(select auth.uid()) and (select internal.is_enabled()));
create policy incidents_manager_update on public.incidents for update to authenticated using ((select internal.is_manager())) with check ((select internal.is_manager()));
create policy movements_read on public.movements for select to authenticated using ((actor_id=(select auth.uid()) and (select internal.is_enabled())) or (select internal.is_manager()));
create policy movements_insert on public.movements for insert to authenticated with check (
 actor_id=(select auth.uid()) and (select internal.is_enabled()) and exists(select 1 from public.campaigns c where c.id=campaign_id and c.status='active')
);
create policy audit_manager_read on public.audit_events for select to authenticated using ((select internal.is_manager()));

