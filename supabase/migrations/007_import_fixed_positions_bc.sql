-- Migración aplicada exclusivamente en Supabase INVENTA, 2026-10-24.

-- INVENTA: sincronización de posiciones fijas desde "Base unificada ubicaciones almacen.xlsx".
-- Artículos y ubicaciones inexistentes se añaden sin asignar stock, los existentes se conservan.
alter table public.fixed_positions
 add column if not exists origin text not null default 'manual';
alter table public.fixed_positions
 drop constraint if exists fixed_positions_origin_check;
alter table public.fixed_positions
 add constraint fixed_positions_origin_check check (origin in ('manual','bc'));

create table if not exists public.fixed_position_imports (
 id uuid primary key default gen_random_uuid(),
 warehouse text not null,
 file_name text not null,
 source_rows integer not null,
 fixed_rows integer not null,
 unique_positions integer not null,
 duplicate_rows integer not null,
 new_products integer not null,
 new_locations integer not null,
 new_fixed integer not null,
 removed_fixed integer not null,
 imported_by uuid not null references public.profiles(user_id),
 imported_at timestamptz not null default now()
);
alter table public.fixed_position_imports enable row level security;
revoke all on public.fixed_position_imports from anon,authenticated;
grant select on public.fixed_position_imports to authenticated;
drop policy if exists fixed_imports_admin_select on public.fixed_position_imports;
create policy fixed_imports_admin_select on public.fixed_position_imports
 for select to authenticated using ((select internal.is_admin()));

create or replace function public.admin_import_fixed_positions(
 p_warehouse text, p_filename text, p_items jsonb, p_source_rows integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_warehouse text;
 v_input integer;
 v_unique integer;
 v_new_products integer;
 v_new_locations integer;
 v_new_fixed integer;
 v_removed_fixed integer;
 v_import_id uuid;
begin
 if not internal.is_admin() then
  raise exception 'Solo Administración puede importar posiciones fijas' using errcode='42501';
 end if;
 if p_warehouse is null or length(btrim(p_warehouse)) not between 1 and 100
    or p_filename is null or length(btrim(p_filename)) not between 1 and 240
    or p_source_rows is null or p_source_rows not between 1 and 20000
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 10000 then
  raise exception 'Archivo no válido o incompleto';
 end if;
 v_input:=jsonb_array_length(p_items);
 if v_input>p_source_rows then raise exception 'Las posiciones fijas superan las líneas de origen';end if;
 select b.warehouse into v_warehouse
 from public.bc_import_current c join public.bc_import_batches b on b.id=c.import_id
 where c.singleton=true;
 if v_warehouse is null or upper(btrim(p_warehouse))<>upper(btrim(v_warehouse)) then
  raise exception 'El almacén del fichero (%) no coincide con el stock BC vigente (%)',p_warehouse,coalesce(v_warehouse,'sin importación');
 end if;
 perform pg_advisory_xact_lock(78042,1024);
 create temporary table pg_temp.inventa_fixed_raw on commit drop as
 select
  upper(btrim(r.value->>'product_code')) as product_code,
  upper(btrim(r.value->>'location_code')) as location_code,
  btrim(r.value->>'description') as description,
  btrim(r.value->>'unit') as unit,
  btrim(coalesce(r.value->>'zone','')) as zone,
  r.n as ord
 from jsonb_array_elements(p_items) with ordinality as r(value,n);
 if exists(
  select 1 from pg_temp.inventa_fixed_raw
  where product_code is null or length(product_code) not between 1 and 120
     or location_code is null or length(location_code) not between 1 and 120
     or description is null or length(description) not between 1 and 500
     or unit is null or length(unit) not between 1 and 50
     or length(zone)>100
 ) then
   raise exception 'Hay artículos, ubicaciones o descripciones incorrectas en el Excel';
 end if;
 create temporary table pg_temp.inventa_fixed_stage on commit drop as
 select distinct on (product_code,location_code)
  product_code,location_code,description,unit,zone
 from pg_temp.inventa_fixed_raw order by product_code,location_code,ord;
 select count(*) into v_unique from pg_temp.inventa_fixed_stage;
 select count(*) into v_new_products from
 (select distinct product_code from pg_temp.inventa_fixed_stage) s
 where not exists (select 1 from public.products p where p.code=s.product_code);
 select count(*) into v_new_locations from
 (select distinct location_code from pg_temp.inventa_fixed_stage) s
 where not exists (select 1 from public.locations l where l.code=s.location_code);
 insert into public.products(code,description,unit)
 select distinct on(product_code) product_code,description,unit
 from pg_temp.inventa_fixed_stage
 order by product_code,location_code
 on conflict (code) do nothing;
 insert into public.locations(code,aisle,zone)
 select distinct on(location_code)
   location_code,upper(left(location_code,1)),zone
 from pg_temp.inventa_fixed_stage
 order by location_code,product_code
 on conflict (code) do nothing;
 delete from public.fixed_positions f
 where f.origin='bc' and not exists (
  select 1 from pg_temp.inventa_fixed_stage s
  where s.product_code=f.product_code and s.location_code=f.location_code
 );
 get diagnostics v_removed_fixed=row_count;
 insert into public.fixed_positions(product_code,location_code,priority,origin)
 select product_code,location_code,1,'bc'
 from pg_temp.inventa_fixed_stage
 on conflict(product_code,location_code) do nothing;
 get diagnostics v_new_fixed=row_count;
 insert into public.fixed_position_imports
 (warehouse,file_name,source_rows,fixed_rows,unique_positions,duplicate_rows,
  new_products,new_locations,new_fixed,removed_fixed,imported_by)
 values (v_warehouse,btrim(p_filename),p_source_rows,v_input,v_unique,
    v_input-v_unique,v_new_products,v_new_locations,v_new_fixed,v_removed_fixed,auth.uid())
 returning id into v_import_id;
 return jsonb_build_object(
  'import_id',v_import_id,
  'source_rows',p_source_rows,'fixed_rows',v_input,
  'unique_positions',v_unique,'duplicate_rows',v_input-v_unique,
  'new_products',v_new_products,'new_locations',v_new_locations,
  'new_fixed',v_new_fixed,'removed_fixed',v_removed_fixed
 );
end;
$$;
revoke all on function public.admin_import_fixed_positions(text,text,jsonb,integer) from public,anon;
grant execute on function public.admin_import_fixed_positions(text,text,jsonb,integer) to authenticated;

