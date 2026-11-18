-- PROPUESTA PARA 000 · NO APLICAR SIN DECISIÓN DE 000 Y «AUTORIZO».
-- Retirada de F2 tramos K (CP012) del proyecto Supabase INVENTA wlejxnpphysogrzcxjfh.
-- Motivo: tablas vacías, fuera del historial de migraciones y de main; función
-- f2_k_command ejecutable por usuarios autenticados sin uso en la app publicada.
-- Sus ideas útiles (segundo recuento, idempotencia) están en INVENTA 0.30.14.
-- Antes: guardar en Drive el DDL de F2 (rama feature/f2-tramos-k-inventa-integracion-20261111).
-- Se niega a ejecutarse si alguna tabla f2_k_* tiene filas.
begin;
do $$ begin
 if exists(select 1 from public.f2_k_slots) or exists(select 1 from public.f2_k_actions)
    or exists(select 1 from public.f2_k_events) or exists(select 1 from public.f2_k_entries) then
  raise exception 'Retirada bloqueada: hay datos en f2_k_*. Exportar y decidir antes.';
 end if;
end $$;
drop function public.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric);
drop table public.f2_k_entries;
drop table public.f2_k_events;
drop table public.f2_k_actions;
drop table public.f2_k_slots;
commit;
