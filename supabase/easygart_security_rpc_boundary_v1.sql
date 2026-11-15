-- EasyGart security hardening: RPC privilege boundary
-- This migration PRESERVES ALL ORIGINAL FUNCTION BODIES and existing data.
-- Move privileged business logic to the non-exposed private schema, keep the
-- same PUBLIC RPC names and argument defaults as SECURITY INVOKER façades.
-- Project: xdwsqkteykjjpzogwocx ONLY.
-- Preconditions: core, daily reports, attendance, private-media migrations installed.
begin;

do $eg_rpc_preflight$
declare
 v_public integer;
 v_private integer;
begin
 select count(*) into v_public
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.prosecdef
   and p.proname = any(array['eg_claim_invitations','eg_invite_worker','eg_media_finalize','eg_media_release','eg_media_reserve','eg_review_daily_report','eg_save_daily_report','eg_set_task_status','eg_set_worker_active','eg_shift_action']);
 if v_public<>10 then
   raise exception 'EasyGart RPC preflight: expected 10 public SECURITY DEFINER functions, found %',v_public;
 end if;
 select count(*) into v_private
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname=any(array['eg_claim_invitations','eg_invite_worker','eg_media_finalize','eg_media_release','eg_media_reserve','eg_review_daily_report','eg_save_daily_report','eg_set_task_status','eg_set_worker_active','eg_shift_action']);
 if v_private<>0 then
   raise exception 'Private implementation functions already exist. Review migration before rerunning';
 end if;
end
$eg_rpc_preflight$;

-- Moving the existing function object preserves its exact implementation,
-- owner, grants and security checks (no code is copied or rewritten).
alter function public.eg_claim_invitations() set schema private;
alter function public.eg_invite_worker(p_company_id uuid, p_email text) set schema private;
alter function public.eg_media_finalize(p_media_id uuid) set schema private;
alter function public.eg_media_release(p_media_id uuid) set schema private;
alter function public.eg_media_reserve(p_report_id uuid, p_kind text, p_mime text, p_bytes integer, p_signer_name text, p_consent boolean) set schema private;
alter function public.eg_review_daily_report(p_report_id uuid, p_action text, p_feedback text) set schema private;
alter function public.eg_save_daily_report(p_report_id uuid, p_task_id uuid, p_work_date date, p_minutes_worked integer, p_work_summary text, p_materials_used text, p_issues text, p_send boolean) set schema private;
alter function public.eg_set_task_status(p_task_id uuid, p_status text) set schema private;
alter function public.eg_set_worker_active(p_company_id uuid, p_user_id uuid, p_active boolean) set schema private;
alter function public.eg_shift_action(p_company_id uuid, p_action text, p_site_id uuid) set schema private;

-- Explicitly public, unprivileged API façades. Each calls the original
-- private implementation under its original audited permissions.

create function public.eg_claim_invitations()
returns integer
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_claim_invitations();
$eg_wrapper$;
revoke all on function public.eg_claim_invitations() from public,anon;
grant execute on function public.eg_claim_invitations() to authenticated;

create function public.eg_invite_worker(p_company_id uuid, p_email text)
returns uuid
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_invite_worker(p_company_id, p_email);
$eg_wrapper$;
revoke all on function public.eg_invite_worker(p_company_id uuid, p_email text) from public,anon;
grant execute on function public.eg_invite_worker(p_company_id uuid, p_email text) to authenticated;

create function public.eg_media_finalize(p_media_id uuid)
returns void
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_media_finalize(p_media_id);
$eg_wrapper$;
revoke all on function public.eg_media_finalize(p_media_id uuid) from public,anon;
grant execute on function public.eg_media_finalize(p_media_id uuid) to authenticated;

create function public.eg_media_release(p_media_id uuid)
returns void
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_media_release(p_media_id);
$eg_wrapper$;
revoke all on function public.eg_media_release(p_media_id uuid) from public,anon;
grant execute on function public.eg_media_release(p_media_id uuid) to authenticated;

create function public.eg_media_reserve(p_report_id uuid, p_kind text, p_mime text, p_bytes integer, p_signer_name text DEFAULT NULL::text, p_consent boolean DEFAULT false)
returns jsonb
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_media_reserve(p_report_id, p_kind, p_mime, p_bytes, p_signer_name, p_consent);
$eg_wrapper$;
revoke all on function public.eg_media_reserve(p_report_id uuid, p_kind text, p_mime text, p_bytes integer, p_signer_name text, p_consent boolean) from public,anon;
grant execute on function public.eg_media_reserve(p_report_id uuid, p_kind text, p_mime text, p_bytes integer, p_signer_name text, p_consent boolean) to authenticated;

create function public.eg_review_daily_report(p_report_id uuid, p_action text, p_feedback text)
returns void
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_review_daily_report(p_report_id, p_action, p_feedback);
$eg_wrapper$;
revoke all on function public.eg_review_daily_report(p_report_id uuid, p_action text, p_feedback text) from public,anon;
grant execute on function public.eg_review_daily_report(p_report_id uuid, p_action text, p_feedback text) to authenticated;

create function public.eg_save_daily_report(p_report_id uuid, p_task_id uuid, p_work_date date, p_minutes_worked integer, p_work_summary text, p_materials_used text, p_issues text, p_send boolean)
returns uuid
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_save_daily_report(p_report_id, p_task_id, p_work_date, p_minutes_worked, p_work_summary, p_materials_used, p_issues, p_send);
$eg_wrapper$;
revoke all on function public.eg_save_daily_report(p_report_id uuid, p_task_id uuid, p_work_date date, p_minutes_worked integer, p_work_summary text, p_materials_used text, p_issues text, p_send boolean) from public,anon;
grant execute on function public.eg_save_daily_report(p_report_id uuid, p_task_id uuid, p_work_date date, p_minutes_worked integer, p_work_summary text, p_materials_used text, p_issues text, p_send boolean) to authenticated;

create function public.eg_set_task_status(p_task_id uuid, p_status text)
returns void
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_set_task_status(p_task_id, p_status);
$eg_wrapper$;
revoke all on function public.eg_set_task_status(p_task_id uuid, p_status text) from public,anon;
grant execute on function public.eg_set_task_status(p_task_id uuid, p_status text) to authenticated;

create function public.eg_set_worker_active(p_company_id uuid, p_user_id uuid, p_active boolean)
returns void
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_set_worker_active(p_company_id, p_user_id, p_active);
$eg_wrapper$;
revoke all on function public.eg_set_worker_active(p_company_id uuid, p_user_id uuid, p_active boolean) from public,anon;
grant execute on function public.eg_set_worker_active(p_company_id uuid, p_user_id uuid, p_active boolean) to authenticated;

create function public.eg_shift_action(p_company_id uuid, p_action text, p_site_id uuid DEFAULT NULL::uuid)
returns uuid
language sql security invoker set search_path = ''
as $eg_wrapper$
  select private.eg_shift_action(p_company_id, p_action, p_site_id);
$eg_wrapper$;
revoke all on function public.eg_shift_action(p_company_id uuid, p_action text, p_site_id uuid) from public,anon;
grant execute on function public.eg_shift_action(p_company_id uuid, p_action text, p_site_id uuid) to authenticated;

-- Make the private schema callable by authenticated only; do not expose it
-- through PostgREST's Exposed schemas list.
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
notify pgrst,'reload schema';
commit;

-- Expected: 10 public SECURITY INVOKER façades + 10 private SECURITY DEFINER implementations.
select n.nspname, p.proname,p.prosecdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.proname=any(array['eg_claim_invitations','eg_invite_worker','eg_media_finalize','eg_media_release','eg_media_reserve','eg_review_daily_report','eg_save_daily_report','eg_set_task_status','eg_set_worker_active','eg_shift_action'])
  and n.nspname in ('public','private')
order by p.proname,n.nspname;
