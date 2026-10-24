-- Synthetic identities have no email/password; every fixture is rolled back.
begin;
insert into auth.users(id,email_confirmed_at,raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000001',now(),'{"display_name":"QA admin"}'),
('00000000-0000-4000-8000-000000000002',now(),'{"display_name":"QA supervisor"}'),
('00000000-0000-4000-8000-000000000003',now(),'{"display_name":"QA operator"}'),
('00000000-0000-4000-8000-000000000004',null,'{"display_name":"QA pending","role":"admin"}');
do $$ begin
 if exists(select 1 from public.profiles where user_id::text like '00000000-0000-4000-8000-00000000000%' and (enabled or role<>'operator')) then raise exception 'Unsafe signup defaults'; end if;
end $$;
update public.profiles set role=case right(user_id::text,1) when '1' then 'admin' when '2' then 'supervisor' else 'operator' end,enabled=true,permission_reason='QA transactional setup'
where user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
insert into public.campaigns(id,name,kind,status) values('00000000-0000-4000-8000-000000000010','QA rollback only','micro','active');
insert into public.locations(code,aisle) values('QA-ROLLBACK','Q'),('QA-OTHER','Q');
insert into public.products(code,description) values('QA-ROLLBACK','Transactional fixture');
insert into public.stock_snapshot(campaign_id,location_code,product_code,quantity) values('00000000-0000-4000-8000-000000000010','QA-ROLLBACK','QA-ROLLBACK',123);
insert into public.assignments(campaign_id,location_code,operator_id) values('00000000-0000-4000-8000-000000000010','QA-ROLLBACK','00000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ declare n int; begin
 if not internal.is_enabled() or internal.is_manager() then raise exception 'Operator role failed'; end if;
 if exists(select 1 from public.stock_snapshot) then raise exception 'Stock leaked to operator'; end if;
 update public.profiles set role='admin',permission_reason='Attempt escalation' where user_id=auth.uid();
 get diagnostics n=row_count;if n<>0 then raise exception 'Operator escalated';end if;
 begin perform * from public.admin_user_directory();raise exception 'Directory leaked';exception when insufficient_privilege then null;end;
 begin
 insert into public.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
 values('00000000-0000-4000-8000-000000000010','QA-OTHER','QA-ROLLBACK',2,auth.uid(),gen_random_uuid());
 raise exception 'Unassigned location accepted';exception when insufficient_privilege then null;end;
end $$;
insert into public.counts(id,campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
values('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010','QA-ROLLBACK','QA-ROLLBACK',2,auth.uid(),'00000000-0000-4000-8000-000000000030');
do $$ begin
 begin
 insert into public.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id)
 values('00000000-0000-4000-8000-000000000010','QA-ROLLBACK','QA-ROLLBACK',2,auth.uid(),'00000000-0000-4000-8000-000000000030');
 raise exception 'Duplicate mutation accepted';exception when unique_violation then null;end;
end $$;
insert into public.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id,previous_id,correction_reason)
values('00000000-0000-4000-8000-000000000010','QA-ROLLBACK','QA-ROLLBACK',3,auth.uid(),gen_random_uuid(),'00000000-0000-4000-8000-000000000020','QA correction');
do $$ begin
 begin
 insert into public.counts(campaign_id,location_code,product_code,quantity,actor_id,client_mutation_id,previous_id,correction_reason)
 values('00000000-0000-4000-8000-000000000010','QA-ROLLBACK','QA-ROLLBACK',4,auth.uid(),gen_random_uuid(),'00000000-0000-4000-8000-000000000020','QA concurrent correction');
 raise exception 'Correction fork accepted';exception when unique_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare n int; begin
 if (select count(*) from public.stock_snapshot)<>1 then raise exception 'Supervisor cannot read stock';end if;
 update public.profiles set role='admin',permission_reason='Attempt escalation' where user_id=auth.uid();
 get diagnostics n=row_count;if n<>0 then raise exception 'Supervisor escalated';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare n int; begin
 if (select count(*) from public.admin_user_directory())<>4 then raise exception 'Admin directory failed';end if;
 begin update public.profiles set role='operator',permission_reason='QA last admin' where user_id=auth.uid();raise exception 'Last admin removed';
 exception when raise_exception then if sqlerrm<>'No se puede desactivar ni degradar al último Administrador' then raise;end if;end;
 begin update public.profiles set enabled=true,permission_reason='QA pending email' where user_id='00000000-0000-4000-8000-000000000004';raise exception 'Unconfirmed account enabled';
 exception when raise_exception then if sqlerrm<>'El usuario debe confirmar primero su correo' then raise;end if;end;
 update public.profiles set enabled=false,permission_reason='QA disable operator' where user_id='00000000-0000-4000-8000-000000000003' and version=1;
 get diagnostics n=row_count;if n<>1 then raise exception 'Version update failed';end if;
 update public.profiles set enabled=true,permission_reason='QA stale update' where user_id='00000000-0000-4000-8000-000000000003' and version=1;
 get diagnostics n=row_count;if n<>0 then raise exception 'Stale version accepted';end if;
 if not exists(select 1 from public.audit_events where relation_name='profiles' and record_id='00000000-0000-4000-8000-000000000003' and actor_id=auth.uid() and after_row->>'permission_reason'='QA disable operator') then raise exception 'Profile audit missing';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin if internal.is_enabled() or exists(select 1 from public.counts) or exists(select 1 from public.assignments) then raise exception 'Disabled user retains access';end if;end $$;
reset role;
select 'PASS: signup defaults, roles, blind counts, admin directory, approval, last admin, version conflicts, audit, idempotence, correction conflicts, disabled access' as verification;
rollback;