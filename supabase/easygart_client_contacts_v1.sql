-- EasyGart Cloud: dati di contatto clienti da screenshot e inserimento manuale.
-- Eseguire SOLO sul progetto Supabase EasyGart xdwsqkteykjjpzogwocx.
-- Non modifica altre applicazioni, utenti, regole RLS o report.
begin;
do $eg$
begin
  if to_regclass('public.eg_clients') is null or to_regclass('public.eg_members') is null
    then raise exception 'Schema EasyGart non installato'; end if;
end
$eg$;
alter table public.eg_clients
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists address text not null default '';
-- Limiti coerenti con la validazione frontend. Non si accettano valori infiniti.
do $eg_constraints$
begin
  if not exists (select 1 from pg_constraint where conname='eg_clients_phone_length') then
    alter table public.eg_clients add constraint eg_clients_phone_length check (char_length(phone)<=80);
  end if;
  if not exists (select 1 from pg_constraint where conname='eg_clients_email_length') then
    alter table public.eg_clients add constraint eg_clients_email_length check (char_length(email)<=200);
  end if;
  if not exists (select 1 from pg_constraint where conname='eg_clients_address_length') then
    alter table public.eg_clients add constraint eg_clients_address_length check (char_length(address)<=300);
  end if;
end
$eg_constraints$;
-- Conserva RLS e permessi aziendali esistenti di eg_clients.
commit;
select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='eg_clients'
  and column_name in ('phone','email','address')
order by column_name;
