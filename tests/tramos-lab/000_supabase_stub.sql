-- INVENTA TRAMOS LAB ONLY · PostgreSQL efímero. Nunca ejecutar contra Supabase real.
-- Reproduce lo mínimo de Supabase (roles, auth.users, auth.uid) para aplicar las migraciones.
do $$ begin
 if current_database()<>'inventa_tramos_test' then
  raise exception 'INVENTA TRAMOS LAB ONLY: base de datos % rechazada',current_database();
 end if;
end $$;

create extension if not exists pgcrypto;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
grant usage on schema auth to anon,authenticated;
grant usage on schema public to anon,authenticated;
create table auth.users(
 id uuid primary key,
 email text,
 email_confirmed_at timestamptz,
 is_anonymous boolean default false,
 raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant execute on function auth.uid() to anon,authenticated;
