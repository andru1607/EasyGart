-- EasyGart Cloud • presenze e pause dei dipendenti (2026-11)
-- Dipendenza: supabase/easygart_core_v1.sql.
-- Applicare SOLO al progetto EasyGart xdwsqkteykjjpzogwocx, dopo aver controllato l'ID.
-- Tutte le timbrature e gli orari sono generati dal database, NON dal dispositivo.
begin;

do $eg_check$
begin
  if to_regclass('public.eg_members') is null or to_regclass('public.eg_sites') is null
    or to_regprocedure('private.eg_is_owner(uuid)') is null
    or to_regprocedure('private.eg_is_member(uuid)') is null then
    raise exception 'Schema EasyGart non trovato; applica prima easygart_core_v1.sql nel progetto corretto';
  end if;
end
$eg_check$;

create table if not exists public.eg_shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  site_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  break_started_at timestamptz,
  break_seconds integer not null default 0 check (break_seconds >= 0),
  status text not null default 'working' check (status in ('working','break','closed')),
  created_at timestamptz not null default now(),
  constraint eg_shifts_member_fk foreign key(company_id,user_id)
    references public.eg_members(company_id,user_id),
  constraint eg_shifts_site_fk foreign key(company_id,site_id)
    references public.eg_sites(company_id,id),
  constraint eg_shifts_consistency check (
    (status='closed' and ended_at is not null and break_started_at is null and ended_at>=started_at)
    or (status='working' and ended_at is null and break_started_at is null)
    or (status='break' and ended_at is null and break_started_at is not null and break_started_at>=started_at)
  ),
  unique(company_id,id)
);
create unique index if not exists eg_shifts_one_open_per_worker
  on public.eg_shifts(company_id,user_id) where status <> 'closed';
create index if not exists eg_shifts_company_started
  on public.eg_shifts(company_id,started_at desc);
create index if not exists eg_shifts_worker_started
  on public.eg_shifts(company_id,user_id,started_at desc);

create table if not exists public.eg_shift_events (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  shift_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('clock_in','break_start','break_end','clock_out')),
  occurred_at timestamptz not null default now(),
  foreign key(company_id,shift_id) references public.eg_shifts(company_id,id) on delete cascade
);
create index if not exists eg_shift_events_company
  on public.eg_shift_events(company_id,occurred_at desc);

revoke all on public.eg_shifts,public.eg_shift_events from public,anon,authenticated;
grant select on public.eg_shifts,public.eg_shift_events to authenticated;
alter table public.eg_shifts enable row level security;
alter table public.eg_shift_events enable row level security;

drop policy if exists eg_shifts_read on public.eg_shifts;
create policy eg_shifts_read on public.eg_shifts for select to authenticated
  using (
    private.eg_is_owner(company_id)
    or (private.eg_is_member(company_id) and user_id=(select auth.uid()))
  );
drop policy if exists eg_shift_events_read on public.eg_shift_events;
create policy eg_shift_events_read on public.eg_shift_events for select to authenticated
  using (
    private.eg_is_owner(company_id) or (
      private.eg_is_member(company_id)
      and exists (
        select 1 from public.eg_shifts s
        where s.company_id=eg_shift_events.company_id
          and s.id=eg_shift_events.shift_id and s.user_id=(select auth.uid())
      )
    )
  );

-- SQL RPC: controllo server dell'appartenenza, sequenza di azioni e marcature orarie.
-- Non permette al client di passare ore o cambiare proprietario/azienda del turno.
create or replace function public.eg_shift_action(
  p_company_id uuid, p_action text, p_site_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $eg_shift_rpc$
declare
  v_uid uuid := auth.uid();
  v_shift public.eg_shifts%rowtype;
  v_id uuid;
  v_time timestamptz := clock_timestamp();
  v_elapsed integer;
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  if not exists (
    select 1 from public.eg_members m
    where m.company_id=p_company_id and m.user_id=v_uid and m.active and m.role='worker'
  ) then raise exception 'Dipendente non autorizzato alle timbrature'; end if;

  -- Serializza timbrature simultanee dello stesso utente/azienda.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||':'||v_uid::text,0));
  select * into v_shift from public.eg_shifts
    where company_id=p_company_id and user_id=v_uid and status<>'closed'
    for update;

  if p_action='clock_in' then
    if found then raise exception 'Esiste già un turno aperto'; end if;
    if p_site_id is not null and not exists (
      select 1 from public.eg_sites where id=p_site_id and company_id=p_company_id
    ) then raise exception 'Cantiere non valido'; end if;
    insert into public.eg_shifts(company_id,user_id,site_id,started_at,status)
    values(p_company_id,v_uid,p_site_id,v_time,'working')
    returning id into v_id;
    insert into public.eg_shift_events(company_id,shift_id,actor_id,action,occurred_at)
    values(p_company_id,v_id,v_uid,'clock_in',v_time);
    return v_id;
  end if;

  if not found then raise exception 'Nessun turno aperto'; end if;
  v_id := v_shift.id;
  if p_action='break_start' then
    if v_shift.status <> 'working' then raise exception 'Pausa già avviata'; end if;
    update public.eg_shifts set break_started_at=v_time,status='break' where id=v_id;
    insert into public.eg_shift_events(company_id,shift_id,actor_id,action,occurred_at)
    values(p_company_id,v_id,v_uid,'break_start',v_time);
  elsif p_action='break_end' then
    if v_shift.status <> 'break' then raise exception 'Nessuna pausa da terminare'; end if;
    v_elapsed := greatest(0,floor(extract(epoch from v_time-v_shift.break_started_at))::integer);
    update public.eg_shifts set
      break_seconds=break_seconds+v_elapsed,break_started_at=null,status='working' where id=v_id;
    insert into public.eg_shift_events(company_id,shift_id,actor_id,action,occurred_at)
    values(p_company_id,v_id,v_uid,'break_end',v_time);
  elsif p_action='clock_out' then
    if v_shift.status='break' then
      v_elapsed := greatest(0,floor(extract(epoch from v_time-v_shift.break_started_at))::integer);
      insert into public.eg_shift_events(company_id,shift_id,actor_id,action,occurred_at)
      values(p_company_id,v_id,v_uid,'break_end',v_time);
    else v_elapsed := 0; end if;
    update public.eg_shifts set
      break_seconds=break_seconds+v_elapsed,break_started_at=null,
      ended_at=v_time,status='closed' where id=v_id;
    insert into public.eg_shift_events(company_id,shift_id,actor_id,action,occurred_at)
    values(p_company_id,v_id,v_uid,'clock_out',v_time);
  else
    raise exception 'Azione timbratura non valida';
  end if;
  return v_id;
end
$eg_shift_rpc$;
revoke all on function public.eg_shift_action(uuid,text,uuid) from public,anon;
grant execute on function public.eg_shift_action(uuid,text,uuid) to authenticated;

commit;

-- Verifica sul progetto EasyGart: 2 tabelle con RLS, 2 policy SELECT e RPC.
select tablename,policyname,cmd
from pg_policies
where schemaname='public' and tablename in ('eg_shifts','eg_shift_events')
order by tablename,policyname;
