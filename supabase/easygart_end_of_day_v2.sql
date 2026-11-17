-- EasyGart: rapporti di fine giornata autonomi per cantiere, modifiche e storico.
-- I rapporti storici collegati ai compiti restano invariati.
alter table public.eg_daily_reports alter column task_id drop not null;
alter table public.eg_daily_reports add column if not exists site_id uuid;
update public.eg_daily_reports r set site_id=t.site_id
from public.eg_tasks t where r.task_id=t.id and r.company_id=t.company_id and r.site_id is null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.eg_daily_reports'::regclass and conname='eg_reports_company_site_fk') then
    alter table public.eg_daily_reports add constraint eg_reports_company_site_fk
      foreign key(company_id,site_id) references public.eg_sites(company_id,id);
  end if;
end $$;
create index if not exists eg_daily_reports_site_day_idx on public.eg_daily_reports(company_id,site_id,work_date);
alter table public.eg_daily_report_events drop constraint if exists eg_daily_report_events_action_check;
alter table public.eg_daily_report_events add constraint eg_daily_report_events_action_check
  check(action in ('created','edited','submitted','approved','changes_requested'));

create or replace function private.eg_save_daily_report_v2(
  p_report_id uuid,p_company_id uuid,p_worker_id uuid,p_site_id uuid,p_task_id uuid,
  p_work_date date,p_minutes_worked integer,p_work_summary text,p_materials_used text,
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
  if p_minutes_worked is null or p_minutes_worked<0 or p_minutes_worked>1440
    then raise exception 'Ore non valide'; end if;
  if length(v_summary)>6000 or length(v_materials)>4000 or length(v_issues)>4000
    then raise exception 'Testo troppo lungo'; end if;
  if coalesce(p_send,false) and (p_minutes_worked<1 or length(v_summary)<10)
    then raise exception 'Per inviare servono ore e almeno 10 caratteri di rapporto'; end if;

  if p_report_id is null then
    insert into public.eg_daily_reports(company_id,created_by,task_id,site_id,work_date,
      minutes_worked,work_summary,materials_used,issues,status,submitted_at)
    values(p_company_id,v_worker,p_task_id,p_site_id,p_work_date,p_minutes_worked,
      v_summary,v_materials,v_issues,
      case when coalesce(p_send,false) then 'submitted' else 'draft' end,
      case when coalesce(p_send,false) then now() end)
    returning id into v_id;
    insert into public.eg_daily_report_events(company_id,report_id,actor_id,action,note)
    values(p_company_id,v_id,v_uid,'created',
      jsonb_build_object('worker_id',v_worker,'site_id',p_site_id,'minutes',p_minutes_worked)::text);
  else
    select * into v_old from public.eg_daily_reports where id=p_report_id for update;
    if not found or v_old.company_id<>p_company_id then raise exception 'Rapporto non trovato'; end if;
    if not v_owner and v_old.created_by<>v_uid then raise exception 'Rapporto non autorizzato'; end if;
    if v_old.created_by<>v_worker then raise exception 'Il dipendente del rapporto non può cambiare'; end if;
    if v_old.status='approved' and (not v_owner or exists(
         select 1 from public.eg_invoice_drafts i where i.report_id=p_report_id))
      then raise exception 'Rapporto approvato o già collegato a proforma: modifica bloccata'; end if;
    v_id:=p_report_id;
    update public.eg_daily_reports set site_id=p_site_id,task_id=p_task_id,work_date=p_work_date,
      minutes_worked=p_minutes_worked,work_summary=v_summary,materials_used=v_materials,issues=v_issues,
      status=case when coalesce(p_send,false) then 'submitted' else 'draft' end,
      submitted_at=case when coalesce(p_send,false) then now() else null end,
      reviewed_at=null,reviewed_by=null,manager_feedback='',updated_at=now()
    where id=v_id;
    v_note:=jsonb_build_object(
      'prima',jsonb_build_object('date',v_old.work_date,'site',v_old.site_id,
        'task',v_old.task_id,'minutes',v_old.minutes_worked,'summary',v_old.work_summary,
        'materials',v_old.materials_used,'issues',v_old.issues,'status',v_old.status),
      'dopo',jsonb_build_object('date',p_work_date,'site',p_site_id,
        'task',p_task_id,'minutes',p_minutes_worked,'summary',v_summary,
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

create or replace function public.eg_save_daily_report_v2(
  p_report_id uuid,p_company_id uuid,p_worker_id uuid,p_site_id uuid,p_task_id uuid,
  p_work_date date,p_minutes_worked integer,p_work_summary text,p_materials_used text,
  p_issues text,p_send boolean
) returns uuid language sql set search_path = ''
as $eg$ select private.eg_save_daily_report_v2(p_report_id,p_company_id,p_worker_id,
  p_site_id,p_task_id,p_work_date,p_minutes_worked,p_work_summary,p_materials_used,p_issues,p_send) $eg$;
revoke all on function public.eg_save_daily_report_v2(uuid,uuid,uuid,uuid,uuid,date,integer,text,text,text,boolean) from public,anon;
grant execute on function public.eg_save_daily_report_v2(uuid,uuid,uuid,uuid,uuid,date,integer,text,text,text,boolean) to authenticated;

-- Una proforma deve funzionare anche per i rapporti compilati senza compito.
create or replace function private.eg_invoice_from_report(p_report_id uuid,p_labor_rate numeric,p_labor_vat numeric)
returns uuid language plpgsql security definer set search_path = ''
as $eg$
declare
  v_report public.eg_daily_reports%rowtype;
  v_task public.eg_tasks%rowtype;
  v_site public.eg_sites%rowtype;
  v_client uuid;
  v_title text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_labor_rate is null or p_labor_rate<0 or p_labor_rate>10000
     or p_labor_vat is null or p_labor_vat<0 or p_labor_vat>30
    then raise exception 'Invalid labor rate or VAT'; end if;
  select * into v_report from public.eg_daily_reports where id=p_report_id for share;
  if not found or not private.eg_is_owner(v_report.company_id)
      or v_report.status<>'approved'
    then raise exception 'Only approved reports can generate invoice drafts'; end if;
  if v_report.task_id is not null then
    select * into v_task from public.eg_tasks where id=v_report.task_id
      and company_id=v_report.company_id;
  end if;
  if v_report.site_id is not null then
    select * into v_site from public.eg_sites where id=v_report.site_id
      and company_id=v_report.company_id;
  end if;
  v_client:=coalesce(v_task.client_id,v_site.client_id);
  v_title:=coalesce(v_task.title,v_site.name,'Intervento');
  if v_client is null then raise exception 'Il rapporto deve indicare un cliente/cantiere'; end if;
  select id into v_id from public.eg_invoice_drafts where report_id=p_report_id;
  if found then return v_id; end if;
  insert into public.eg_invoice_drafts(company_id,client_id,report_id,created_by)
    values(v_report.company_id,v_client,p_report_id,auth.uid())
    on conflict(report_id) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.eg_invoice_drafts where report_id=p_report_id;
    return v_id;
  end if;
  if p_labor_rate>0 and v_report.minutes_worked>0 then
    insert into public.eg_invoice_lines(company_id,invoice_id,kind,description,
       quantity,unit,unit_price,vat_rate)
    values(v_report.company_id,v_id,'labor','Lavoro: '||left(v_title,450),
      round(v_report.minutes_worked::numeric/60,3),'h',p_labor_rate,p_labor_vat);
  end if;
  insert into public.eg_invoice_lines(company_id,invoice_id,kind,description,
     quantity,unit,unit_price,vat_rate)
  select m.company_id,v_id,'material',m.material_name,m.quantity,m.unit,
    m.sale_price_snapshot,m.vat_rate_snapshot
  from public.eg_report_materials m where m.report_id=p_report_id;
  return v_id;
end $eg$;
