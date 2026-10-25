-- MOVENTA: contrato de acceso a aplicaciones (NO aplicado aún).
-- Requiere proyecto Supabase común y verificación de administradores existentes.
begin;
create table if not exists public.moventa_app_access (
 user_id uuid not null references auth.users(id) on delete cascade,
 app_id text not null check (app_id in ('inventa','kontrola')),
 app_role text not null check (app_role in ('admin','operator','viewer')),
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (user_id,app_id)
);
alter table public.moventa_app_access enable row level security;
revoke all on public.moventa_app_access from anon;
grant select on public.moventa_app_access to authenticated;
-- Each signed-in user may see ONLY their own module permissions.
create policy moventa_access_self_read on public.moventa_app_access
 for select to authenticated using (user_id = (select auth.uid()));
-- No client INSERT/UPDATE/DELETE policies. Admin management must be via
-- reviewed, server-side privileged workflow (not via user_metadata).
-- Do not grant write privileges to authenticated.
revoke insert, update, delete on public.moventa_app_access from authenticated;
commit;
