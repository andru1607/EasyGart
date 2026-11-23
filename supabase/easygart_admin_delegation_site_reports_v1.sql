-- EasyGart: admin delegato e rapporti di cantiere per tutta la squadra.
-- Applicare ESCLUSIVAMENTE al progetto xdwsqkteykjjpzogwocx (Gartenarte/EasyGart).
-- Prerequisiti: easygart_core_v1.sql, easygart_daily_reports_v1.sql.
-- Il dipendente RESTA "worker" (timbrature e attività personali), con permessi
-- gestionali aggiuntivi finché la delega è attiva. Soltanto il titolare fondatore
-- può concederla o revocarla. Nessuna password o credenziale condivisa.
begin;

do $eg_guard$
begin
  if to_regclass('public.eg_companies') is null or
     to_regclass('public.eg_members') is null or
     to_regclass('public.eg_daily_reports') is null or
     to_regprocedure('private.eg_is_owner(uuid)') is null then
    raise exception 'Mancano le migrazioni base EasyGart';
  end if;
end $eg_guard$;

create table if not exists public.eg_admin_delegations (
  company_id uuid not null,
  user_id uuid not null,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (company_id,user_id),
  foreign key (company_id,user_id)
    references public.eg_members(company_id,user_id) on delete cascade
);

create table if not exists public.eg_admin_delegation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  target_user_id uuid not null references auth.users(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('grant','revoke')),
  occurred_at timestamptz not null default now()
);
create index if not exists eg_admin_delegations_user
  on public.eg_admin_delegations(user_id,company_id);
create index if not exists eg_admin_delegate_events_company
  on public.eg_admin_delegation_events(company_id,occurred_at desc);

revoke all on public.eg_admin_delegations,public.eg_admin_delegation_events from public,anon,authenticated;
grant select on public.eg_admin_delegations,public.eg_admin_delegation_events to authenticated;
alter table public.eg_admin_delegations enable row level security;
alter table public.eg_admin_delegation_events enable row level security;

-- Questo helper esiste già e viene usato dalle RLS e dalle RPC della gestione
-- materiali, squadra, fatture, rapporti e manutenzioni. La delega lo estende
-- senza alterare il ruolo "worker" necessario alle timbrature personali.
create or replace function private.eg_is_owner(p_company_id uuid)
returns boolean language sql stable security definer set search_path='' as $eg_admin_owner$
  select (select auth.uid()) is not null and exists(
    select 1 from public.eg_members m
    where m.company_id=p_company_id
      and m.user_id=(select auth.uid()) and m.active
      and (
        m.role='owner'
        or (m.role='worker' and exists (
          select 1 from public.eg_admin_delegations d
          where d.company_id=m.company_id and d.user_id=m.user_id
        ))
      )
  );
$eg_admin_owner$;
revoke all on function private.eg_is_owner(uuid) from public,anon;
grant execute on function private.eg_is_owner(uuid) to authenticated;

-- Titolare e amministratore possono correggere il nome aziendale, ma nessuno
-- dei due può cambiare il proprietario created_by tramite le API pubbliche.
revoke update on public.eg_companies from authenticated;
grant update(name) on public.eg_companies to authenticated;
drop policy if exists eg_companies_edit on public.eg_companies;
create policy eg_companies_edit on public.eg_companies for update to authenticated
  using(private.eg_is_owner(id)) with check(private.eg_is_owner(id));

drop policy if exists eg_admin_delegations_read on public.eg_admin_delegations;
create policy eg_admin_delegations_read on public.eg_admin_delegations
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.eg_is_owner(company_id)
);

drop policy if exists eg_admin_delegation_events_read on public.eg_admin_delegation_events;
create policy eg_admin_delegation_events_read on public.eg_admin_delegation_events
for select to authenticated
using(exists(
  select 1 from public.eg_companies c
  where c.id=company_id and c.created_by=(select auth.uid())
));

-- Un amministratore delegato NON può assegnare permessi ad altre persone:
-- il controllo usa esplicitamente l'utente fondatore e il ruolo owner.
create or replace function public.eg_set_admin_delegate(
  p_company_id uuid, p_user_id uuid, p_enable boolean
) returns boolean language plpgsql security definer set search_path='' as $eg_admin_delegate$
declare
  v_actor uuid := auth.uid();
  v_member public.eg_members%rowtype;
begin
  if v_actor is null or p_company_id is null or p_user_id is null or p_enable is null then
    raise exception 'Parametri non validi';
  end if;
  if not exists(
    select 1 from public.eg_companies c
    join public.eg_members m on m.company_id=c.id
     and m.user_id=v_actor and m.active and m.role='owner'
    where c.id=p_company_id and c.created_by=v_actor
  ) then
    raise exception 'Solo il titolare originale può gestire gli amministratori';
  end if;
  select * into v_member from public.eg_members
   where company_id=p_company_id and user_id=p_user_id for update;
  if not found or v_member.role<>'worker' then
    raise exception 'Seleziona un dipendente della tua azienda';
  end if;
  if p_enable and not v_member.active then
    raise exception 'Riattiva prima il dipendente';
  end if;

  if p_enable then
    insert into public.eg_admin_delegations(company_id,user_id,granted_by)
    values(p_company_id,p_user_id,v_actor)
    on conflict (company_id,user_id) do nothing;
    if found then
      insert into public.eg_admin_delegation_events
      (company_id,target_user_id,actor_id,action)
      values(p_company_id,p_user_id,v_actor,'grant');
    end if;
  else
    delete from public.eg_admin_delegations
      where company_id=p_company_id and user_id=p_user_id;
    if found then
      insert into public.eg_admin_delegation_events
      (company_id,target_user_id,actor_id,action)
      values(p_company_id,p_user_id,v_actor,'revoke');
    end if;
  end if;
  return true;
end;
$eg_admin_delegate$;
revoke all on function public.eg_set_admin_delegate(uuid,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.eg_set_admin_delegate(uuid,uuid,boolean) to authenticated;

-- Un dipendente autenticato può aprire qualunque cantiere della propria azienda,
-- compresi quelli senza interventi precedenti. Non può modificarli senza delega.
drop policy if exists eg_sites_read on public.eg_sites;
create policy eg_sites_read on public.eg_sites for select to authenticated
  using(private.eg_is_member(company_id));

-- I rapporti della squadra sono condivisi soltanto se inviati/approvati;
-- le bozze restano private all'autore e al titolare/amministratore.
-- La condizione deleted_at viene applicata dove la migrazione cancellazioni è già attiva.
drop policy if exists eg_reports_select on public.eg_daily_reports;
do $eg_policy$
declare
  v_deleted_clause text := '';
begin
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='eg_daily_reports' and column_name='deleted_at'
  ) then
    v_deleted_clause := 'and deleted_at is null';
  end if;
  execute 'create policy eg_reports_select on public.eg_daily_reports ' ||
    'for select to authenticated using(' ||
    'private.eg_is_owner(company_id) or ' ||
    '(private.eg_is_member(company_id) '||v_deleted_clause||' and (' ||
    ' created_by=(select auth.uid()) ' ||
    ' or (site_id is not null and status in (''submitted'',''approved''))' ||
    ')))';
end $eg_policy$;

-- I colleghi possono vedere chi ha compilato un rapporto senza ottenere dati Auth.
drop policy if exists eg_members_read on public.eg_members;
create policy eg_members_read on public.eg_members for select to authenticated
  using(private.eg_is_member(company_id));

-- Se la cancellazione delle timbrature è già installata, consentirla anche
-- all'amministratore delegato. Non crea il modulo se la migrazione precedente
-- non è ancora stata applicata.
do $eg_shift_delegate_upgrade$
begin
  if to_regprocedure('public.eg_delete_shift(uuid,uuid)') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='eg_shifts' and column_name='deleted_at'
    ) then
    execute $eg_shift_rpc$
create or replace function public.eg_delete_shift(
  p_company_id uuid, p_shift_id uuid
) returns boolean
language plpgsql security definer set search_path = '' as $eg_delete_shift$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_shift public.eg_shifts%rowtype;
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  select m.role into v_role from public.eg_members m
    where m.company_id=p_company_id and m.user_id=v_uid and m.active;
  if v_role is null or v_role not in ('owner','worker') then
    raise exception 'Utente non autorizzato';
  end if;

  select * into v_shift from public.eg_shifts s
    where s.company_id=p_company_id and s.id=p_shift_id for update;
  if not found then raise exception 'Timbratura non trovata'; end if;
  if not private.eg_is_owner(p_company_id) and v_shift.user_id <> v_uid then
    raise exception 'Puoi cancellare soltanto le tue timbrature';
  end if;
  if v_shift.deleted_at is not null then raise exception 'Timbratura già cancellata'; end if;
  if v_shift.status <> 'closed' or v_shift.ended_at is null then
    raise exception 'Puoi cancellare soltanto turni conclusi';
  end if;

  update public.eg_shifts
     set deleted_at=clock_timestamp(), deleted_by=v_uid
   where id=v_shift.id and company_id=p_company_id;
  return true;
end
$eg_delete_shift$;

    $eg_shift_rpc$;
  end if;
end
$eg_shift_delegate_upgrade$;

commit;

-- Solo verifica, nessuna modifica ai dati:
-- select * from public.eg_admin_delegations limit 10;
-- select proname,prosecdef from pg_proc where proname='eg_set_admin_delegate';
