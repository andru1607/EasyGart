-- EasyGart Cloud MVP v1.0 - schema isolato, eseguire SOLO sul progetto Supabase EasyGart.
-- Script rieseguibile nel progetto con ref xdwsqkteykjjpzogwocx: tabelle IF NOT EXISTS, policies ricreate.
-- Non eseguire su SINDRU, Nexo o altri progetti. Non ancora collaudato su DB remoto.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.eg_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 150),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.eg_members (
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('owner','worker')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key(company_id,user_id)
);
create table if not exists public.eg_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique(company_id,id)
);
create table if not exists public.eg_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  address text not null default '',
  unique(company_id,id),
  unique(company_id,client_id,id),
  foreign key (company_id,client_id) references public.eg_clients(company_id,id) on delete cascade
);
create table if not exists public.eg_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  client_id uuid not null,
  site_id uuid,
  assignee_id uuid not null,
  assigned_by uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 2 and 200),
  instructions text not null default '',
  due_date date not null,
  start_time time,
  estimated_minutes int check (estimated_minutes is null or estimated_minutes between 0 and 1440),
  priority text not null default 'media' check (priority in ('bassa','media','alta')),
  status text not null default 'assigned' check (status in ('assigned','in_progress','done')),
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  done_at timestamptz,
  completed_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key(company_id,client_id) references public.eg_clients(company_id,id),
  foreign key(company_id,client_id,site_id) references public.eg_sites(company_id,client_id,id),
  foreign key(company_id,assignee_id) references public.eg_members(company_id,user_id)
);
create table if not exists public.eg_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  unique(company_id,email)
);
create table if not exists public.eg_task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.eg_tasks(id) on delete cascade,
  company_id uuid not null references public.eg_companies(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  event text not null check(event in ('started','completed','reopened')),
  at timestamptz not null default now()
);
create index if not exists eg_tasks_assignee_due_idx on public.eg_tasks(company_id,assignee_id,due_date);
create index if not exists eg_tasks_company_status_idx on public.eg_tasks(company_id,status,due_date);
create index if not exists eg_invites_email_idx on public.eg_invites(email) where claimed_at is null;
create index if not exists eg_task_events_company_idx on public.eg_task_events(company_id,at desc);

create or replace function private.eg_is_member(p_company_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
  and exists (select 1 from public.eg_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.active);
$$;
create or replace function private.eg_is_owner(p_company_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
  and exists (select 1 from public.eg_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.active and m.role = 'owner');
$$;
revoke all on function private.eg_is_member(uuid),private.eg_is_owner(uuid) from public,anon;
grant execute on function private.eg_is_member(uuid),private.eg_is_owner(uuid) to authenticated;

create or replace function private.eg_create_owner_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.eg_members(company_id,user_id,full_name,role)
  values(new.id,new.created_by,'Titolare','owner');
  return new;
end; $$;
revoke all on function private.eg_create_owner_membership() from public,anon,authenticated;
drop trigger if exists eg_company_add_owner on public.eg_companies;
create trigger eg_company_add_owner after insert on public.eg_companies
for each row execute function private.eg_create_owner_membership();

create or replace function private.eg_touch_task() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;
revoke all on function private.eg_touch_task() from public,anon,authenticated;
drop trigger if exists eg_tasks_touched on public.eg_tasks;
create trigger eg_tasks_touched before update on public.eg_tasks
for each row execute function private.eg_touch_task();

-- Solo connessioni autenticate. Le policies sono l'unica fonte di autorizzazione per le tabelle.
revoke all on public.eg_companies,public.eg_members,public.eg_clients,public.eg_sites,
  public.eg_tasks,public.eg_invites,public.eg_task_events from anon,authenticated;
grant select,insert,update on public.eg_companies to authenticated;
grant select on public.eg_members to authenticated;
grant select,insert,update on public.eg_clients,public.eg_sites,public.eg_tasks to authenticated;
grant select,insert on public.eg_invites to authenticated;
grant select on public.eg_task_events to authenticated;
alter table public.eg_companies enable row level security;
alter table public.eg_members enable row level security;
alter table public.eg_clients enable row level security;
alter table public.eg_sites enable row level security;
alter table public.eg_tasks enable row level security;
alter table public.eg_invites enable row level security;
alter table public.eg_task_events enable row level security;

drop policy if exists eg_companies_read on public.eg_companies;
create policy eg_companies_read on public.eg_companies for select to authenticated
  using(private.eg_is_member(id));
drop policy if exists eg_companies_create on public.eg_companies;
create policy eg_companies_create on public.eg_companies for insert to authenticated
  with check ((select auth.uid()) = created_by);
drop policy if exists eg_companies_edit on public.eg_companies;
create policy eg_companies_edit on public.eg_companies for update to authenticated
  using(private.eg_is_owner(id)) with check(private.eg_is_owner(id) and created_by = (select auth.uid()));
drop policy if exists eg_members_read on public.eg_members;
create policy eg_members_read on public.eg_members for select to authenticated
  using ((select auth.uid()) = user_id or private.eg_is_owner(company_id));
drop policy if exists eg_clients_read on public.eg_clients;
create policy eg_clients_read on public.eg_clients for select to authenticated
  using(private.eg_is_owner(company_id) or (
    private.eg_is_member(company_id) and exists(
      select 1 from public.eg_tasks t where t.client_id=eg_clients.id and t.company_id=eg_clients.company_id and t.assignee_id=(select auth.uid())
    )));
drop policy if exists eg_clients_write on public.eg_clients;
create policy eg_clients_write on public.eg_clients for insert to authenticated
  with check(private.eg_is_owner(company_id));
drop policy if exists eg_clients_edit on public.eg_clients;
create policy eg_clients_edit on public.eg_clients for update to authenticated
  using(private.eg_is_owner(company_id)) with check(private.eg_is_owner(company_id));
drop policy if exists eg_sites_read on public.eg_sites;
create policy eg_sites_read on public.eg_sites for select to authenticated
  using(private.eg_is_owner(company_id) or (
    private.eg_is_member(company_id) and exists(
      select 1 from public.eg_tasks t where t.site_id=eg_sites.id and t.company_id=eg_sites.company_id and t.assignee_id=(select auth.uid())
    )));
drop policy if exists eg_sites_write on public.eg_sites;
create policy eg_sites_write on public.eg_sites for insert to authenticated
  with check(private.eg_is_owner(company_id));
drop policy if exists eg_sites_edit on public.eg_sites;
create policy eg_sites_edit on public.eg_sites for update to authenticated
  using(private.eg_is_owner(company_id)) with check(private.eg_is_owner(company_id));
drop policy if exists eg_tasks_read on public.eg_tasks;
create policy eg_tasks_read on public.eg_tasks for select to authenticated
  using(private.eg_is_owner(company_id) or
    (private.eg_is_member(company_id) and assignee_id = (select auth.uid())));
drop policy if exists eg_tasks_write on public.eg_tasks;
create policy eg_tasks_write on public.eg_tasks for insert to authenticated
  with check(private.eg_is_owner(company_id)
    and assigned_by = (select auth.uid())
    and status = 'assigned'
    and started_at is null and done_at is null and completed_by is null
    and exists(select 1 from public.eg_members m where m.company_id=eg_tasks.company_id
      and m.user_id=eg_tasks.assignee_id and m.active and m.role='worker'));
drop policy if exists eg_tasks_edit on public.eg_tasks;
create policy eg_tasks_edit on public.eg_tasks for update to authenticated
  using(private.eg_is_owner(company_id)) with check(private.eg_is_owner(company_id)
    and exists(select 1 from public.eg_members m where m.company_id=eg_tasks.company_id
      and m.user_id=eg_tasks.assignee_id and m.active and m.role='worker'));
drop policy if exists eg_invites_read on public.eg_invites;
create policy eg_invites_read on public.eg_invites for select to authenticated
  using(private.eg_is_owner(company_id));
drop policy if exists eg_invites_create on public.eg_invites;
create policy eg_invites_create on public.eg_invites for insert to authenticated
  with check(private.eg_is_owner(company_id) and invited_by=(select auth.uid())
    and claimed_at is null and claimed_by is null and expires_at>now() and expires_at<=now()+interval '7 days');
drop policy if exists eg_task_events_read on public.eg_task_events;
create policy eg_task_events_read on public.eg_task_events for select to authenticated
  using(private.eg_is_owner(company_id) or (
    private.eg_is_member(company_id) and exists(
      select 1 from public.eg_tasks t where t.id=eg_task_events.task_id and t.company_id=eg_task_events.company_id
      and t.assignee_id=(select auth.uid())
    )));

-- Gli utenti accettano un invito soltanto dopo verifica dell'indirizzo email.
-- La funzione controlla l'email nel sistema Auth, non in user_metadata modificabili dall'utente.
create or replace function public.eg_claim_invitations() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.eg_invites%rowtype;
  v_count int := 0;
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  select lower(u.email) into v_email from auth.users u where u.id=v_uid and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'Conferma prima la tua email'; end if;
  for v_inv in select * from public.eg_invites
    where email=v_email and claimed_at is null and expires_at>now()
    for update
  loop
    insert into public.eg_members(company_id,user_id,full_name,role,active)
      values(v_inv.company_id,v_uid,split_part(v_email,'@',1),'worker',true)
      on conflict (company_id,user_id) do nothing;
    update public.eg_invites set claimed_at=now(), claimed_by=v_uid where id=v_inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.eg_claim_invitations() from public,anon;
grant execute on function public.eg_claim_invitations() to authenticated;

-- Un operaio non ha permessi UPDATE sulla tabella: può cambiare solo stato tramite questo RPC validato.
create or replace function public.eg_set_task_status(p_task_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_task public.eg_tasks%rowtype;
  v_owner boolean;
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  select * into v_task from public.eg_tasks where id=p_task_id for update;
  if not found then raise exception 'Attività non trovata'; end if;
  v_owner := private.eg_is_owner(v_task.company_id);
  if not v_owner and not (private.eg_is_member(v_task.company_id) and v_task.assignee_id=v_uid) then
    raise exception 'Non autorizzato';
  end if;
  if p_status not in ('assigned','in_progress','done') then raise exception 'Stato non valido'; end if;
  if p_status='assigned' then
    if not v_owner then raise exception 'Solo titolare può riaprire'; end if;
    update public.eg_tasks set status='assigned',started_at=null,done_at=null,completed_by=null
      where id=p_task_id;
    insert into public.eg_task_events(task_id,company_id,actor_id,event)
      values(p_task_id,v_task.company_id,v_uid,'reopened');
  elsif p_status='in_progress' then
    if v_task.status<>'assigned' then raise exception 'Attività non assegnata'; end if;
    update public.eg_tasks set status='in_progress',started_at=now(),done_at=null,completed_by=null
      where id=p_task_id;
    insert into public.eg_task_events(task_id,company_id,actor_id,event)
      values(p_task_id,v_task.company_id,v_uid,'started');
  elsif p_status='done' then
    if v_task.status='done' then raise exception 'Attività già completata'; end if;
    update public.eg_tasks set status='done',started_at=coalesce(started_at,now()),done_at=now(),completed_by=v_uid
      where id=p_task_id;
    insert into public.eg_task_events(task_id,company_id,actor_id,event)
      values(p_task_id,v_task.company_id,v_uid,'completed');
  end if;
end; $$;
revoke all on function public.eg_set_task_status(uuid,text) from public,anon;
grant execute on function public.eg_set_task_status(uuid,text) to authenticated;


-- Reinvio sicuro: il titolare può rinnovare un invito scaduto senza creare duplicati.
grant usage on schema public to authenticated;
create or replace function public.eg_invite_worker(p_company_id uuid,p_email text) returns uuid
language plpgsql security definer set search_path = '' as $eg_invite$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if v_uid is null or not private.eg_is_owner(p_company_id) then raise exception 'Non autorizzato'; end if;
  if length(v_email) < 5 or length(v_email) > 200 or position('@' in v_email) < 2 then
    raise exception 'Email non valida';
  end if;
  insert into public.eg_invites(company_id,email,invited_by,expires_at,claimed_at,claimed_by)
  values(p_company_id,v_email,v_uid,now()+interval '7 days',null,null)
  on conflict (company_id,email) do update
  set invited_by=excluded.invited_by,expires_at=excluded.expires_at,
      claimed_at=null,claimed_by=null,created_at=now()
  returning id into v_id;
  return v_id;
end; $eg_invite$;
revoke all on function public.eg_invite_worker(uuid,text) from public,anon;
grant execute on function public.eg_invite_worker(uuid,text) to authenticated;

-- Il titolare può sospendere e riattivare un dipendente senza esporre UPDATE diretto sui ruoli.
create or replace function public.eg_set_worker_active(
  p_company_id uuid,p_user_id uuid,p_active boolean) returns void
language plpgsql security definer set search_path = '' as $eg_worker$
begin
  if auth.uid() is null or not private.eg_is_owner(p_company_id) then
    raise exception 'Solo il titolare può cambiare lo stato del dipendente';
  end if;
  update public.eg_members
    set active=p_active
    where company_id=p_company_id and user_id=p_user_id and role='worker';
  if not found then raise exception 'Dipendente non trovato'; end if;
end; $eg_worker$;
revoke all on function public.eg_set_worker_active(uuid,uuid,boolean) from public,anon;
grant execute on function public.eg_set_worker_active(uuid,uuid,boolean) to authenticated;

-- Check extra: nessun progetto legacy toccato; niente service_role nell'app client.
-- Prima dell'uso reale verificare RLS con due aziende e account differenti, lock,
-- invite scaduti, revoche dipendenti e modifiche concorrenti.
