-- EasyGart: annullamento timbrature concluse (senza eliminare la traccia storica).
-- Applicare SOLO nel progetto Supabase EasyGart: xdwsqkteykjjpzogwocx.
-- Dipendenza: easygart_attendance_v1.sql. Non eseguire su altri progetti.
begin;

do $eg_guard$
begin
  if to_regclass('public.eg_shifts') is null
     or to_regclass('public.eg_members') is null then
    raise exception 'Tabelle presenze EasyGart mancanti';
  end if;
end
$eg_guard$;

alter table public.eg_shifts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

create index if not exists eg_shifts_active_by_company_date
  on public.eg_shifts(company_id, started_at desc) where deleted_at is null;

-- Nessun permesso UPDATE/DELETE diretto per il browser. Soltanto questa RPC
-- può annullare turni già chiusi. Le marcature originali e gli eventi restano.
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
  if v_role <> 'owner' and v_shift.user_id <> v_uid then
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

revoke all on function public.eg_delete_shift(uuid,uuid) from public,anon,authenticated;
grant execute on function public.eg_delete_shift(uuid,uuid) to authenticated;

commit;

-- Controllo post-migrazione, senza scrivere dati:
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='eg_shifts'
-- and column_name in ('deleted_at','deleted_by');
