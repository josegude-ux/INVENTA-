-- Exact SQL from applied Supabase migration

drop policy if exists stock_manager_insert on public.stock_snapshot;
drop policy if exists stock_manager_update on public.stock_snapshot;
create policy stock_admin_insert on public.stock_snapshot for insert to authenticated
 with check ((select internal.is_admin()));
create policy stock_admin_update on public.stock_snapshot for update to authenticated
 using ((select internal.is_admin())) with check ((select internal.is_admin()));
create or replace function internal.guard_correction() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prior public.counts;
begin
 if jsonb_typeof(new.entries)<>'array' then raise exception 'Count entries must be a JSON array'; end if;
 if new.previous_id is not null then
   select * into prior from public.counts where id=new.previous_id;
   if not found then raise exception 'Original count not found'; end if;
   if prior.campaign_id<>new.campaign_id or prior.location_code<>new.location_code
      or prior.product_code<>new.product_code or prior.lot<>new.lot
   then raise exception 'Correction must refer to the same campaign, location, product and lot'; end if;
 end if;
 return new;
end; $$;
revoke execute on function internal.guard_correction() from public, anon, authenticated;
create trigger counts_correction_guard before insert on public.counts for each row execute function internal.guard_correction();
create or replace function internal.guard_campaign_status() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.status='closed' and new.status<>old.status then raise exception 'Closed campaigns cannot be reopened'; end if;
 if old.status='active' and new.status='draft' then raise exception 'Active campaigns cannot return to draft'; end if;
 return new;
end; $$;
revoke execute on function internal.guard_campaign_status() from public, anon, authenticated;
create trigger guard_campaign_transition before update of status on public.campaigns for each row execute function internal.guard_campaign_status();

