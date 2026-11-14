-- EasyGart Cloud: riparazione mirata della creazione azienda (RLS)
-- Eseguire nel SQL Editor del progetto EasyGart: xdwsqkteykjjpzogwocx
-- Eseguire DOPO easygart_core_v1.sql. Non modifica aziende/dipendenti esistenti.
-- Non disabilita RLS e non concede permessi a utenti anonimi.
begin;

do $eg_preflight$
begin
  if to_regclass('public.eg_companies') is null
     or to_regclass('public.eg_members') is null
     or to_regprocedure('private.eg_is_member(uuid)') is null
     or to_regprocedure('private.eg_is_owner(uuid)') is null then
    raise exception 'Schema base EasyGart incompleto: applicare prima easygart_core_v1.sql nel progetto corretto';
  end if;
end;
$eg_preflight$;

-- Il proprietario è sempre determinato dal JWT autenticato sul server,
-- non da un ID fornito liberamente dal browser.
alter table public.eg_companies
  alter column created_by set default auth.uid();

revoke all on public.eg_companies from anon;
grant select,insert,update on public.eg_companies to authenticated;
grant select on public.eg_members to authenticated;
alter table public.eg_companies enable row level security;
alter table public.eg_members enable row level security;

-- INSERT consentito esclusivamente all'utente autenticato come proprietario.
drop policy if exists eg_companies_create on public.eg_companies;
create policy eg_companies_create on public.eg_companies
  for insert to authenticated
  with check ((select auth.uid()) is not null
              and created_by = (select auth.uid()));

-- Le aziende rimangono leggibili solo dai membri attivi.
drop policy if exists eg_companies_read on public.eg_companies;
create policy eg_companies_read on public.eg_companies
  for select to authenticated
  using (private.eg_is_member(id));

-- Il proprietario può modificare solo la propria azienda.
drop policy if exists eg_companies_edit on public.eg_companies;
create policy eg_companies_edit on public.eg_companies
  for update to authenticated
  using (private.eg_is_owner(id))
  with check (private.eg_is_owner(id) and created_by = (select auth.uid()));

-- L'iscrizione del titolare deve essere creata nella stessa transazione.
-- Funzione trigger già prevista dallo schema base, con privilegi limitati.
create or replace function private.eg_create_owner_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $eg_owner_trigger$
begin
  insert into public.eg_members(company_id,user_id,full_name,role,active)
    values(new.id,new.created_by,'Titolare','owner',true)
    on conflict (company_id,user_id) do nothing;
  return new;
end;
$eg_owner_trigger$;
revoke all on function private.eg_create_owner_membership() from public,anon,authenticated;

drop trigger if exists eg_company_add_owner on public.eg_companies;
create trigger eg_company_add_owner
  after insert on public.eg_companies
  for each row execute function private.eg_create_owner_membership();

-- Il titolare deve poter leggere la propria iscrizione per aprire la dashboard.
drop policy if exists eg_members_read on public.eg_members;
create policy eg_members_read on public.eg_members
  for select to authenticated
  using ((select auth.uid()) = user_id or private.eg_is_owner(company_id));

commit;

-- Diagnostica senza leggere i dati aziendali.
-- Nel risultato devono comparire eg_companies_create (INSERT),
-- eg_companies_read (SELECT), eg_companies_edit (UPDATE), eg_members_read (SELECT).
select tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='public' and tablename in ('eg_companies','eg_members')
order by tablename,policyname;
