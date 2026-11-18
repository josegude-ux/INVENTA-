-- INVENTA · Fase B · Tramos de inventario.
-- Un tramo es un rango de ubicaciones (por ejemplo K00-P01 → K09-P08) dentro de
-- una campaña, asignado en un solo paso a una o dos personas (pareja).
--
-- ESTADO: PROPUESTA. NO aplicada en el proyecto Supabase real.
-- Solo se ha ejecutado en PostgreSQL 16 efímero (tests/tramos-lab).
--
-- Compatibilidad: cada tramo genera las filas de public.assignments que ya usan
-- la RLS de counts y la pantalla «Recuento real · individual». Nada se borra:
-- liberar o reasignar un tramo desactiva filas (active=false) y queda auditado.

-- 1. Orden natural de códigos: K2-P1 va antes que K10-P1 aunque falten ceros.
create or replace function internal.location_sort_key(p_code text) returns text
language sql immutable parallel safe set search_path='' as $$
 select coalesce(string_agg(
   case when t.m[1] ~ '^[0-9]+$'
     then lpad(coalesce(nullif(ltrim(t.m[1],'0'),''),'0'),
               greatest(12,length(coalesce(nullif(ltrim(t.m[1],'0'),''),'0'))),'0')
     else upper(t.m[1]) end,
   '' order by t.n),'')
 from regexp_matches(coalesce(p_code,''),'([0-9]+|[^0-9]+)','g') with ordinality as t(m,n);
$$;

-- Formato de un código: letras y separadores fijos, cada grupo de cifras es «#».
-- K00-P01 y K9-P8 tienen el mismo formato (K#-P#); K00-P01-A no.
create or replace function internal.location_shape(p_code text) returns text
language sql immutable parallel safe set search_path='' as $$
 select regexp_replace(upper(coalesce(p_code,'')),'[0-9]+','#','g');
$$;
revoke all on function internal.location_sort_key(text) from public,anon,authenticated;
revoke all on function internal.location_shape(text) from public,anon,authenticated;

-- 2. Tablas.
create table public.segments (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id),
 from_code text not null references public.locations(code),
 to_code text not null references public.locations(code),
 operator_id uuid not null references public.profiles(user_id),
 partner_id uuid references public.profiles(user_id),
 status text not null default 'active' check (status in ('active','released')),
 version bigint not null default 0,
 created_by uuid not null references public.profiles(user_id),
 created_at timestamptz not null default now(),
 last_change_reason text,
 released_at timestamptz,
 released_by uuid references public.profiles(user_id),
 constraint segment_distinct_people check (partner_id is null or partner_id<>operator_id),
 constraint segment_release_consistent check ((status='released')=(released_at is not null))
);
create index segments_campaign on public.segments(campaign_id,status);
create index segments_people on public.segments(operator_id,partner_id);

create table public.segment_locations (
 segment_id uuid not null references public.segments(id),
 campaign_id uuid not null references public.campaigns(id),
 location_code text not null references public.locations(code),
 position int not null check (position>=1),
 active boolean not null default true,
 primary key (segment_id,location_code)
);
-- Una ubicación no puede estar en dos tramos activos de la misma campaña.
create unique index segment_location_single_active
 on public.segment_locations(campaign_id,location_code) where active;

alter table public.assignments add column segment_id uuid references public.segments(id);
alter table public.assignments add column active boolean not null default true;
create index assignment_segment on public.assignments(segment_id);

create trigger audit_segments after insert or update on public.segments
 for each row execute function internal.record_audit();

-- 3. Permisos de tabla: lectura con RLS; escritura solo mediante las funciones.
alter table public.segments enable row level security;
alter table public.segment_locations enable row level security;
revoke all on public.segments,public.segment_locations from anon,authenticated;
grant select on public.segments,public.segment_locations to authenticated;

create policy segments_read on public.segments for select to authenticated using (
 (select internal.is_manager())
 or ((select internal.is_enabled()) and (operator_id=(select auth.uid()) or partner_id=(select auth.uid())))
);
create policy segment_locations_read on public.segment_locations for select to authenticated using (
 (select internal.is_manager())
 or ((select internal.is_enabled()) and exists(select 1 from public.segments s where s.id=segment_id
     and (s.operator_id=(select auth.uid()) or s.partner_id=(select auth.uid()))))
);

-- Las asignaciones ya no se crean a mano ni se cambian de ubicación/persona:
-- solo el estado es editable por Supervisor/Administrador.
drop policy if exists assignments_manager_insert on public.assignments;
revoke insert, update on public.assignments from authenticated;
grant update (status) on public.assignments to authenticated;

-- Una asignación desactivada (tramo liberado o reasignado) ya no permite contar.
drop policy if exists counts_insert on public.counts;
create policy counts_insert on public.counts for insert to authenticated with check (
 actor_id=(select auth.uid()) and (select internal.is_enabled())
 and exists(select 1 from public.campaigns c where c.id=campaign_id and c.status='active')
 and ( (select internal.is_manager()) or exists(select 1 from public.assignments a
   where a.campaign_id=counts.campaign_id and a.location_code=counts.location_code
   and a.operator_id=(select auth.uid()) and a.active) )
);

-- 4. Cálculo del rango (interno, sin control de permisos: lo hacen las funciones públicas).
create or replace function internal.segment_plan(p_campaign uuid,p_from text,p_to text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_from text; v_to text; v_shape text; v_kfrom text; v_kto text; v_status text;
 v_codes text[]; v_excluded text[]; v_disabled int; v_conflicts jsonb; v_conflict_count int;
begin
 select status into v_status from public.campaigns where id=p_campaign;
 if v_status is null then raise exception 'La campaña no existe' using errcode='P0001'; end if;
 if v_status='closed' then raise exception 'La campaña está cerrada' using errcode='P0001'; end if;

 select code into v_from from public.locations where upper(code)=upper(trim(coalesce(p_from,'')));
 if v_from is null then raise exception 'No existe la ubicación inicial «%»',trim(coalesce(p_from,'')) using errcode='P0001'; end if;
 select code into v_to from public.locations where upper(code)=upper(trim(coalesce(p_to,'')));
 if v_to is null then raise exception 'No existe la ubicación final «%»',trim(coalesce(p_to,'')) using errcode='P0001'; end if;

 v_shape=internal.location_shape(v_from);
 if v_shape<>internal.location_shape(v_to) then
  raise exception 'Desde y hasta deben tener el mismo formato (% frente a %)',v_from,v_to using errcode='P0001'; end if;
 v_kfrom=internal.location_sort_key(v_from); v_kto=internal.location_sort_key(v_to);
 if v_kfrom collate "C" > v_kto collate "C" then
  raise exception 'La ubicación inicial % va después de la final %',v_from,v_to using errcode='P0001'; end if;

 with r as (
  select l.code,l.enabled,internal.location_shape(l.code)=v_shape as same_shape,
         internal.location_sort_key(l.code) as k
  from public.locations l
  where (internal.location_sort_key(l.code) collate "C") >= (v_kfrom collate "C")
    and (internal.location_sort_key(l.code) collate "C") <= (v_kto collate "C")
 )
 select
  coalesce(array_agg(code order by k collate "C",code) filter (where same_shape and enabled),'{}'),
  coalesce(array_agg(code order by k collate "C",code) filter (where not same_shape),'{}'),
  count(*) filter (where same_shape and not enabled)
 into v_codes,v_excluded,v_disabled from r;

 select count(*),coalesce(jsonb_agg(x order by x->>'location_code') filter (where n<=50),'[]'::jsonb)
 into v_conflict_count,v_conflicts from (
  select jsonb_build_object('location_code',a.location_code,
          'people',string_agg(coalesce(nullif(p.display_name,''),'Sin nombre'),' + ' order by p.display_name)) as x,
         row_number() over (order by a.location_code) as n
  from public.assignments a join public.profiles p on p.user_id=a.operator_id
  where a.campaign_id=p_campaign and a.active and a.location_code=any(v_codes)
  group by a.location_code
  union all
  select jsonb_build_object('location_code',sl.location_code,'people','Tramo activo'),
         row_number() over (order by sl.location_code)
  from public.segment_locations sl
  where sl.campaign_id=p_campaign and sl.active and sl.location_code=any(v_codes)
    and not exists(select 1 from public.assignments a where a.campaign_id=p_campaign and a.active
                   and a.location_code=sl.location_code)
 ) c;

 return jsonb_build_object(
  'campaign_id',p_campaign,'from',v_from,'to',v_to,'shape',v_shape,
  'total',coalesce(array_length(v_codes,1),0),
  'first',v_codes[1],'last',v_codes[array_length(v_codes,1)],
  'codes',to_jsonb(v_codes),
  'excluded_format',jsonb_build_object('count',coalesce(array_length(v_excluded,1),0),'codes',to_jsonb(v_excluded[1:50])),
  'disabled',v_disabled,
  'conflicts',jsonb_build_object('count',v_conflict_count,'items',v_conflicts),
  'fingerprint',md5(array_to_string(v_codes,chr(31)))
 );
end; $$;
revoke all on function internal.segment_plan(uuid,text,text) from public,anon,authenticated;

create or replace function internal.require_person(p_user uuid,p_label text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.user_id
   where p.user_id=p_user and p.enabled and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then
  raise exception '% no es una cuenta habilitada',p_label using errcode='P0001'; end if;
end; $$;
revoke all on function internal.require_person(uuid,text) from public,anon,authenticated;

-- Activa (o reactiva) la asignación de una persona para todas las ubicaciones del tramo.
create or replace function internal.segment_enable_person(p_segment uuid,p_user uuid) returns void
language sql security definer set search_path='' as $$
 insert into public.assignments(campaign_id,location_code,operator_id,assigned_by,segment_id,active)
 select sl.campaign_id,sl.location_code,p_user,(select auth.uid()),sl.segment_id,true
 from public.segment_locations sl where sl.segment_id=p_segment and sl.active
 on conflict (campaign_id,location_code,operator_id)
 do update set active=true,segment_id=excluded.segment_id,assigned_by=excluded.assigned_by;
$$;
revoke all on function internal.segment_enable_person(uuid,uuid) from public,anon,authenticated;

-- 5. Funciones públicas (RPC). Todas exigen Supervisor o Administrador.
create or replace function public.preview_segment(p_campaign uuid,p_from text,p_to text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare plan jsonb;
begin
 if not (select internal.is_manager()) then raise exception 'Solo Supervisor o Administrador' using errcode='42501'; end if;
 plan=internal.segment_plan(p_campaign,p_from,p_to);
 -- La lista completa solo hace falta en servidor; al navegador van muestras.
 return (plan - 'codes') || jsonb_build_object('sample',
   (select coalesce(jsonb_agg(c),'[]'::jsonb) from (select jsonb_array_elements_text(plan->'codes') c limit 12) s));
end; $$;

create or replace function public.assign_segment(p_campaign uuid,p_from text,p_to text,
 p_operator uuid,p_partner uuid,p_fingerprint text)
returns uuid language plpgsql security definer set search_path='' as $$
declare plan jsonb; v_id uuid;
begin
 if not (select internal.is_manager()) then raise exception 'Solo Supervisor o Administrador' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('inventa-segments:'||p_campaign::text,0));
 if p_operator is null then raise exception 'Falta la persona responsable del tramo' using errcode='P0001'; end if;
 if p_partner is not null and p_partner=p_operator then
  raise exception 'La pareja debe ser otra persona' using errcode='P0001'; end if;
 perform internal.require_person(p_operator,'La persona 1');
 if p_partner is not null then perform internal.require_person(p_partner,'La persona 2'); end if;

 plan=internal.segment_plan(p_campaign,p_from,p_to);
 if (plan->>'total')::int=0 then raise exception 'El tramo no contiene ubicaciones habilitadas' using errcode='P0001'; end if;
 if (plan->'conflicts'->>'count')::int>0 then
  raise exception '% ubicaciones ya están asignadas en esta campaña (primera: %)',
   plan->'conflicts'->>'count',plan->'conflicts'->'items'->0->>'location_code' using errcode='P0001'; end if;
 if p_fingerprint is distinct from plan->>'fingerprint' then
  raise exception 'Las ubicaciones del tramo han cambiado desde la vista previa. Vuelve a revisarla.' using errcode='40001'; end if;

 insert into public.segments(campaign_id,from_code,to_code,operator_id,partner_id,created_by)
 values(p_campaign,plan->>'from',plan->>'to',p_operator,p_partner,(select auth.uid()))
 returning id into v_id;
 insert into public.segment_locations(segment_id,campaign_id,location_code,position)
 select v_id,p_campaign,c,n::int from jsonb_array_elements_text(plan->'codes') with ordinality as t(c,n);
 perform internal.segment_enable_person(v_id,p_operator);
 if p_partner is not null then perform internal.segment_enable_person(v_id,p_partner); end if;
 return v_id;
end; $$;

create or replace function public.reassign_segment(p_segment uuid,p_operator uuid,p_partner uuid,
 p_reason text,p_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare s public.segments;
begin
 if not (select internal.is_manager()) then raise exception 'Solo Supervisor o Administrador' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Explica el motivo con al menos cinco caracteres' using errcode='P0001'; end if;
 select * into s from public.segments where id=p_segment for update;
 if not found then raise exception 'El tramo no existe' using errcode='P0001'; end if;
 if s.status<>'active' then raise exception 'El tramo ya está liberado' using errcode='P0001'; end if;
 if s.version<>p_version then raise exception 'El tramo cambió en otro dispositivo. Recarga y revisa.' using errcode='40001'; end if;
 if exists(select 1 from public.campaigns c where c.id=s.campaign_id and c.status='closed') then
  raise exception 'La campaña está cerrada' using errcode='P0001'; end if;
 if p_operator is null then raise exception 'Falta la persona responsable del tramo' using errcode='P0001'; end if;
 if p_partner is not null and p_partner=p_operator then raise exception 'La pareja debe ser otra persona' using errcode='P0001'; end if;
 perform internal.require_person(p_operator,'La persona 1');
 if p_partner is not null then perform internal.require_person(p_partner,'La persona 2'); end if;

 update public.assignments set active=false
  where segment_id=p_segment and active and operator_id is distinct from p_operator
    and operator_id is distinct from p_partner;
 perform internal.segment_enable_person(p_segment,p_operator);
 if p_partner is not null then perform internal.segment_enable_person(p_segment,p_partner); end if;
 update public.segments set operator_id=p_operator,partner_id=p_partner,
  last_change_reason=trim(p_reason),version=version+1 where id=p_segment;
 return s.version+1;
end; $$;

create or replace function public.release_segment(p_segment uuid,p_reason text,p_version bigint)
returns void language plpgsql security definer set search_path='' as $$
declare s public.segments;
begin
 if not (select internal.is_manager()) then raise exception 'Solo Supervisor o Administrador' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Explica el motivo con al menos cinco caracteres' using errcode='P0001'; end if;
 select * into s from public.segments where id=p_segment for update;
 if not found then raise exception 'El tramo no existe' using errcode='P0001'; end if;
 if s.status<>'active' then raise exception 'El tramo ya está liberado' using errcode='P0001'; end if;
 if s.version<>p_version then raise exception 'El tramo cambió en otro dispositivo. Recarga y revisa.' using errcode='40001'; end if;
 update public.segment_locations set active=false where segment_id=p_segment and active;
 update public.assignments set active=false where segment_id=p_segment and active;
 update public.segments set status='released',released_at=now(),released_by=(select auth.uid()),
  last_change_reason=trim(p_reason),version=version+1 where id=p_segment;
end; $$;

-- Seguimiento: avance por tramo sin cantidades (ni contadas ni teóricas).
create or replace function public.list_segments(p_campaign uuid)
returns table(id uuid,campaign_id uuid,from_code text,to_code text,operator_id uuid,operator_name text,
 partner_id uuid,partner_name text,status text,version bigint,total int,counted int,
 created_at timestamptz,released_at timestamptz,last_change_reason text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (select internal.is_manager()) then raise exception 'Solo Supervisor o Administrador' using errcode='42501'; end if;
 return query
 select s.id,s.campaign_id,s.from_code,s.to_code,s.operator_id,po.display_name,s.partner_id,pp.display_name,
  s.status,s.version,
  (select count(*)::int from public.segment_locations sl where sl.segment_id=s.id),
  (select count(*)::int from public.segment_locations sl where sl.segment_id=s.id
     and exists(select 1 from public.counts c where c.campaign_id=s.campaign_id and c.location_code=sl.location_code)),
  s.created_at,s.released_at,s.last_change_reason
 from public.segments s
 join public.profiles po on po.user_id=s.operator_id
 left join public.profiles pp on pp.user_id=s.partner_id
 where s.campaign_id=p_campaign
 order by (s.status='active') desc,internal.location_sort_key(s.from_code) collate "C",s.created_at;
end; $$;

revoke all on function public.preview_segment(uuid,text,text) from public,anon;
revoke all on function public.assign_segment(uuid,text,text,uuid,uuid,text) from public,anon;
revoke all on function public.reassign_segment(uuid,uuid,uuid,text,bigint) from public,anon;
revoke all on function public.release_segment(uuid,text,bigint) from public,anon;
revoke all on function public.list_segments(uuid) from public,anon;
grant execute on function public.preview_segment(uuid,text,text) to authenticated;
grant execute on function public.assign_segment(uuid,text,text,uuid,uuid,text) to authenticated;
grant execute on function public.reassign_segment(uuid,uuid,uuid,text,bigint) to authenticated;
grant execute on function public.release_segment(uuid,text,bigint) to authenticated;
grant execute on function public.list_segments(uuid) to authenticated;
