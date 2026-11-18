-- PROPUESTA PARA 000 · NO APLICAR SIN DECISIÓN DE 000 Y «AUTORIZO».
-- Reversión de 20261118140000_inventa_tramos.sql (INVENTA 0.32.0, esquema inventa).
-- Deja inventa.assignments/inventa.counts como en la unificación 0.31.x. Se niega a ejecutarse si ya hay tramos,
-- órdenes o recuentos de segundo ciclo (habría que exportarlos antes a Drive).
begin;
do $$ begin
 if exists(select 1 from inventa.segments) or exists(select 1 from inventa.segment_actions)
    or exists(select 1 from inventa.counts where cycle<>1) then
  raise exception 'Reversión bloqueada: hay tramos o recuentos de segundo ciclo. Exportar y decidir antes.';
 end if;
end $$;

drop function inventa.list_segments(uuid);
drop function inventa.release_segment(uuid,uuid,text,bigint);
drop function inventa.reassign_segment(uuid,uuid,uuid,uuid,text,bigint);
drop function inventa.assign_segment(uuid,uuid,text,text,smallint,uuid,uuid,text);
drop function inventa.preview_segment(uuid,text,text,smallint);
drop function inventa_internal.segment_action_save(uuid,text,jsonb,jsonb);
drop function inventa_internal.segment_action_replay(uuid,text,jsonb);
drop function inventa_internal.segment_enable_person(uuid,uuid);
drop function inventa_internal.require_blind(uuid,text[],uuid[]);
drop function inventa_internal.require_person(uuid,text);
drop function inventa_internal.segment_plan(uuid,text,text,smallint);

drop trigger counts_set_cycle on inventa.counts;
drop function inventa_internal.counts_set_cycle();
drop index inventa.counts_campaign_location_cycle;
alter table inventa.counts drop column cycle;

-- Política de recuento original de la unificación 0.31.x (sin exigir asignación activa).
drop policy counts_insert on inventa.counts;
create policy counts_insert on inventa.counts for insert to authenticated with check (
 actor_id=(select auth.uid()) and (select inventa_internal.is_enabled())
 and exists(select 1 from inventa.campaigns c where c.id=campaign_id and c.status='active')
 and ( (select inventa_internal.is_manager()) or exists(select 1 from inventa.assignments a where a.campaign_id=counts.campaign_id and a.location_code=counts.location_code and a.operator_id=(select auth.uid())) )
);

drop index inventa.assignment_segment;
alter table inventa.assignments drop column active;
alter table inventa.assignments drop column segment_id;
-- Permisos originales de asignaciones.
grant insert, update on inventa.assignments to authenticated;
create policy assignments_manager_insert on inventa.assignments for insert to authenticated
 with check ((select inventa_internal.is_manager()) and assigned_by=(select auth.uid()));

drop table inventa.segment_actions;
drop table inventa.segment_locations;
drop table inventa.segments;
drop function inventa_internal.location_shape(text);
drop function inventa_internal.location_sort_key(text);
commit;
