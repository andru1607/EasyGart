-- EasyGart: historic report correction rights with protection of invoiced data.
alter table public.eg_daily_reports
  add column if not exists invoice_locked boolean not null default false;
update public.eg_daily_reports r set invoice_locked=true
  where exists(select 1 from public.eg_invoice_drafts i where i.report_id=r.id)
  and not r.invoice_locked;
create or replace function private.eg_lock_report_on_invoice()
returns trigger language plpgsql security definer set search_path=''
as $eg$
begin
  update public.eg_daily_reports set invoice_locked=true where id=new.report_id and company_id=new.company_id;
  return new;
end $eg$;
drop trigger if exists eg_invoice_locks_report on public.eg_invoice_drafts;
create trigger eg_invoice_locks_report after insert on public.eg_invoice_drafts
for each row execute function private.eg_lock_report_on_invoice();

create or replace function private.eg_save_daily_report_v4(
  p_report_id uuid,p_company_id uuid,p_worker_id uuid,p_site_id uuid,p_task_id uuid,
  p_work_date date,p_start_time time,p_end_time time,p_break_minutes integer,p_work_summary text,p_materials_used text,
  p_issues text,p_send boolean
) returns uuid language plpgsql security definer set search_path = ''
as $eg$
declare
  v_uid uuid:=auth.uid();
  v_owner boolean;
  v_worker uuid;
  v_old public.eg_daily_reports%rowtype;
  v_id uuid;
  v_summary text:=trim(coalesce(p_work_summary,''));
  v_materials text:=trim(coalesce(p_materials_used,''));
  v_issues text:=trim(coalesce(p_issues,''));
  v_note text;
  v_minutes_worked integer;
  v_elapsed integer;
begin
  if v_uid is null or p_company_id is null then raise exception 'Accesso richiesto'; end if;
  v_owner:=private.eg_is_owner(p_company_id);
  if not private.eg_is_member(p_company_id) then raise exception 'Non appartieni a questa azienda'; end if;
  v_worker:=coalesce(p_worker_id,v_uid);
  if not v_owner and v_worker<>v_uid then raise exception 'Puoi compilare solo i tuoi rapporti'; end if;
  if not exists(select 1 from public.eg_members m where m.company_id=p_company_id
      and m.user_id=v_worker and m.active and m.role in ('worker','owner'))
    then raise exception 'Dipendente non attivo'; end if;
  if p_site_id is null or not exists(select 1 from public.eg_sites s
      where s.id=p_site_id and s.company_id=p_company_id)
    then raise exception 'Seleziona un cantiere valido'; end if;
  if p_task_id is not null and not exists(select 1 from public.eg_tasks t
      where t.id=p_task_id and t.company_id=p_company_id and t.assignee_id=v_worker
      and (t.site_id is null or t.site_id=p_site_id))
    then raise exception 'Il compito non appartiene al dipendente o al cantiere'; end if;
  if p_work_date is null or p_work_date<date '2020-01-01' or p_work_date>current_date+1
    then raise exception 'Data non valida'; end if;
  if p_start_time is null or p_end_time is null then
    raise exception 'Indica ora di inizio e ora di fine'; end if;
  if extract(second from p_start_time)<>0 or extract(second from p_end_time)<>0 then
    raise exception 'Orari validi solo al minuto'; end if;
  if p_break_minutes is null or p_break_minutes<0 or p_break_minutes>1439 then
    raise exception 'Pausa non valida'; end if;
  v_elapsed:=mod(((extract(hour from p_end_time)::integer*60
         +extract(minute from p_end_time)::integer)
        -(extract(hour from p_start_time)::integer*60
         +extract(minute from p_start_time)::integer)+1440),1440);
  if v_elapsed=0 or p_break_minutes>=v_elapsed then
    raise exception 'Gli orari o la pausa non sono validi'; end if;
  v_minutes_worked:=v_elapsed-p_break_minutes;
  if length(v_summary)>6000 or length(v_materials)>4000 or length(v_issues)>4000
    then raise exception 'Testo troppo lungo'; end if;
  if coalesce(p_send,false) and (v_minutes_worked<1 or length(v_summary)<10)
    then raise exception 'Per inviare servono ore e almeno 10 caratteri di rapporto'; end if;

  if p_report_id is null then
    insert into public.eg_daily_reports(company_id,created_by,task_id,site_id,work_date,
      minutes_worked,work_start_time,work_end_time,break_minutes,work_summary,materials_used,issues,status,submitted_at)
    values(p_company_id,v_worker,p_task_id,p_site_id,p_work_date,v_minutes_worked,
      p_start_time,p_end_time,p_break_minutes,v_summary,v_materials,v_issues,
      case when coalesce(p_send,false) then 'submitted' else 'draft' end,
      case when coalesce(p_send,false) then now() end)
    returning id into v_id;
    insert into public.eg_daily_report_events(company_id,report_id,actor_id,action,note)
    values(p_company_id,v_id,v_uid,'created',
      jsonb_build_object('worker_id',v_worker,'site_id',p_site_id,'minutes',v_minutes_worked,'start',p_start_time,'end',p_end_time,'break',p_break_minutes)::text);
  else
    select * into v_old from public.eg_daily_reports where id=p_report_id for update;
    if not found or v_old.company_id<>p_company_id then raise exception 'Rapporto non trovato'; end if;
    if not v_owner and v_old.created_by<>v_uid then raise exception 'Rapporto non autorizzato'; end if;
    if v_old.created_by<>v_worker then raise exception 'Il dipendente del rapporto non può cambiare'; end if;
    -- Tutti i rapporti storici non fatturati sono modificabili dal proprio autore
    -- e dal titolare, anche quando erano approvati: tornano in verifica.
    -- Una proforma gia' collegata congela definitivamente i dati economici.
    if v_old.invoice_locked or exists(
       select 1 from public.eg_invoice_drafts i where i.report_id=p_report_id)
      then raise exception 'Rapporto collegato a una proforma: modifica bloccata'; end if;
    v_id:=p_report_id;
    update public.eg_daily_reports set site_id=p_site_id,task_id=p_task_id,work_date=p_work_date,
      minutes_worked=v_minutes_worked,work_start_time=p_start_time,
      work_end_time=p_end_time,break_minutes=p_break_minutes,work_summary=v_summary,materials_used=v_materials,issues=v_issues,
      status=case when coalesce(p_send,false) then 'submitted' else 'draft' end,
      submitted_at=case when coalesce(p_send,false) then now() else null end,
      reviewed_at=null,reviewed_by=null,manager_feedback='',updated_at=now()
    where id=v_id;
    v_note:=jsonb_build_object(
      'prima',jsonb_build_object('date',v_old.work_date,'site',v_old.site_id,
        'task',v_old.task_id,'minutes',v_old.minutes_worked,'start',v_old.work_start_time,
        'end',v_old.work_end_time,'break',v_old.break_minutes,'summary',v_old.work_summary,
        'materials',v_old.materials_used,'issues',v_old.issues,'status',v_old.status),
      'dopo',jsonb_build_object('date',p_work_date,'site',p_site_id,
        'task',p_task_id,'minutes',v_minutes_worked,'start',p_start_time,
        'end',p_end_time,'break',p_break_minutes,'summary',v_summary,
        'materials',v_materials,'issues',v_issues,'status',
        case when coalesce(p_send,false) then 'submitted' else 'draft' end))::text;
    insert into public.eg_daily_report_events(company_id,report_id,actor_id,action,note)
      values(p_company_id,v_id,v_uid,'edited',v_note);
  end if;
  if coalesce(p_send,false) then
    insert into public.eg_daily_report_events(company_id,report_id,actor_id,action)
      values(p_company_id,v_id,v_uid,'submitted');
  end if;
  return v_id;
end $eg$;



create or replace function public.eg_save_daily_report_v4(
  p_report_id uuid,p_company_id uuid,p_worker_id uuid,p_site_id uuid,p_task_id uuid,
  p_work_date date,p_start_time time,p_end_time time,p_break_minutes integer,
  p_work_summary text,p_materials_used text,p_issues text,p_send boolean
) returns uuid language sql set search_path = ''
as $eg$
select private.eg_save_daily_report_v4(
 p_report_id,p_company_id,p_worker_id,p_site_id,p_task_id,
 p_work_date,p_start_time,p_end_time,p_break_minutes,
 p_work_summary,p_materials_used,p_issues,p_send);
$eg$;
revoke all on function public.eg_save_daily_report_v4(
 uuid,uuid,uuid,uuid,uuid,date,time,time,integer,text,text,text,boolean)
 from public,anon;
grant execute on function public.eg_save_daily_report_v4(
 uuid,uuid,uuid,uuid,uuid,date,time,time,integer,text,text,text,boolean)
 to authenticated;
