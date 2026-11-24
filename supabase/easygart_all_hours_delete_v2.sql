-- Apply only to EasyGart after the attendance, report deletion and delegation migrations.
begin;
create or replace function private.eg_cancel_any_shift(p_company_id uuid,p_shift_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=auth.uid();
 v_shift public.eg_shifts%rowtype;
begin
 if v_uid is null or not private.eg_is_member(p_company_id) then
   raise exception 'Access denied' using errcode='42501';
 end if;
 select * into v_shift from public.eg_shifts where company_id=p_company_id and id=p_shift_id for update;
 if not found or v_shift.deleted_at is not null then return false; end if;
 if not private.eg_is_owner(p_company_id) and v_shift.user_id<>v_uid then
   raise exception 'Access denied' using errcode='42501';
 end if;
 -- Keep original closed shift times. An open shift must be closed to release the unique active-shift slot.
 update public.eg_shifts set
   deleted_at=clock_timestamp(),deleted_by=v_uid,
   status='closed',ended_at=coalesce(ended_at,started_at),break_started_at=null
 where company_id=p_company_id and id=p_shift_id;
 return true;
end $$;
revoke all on function private.eg_cancel_any_shift(uuid,uuid) from public,anon;
grant execute on function private.eg_cancel_any_shift(uuid,uuid) to authenticated;
create or replace function public.eg_delete_shift(p_company_id uuid,p_shift_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select private.eg_cancel_any_shift(p_company_id,p_shift_id);
$$;
revoke all on function public.eg_delete_shift(uuid,uuid) from public,anon;
grant execute on function public.eg_delete_shift(uuid,uuid) to authenticated;

create or replace function private.eg_clear_report_hours(p_company_id uuid,p_report_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_report public.eg_daily_reports%rowtype;
begin
 if v_uid is null or not private.eg_is_member(p_company_id) then
   raise exception 'Access denied' using errcode='42501';
 end if;
 select * into v_report from public.eg_daily_reports where company_id=p_company_id and id=p_report_id for update;
 if not found or v_report.deleted_at is not null then return false; end if;
 if not private.eg_is_owner(p_company_id) and v_report.created_by<>v_uid then
   raise exception 'Access denied' using errcode='42501';
 end if;
 if v_report.invoice_locked or exists(select 1 from public.eg_invoice_drafts i where i.report_id=p_report_id) then
   raise exception 'Report linked to invoice' using errcode='55000';
 end if;
 update public.eg_daily_reports set work_start_time=null,work_end_time=null,break_minutes=0,minutes_worked=0,updated_at=now()
   where company_id=p_company_id and id=p_report_id;
 insert into public.eg_daily_report_events(company_id,report_id,actor_id,action,note)
 values(p_company_id,p_report_id,v_uid,'edited',jsonb_build_object('action','clear_hours','start',v_report.work_start_time,'end',v_report.work_end_time,'break',v_report.break_minutes,'minutes',v_report.minutes_worked)::text);
 return true;
end $$;
revoke all on function private.eg_clear_report_hours(uuid,uuid) from public,anon;
grant execute on function private.eg_clear_report_hours(uuid,uuid) to authenticated;
create or replace function public.eg_clear_report_hours(p_company_id uuid,p_report_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select private.eg_clear_report_hours(p_company_id,p_report_id);
$$;
revoke all on function public.eg_clear_report_hours(uuid,uuid) from public,anon;
grant execute on function public.eg_clear_report_hours(uuid,uuid) to authenticated;
commit;
