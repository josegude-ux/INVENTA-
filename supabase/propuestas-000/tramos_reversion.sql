-- PROPUESTA PARA 000 · NO APLICAR SIN DECISIÓN DE 000 Y «AUTORIZO».
-- Reversión de 20261117220000_inventa_fase_b_tramos.sql (INVENTA 0.30.14).
-- Deja assignments/counts como en 0.30.12. Se niega a ejecutarse si ya hay tramos,
-- órdenes o recuentos de segundo ciclo (habría que exportarlos antes a Drive).
begin;
do $$ begin
 if exists(select 1 from public.segments) or exists(select 1 from public.segment_actions)
    or exists(select 1 from public.counts where cycle<>1) then
  raise exception 'Reversión bloqueada: hay tramos o recuentos de segundo ciclo. Exportar y decidir antes.';
 end if;
end $$;

drop function public.list_segments(uuid);
drop function public.release_segment(uuid,uuid,text,bigint);
drop function public.reassign_segment(uuid,uuid,uuid,uuid,text,bigint);
drop function public.assign_segment(uuid,uuid,text,text,smallint,uuid,uuid,text);
drop function public.preview_segment(uuid,text,text,smallint);
drop function internal.segment_action_save(uuid,text,jsonb,jsonb);
drop function internal.segment_action_replay(uuid,text,jsonb);
drop function internal.segment_enable_person(uuid,uuid);
drop function internal.require_blind(uuid,text[],uuid[]);
drop function internal.require_person(uuid,text);
drop function internal.segment_plan(uuid,text,text,smallint);

drop trigger counts_set_cycle on public.counts;
drop function internal.counts_set_cycle();
drop index public.counts_campaign_location_cycle;
alter table public.counts drop column cycle;

-- Política de recuento original de 0.30.12 (sin exigir asignación activa).
drop policy counts_insert on public.counts;
create policy counts_insert on public.counts for insert to authenticated with check (
 actor_id=(select auth.uid()) and (select internal.is_enabled())
 and exists(select 1 from public.campaigns c where c.id=campaign_id and c.status='active')
 and ( (select internal.is_manager()) or exists(select 1 from public.assignments a where a.campaign_id=counts.campaign_id and a.location_code=counts.location_code and a.operator_id=(select auth.uid())) )
);

drop index public.assignment_segment;
alter table public.assignments drop column active;
alter table public.assignments drop column segment_id;
-- Permisos originales de asignaciones.
grant insert, update on public.assignments to authenticated;
create policy assignments_manager_insert on public.assignments for insert to authenticated
 with check ((select internal.is_manager()) and assigned_by=(select auth.uid()));

drop table public.segment_actions;
drop table public.segment_locations;
drop table public.segments;
drop function internal.location_shape(text);
drop function internal.location_sort_key(text);
commit;
