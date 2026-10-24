
create or replace function internal.admin_user_directory()
returns table(user_id uuid,display_name text,role text,enabled boolean,created_at timestamptz,version bigint,permission_reason text,email text,email_confirmed boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not internal.is_admin() then raise exception 'Solo Administración puede consultar las cuentas' using errcode='42501'; end if;
 return query select p.user_id,p.display_name,p.role,p.enabled,p.created_at,p.version,p.permission_reason,u.email::text,(u.email_confirmed_at is not null)
 from public.profiles p join auth.users u on u.id=p.user_id order by p.created_at,p.user_id;
end; $$;
revoke all on function internal.admin_user_directory() from public,anon;
grant execute on function internal.admin_user_directory() to authenticated;
create or replace function public.admin_user_directory()
returns table(user_id uuid,display_name text,role text,enabled boolean,created_at timestamptz,version bigint,permission_reason text,email text,email_confirmed boolean)
language sql stable security invoker set search_path='' as $$ select * from internal.admin_user_directory(); $$;
revoke all on function public.admin_user_directory() from public,anon;
grant execute on function public.admin_user_directory() to authenticated;
