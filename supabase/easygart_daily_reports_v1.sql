-- EasyGart Cloud: rapporti giornalieri dipendenti -> titolare
-- Migrazione AGGIUNTIVA: eseguire DOPO supabase/easygart_core_v1.sql,
-- SOLO nel progetto EasyGart xdwsqkteykjjpzogwocx.
-- Richiede la verifica dei permessi RLS su account di prova prima di dati reali.
begin;

-- La coppia azienda/attività protegge anche i riferimenti tra aziende.
create unique index if not exists eg_tasks_company_task_unique
  on public.eg_tasks(company_id,id);

create table if not exists public.eg_daily_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  task_id uuid not null,
  created_by uuid not null references auth.users(id),
  work_date date not null check (work_date >= date '2020-01-01' and work_date < date '2100-01-01'),
  minutes_worked integer not null default 0 check (minutes_worked between 0 and 1440),
  work_summary text not null default '' check (char_length(work_summary) <= 6000),
  materials_used text not null default '' check (char_length(materials_used) <= 4000),
  issues text not null default '' check (char_length(issues) <= 4000),
  status text not null default 'draft'
    check (status in ('draft','submitted','changes_requested','approved')),
  manager_feedback text not null default '' check (char_length(manager_feedback) <= 4000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eg_reports_company_task_fk foreign key(company_id,task_id)
    references public.eg_tasks(company_id,id),
  constraint eg_reports_company_author_fk foreign key(company_id,created_by)
    references public.eg_members(company_id,user_id),
  constraint eg_reports_one_daily_per_task unique(task_id,created_by,work_date),
  constraint eg_reports_company_id_id unique(company_id,id)
);

create table if not exists public.eg_daily_report_events (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  report_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('submitted','approved','changes_requested')),
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key(company_id,report_id) references public.eg_daily_reports(company_id,id) on delete cascade
);
create index if not exists eg_reports_company_status_date
  on public.eg_daily_reports(company_id,status,work_date desc);
create index if not exists eg_reports_author_date
  on public.eg_daily_reports(company_id,created_by,work_date desc);
create index if not exists eg_reports_events_company
  on public.eg_daily_report_events(company_id,created_at desc);

revoke all on public.eg_daily_reports, public.eg_daily_report_events from public, anon, authenticated;
grant select on public.eg_daily_reports, public.eg_daily_report_events to authenticated;
alter table public.eg_daily_reports enable row level security;
alter table public.eg_daily_report_events enable row level security;

drop policy if exists eg_reports_select on public.eg_daily_reports;
create policy eg_reports_select on public.eg_daily_reports
  for select to authenticated
  using (
    private.eg_is_owner(company_id)
    or (private.eg_is_member(company_id) and created_by=(select auth.uid()))
  );

drop policy if exists eg_report_events_select on public.eg_daily_report_events;
create policy eg_report_events_select on public.eg_daily_report_events
  for select to authenticated
  using (
    private.eg_is_owner(company_id)
    or (
      private.eg_is_member(company_id)
      and exists(
        select 1 from public.eg_daily_reports r
        where r.id=eg_daily_report_events.report_id
          and r.company_id=eg_daily_report_events.company_id
          and r.created_by=(select auth.uid())
      )
    )
  );

-- Solo la funzione RPC può creare o modificare un rapporto; nessun INSERT/UPDATE diretto.
create or replace function public.eg_save_daily_report(
  p_report_id uuid,
  p_task_id uuid,
  p_work_date date,
  p_minutes_worked integer,
  p_work_summary text,
  p_materials_used text,
  p_issues text,
  p_send boolean
) returns uuid
language plpgsql security definer set search_path = '' as $eg_report_save$
declare
  v_uid uuid := auth.uid();
  v_task public.eg_tasks%rowtype;
  v_report public.eg_daily_reports%rowtype;
  v_id uuid;
  v_summary text := trim(coalesce(p_work_summary,''));
  v_materials text := trim(coalesce(p_materials_used,''));
  v_issues text := trim(coalesce(p_issues,''));
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  if p_task_id is null then raise exception 'Attività obbligatoria'; end if;
  if p_work_date is null or p_work_date < date '2020-01-01' or p_work_date > current_date+1 then
    raise exception 'Data di lavoro non valida';
  end if;
  if p_minutes_worked is null or p_minutes_worked < 0 or p_minutes_worked > 1440 then
    raise exception 'Durata del lavoro non valida';
  end if;
  if length(v_summary)>6000 or length(v_materials)>4000 or length(v_issues)>4000 then
    raise exception 'Testo troppo lungo';
  end if;
  if coalesce(p_send,false) and (length(v_summary)<10 or p_minutes_worked<1) then
    raise exception 'Per inviare, descrivi il lavoro (almeno 10 caratteri) e le ore effettive';
  end if;

  -- Proteggere l'assegnazione: solo un dipendente attivo e incaricato può compilare.
  select * into v_task from public.eg_tasks
    where id=p_task_id for share;
  if not found then raise exception 'Attività non trovata'; end if;
  if v_task.assignee_id <> v_uid or not private.eg_is_member(v_task.company_id)
     or not exists(
       select 1 from public.eg_members m
       where m.company_id=v_task.company_id and m.user_id=v_uid
         and m.role='worker' and m.active
     ) then
    raise exception 'Non sei autorizzato a compilare questo rapporto';
  end if;

  if p_report_id is null then
    insert into public.eg_daily_reports(
      company_id,task_id,created_by,work_date,minutes_worked,
      work_summary,materials_used,issues,status,submitted_at
    ) values(
      v_task.company_id,v_task.id,v_uid,p_work_date,p_minutes_worked,
      v_summary,v_materials,v_issues,
      case when coalesce(p_send,false) then 'submitted' else 'draft' end,
      case when coalesce(p_send,false) then now() else null end
    )
    returning id into v_id;
  else
    select * into v_report from public.eg_daily_reports where id=p_report_id for update;
    if not found or v_report.company_id <> v_task.company_id
      or v_report.task_id <> v_task.id or v_report.created_by <> v_uid then
      raise exception 'Rapporto non trovato o non autorizzato';
    end if;
    if v_report.status not in ('draft','changes_requested') then
      raise exception 'Rapporto già inviato e bloccato';
    end if;
    update public.eg_daily_reports set
      work_date=p_work_date,minutes_worked=p_minutes_worked,
      work_summary=v_summary,materials_used=v_materials,issues=v_issues,
      status=case when coalesce(p_send,false) then 'submitted' else 'draft' end,
      submitted_at=case when coalesce(p_send,false) then now() else submitted_at end,
      updated_at=now()
    where id=p_report_id returning id into v_id;
  end if;

  if coalesce(p_send,false) then
    insert into public.eg_daily_report_events(company_id,report_id,actor_id,action)
    values(v_task.company_id,v_id,v_uid,'submitted');
  end if;
  return v_id;
end;
$eg_report_save$;
revoke all on function public.eg_save_daily_report(uuid,uuid,date,integer,text,text,text,boolean)
  from public,anon;
grant execute on function public.eg_save_daily_report(uuid,uuid,date,integer,text,text,text,boolean)
  to authenticated;

-- Titolare: approva oppure chiede correzioni, con feedback visibile al dipendente.
create or replace function public.eg_review_daily_report(
  p_report_id uuid,
  p_action text,
  p_feedback text
) returns void
language plpgsql security definer set search_path = '' as $eg_report_review$
declare
  v_uid uuid := auth.uid();
  v_report public.eg_daily_reports%rowtype;
  v_note text := trim(coalesce(p_feedback,''));
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  if p_action not in ('approved','changes_requested') then raise exception 'Decisione non valida'; end if;
  if length(v_note)>4000 then raise exception 'Feedback troppo lungo'; end if;
  if p_action='changes_requested' and length(v_note)<5 then
    raise exception 'Indica quali correzioni sono richieste';
  end if;

  select * into v_report from public.eg_daily_reports where id=p_report_id for update;
  if not found then raise exception 'Rapporto non trovato'; end if;
  if not private.eg_is_owner(v_report.company_id) then raise exception 'Solo il titolare può verificare'; end if;
  if v_report.status <> 'submitted' then raise exception 'Rapporto non in attesa di verifica'; end if;
  update public.eg_daily_reports set
    status=p_action,manager_feedback=v_note,reviewed_by=v_uid,reviewed_at=now(),updated_at=now()
  where id=p_report_id;
  insert into public.eg_daily_report_events(company_id,report_id,actor_id,action,note)
  values(v_report.company_id,v_report.id,v_uid,p_action,v_note);
end;
$eg_report_review$;
revoke all on function public.eg_review_daily_report(uuid,text,text) from public,anon;
grant execute on function public.eg_review_daily_report(uuid,text,text) to authenticated;

commit;
