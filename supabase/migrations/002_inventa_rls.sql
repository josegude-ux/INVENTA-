-- INVENTA Row Level Security.
-- Goal: Operario must NOT read theoretical stock during an active campaign,
-- even via direct PostgREST/API calls. Staff (supervisor/admin) may.
-- Apply after 001_inventa_schema.sql on an independent INVENTA Supabase project.

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.locations enable row level security;
alter table public.articles enable row level security;
alter table public.article_fixed_locations enable row level security;
alter table public.barcodes enable row level security;
alter table public.stock_snapshots enable row level security;
alter table public.assignments enable row level security;
alter table public.count_sessions enable row level security;
alter table public.count_session_members enable row level security;
alter table public.count_entries enable row level security;
alter table public.count_corrections enable row level security;
alter table public.movements enable row level security;
alter table public.incidents enable row level security;
alter table public.audit_events enable row level security;
alter table public.sync_outbox enable row level security;

-- Profiles: self read; admin manage.
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.current_profile_role() = 'administrador')
  with check (public.current_profile_role() = 'administrador');

-- Campaigns: everyone authenticated can read; only admin opens/closes.
create policy campaigns_select_auth on public.campaigns
  for select to authenticated
  using (true);

create policy campaigns_admin_write on public.campaigns
  for all to authenticated
  using (public.current_profile_role() = 'administrador')
  with check (public.current_profile_role() = 'administrador');

-- Masters: readable by authenticated users.
create policy locations_select_auth on public.locations
  for select to authenticated using (true);

create policy articles_select_auth on public.articles
  for select to authenticated using (true);

create policy fixed_locations_select_auth on public.article_fixed_locations
  for select to authenticated using (true);

create policy barcodes_select_auth on public.barcodes
  for select to authenticated using (true);

create policy barcodes_insert_auth on public.barcodes
  for insert to authenticated
  with check (created_by = auth.uid());

create policy barcodes_update_staff on public.barcodes
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- CRITICAL: theoretical stock. Operario blocked while any campaign is active.
create policy stock_snapshots_select_guarded on public.stock_snapshots
  for select to authenticated
  using (
    public.is_staff()
    or not public.has_active_campaign()
  );

create policy stock_snapshots_staff_write on public.stock_snapshots
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Assignments: operario sees own; staff sees all.
create policy assignments_select on public.assignments
  for select to authenticated
  using (assigned_to = auth.uid() or public.is_staff());

create policy assignments_staff_write on public.assignments
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Count sessions / members
create policy count_sessions_select on public.count_sessions
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.count_session_members m
      where m.session_id = count_sessions.id and m.profile_id = auth.uid()
    )
  );

create policy count_sessions_insert on public.count_sessions
  for insert to authenticated
  with check (true);

create policy count_session_members_select on public.count_session_members
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_staff()
    or exists (
      select 1 from public.count_session_members m
      where m.session_id = count_session_members.session_id and m.profile_id = auth.uid()
    )
  );

create policy count_session_members_insert on public.count_session_members
  for insert to authenticated
  with check (profile_id = auth.uid() or public.is_staff());

-- Count entries: participants and staff; no theoretical leakage here.
create policy count_entries_select on public.count_entries
  for select to authenticated
  using (
    public.is_staff()
    or auth.uid() = any (workers)
    or created_by = auth.uid()
  );

create policy count_entries_insert on public.count_entries
  for insert to authenticated
  with check (created_by = auth.uid());

-- Corrections: append-only insert for authors/staff; readable like entries.
create policy count_corrections_select on public.count_corrections
  for select to authenticated
  using (
    public.is_staff()
    or created_by = auth.uid()
    or exists (
      select 1 from public.count_entries e
      where e.id = count_corrections.entry_id
        and (e.created_by = auth.uid() or auth.uid() = any (e.workers))
    )
  );

create policy count_corrections_insert on public.count_corrections
  for insert to authenticated
  with check (created_by = auth.uid());

create policy movements_select on public.movements
  for select to authenticated
  using (created_by = auth.uid() or public.is_staff());

create policy movements_insert on public.movements
  for insert to authenticated
  with check (created_by = auth.uid());

create policy incidents_select on public.incidents
  for select to authenticated
  using (created_by = auth.uid() or public.is_staff());

create policy incidents_insert on public.incidents
  for insert to authenticated
  with check (created_by = auth.uid());

create policy incidents_staff_update on public.incidents
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Audit: staff read; inserts via security definer helpers later (service or trigger).
create policy audit_events_staff_select on public.audit_events
  for select to authenticated
  using (public.is_staff());

create policy sync_outbox_own on public.sync_outbox
  for all to authenticated
  using (true)
  with check (true);

-- Deny anon by default (RLS on + no policies for anon).
-- Explicit revoke of dangerous grants if present.
revoke all on table public.stock_snapshots from anon;
revoke all on table public.audit_events from anon;
