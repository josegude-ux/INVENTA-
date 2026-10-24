-- Migración aplicada en Supabase INVENTA · 2026-10-24.
-- INVENTA · Administración de posiciones fijas e informe de existencias BC.
-- Preserva movimientos, recuentos y posiciones existentes.
drop policy if exists fixed_manager_insert on public.fixed_positions;
drop policy if exists fixed_manager_update on public.fixed_positions;
drop policy if exists fixed_admin_insert on public.fixed_positions;
drop policy if exists fixed_admin_update on public.fixed_positions;
drop policy if exists fixed_admin_delete on public.fixed_positions;
create policy fixed_admin_insert on public.fixed_positions
 for insert to authenticated with check ((select internal.is_admin()));
create policy fixed_admin_update on public.fixed_positions
 for update to authenticated using ((select internal.is_admin()))
 with check ((select internal.is_admin()));
create policy fixed_admin_delete on public.fixed_positions
 for delete to authenticated using ((select internal.is_admin()));

create table if not exists public.fixed_position_events (
 id bigint generated always as identity primary key,
 product_code text not null,
 location_code text not null,
 action text not null check (action in ('assigned','unassigned','priority_changed')),
 actor_id uuid references public.profiles(user_id),
 created_at timestamptz not null default now()
);
alter table public.fixed_position_events enable row level security;
revoke all on public.fixed_position_events from anon,authenticated;
grant select on public.fixed_position_events to authenticated;
drop policy if exists fixed_events_admin_read on public.fixed_position_events;
create policy fixed_events_admin_read on public.fixed_position_events
 for select to authenticated using ((select internal.is_admin()));

create or replace function internal.audit_fixed_position_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.fixed_position_events(product_code,location_code,action,actor_id)
  values(new.product_code,new.location_code,'assigned',auth.uid());
  return new;
 elsif tg_op='DELETE' then
  insert into public.fixed_position_events(product_code,location_code,action,actor_id)
  values(old.product_code,old.location_code,'unassigned',auth.uid());
  return old;
 elsif new.priority is distinct from old.priority then
  insert into public.fixed_position_events(product_code,location_code,action,actor_id)
  values(new.product_code,new.location_code,'priority_changed',auth.uid());
 end if;
 return new;
end;
$$;
drop trigger if exists audit_fixed_position_change_trg on public.fixed_positions;
create trigger audit_fixed_position_change_trg
 after insert or update or delete on public.fixed_positions
 for each row execute function internal.audit_fixed_position_change();

create or replace function public.admin_fixed_positions_report()
returns table(product_code text,product_description text,unit text,
 location_code text,aisle text,priority integer,stock_quantity numeric,assigned_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.is_admin() then
  raise exception 'Solo Administración puede consultar este informe'
   using errcode='42501';
 end if;
 return query
 select f.product_code,p.description,p.unit,f.location_code,l.aisle,
        f.priority,coalesce(bc.qty,0::numeric),f.created_at
 from public.fixed_positions f
 join public.products p on p.code=f.product_code
 join public.locations l on l.code=f.location_code
 left join public.bc_import_current cur on cur.singleton=true
 left join lateral (
   select sum(line.quantity) as qty
   from public.bc_import_lines line
   where line.import_id=cur.import_id and line.product_code=f.product_code
    and line.location_code=f.location_code
 ) bc on true
 order by f.location_code,f.priority,f.product_code;
end;
$$;
revoke all on function public.admin_fixed_positions_report() from public,anon;
grant execute on function public.admin_fixed_positions_report() to authenticated;

