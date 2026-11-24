-- EasyGart: delete only an unused customer, owner or delegated administrator.
begin;
-- The existing FK cascades to sites. Keep the data safe by blocking direct
-- customer deletes with linked sites before the cascade can run.
-- The private function locks the customer row, so concurrent FK inserts
-- must wait; existing linked sites are checked after the row lock.
create or replace function private.eg_delete_unused_client(p_company_id uuid,p_client_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.eg_is_owner(p_company_id) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  perform 1 from public.eg_clients
    where company_id=p_company_id and id=p_client_id for update;
  if not found then return false; end if;
  if exists(select 1 from public.eg_sites where company_id=p_company_id and client_id=p_client_id)
    or exists(select 1 from public.eg_tasks where company_id=p_company_id and client_id=p_client_id) then
    raise exception 'customer has linked records' using errcode='23503';
  end if;
  -- Other historical links (invoices, maintenance) use restrictive FKs.
  delete from public.eg_clients where company_id=p_company_id and id=p_client_id;
  return found;
end;
$$;
revoke all on function private.eg_delete_unused_client(uuid,uuid) from public,anon;
grant execute on function private.eg_delete_unused_client(uuid,uuid) to authenticated;
create or replace function public.eg_delete_unused_client(p_company_id uuid,p_client_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.eg_delete_unused_client(p_company_id,p_client_id);
$$;
revoke all on function public.eg_delete_unused_client(uuid,uuid) from public,anon;
grant execute on function public.eg_delete_unused_client(uuid,uuid) to authenticated;
commit;
