-- VISURA 000 · D1: retirada de F2 (tablas f2_k_* y f2_k_command) del esquema inventa.
-- Se niega a continuar si cualquiera de las tablas tiene filas. Sin CASCADE: si apareciera
-- una dependencia no prevista, falla y no borra nada.
lock table inventa.f2_k_entries, inventa.f2_k_events, inventa.f2_k_actions, inventa.f2_k_slots in access exclusive mode;
do $$
begin
  if exists(select 1 from inventa.f2_k_slots) or exists(select 1 from inventa.f2_k_actions)
     or exists(select 1 from inventa.f2_k_events) or exists(select 1 from inventa.f2_k_entries) then
    raise exception 'F2 tiene datos: retirada cancelada sin cambios';
  end if;
end $$;
drop function inventa.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric);
drop table inventa.f2_k_entries;
drop table inventa.f2_k_events;
drop table inventa.f2_k_actions;
drop table inventa.f2_k_slots;
