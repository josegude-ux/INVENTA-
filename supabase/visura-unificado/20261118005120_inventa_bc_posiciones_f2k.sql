-- INVENTA: importaciones BC, posiciones fijas, recuentos F2-K y acceso de aplicación.
create table inventa.bc_import_batches (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references inventa.profiles(user_id),
 file_name text not null check (length(trim(file_name)) between 1 and 240),
 warehouse text not null check (length(trim(warehouse)) between 1 and 100),
 expected_rows integer not null check (expected_rows between 1 and 50000),
 status text not null default 'uploading' check (status in ('uploading','committed','cancelled')),
 created_at timestamptz not null default now(),
 committed_at timestamptz,
 stock_rows integer, product_count integer, location_count integer, negative_count integer
);
create table inventa.bc_import_lines (
 import_id uuid not null references inventa.bc_import_batches(id) on delete cascade,
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
create index bc_import_lines_location_idx on inventa.bc_import_lines(import_id,location_code);
create index bc_import_lines_product_idx on inventa.bc_import_lines(import_id,product_code);
create table inventa.bc_import_current (
 singleton boolean primary key default true check (singleton),
 import_id uuid not null references inventa.bc_import_batches(id),
 updated_at timestamptz not null default now()
);
alter table inventa.bc_import_batches enable row level security;
alter table inventa.bc_import_lines enable row level security;
alter table inventa.bc_import_current enable row level security;
create policy bc_batches_manager_read on inventa.bc_import_batches for select to authenticated using ((select inventa_internal.is_manager()));
create policy bc_batches_admin_insert on inventa.bc_import_batches for insert to authenticated
 with check ((select inventa_internal.is_admin()) and created_by=(select auth.uid()) and status='uploading');
create policy bc_lines_manager_read on inventa.bc_import_lines for select to authenticated using ((select inventa_internal.is_manager()));
create policy bc_lines_admin_insert on inventa.bc_import_lines for insert to authenticated
 with check ((select inventa_internal.is_admin()) and exists (
 select 1 from inventa.bc_import_batches b where b.id=import_id and b.created_by=(select auth.uid()) and b.status='uploading'));
create policy bc_current_manager_read on inventa.bc_import_current for select to authenticated using ((select inventa_internal.is_manager()));
grant select,insert on inventa.bc_import_batches to authenticated;
grant select,insert on inventa.bc_import_lines to authenticated;
grant select on inventa.bc_import_current to authenticated;

create or replace function inventa_internal.bc_validate_line_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status text; v_creator uuid; v_expected integer;
begin
 select status,created_by,expected_rows into v_status,v_creator,v_expected
 from inventa.bc_import_batches where id=new.import_id for update;
 if v_status is distinct from 'uploading' or v_creator is distinct from auth.uid() then
  raise exception 'Importación no editable o sin autorización' using errcode='42501';
 end if;
 if new.row_number>v_expected then raise exception 'Número de línea fuera del total previsto'; end if;
 return new;
end; $$;
revoke all on function inventa_internal.bc_validate_line_insert() from public,anon,authenticated;
create trigger bc_validate_line_insert_trg before insert on inventa.bc_import_lines
for each row execute function inventa_internal.bc_validate_line_insert();

create or replace function inventa.bc_commit_import(p_import_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b inventa.bc_import_batches%rowtype;
 v_rows integer; v_stock integer; v_products integer; v_locations integer; v_negative integer;
begin
 if not inventa_internal.is_admin() then
  raise exception 'Solo Administración puede confirmar el stock de BC' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(726291,728101);
 select * into b from inventa.bc_import_batches where id=p_import_id for update;
 if not found or b.created_by is distinct from auth.uid() or b.status <> 'uploading' then
  raise exception 'Importación no disponible para confirmar' using errcode='42501';
 end if;
 select count(*),count(*) filter(where quantity<>0),count(*) filter(where quantity<0),
 count(distinct product_code),count(distinct location_code)
 into v_rows,v_stock,v_negative,v_products,v_locations
 from inventa.bc_import_lines where import_id=p_import_id;
 if v_rows<>b.expected_rows then
  raise exception 'Importación incompleta: % de % líneas',v_rows,b.expected_rows;
 end if;
 insert into inventa.products(code,description,unit)
 select distinct on(product_code) product_code,description,unit
 from inventa.bc_import_lines where import_id=p_import_id order by product_code,row_number
 on conflict (code) do update set description=excluded.description,unit=excluded.unit;
 insert into inventa.locations(code,aisle,zone)
 select distinct on(location_code) location_code,upper(left(location_code,1)),zone
 from inventa.bc_import_lines where import_id=p_import_id order by location_code,row_number
 on conflict (code) do update set aisle=excluded.aisle,zone=excluded.zone;
 update inventa.bc_import_batches set status='committed', committed_at=now(),
 stock_rows=v_stock,product_count=v_products,location_count=v_locations,negative_count=v_negative
 where id=p_import_id;
 insert into inventa.bc_import_current(singleton,import_id,updated_at)
 values (true,p_import_id,now())
 on conflict(singleton) do update set import_id=excluded.import_id,updated_at=excluded.updated_at;
 return jsonb_build_object('import_id',p_import_id,'rows',v_rows,'stock_rows',v_stock,
 'products',v_products,'locations',v_locations,'negative',v_negative);
end; $$;
revoke all on function inventa.bc_commit_import(uuid) from public,anon;
grant execute on function inventa.bc_commit_import(uuid) to authenticated;

create table inventa.fixed_position_events (
 id bigint generated by default as identity primary key,
 product_code text not null,
 location_code text not null,
 action text not null check (action in ('assigned','unassigned','priority_changed')),
 actor_id uuid references inventa.profiles(user_id),
 created_at timestamptz not null default now()
);
alter table inventa.fixed_position_events enable row level security;
grant select on inventa.fixed_position_events to authenticated;
create policy fixed_events_admin_read on inventa.fixed_position_events
 for select to authenticated using ((select inventa_internal.is_admin()));

create or replace function inventa_internal.audit_fixed_position_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into inventa.fixed_position_events(product_code,location_code,action,actor_id)
  values(new.product_code,new.location_code,'assigned',auth.uid());
  return new;
 elsif tg_op='DELETE' then
  insert into inventa.fixed_position_events(product_code,location_code,action,actor_id)
  values(old.product_code,old.location_code,'unassigned',auth.uid());
  return old;
 elsif new.priority is distinct from old.priority then
  insert into inventa.fixed_position_events(product_code,location_code,action,actor_id)
  values(new.product_code,new.location_code,'priority_changed',auth.uid());
 end if;
 return new;
end; $$;
revoke all on function inventa_internal.audit_fixed_position_change() from public,anon,authenticated;
create trigger audit_fixed_position_change_trg
 after insert or update or delete on inventa.fixed_positions
 for each row execute function inventa_internal.audit_fixed_position_change();

create or replace function inventa.admin_fixed_positions_report()
returns table(product_code text,product_description text,unit text,
 location_code text,aisle text,priority integer,stock_quantity numeric,assigned_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not inventa_internal.is_admin() then
  raise exception 'Solo Administración puede consultar este informe' using errcode='42501';
 end if;
 return query
 select f.product_code,p.description,p.unit,f.location_code,l.aisle,
        f.priority,coalesce(bc.qty,0::numeric),f.created_at
 from inventa.fixed_positions f
 join inventa.products p on p.code=f.product_code
 join inventa.locations l on l.code=f.location_code
 left join inventa.bc_import_current cur on cur.singleton=true
 left join lateral (
   select sum(line.quantity) as qty from inventa.bc_import_lines line
   where line.import_id=cur.import_id and line.product_code=f.product_code
    and line.location_code=f.location_code
 ) bc on true
 order by f.location_code,f.priority,f.product_code;
end; $$;
revoke all on function inventa.admin_fixed_positions_report() from public,anon;
grant execute on function inventa.admin_fixed_positions_report() to authenticated;

create table inventa.fixed_position_imports (
 id uuid primary key default gen_random_uuid(),
 warehouse text not null, file_name text not null,
 source_rows integer not null, fixed_rows integer not null, unique_positions integer not null,
 duplicate_rows integer not null, new_products integer not null, new_locations integer not null,
 new_fixed integer not null, removed_fixed integer not null,
 imported_by uuid not null references inventa.profiles(user_id),
 imported_at timestamptz not null default now()
);
alter table inventa.fixed_position_imports enable row level security;
grant select on inventa.fixed_position_imports to authenticated;
create policy fixed_imports_admin_select on inventa.fixed_position_imports
 for select to authenticated using ((select inventa_internal.is_admin()));

create or replace function inventa.admin_import_fixed_positions(
 p_warehouse text, p_filename text, p_items jsonb, p_source_rows integer, p_replace boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_warehouse text; v_input integer; v_unique integer; v_new_products integer;
 v_new_locations integer; v_new_fixed integer; v_removed_fixed integer; v_import_id uuid;
begin
 if not inventa_internal.is_admin() then
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
 from inventa.bc_import_current c join inventa.bc_import_batches b on b.id=c.import_id
 where c.singleton=true;
 if v_warehouse is null or upper(btrim(p_warehouse))<>upper(btrim(v_warehouse)) then
  raise exception 'El almacén del fichero (%) no coincide con el stock BC vigente (%)',p_warehouse,coalesce(v_warehouse,'sin importación');
 end if;
 perform pg_advisory_xact_lock(78042,1024);
 create temporary table pg_temp.inventa_fixed_raw on commit drop as
 select upper(btrim(r.value->>'product_code')) as product_code,
  upper(btrim(r.value->>'location_code')) as location_code,
  btrim(r.value->>'description') as description,
  btrim(r.value->>'unit') as unit,
  btrim(coalesce(r.value->>'zone','')) as zone,
  r.n as ord
 from jsonb_array_elements(p_items) with ordinality as r(value,n);
 if exists(select 1 from pg_temp.inventa_fixed_raw
  where product_code is null or length(product_code) not between 1 and 120
     or location_code is null or length(location_code) not between 1 and 120
     or description is null or length(description) not between 1 and 500
     or unit is null or length(unit) not between 1 and 50
     or length(zone)>100) then
   raise exception 'Hay artículos, ubicaciones o descripciones incorrectas en el Excel';
 end if;
 create temporary table pg_temp.inventa_fixed_stage on commit drop as
 select distinct on (product_code,location_code) product_code,location_code,description,unit,zone
 from pg_temp.inventa_fixed_raw order by product_code,location_code,ord;
 select count(*) into v_unique from pg_temp.inventa_fixed_stage;
 select count(*) into v_new_products from (select distinct product_code from pg_temp.inventa_fixed_stage) s
 where not exists (select 1 from inventa.products p where p.code=s.product_code);
 select count(*) into v_new_locations from (select distinct location_code from pg_temp.inventa_fixed_stage) s
 where not exists (select 1 from inventa.locations l where l.code=s.location_code);
 insert into inventa.products(code,description,unit)
 select distinct on(product_code) product_code,description,unit
 from pg_temp.inventa_fixed_stage order by product_code,location_code
 on conflict (code) do nothing;
 insert into inventa.locations(code,aisle,zone)
 select distinct on(location_code) location_code,upper(left(location_code,1)),zone
 from pg_temp.inventa_fixed_stage order by location_code,product_code
 on conflict (code) do nothing;
 if p_replace then
  delete from inventa.fixed_positions f
  where f.origin='bc' and not exists (select 1 from pg_temp.inventa_fixed_stage s
   where s.product_code=f.product_code and s.location_code=f.location_code);
  get diagnostics v_removed_fixed=row_count;
 else
  v_removed_fixed:=0;
 end if;
 insert into inventa.fixed_positions(product_code,location_code,priority,origin)
 select product_code,location_code,1,'bc' from pg_temp.inventa_fixed_stage
 on conflict(product_code,location_code) do nothing;
 get diagnostics v_new_fixed=row_count;
 insert into inventa.fixed_position_imports
 (warehouse,file_name,source_rows,fixed_rows,unique_positions,duplicate_rows,
  new_products,new_locations,new_fixed,removed_fixed,imported_by)
 values (v_warehouse,btrim(p_filename),p_source_rows,v_input,v_unique,
    v_input-v_unique,v_new_products,v_new_locations,v_new_fixed,v_removed_fixed,auth.uid())
 returning id into v_import_id;
 return jsonb_build_object('import_id',v_import_id,'source_rows',p_source_rows,'fixed_rows',v_input,
  'unique_positions',v_unique,'duplicate_rows',v_input-v_unique,
  'new_products',v_new_products,'new_locations',v_new_locations,
  'new_fixed',v_new_fixed,'removed_fixed',v_removed_fixed,'replace_mode',p_replace);
end; $$;
revoke all on function inventa.admin_import_fixed_positions(text,text,jsonb,integer,boolean) from public,anon;
grant execute on function inventa.admin_import_fixed_positions(text,text,jsonb,integer,boolean) to authenticated;

-- Recuentos F2-K
create table inventa.f2_k_slots (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references inventa.campaigns(id),
 location_code text not null references inventa.locations(code),
 cycle integer not null check (cycle between 1 and 2),
 operator_id uuid not null references inventa.profiles(user_id),
 state text not null check (state in ('pending','in_progress','completed','withdrawn','transferred')),
 version bigint not null default 1,
 assigned_by uuid not null references inventa.profiles(user_id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index f2_k_one_active_slot on inventa.f2_k_slots(campaign_id,location_code,cycle) where state in ('pending','in_progress');
create table inventa.f2_k_actions (
 mutation_id uuid primary key,
 actor_id uuid not null references inventa.profiles(user_id),
 action text not null, request jsonb not null, result jsonb not null,
 created_at timestamptz not null default now()
);
create table inventa.f2_k_events (
 id bigint generated by default as identity primary key,
 mutation_id uuid not null references inventa.f2_k_actions(mutation_id),
 slot_id uuid not null references inventa.f2_k_slots(id),
 actor_id uuid not null references inventa.profiles(user_id),
 event_type text not null, before_row jsonb, after_row jsonb, reason text,
 created_at timestamptz not null default now()
);
create table inventa.f2_k_entries (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references inventa.f2_k_slots(id),
 actor_id uuid not null references inventa.profiles(user_id),
 product_code text not null references inventa.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null check (quantity >= 0),
 client_mutation_id uuid not null unique,
 created_at timestamptz not null default now(),
 unique (slot_id, product_code, lot)
);
alter table inventa.f2_k_slots enable row level security;
alter table inventa.f2_k_actions enable row level security;
alter table inventa.f2_k_events enable row level security;
alter table inventa.f2_k_entries enable row level security;
grant select on inventa.f2_k_slots, inventa.f2_k_events, inventa.f2_k_entries to authenticated;
create policy f2_slots_read on inventa.f2_k_slots for select to authenticated
 using ((select inventa_internal.is_admin()) or ((select inventa_internal.is_enabled()) and operator_id=(select auth.uid())));
create policy f2_events_read on inventa.f2_k_events for select to authenticated
 using ((select inventa_internal.is_admin()) or exists(select 1 from inventa.f2_k_slots s
  where s.id=f2_k_events.slot_id and s.operator_id=(select auth.uid()) and (select inventa_internal.is_enabled())));
create policy f2_entries_read on inventa.f2_k_entries for select to authenticated
 using ((select inventa_internal.is_admin()) or exists(select 1 from inventa.f2_k_slots s
  where s.id=f2_k_entries.slot_id and s.operator_id=(select auth.uid()) and (select inventa_internal.is_enabled())));

create or replace function inventa.f2_k_command(p_mutation_id uuid, p_action text, p_campaign_id uuid, p_location_code text, p_cycle integer, p_operator_id uuid default null, p_reason text default null, p_expected_version bigint default null, p_product_code text default null, p_lot text default '', p_quantity numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_actor uuid := auth.uid(); v_request jsonb; v_old inventa.f2_k_slots%rowtype; v_new inventa.f2_k_slots%rowtype; v_result jsonb; v_existing inventa.f2_k_actions%rowtype; v_role text; v_enabled boolean;
begin
 if v_actor is null or p_mutation_id is null then raise exception 'Unauthenticated or missing mutation ID' using errcode='42501'; end if;
 select role,enabled into v_role,v_enabled from inventa.profiles where user_id=v_actor;
 if not coalesce(v_enabled,false) then raise exception 'Disabled user' using errcode='42501'; end if;
 if p_cycle not in (1,2) or p_location_code !~ '^K[0-9]{2,}[-_]' then raise exception 'Invalid K location or cycle' using errcode='22023'; end if;
 v_request:=jsonb_build_object('action',p_action,'campaign',p_campaign_id,'location',p_location_code,'cycle',p_cycle,'operator',p_operator_id,'reason',p_reason,'version',p_expected_version,'product',p_product_code,'lot',p_lot,'quantity',p_quantity);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_mutation_id::text,0));
 select * into v_existing from inventa.f2_k_actions where mutation_id=p_mutation_id;
 if found then
  if v_existing.actor_id<>v_actor or v_existing.request<>v_request then raise exception 'Idempotency key reused with different request' using errcode='23505'; end if;
  return v_existing.result;
 end if;
 if not exists(select 1 from inventa.campaigns where id=p_campaign_id and status='active') then raise exception 'Campaign not active' using errcode='22023'; end if;
 if not exists(select 1 from inventa.locations where code=p_location_code and enabled) then raise exception 'Location unavailable' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_campaign_id::text||':'||p_location_code,1));
 if p_action='count' then
  select * into v_old from inventa.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=p_cycle and state='in_progress' and operator_id=v_actor for update;
  if not found then raise exception 'Not current counting operator' using errcode='42501'; end if;
  if p_product_code is null or p_quantity is null or p_quantity<0 then raise exception 'Invalid count' using errcode='22023'; end if;
  if not exists(select 1 from inventa.products where code=p_product_code) then raise exception 'Unknown product' using errcode='22023'; end if;
  insert into inventa.f2_k_entries(slot_id,actor_id,product_code,lot,quantity,client_mutation_id) values(v_old.id,v_actor,p_product_code,coalesce(p_lot,''),p_quantity,p_mutation_id);
  v_new:=v_old;
 elsif v_role='admin' and p_action in ('assign','transfer','withdraw','second_count','start','complete') then
  select * into v_old from inventa.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=p_cycle and state in ('pending','in_progress') for update;
  if p_action='assign' then
   if found then raise exception 'Location already assigned' using errcode='23505'; end if;
   if p_operator_id is null or not exists(select 1 from inventa.profiles where user_id=p_operator_id and enabled and role='operator') then raise exception 'Invalid operator' using errcode='22023'; end if;
   if exists(select 1 from inventa.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=p_cycle) then raise exception 'Cycle already exists' using errcode='23505'; end if;
   if p_cycle=2 and not exists(select 1 from inventa.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=1 and state='completed') then raise exception 'First cycle not finished' using errcode='22023'; end if;
   insert into inventa.f2_k_slots(campaign_id,location_code,cycle,operator_id,state,assigned_by) values(p_campaign_id,p_location_code,p_cycle,p_operator_id,'pending',v_actor) returning * into v_new;
  elsif p_action='second_count' then
   if p_cycle<>2 then raise exception 'Second count requires cycle 2' using errcode='22023'; end if;
   if found or exists(select 1 from inventa.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=2) or not exists(select 1 from inventa.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=1 and state='completed') then raise exception 'First count incomplete or second count active' using errcode='22023'; end if;
   if p_operator_id is null or not exists(select 1 from inventa.profiles where user_id=p_operator_id and enabled and role='operator') then raise exception 'Invalid operator' using errcode='22023'; end if;
   insert into inventa.f2_k_slots(campaign_id,location_code,cycle,operator_id,state,assigned_by) values(p_campaign_id,p_location_code,2,p_operator_id,'pending',v_actor) returning * into v_new;
  else
   if not found or p_expected_version is distinct from v_old.version then raise exception 'Stale or missing assignment' using errcode='40001'; end if;
   if p_action='transfer' then
    if p_operator_id is null or p_operator_id=v_old.operator_id or not exists(select 1 from inventa.profiles where user_id=p_operator_id and enabled and role='operator') then raise exception 'Invalid new operator' using errcode='22023'; end if;
    if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Reason required' using errcode='22023'; end if;
    update inventa.f2_k_slots set state='transferred',version=version+1,updated_at=now() where id=v_old.id;
    insert into inventa.f2_k_slots(campaign_id,location_code,cycle,operator_id,state,assigned_by) values(p_campaign_id,p_location_code,p_cycle,p_operator_id,'pending',v_actor) returning * into v_new;
   elsif p_action='withdraw' then
    if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Reason required' using errcode='22023'; end if;
    update inventa.f2_k_slots set state='withdrawn',version=version+1,updated_at=now() where id=v_old.id returning * into v_new;
   elsif p_action in ('start','complete') then
    if (p_action='start' and v_old.state<>'pending') or (p_action='complete' and v_old.state<>'in_progress') then raise exception 'Invalid state transition' using errcode='22023'; end if;
    update inventa.f2_k_slots set state=case when p_action='start' then 'in_progress' else 'completed' end,version=version+1,updated_at=now() where id=v_old.id returning * into v_new;
   end if;
  end if;
 else
  raise exception 'Admin required or unknown command' using errcode='42501';
 end if;
 v_result:=jsonb_build_object('slot_id',v_new.id,'state',v_new.state,'version',v_new.version,'cycle',v_new.cycle,'mutation_id',p_mutation_id);
 insert into inventa.f2_k_actions(mutation_id,actor_id,action,request,result) values(p_mutation_id,v_actor,p_action,v_request,v_result);
 insert into inventa.f2_k_events(mutation_id,slot_id,actor_id,event_type,before_row,after_row,reason) values(p_mutation_id,v_new.id,v_actor,p_action,case when v_old.id is not null then to_jsonb(v_old) end,to_jsonb(v_new),p_reason);
 return v_result;
end;$function$;
revoke all on function inventa.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric) from public,anon;
grant execute on function inventa.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric) to authenticated;

-- Perfil INVENTA de la cuenta propietaria (mismo rol que en el proyecto original)
insert into inventa.profiles(user_id,display_name,role,enabled,permission_reason)
select id, '<nombre-propietario>', 'admin', true, 'Traslado de INVENTA al proyecto unificado'
from auth.users where email='<correo-propietario>'
on conflict (user_id) do nothing;
