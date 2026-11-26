-- EasyGart only: remove unused sites without deleting customers or work history.
-- Target project: xdwsqkteykjjpzogwocx (Gartenarte).
begin;
create or replace function private.eg_delete_unused_site(p_company_id uuid,p_site_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.eg_is_owner(p_company_id) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  perform 1 from public.eg_sites
    where company_id=p_company_id and id=p_site_id for update;
  if not found then return false; end if;
  if exists(select 1 from public.eg_tasks where company_id=p_company_id and site_id=p_site_id)
    or exists(select 1 from public.eg_daily_reports where company_id=p_company_id and site_id=p_site_id)
    or exists(select 1 from public.eg_shifts where company_id=p_company_id and site_id=p_site_id)
    or exists(select 1 from public.eg_maintenance_plans where company_id=p_company_id and site_id=p_site_id) then
    raise exception 'site has linked records' using errcode='23503';
  end if;
  -- Remaining historical FK references must also reject the deletion.
  delete from public.eg_sites where company_id=p_company_id and id=p_site_id;
  return found;
end;
$$;
revoke all on function private.eg_delete_unused_site(uuid,uuid) from public,anon;
grant execute on function private.eg_delete_unused_site(uuid,uuid) to authenticated;
create or replace function public.eg_delete_unused_site(p_company_id uuid,p_site_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.eg_delete_unused_site(p_company_id,p_site_id);
$$;
revoke all on function public.eg_delete_unused_site(uuid,uuid) from public,anon;
grant execute on function public.eg_delete_unused_site(uuid,uuid) to authenticated;
commit;
