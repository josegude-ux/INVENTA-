-- Migración aplicada al proyecto INVENTA en Supabase (24/10/2026).

-- INVENTA: importaciones BC completas, preparadas en lotes y publicadas atomícamente.
create table if not exists public.bc_import_batches (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references public.profiles(user_id),
 file_name text not null check (length(trim(file_name)) between 1 and 240),
 warehouse text not null check (length(trim(warehouse)) between 1 and 100),
 expected_rows integer not null check (expected_rows between 1 and 50000),
 status text not null default 'uploading' check (status in ('uploading','committed','cancelled')),
 created_at timestamptz not null default now(),
 committed_at timestamptz,
 stock_rows integer,
 product_count integer,
 location_count integer,
 negative_count integer
);
create table if not exists public.bc_import_lines (
 import_id uuid not null references public.bc_import_batches(id) on delete cascade,
 row_number integer not null check (row_number > 0),
 product_code text not null check (length(trim(product_code)) between 1 and 120),
 description text not null check (length(trim(description)) between 1 and 500),
 unit text not null check (length(trim(unit)) between 1 and 50),
 location_code text not null check (length(trim(location_code)) between 1 and 120),
 zone text not null default '',
 lot text not null default '',
 expiry_date date,
 quantity numeric not null check (abs(quantity) < 1000000000000),
 primary key (import_id,row_number),
 unique (import_id,location_code,product_code,lot)
);
create index if not exists bc_import_lines_location_idx on public.bc_import_lines(import_id,location_code);
create index if not exists bc_import_lines_product_idx on public.bc_import_lines(import_id,product_code);
create table if not exists public.bc_import_current (
 singleton boolean primary key default true check (singleton),
 import_id uuid not null references public.bc_import_batches(id),
 updated_at timestamptz not null default now()
);
alter table public.bc_import_batches enable row level security;
alter table public.bc_import_lines enable row level security;
alter table public.bc_import_current enable row level security;
create policy bc_batches_manager_read on public.bc_import_batches for select to authenticated using ((select internal.is_manager()));
create policy bc_batches_admin_insert on public.bc_import_batches for insert to authenticated
 with check ((select internal.is_admin()) and created_by=(select auth.uid()) and status='uploading');
create policy bc_lines_manager_read on public.bc_import_lines for select to authenticated using ((select internal.is_manager()));
create policy bc_lines_admin_insert on public.bc_import_lines for insert to authenticated
 with check ((select internal.is_admin()) and exists (
 select 1 from public.bc_import_batches b
 where b.id=import_id and b.created_by=(select auth.uid()) and b.status='uploading'));
create policy bc_current_manager_read on public.bc_import_current for select to authenticated using ((select internal.is_manager()));
revoke all on public.bc_import_batches, public.bc_import_lines, public.bc_import_current from anon;
grant select,insert on public.bc_import_batches to authenticated;
grant select,insert on public.bc_import_lines to authenticated;
grant select on public.bc_import_current to authenticated;
-- Impide que un paquete finalizado reciba nuevas líneas incluso si hay solicitudes simultáneas.
create or replace function internal.bc_validate_line_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status text; v_creator uuid; v_expected integer;
begin
 select status,created_by,expected_rows into v_status,v_creator,v_expected
 from public.bc_import_batches where id=new.import_id for update;
 if v_status is distinct from 'uploading' or v_creator is distinct from auth.uid() then
  raise exception 'Importación no editable o sin autorización' using errcode='42501';
 end if;
 if new.row_number>v_expected then raise exception 'Número de línea fuera del total previsto'; end if;
 return new;
end;
$$;
drop trigger if exists bc_validate_line_insert_trg on public.bc_import_lines;
create trigger bc_validate_line_insert_trg before insert on public.bc_import_lines
for each row execute function internal.bc_validate_line_insert();
create or replace function public.bc_commit_import(p_import_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bc_import_batches%rowtype;
 v_rows integer; v_stock integer; v_products integer; v_locations integer; v_negative integer;
begin
 if not internal.is_admin() then
  raise exception 'Solo Administración puede confirmar el stock de BC' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(726291,728101);
 select * into b from public.bc_import_batches where id=p_import_id for update;
 if not found or b.created_by is distinct from auth.uid() or b.status <> 'uploading' then
  raise exception 'Importación no disponible para confirmar' using errcode='42501';
 end if;
 select count(*),count(*) filter(where quantity<>0),count(*) filter(where quantity<0),
 count(distinct product_code),count(distinct location_code)
 into v_rows,v_stock,v_negative,v_products,v_locations
 from public.bc_import_lines where import_id=p_import_id;
 if v_rows<>b.expected_rows then
  raise exception 'Importación incompleta: % de % líneas',v_rows,b.expected_rows;
 end if;
 -- Mantener artículos y ubicaciones existentes, incluyendo los de stock cero.
 insert into public.products(code,description,unit)
 select distinct on(product_code) product_code,description,unit
 from public.bc_import_lines where import_id=p_import_id order by product_code,row_number
 on conflict (code) do update set description=excluded.description,unit=excluded.unit;
 insert into public.locations(code,aisle,zone)
 select distinct on(location_code) location_code,upper(left(location_code,1)),zone
 from public.bc_import_lines where import_id=p_import_id order by location_code,row_number
 on conflict (code) do update set aisle=excluded.aisle,zone=excluded.zone;
 update public.bc_import_batches set status='committed', committed_at=now(),
 stock_rows=v_stock,product_count=v_products,location_count=v_locations,negative_count=v_negative
 where id=p_import_id;
 -- El puntero cambia una única vez: ninguna lectura verá una importación parcial.
 insert into public.bc_import_current(singleton,import_id,updated_at)
 values (true,p_import_id,now())
 on conflict(singleton) do update set import_id=excluded.import_id,updated_at=excluded.updated_at;
 return jsonb_build_object('import_id',p_import_id,'rows',v_rows,'stock_rows',v_stock,
 'products',v_products,'locations',v_locations,'negative',v_negative);
end;
$$;
revoke all on function public.bc_commit_import(uuid) from public,anon;
grant execute on function public.bc_commit_import(uuid) to authenticated;

