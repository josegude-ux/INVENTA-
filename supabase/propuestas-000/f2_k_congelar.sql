-- PROPUESTA PARA 000 · ALTERNATIVA a la retirada: conservar F2 sin uso posible.
-- Quita la ejecución de f2_k_command a usuarios autenticados; tablas y datos se conservan.
revoke execute on function public.f2_k_command(uuid,text,uuid,text,integer,uuid,text,bigint,text,text,numeric) from authenticated;
