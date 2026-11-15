-- EasyGart: scheduled recurring maintenance, server-side at 05:15 UTC.
-- Trusted scheduler runs without a user's JWT and never exposes a public RPC.
-- Requires easygart_business_v1.sql and pg_cron support on the project.
begin;
do $eg_check$
begin
 if to_regclass('public.eg_maintenance_plans') is null
 or to_regprocedure('private.eg_next_maintenance_date(date,date,text)') is null then
  raise exception 'Apply EasyGart business migration first';
 end if;
end $eg_check$;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

create or replace function private.eg_run_maintenance_scheduler()
returns integer language plpgsql security definer set search_path=''
as $eg_scheduler$
declare
 v_plan public.eg_maintenance_plans%rowtype;
 v_owner uuid;
 v_step integer;
 v_inserted integer;
 v_created integer:=0;
begin
 for v_plan in select * from public.eg_maintenance_plans
  where active and next_due_date<=current_date+30
  order by next_due_date for update skip locked
 loop
   select m.user_id into v_owner from public.eg_members m
     where m.company_id=v_plan.company_id and m.role='owner' and m.active
     order by m.joined_at limit 1;
   if v_owner is null then continue; end if;
   if not exists(
     select 1 from public.eg_members m where m.company_id=v_plan.company_id
      and m.user_id=v_plan.assignee_id and m.active and m.role='worker'
   ) then continue; end if;
   v_step:=0;
   while v_plan.next_due_date<=current_date+30 and v_step<40 loop
      insert into public.eg_tasks(
        company_id,client_id,site_id,assignee_id,assigned_by,title,instructions,
        due_date,start_time,estimated_minutes,priority,status,maintenance_plan_id
      ) values(
        v_plan.company_id,v_plan.client_id,v_plan.site_id,v_plan.assignee_id,
        v_owner,v_plan.title,v_plan.instructions,v_plan.next_due_date,
        v_plan.start_time,v_plan.estimated_minutes,'media','assigned',v_plan.id
      )
      on conflict(maintenance_plan_id,due_date)
        where maintenance_plan_id is not null do nothing;
      get diagnostics v_inserted=row_count;
      v_created:=v_created+v_inserted;
      v_plan.next_due_date:=private.eg_next_maintenance_date(
        v_plan.next_due_date,v_plan.anchor_date,v_plan.cadence
      );
      v_step:=v_step+1;
   end loop;
   update public.eg_maintenance_plans set next_due_date=v_plan.next_due_date where id=v_plan.id;
 end loop;
 return v_created;
end
$eg_scheduler$;
revoke all on function private.eg_run_maintenance_scheduler() from public,anon,authenticated;

-- Schedule one named job; reruns only replace that same schedule.
select cron.schedule(
  'easygart-recurring-maintenance',
  '15 5 * * *',
  'select private.eg_run_maintenance_scheduler();'
);

commit;
