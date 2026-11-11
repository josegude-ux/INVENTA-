
-- F2 Tramos K isolated schema extension; no changes to legacy assignments/counts.
create table if not exists public.f2_k_slots (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id),
 location_code text not null references public.locations(code),
 cycle integer not null check(cycle between 1 and 2),
 operator_id uuid not null references public.profiles(user_id),
 state text not null check(state in ('pending','in_progress','completed','withdrawn','transferred')),
 version bigint not null default 1,
 assigned_by uuid not null references public.profiles(user_id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists f2_k_one_active_slot on public.f2_k_slots(campaign_id,location_code,cycle) where state in ('pending','in_progress');
create table if not exists public.f2_k_actions (
 mutation_id uuid primary key,
 actor_id uuid not null references public.profiles(user_id),
 action text not null,
 request jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
create table if not exists public.f2_k_events (
 id bigint generated always as identity primary key,
 mutation_id uuid not null references public.f2_k_actions(mutation_id),
 slot_id uuid not null references public.f2_k_slots(id),
 actor_id uuid not null references public.profiles(user_id),
 event_type text not null,
 before_row jsonb,
 after_row jsonb,
 reason text,
 created_at timestamptz not null default now()
);
create table if not exists public.f2_k_entries (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.f2_k_slots(id),
 actor_id uuid not null references public.profiles(user_id),
 product_code text not null references public.products(code),
 lot text not null default '',
 quantity numeric(16,3) not null check(quantity>=0),
 client_mutation_id uuid not null unique,
 created_at timestamptz not null default now(),
 unique(slot_id,product_code,lot)
);
alter table public.f2_k_slots enable row level security;
alter table public.f2_k_actions enable row level security;
alter table public.f2_k_events enable row level security;
alter table public.f2_k_entries enable row level security;
revoke all on public.f2_k_slots,public.f2_k_actions,public.f2_k_events,public.f2_k_entries from anon,authenticated;
grant select on public.f2_k_slots,public.f2_k_events,public.f2_k_entries to authenticated;
create policy f2_slots_read on public.f2_k_slots for select to authenticated using ((select internal.is_admin()) or ((select internal.is_enabled()) and operator_id=(select auth.uid())));
create policy f2_events_read on public.f2_k_events for select to authenticated using ((select internal.is_admin()) or exists(select 1 from public.f2_k_slots s where s.id=slot_id and s.operator_id=(select auth.uid()) and (select internal.is_enabled())));
create policy f2_entries_read on public.f2_k_entries for select to authenticated using ((select internal.is_admin()) or exists(select 1 from public.f2_k_slots s where s.id=slot_id and s.operator_id=(select auth.uid()) and (select internal.is_enabled())));
-- Do not expose action ledger; only RPC can access it.
create or replace function public.f2_k_command(p_mutation_id uuid,p_action text,p_campaign_id uuid,p_location_code text,p_cycle integer,p_operator_id uuid default null,p_reason text default null,p_expected_version bigint default null,p_product_code text default null,p_lot text default '',p_quantity numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_request jsonb; v_old public.f2_k_slots%rowtype; v_new public.f2_k_slots%rowtype; v_result jsonb; v_existing public.f2_k_actions%rowtype; v_role text; v_enabled boolean; v_previous integer;
begin
 if v_actor is null or p_mutation_id is null then raise exception 'Unauthenticated or missing mutation ID' using errcode='42501'; end if;
 select role,enabled into v_role,v_enabled from public.profiles where user_id=v_actor;
 if not coalesce(v_enabled,false) then raise exception 'Disabled user' using errcode='42501'; end if;
 if p_cycle not in (1,2) or p_location_code !~ '^K[0-9]{2,}[-_]' then raise exception 'Invalid K location or cycle' using errcode='22023'; end if;
 v_request:=jsonb_build_object('action',p_action,'campaign',p_campaign_id,'location',p_location_code,'cycle',p_cycle,'operator',p_operator_id,'reason',p_reason,'version',p_expected_version,'product',p_product_code,'lot',p_lot,'quantity',p_quantity);
 -- Serialize same idempotency key, including concurrent requests.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_mutation_id::text,0));
 select * into v_existing from public.f2_k_actions where mutation_id=p_mutation_id;
 if found then
  if v_existing.actor_id<>v_actor or v_existing.request<>v_request then raise exception 'Idempotency key reused with different request' using errcode='23505'; end if;
  return v_existing.result;
 end if;
 if not exists(select 1 from public.campaigns where id=p_campaign_id and status='active') then raise exception 'Campaign not active' using errcode='22023'; end if;
 if not exists(select 1 from public.locations where code=p_location_code and enabled) then raise exception 'Location unavailable' using errcode='22023'; end if;
 -- Serialize all commands on the same location, across both cycles.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_campaign_id::text||':'||p_location_code,1));
 if p_action='count' then
  select * into v_old from public.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=p_cycle and state='in_progress' and operator_id=v_actor for update;
  if not found then raise exception 'Not current counting operator' using errcode='42501'; end if;
  if p_product_code is null or p_quantity is null or p_quantity<0 then raise exception 'Invalid count' using errcode='22023'; end if;
  if not exists(select 1 from public.products where code=p_product_code) then raise exception 'Unknown product' using errcode='22023'; end if;
  insert into public.f2_k_entries(slot_id,actor_id,product_code,lot,quantity,client_mutation_id) values(v_old.id,v_actor,p_product_code,coalesce(p_lot,''),p_quantity,p_mutation_id);
  v_new:=v_old;
 elsif v_role='admin' and p_action in ('assign','transfer','withdraw','second_count','start','complete') then
  select * into v_old from public.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=p_cycle and state in ('pending','in_progress') for update;
  if p_action='assign' then
   if found then raise exception 'Location already assigned' using errcode='23505'; end if;
   if p_operator_id is null or not exists(select 1 from public.profiles where user_id=p_operator_id and enabled and role='operator') then raise exception 'Invalid operator' using errcode='22023'; end if;
   if exists(select 1 from public.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=p_cycle) then raise exception 'Cycle already exists' using errcode='23505'; end if;
   if p_cycle=2 and not exists(select 1 from public.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=1 and state='completed') then raise exception 'First cycle not finished' using errcode='22023'; end if;
   insert into public.f2_k_slots(campaign_id,location_code,cycle,operator_id,state,assigned_by) values(p_campaign_id,p_location_code,p_cycle,p_operator_id,'pending',v_actor) returning * into v_new;
  elsif p_action='second_count' then
   if p_cycle<>2 then raise exception 'Second count requires cycle 2' using errcode='22023'; end if;
   if found or exists(select 1 from public.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=2) or not exists(select 1 from public.f2_k_slots where campaign_id=p_campaign_id and location_code=p_location_code and cycle=1 and state='completed') then raise exception 'First count incomplete or second count active' using errcode='22023'; end if;
   if p_operator_id is null or not exists(select 1 from public.profiles where user_id=p_operator_id and enabled and role='operator') then raise exception 'Invalid operator' using errcode='22023'; end if;
   insert into public.f2_k_slots(campaign_id,location_code,cycle,operator_id,state,assigned_by) values(p_campaign_id,p_location_code,2,p_operator_id,'pending',v_actor) returning * into v_new;
  else
   if not found or p_expected_version is distinct from v_old.version then raise exception 'Stale or missing assignment' using errcode='40001'; end if;
   if p_action='transfer' then
    if p_operator_id is null or p_operator_id=v_old.operator_id or not exists(select 1 from public.profiles where user_id=p_operator_id and enabled and role='operator') then raise exception 'Invalid new operator' using errcode='22023'; end if;
    if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Reason required' using errcode='22023'; end if;
    update public.f2_k_slots set state='transferred',version=version+1,updated_at=now() where id=v_old.id;
    insert into public.f2_k_slots(campaign_id,location_code,cycle,operator_id,state,assigned_by) values(p_campaign_id,p_location_code,p_cycle,p_operator_id,'pending',v_actor) returning * into v_new;
   elsif p_action='withdraw' then
    if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Reason required' using errcode='22023'; end if;
    update public.f2_k_slots set state='withdrawn',version=version+1,updated_at=now() where id=v_old.id returning * into v_new;
   elsif p_action in ('start','complete') then
    if (p_action='start' and v_old.state<>'pending') or (p_action='complete' and v_old.state<>'in_progress') then raise exception 'Invalid state transition' using errcode='22023'; end if;
    update public.f2_k_slots set state=case when p_action='start' then 'in_progress' else 'completed' end,version=version+1,updated_at=now() where id=v_old.id returning * into v_new;
   end if;
  end if;
 else
  raise exception 'Admin required or unknown command' using errcode='42501';
 end if;
 v_result:=jsonb_build_object('slot_id',v_new.id,'state',v_new.state,'version',v_new.version,'cycle',v_new.cycle,'mutation_id',p_mutation_id);
 insert into public.f2_k_actions(mutation_id,actor_id,action,request,result) values(p_mutation_id,v_actor,p_action,v_request,v_result);
 insert into public.f2_k_events(mutation_id,slot_id,actor_id,event_type,before_row,after_row,reason) values(p_mutation_id,v_new.id,v_actor,p_action,case when v_old.id is not null then to_jsonb(v_old) end,to_jsonb(v_new),p_reason);
 return v_result;
end;$$;
revoke all on function public.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric) from public,anon;
grant execute on function public.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric) to authenticated;
