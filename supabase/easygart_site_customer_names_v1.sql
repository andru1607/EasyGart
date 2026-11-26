-- EasyGart only: company members see the customer name for their visible sites, not contact fields.
begin;
create or replace function private.eg_site_customer_names(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.eg_is_member(p_company_id) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  return (select coalesce(jsonb_object_agg(s.id::text,c.name),'{}'::jsonb)
    from public.eg_sites s join public.eg_clients c
    on c.company_id=s.company_id and c.id=s.client_id
    where s.company_id=p_company_id);
end;
$$;
revoke all on function private.eg_site_customer_names(uuid) from public,anon;
grant execute on function private.eg_site_customer_names(uuid) to authenticated;
create or replace function public.eg_site_customer_names(p_company_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.eg_site_customer_names(p_company_id);
$$;
revoke all on function public.eg_site_customer_names(uuid) from public,anon;
grant execute on function public.eg_site_customer_names(uuid) to authenticated;
commit;
