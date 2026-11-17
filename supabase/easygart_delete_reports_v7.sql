-- Gartenarte/EasyGart: staff and owner may remove historic non-invoiced
-- reports. Deletion is logical so the audit trail and linked evidence remain.
alter table public.eg_daily_reports
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);
alter table public.eg_daily_reports
  drop constraint if exists eg_reports_deletion_pair_check;
alter table public.eg_daily_reports
  add constraint eg_reports_deletion_pair_check
  check ((deleted_at is null and deleted_by is null) or
         (deleted_at is not null and deleted_by is not null));

create index if not exists eg_reports_active_month_idx
  on public.eg_daily_reports(company_id,work_date,created_by)
  where deleted_at is null;

-- Deleted rows disappear from all normal RLS reads, including worker queries,
-- owner dashboards, calendar and history. Deletion itself is RPC-only.
drop policy if exists eg_reports_select on public.eg_daily_reports;
create policy eg_reports_select on public.eg_daily_reports
  for select to authenticated
  using (
    deleted_at is null and
    (private.eg_is_owner(company_id) or
     (private.eg_is_member(company_id) and created_by=(select auth.uid())))
  );

alter table public.eg_daily_report_events
  drop constraint if exists eg_daily_report_events_action_check;
alter table public.eg_daily_report_events
  add constraint eg_daily_report_events_action_check
  check (action in ('created','edited','submitted','approved','changes_requested','deleted'));

create or replace function private.eg_avoid_editing_deleted_report()
returns trigger language plpgsql set search_path=''
as $$
begin
  if old.deleted_at is not null then
    raise exception 'Rapporto eliminato: non è più modificabile';
  end if;
  return new;
end $$;
drop trigger if exists eg_prevent_deleted_report_update on public.eg_daily_reports;
create trigger eg_prevent_deleted_report_update
 before update on public.eg_daily_reports
 for each row execute function private.eg_avoid_editing_deleted_report();

create or replace function private.eg_delete_daily_report(p_report_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_report public.eg_daily_reports%rowtype;
begin
  if v_actor is null or p_report_id is null then
    raise exception 'Accesso richiesto';
  end if;
  select * into v_report from public.eg_daily_reports
    where id=p_report_id for update;
  if not found or v_report.deleted_at is not null then
    raise exception 'Rapporto già eliminato o inesistente';
  end if;
  if not (private.eg_is_owner(v_report.company_id) or
    (private.eg_is_member(v_report.company_id) and v_report.created_by=v_actor)) then
    raise exception 'Puoi eliminare solo i tuoi rapporti';
  end if;
  if v_report.invoice_locked or exists(
    select 1 from public.eg_invoice_drafts i where i.report_id=p_report_id)
  then
    raise exception 'Rapporto collegato a proforma: impossibile eliminarlo';
  end if;
  update public.eg_daily_reports
    set deleted_at=now(),deleted_by=v_actor,updated_at=now()
    where id=p_report_id and deleted_at is null;

  insert into public.eg_daily_report_events(company_id,report_id,actor_id,action,note)
  values(v_report.company_id,p_report_id,v_actor,'deleted',
    jsonb_build_object('data',v_report.work_date,
      'dipendente',v_report.created_by,
      'cantiere',v_report.site_id,
      'ore_minuti',v_report.minutes_worked,
      'stato_precedente',v_report.status)::text);
  return true;
end $$;

create or replace function public.eg_delete_daily_report(p_report_id uuid)
returns boolean language sql set search_path=''
as $$select private.eg_delete_daily_report(p_report_id);$$;
revoke all on function public.eg_delete_daily_report(uuid) from public,anon;
grant execute on function public.eg_delete_daily_report(uuid) to authenticated;

-- No new invoices may refer to a report that has been removed, even if it
-- was previously approved. Existing invoice locking remains untouched.
create or replace function private.eg_disallow_invoice_from_deleted_report()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if not exists(
   select 1 from public.eg_daily_reports r
   where r.id=new.report_id and r.company_id=new.company_id
     and r.deleted_at is null
 ) then
   raise exception 'Rapporto eliminato: impossibile creare una proforma';
 end if;
 return new;
end $$;
drop trigger if exists eg_invoice_disallow_deleted_report on public.eg_invoice_drafts;
create trigger eg_invoice_disallow_deleted_report
 before insert on public.eg_invoice_drafts
 for each row execute function private.eg_disallow_invoice_from_deleted_report();

-- Only current reports can contribute materials to monthly/site summaries.
create or replace function private.eg_list_month_materials(
 p_company_id uuid,p_begin date,p_end date)
returns table(report_id uuid,material_id uuid,material_name text,unit text,quantity numeric)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not private.eg_is_member(p_company_id) then
   raise exception 'Accesso negato';
 end if;
 if p_begin is null or p_end is null or p_end<=p_begin
   or p_begin<date '2020-01-01' or p_end>date '2100-01-01'
 then raise exception 'Intervallo non valido'; end if;
 return query
 select x.report_id,x.material_id,x.material_name,x.unit,x.quantity
 from public.eg_report_materials x
 join public.eg_daily_reports r
   on r.id=x.report_id and r.company_id=x.company_id
 where x.company_id=p_company_id and r.deleted_at is null
   and r.work_date>=p_begin and r.work_date<p_end
   and (private.eg_is_owner(p_company_id) or r.created_by=auth.uid())
 order by r.work_date,x.material_name;
end $$;

-- Do not serve media records for removed reports through RLS.
drop policy if exists eg_media_read on public.eg_report_media;
create policy eg_media_read on public.eg_report_media
 for select to authenticated using (
   status='uploaded'
   and exists(
     select 1 from public.eg_daily_reports r
       where r.id=eg_report_media.report_id
       and r.company_id=eg_report_media.company_id
       and r.deleted_at is null
   )
   and (private.eg_is_owner(company_id) or
     (private.eg_is_member(company_id) and author_id=(select auth.uid())))
 );

-- Signed media URLs have a short TTL. Stop issuing new URLs for deleted
-- reports even when a user knows the old storage path.
create or replace function private.eg_media_can_read(p_path text)
returns boolean language sql stable security definer set search_path=''
as $$
select auth.uid() is not null and exists(
 select 1 from public.eg_report_media m
 join public.eg_daily_reports r
   on r.id=m.report_id and r.company_id=m.company_id
 where m.storage_path=p_path and r.deleted_at is null
   and (m.status='uploaded' or
        (m.status='reserved' and m.author_id=auth.uid()
          and r.created_by=auth.uid()
          and r.status in ('draft','changes_requested')))
   and (private.eg_is_owner(m.company_id) or
        (private.eg_is_member(m.company_id) and m.author_id=auth.uid()))
);
$$;

-- Deleting a report prevents further material changes via older RPCs.
create or replace function private.eg_protect_deleted_report_materials()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_report uuid;begin
 v_report:=case when TG_OP='DELETE' then old.report_id else new.report_id end;
 if exists(select 1 from public.eg_daily_reports r
    where r.id=v_report and r.deleted_at is not null) then
   raise exception 'I materiali di un rapporto eliminato non sono modificabili';
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
drop trigger if exists eg_block_deleted_report_materials on public.eg_report_materials;
create trigger eg_block_deleted_report_materials
 before insert or update or delete on public.eg_report_materials
 for each row execute function private.eg_protect_deleted_report_materials();
