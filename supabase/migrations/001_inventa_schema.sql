-- INVENTA schema (independent Supabase project).
-- Do NOT apply to Control de Cargas or Control de Tanques databases.
-- Apply only after an INVENTA project is created and authorized.
-- No secrets. No Business Central writes.

create extension if not exists "pgcrypto";

create type public.inventa_role as enum ('operario', 'supervisor', 'administrador');
create type public.campaign_kind as enum ('microrecuento', 'inventario_anual');
create type public.campaign_status as enum ('draft', 'active', 'closed');
create type public.count_mode as enum ('single', 'pair');
create type public.incident_status as enum ('pending', 'in_review', 'resolved', 'rejected');
create type public.sync_status as enum ('pending', 'synced', 'conflict');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.inventa_role not null default 'operario',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.campaign_kind not null,
  status public.campaign_status not null default 'draft',
  opened_at timestamptz,
  closed_at timestamptz,
  opened_by uuid references public.profiles (id),
  closed_by uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.locations (
  id text primary key,
  aisle text not null,
  zone text,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.articles (
  id text primary key,
  name text not null,
  unit text not null default 'unidades',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Preferente / fija según Asignador BC (Fijo = 1). Null = sin ubicación fija.
create table public.article_fixed_locations (
  article_id text not null references public.articles (id) on delete cascade,
  location_id text not null references public.locations (id) on delete cascade,
  is_preferred boolean not null default true,
  primary key (article_id, location_id)
);

create table public.barcodes (
  code text primary key,
  article_id text not null references public.articles (id) on delete cascade,
  source text not null default 'INVENTA',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Snapshot BC importado al abrir campaña. Nunca se escribe de vuelta a BC desde aquí.
create table public.stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  location_id text not null references public.locations (id),
  article_id text not null references public.articles (id),
  lot text,
  theoretical_qty numeric(18, 3) not null check (theoretical_qty >= 0),
  imported_at timestamptz not null default now(),
  unique (campaign_id, location_id, article_id, lot)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  location_id text not null references public.locations (id),
  assigned_to uuid references public.profiles (id),
  aisle text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (campaign_id, location_id)
);

create table public.count_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  mode public.count_mode not null,
  device_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active boolean not null default true
);

-- Pareja = dos filas en la misma sesión; un solo dispositivo / un solo resultado.
create table public.count_session_members (
  session_id uuid not null references public.count_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (session_id, profile_id)
);

create table public.count_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_id uuid references public.count_sessions (id),
  location_id text not null references public.locations (id),
  article_id text not null references public.articles (id),
  lot text,
  amount numeric(18, 3) not null check (amount >= 0),
  factors jsonb,
  entries jsonb not null default '[]'::jsonb,
  count_mode public.count_mode not null,
  workers uuid[] not null default '{}',
  client_id text not null,
  device_id text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  superseded_by uuid references public.count_entries (id),
  unique (campaign_id, client_id)
);

create table public.count_corrections (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.count_entries (id) on delete cascade,
  previous_amount numeric(18, 3) not null,
  new_amount numeric(18, 3) not null,
  previous_entries jsonb,
  new_entries jsonb,
  reason text not null,
  created_by uuid references public.profiles (id),
  session_id uuid references public.count_sessions (id),
  created_at timestamptz not null default now()
);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  article_id text not null references public.articles (id),
  lot text,
  qty numeric(18, 3) not null check (qty > 0),
  from_location text not null references public.locations (id),
  to_location text not null references public.locations (id),
  reason text not null,
  created_by uuid references public.profiles (id),
  client_id text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, client_id),
  check (from_location <> to_location)
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  location_id text not null references public.locations (id),
  article_id text not null references public.articles (id),
  kind text not null,
  status public.incident_status not null default 'pending',
  counted_qty numeric(18, 3),
  note text,
  created_by uuid references public.profiles (id),
  resolved_by uuid references public.profiles (id),
  client_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (campaign_id, client_id)
);

-- Append-only audit trail. Never update/delete from the app.
create table public.audit_events (
  id bigserial primary key,
  campaign_id uuid references public.campaigns (id),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create table public.sync_outbox (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  client_id text not null,
  op text not null,
  payload jsonb not null,
  status public.sync_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_id)
);

create index stock_snapshots_campaign_idx on public.stock_snapshots (campaign_id);
create index count_entries_campaign_loc_idx on public.count_entries (campaign_id, location_id);
create index incidents_campaign_status_idx on public.incidents (campaign_id, status);
create index audit_events_campaign_idx on public.audit_events (campaign_id, at desc);
create index assignments_campaign_assignee_idx on public.assignments (campaign_id, assigned_to);

create or replace function public.current_profile_role()
returns public.inventa_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_active_campaign()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaigns where status = 'active'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('supervisor', 'administrador'), false);
$$;
