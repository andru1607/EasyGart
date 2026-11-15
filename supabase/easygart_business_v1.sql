-- EasyGart Cloud • materiali, consumi, bozze proforma e piani ricorrenti
-- Project: xdwsqkteykjjpzogwocx. Prerequisites: core and daily-report schemas.
-- Monetary amounts are decimal EUR. Drafts are NOT Italian electronic invoices.
begin;
do $eg_check$
begin
 if to_regclass('public.eg_tasks') is null or to_regclass('public.eg_daily_reports') is null
    or to_regprocedure('private.eg_is_owner(uuid)') is null then
    raise exception 'EasyGart core/daily reports schema required';
 end if;
end $eg_check$;

create table if not exists public.eg_materials (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.eg_companies(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 2 and 200),
 unit text not null default 'pz' check (unit in ('pz','kg','l','m','m2','m3','h')),
 purchase_price numeric(12,2) not null default 0 check (purchase_price between 0 and 9999999),
 sale_price numeric(12,2) not null default 0 check (sale_price between 0 and 9999999),
 vat_rate numeric(5,2) not null default 22 check (vat_rate between 0 and 30),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(company_id,id)
);
create index if not exists eg_materials_company on public.eg_materials(company_id,name);
alter table public.eg_materials enable row level security;
revoke all on public.eg_materials from public,anon,authenticated;
grant select,insert,update on public.eg_materials to authenticated;
drop policy if exists eg_materials_owner_select on public.eg_materials;
create policy eg_materials_owner_select on public.eg_materials for select to authenticated
 using (private.eg_is_owner(company_id));
drop policy if exists eg_materials_owner_insert on public.eg_materials;
create policy eg_materials_owner_insert on public.eg_materials for insert to authenticated
 with check (private.eg_is_owner(company_id));
drop policy if exists eg_materials_owner_update on public.eg_materials;
create policy eg_materials_owner_update on public.eg_materials for update to authenticated
 using (private.eg_is_owner(company_id))
 with check (private.eg_is_owner(company_id));

create table if not exists public.eg_report_materials (
 company_id uuid not null,
 report_id uuid not null,
 material_id uuid not null,
 material_name text not null,
 unit text not null,
 quantity numeric(12,3) not null check (quantity > 0 and quantity <= 100000),
 sale_price_snapshot numeric(12,2) not null check (sale_price_snapshot >= 0),
 vat_rate_snapshot numeric(5,2) not null check (vat_rate_snapshot between 0 and 30),
 updated_at timestamptz not null default now(),
 primary key(report_id,material_id),
 foreign key(company_id,report_id) references public.eg_daily_reports(company_id,id) on delete cascade,
 foreign key(company_id,material_id) references public.eg_materials(company_id,id)
);
create index if not exists eg_report_materials_company_report on public.eg_report_materials(company_id,report_id);
alter table public.eg_report_materials enable row level security;
revoke all on public.eg_report_materials from public,anon,authenticated;
grant select on public.eg_report_materials to authenticated;
drop policy if exists eg_report_materials_owner_select on public.eg_report_materials;
create policy eg_report_materials_owner_select on public.eg_report_materials for select to authenticated
 using (private.eg_is_owner(company_id));
-- Workers never receive purchasing/selling prices: dedicated restricted RPCs below.
create or replace function private.eg_list_materials(p_company_id uuid)
returns table(id uuid,name text,unit text)
language plpgsql stable security definer set search_path=''
as $eg_list_materials$
begin
 if auth.uid() is null or not private.eg_is_member(p_company_id) then
    raise exception 'Not authorized';
 end if;
 return query select m.id,m.name,m.unit from public.eg_materials m
   where m.company_id=p_company_id and m.active order by m.name;
end
$eg_list_materials$;
revoke all on function private.eg_list_materials(uuid) from public,anon;
grant execute on function private.eg_list_materials(uuid) to authenticated;
create function public.eg_list_materials(p_company_id uuid)
returns table(id uuid,name text,unit text)
language sql security invoker set search_path=''
as $eg_api$ select * from private.eg_list_materials(p_company_id); $eg_api$;
revoke all on function public.eg_list_materials(uuid) from public,anon;
grant execute on function public.eg_list_materials(uuid) to authenticated;

create or replace function private.eg_list_report_materials(p_report_id uuid)
returns table(material_id uuid,material_name text,unit text,quantity numeric)
language plpgsql stable security definer set search_path=''
as $eg_list_report$
declare v_company uuid;v_owner uuid;
begin
 select r.company_id,r.created_by into v_company,v_owner
 from public.eg_daily_reports r where r.id=p_report_id;
 if v_company is null or auth.uid() is null or
  not (private.eg_is_owner(v_company) or
       (v_owner=auth.uid() and private.eg_is_member(v_company))) then
   raise exception 'Report access denied';
 end if;
 return query select x.material_id,x.material_name,x.unit,x.quantity
 from public.eg_report_materials x where x.report_id=p_report_id order by x.material_name;
end $eg_list_report$;
revoke all on function private.eg_list_report_materials(uuid) from public,anon;
grant execute on function private.eg_list_report_materials(uuid) to authenticated;
create function public.eg_list_report_materials(p_report_id uuid)
returns table(material_id uuid,material_name text,unit text,quantity numeric)
language sql security invoker set search_path=''
as $eg_api$ select * from private.eg_list_report_materials(p_report_id); $eg_api$;
revoke all on function public.eg_list_report_materials(uuid) from public,anon;
grant execute on function public.eg_list_report_materials(uuid) to authenticated;

create or replace function private.eg_set_report_material(
 p_report_id uuid,p_material_id uuid,p_quantity numeric
) returns void
language plpgsql security definer set search_path=''
as $eg_set_material$
declare v_report public.eg_daily_reports%rowtype;v_material public.eg_materials%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_quantity is null or p_quantity < 0 or p_quantity > 100000 then
    raise exception 'Invalid material quantity'; end if;
 select * into v_report from public.eg_daily_reports where id=p_report_id for update;
 if not found or v_report.created_by<>auth.uid()
    or v_report.status not in ('draft','changes_requested')
    or not exists(select 1 from public.eg_members mm where mm.company_id=v_report.company_id
      and mm.user_id=auth.uid() and mm.active and mm.role='worker') then
      raise exception 'Report is not editable'; end if;
 if p_quantity=0 then
  delete from public.eg_report_materials where report_id=p_report_id and material_id=p_material_id;
  return;
 end if;
 select * into v_material from public.eg_materials
   where id=p_material_id and company_id=v_report.company_id and active=true;
 if not found then raise exception 'Material not available'; end if;
 insert into public.eg_report_materials(company_id,report_id,material_id,material_name,unit,
    quantity,sale_price_snapshot,vat_rate_snapshot)
 values(v_report.company_id,p_report_id,p_material_id,v_material.name,v_material.unit,
    p_quantity,v_material.sale_price,v_material.vat_rate)
 on conflict(report_id,material_id) do update
 set quantity=excluded.quantity,material_name=excluded.material_name,unit=excluded.unit,
     sale_price_snapshot=excluded.sale_price_snapshot,
     vat_rate_snapshot=excluded.vat_rate_snapshot,updated_at=now();
end $eg_set_material$;
revoke all on function private.eg_set_report_material(uuid,uuid,numeric) from public,anon;
grant execute on function private.eg_set_report_material(uuid,uuid,numeric) to authenticated;
create function public.eg_set_report_material(p_report_id uuid,p_material_id uuid,p_quantity numeric)
returns void language sql security invoker set search_path=''
as $eg_api$ select private.eg_set_report_material(p_report_id,p_material_id,p_quantity); $eg_api$;
revoke all on function public.eg_set_report_material(uuid,uuid,numeric) from public,anon;
grant execute on function public.eg_set_report_material(uuid,uuid,numeric) to authenticated;

create table if not exists public.eg_invoice_drafts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.eg_companies(id) on delete cascade,
 client_id uuid not null,
 report_id uuid not null unique,
 created_by uuid not null references auth.users(id),
 status text not null default 'draft' check(status='draft'),
 note text not null default '' check(char_length(note)<=2000),
 currency text not null default 'EUR' check(currency='EUR'),
 created_at timestamptz not null default now(),
 unique(company_id,id),
 foreign key(company_id,client_id) references public.eg_clients(company_id,id),
 foreign key(company_id,report_id) references public.eg_daily_reports(company_id,id)
);
create index if not exists eg_invoice_drafts_company on public.eg_invoice_drafts(company_id,created_at desc);
alter table public.eg_invoice_drafts enable row level security;
revoke all on public.eg_invoice_drafts from public,anon,authenticated;
grant select,update on public.eg_invoice_drafts to authenticated;
drop policy if exists eg_invoice_drafts_owner_select on public.eg_invoice_drafts;
create policy eg_invoice_drafts_owner_select on public.eg_invoice_drafts for select to authenticated
 using(private.eg_is_owner(company_id));
drop policy if exists eg_invoice_drafts_owner_update on public.eg_invoice_drafts;
create policy eg_invoice_drafts_owner_update on public.eg_invoice_drafts for update to authenticated
 using(private.eg_is_owner(company_id))
 with check(private.eg_is_owner(company_id) and status='draft');

create table if not exists public.eg_invoice_lines (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 invoice_id uuid not null,
 kind text not null default 'other' check(kind in('material','labor','other')),
 description text not null check(char_length(trim(description)) between 2 and 500),
 quantity numeric(12,3) not null check(quantity > 0 and quantity <= 100000),
 unit text not null default 'pz' check(char_length(unit) between 1 and 20),
 unit_price numeric(12,2) not null check(unit_price >= 0 and unit_price <= 9999999),
 vat_rate numeric(5,2) not null default 22 check(vat_rate between 0 and 30),
 created_at timestamptz not null default now(),
 foreign key(company_id,invoice_id) references public.eg_invoice_drafts(company_id,id) on delete cascade
);
create index if not exists eg_invoice_lines_draft on public.eg_invoice_lines(company_id,invoice_id);
alter table public.eg_invoice_lines enable row level security;
revoke all on public.eg_invoice_lines from public,anon,authenticated;
grant select,insert,update,delete on public.eg_invoice_lines to authenticated;
drop policy if exists eg_invoice_lines_owner_select on public.eg_invoice_lines;
create policy eg_invoice_lines_owner_select on public.eg_invoice_lines for select to authenticated
 using(private.eg_is_owner(company_id));
drop policy if exists eg_invoice_lines_owner_insert on public.eg_invoice_lines;
create policy eg_invoice_lines_owner_insert on public.eg_invoice_lines for insert to authenticated
 with check(private.eg_is_owner(company_id));
drop policy if exists eg_invoice_lines_owner_update on public.eg_invoice_lines;
create policy eg_invoice_lines_owner_update on public.eg_invoice_lines for update to authenticated
 using(private.eg_is_owner(company_id)) with check(private.eg_is_owner(company_id));
drop policy if exists eg_invoice_lines_owner_delete on public.eg_invoice_lines;
create policy eg_invoice_lines_owner_delete on public.eg_invoice_lines for delete to authenticated
 using(private.eg_is_owner(company_id));

create or replace function private.eg_invoice_from_report(p_report_id uuid,p_labor_rate numeric,p_labor_vat numeric)
returns uuid
language plpgsql security definer set search_path=''
as $eg_invoice_create$
declare v_report public.eg_daily_reports%rowtype;v_task public.eg_tasks%rowtype;v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_labor_rate is null or p_labor_rate < 0 or p_labor_rate > 10000
   or p_labor_vat is null or p_labor_vat<0 or p_labor_vat>30 then
   raise exception 'Invalid labor rate or VAT'; end if;
 select * into v_report from public.eg_daily_reports where id=p_report_id for share;
 if not found or not private.eg_is_owner(v_report.company_id)
    or v_report.status<>'approved' then
    raise exception 'Only approved reports can generate invoice drafts'; end if;
 select * into v_task from public.eg_tasks where id=v_report.task_id
    and company_id=v_report.company_id;
 if not found then raise exception 'Task not found'; end if;
 select id into v_id from public.eg_invoice_drafts where report_id=p_report_id;
 if found then return v_id; end if;
 insert into public.eg_invoice_drafts(company_id,client_id,report_id,created_by)
 values(v_report.company_id,v_task.client_id,p_report_id,auth.uid())
 on conflict(report_id) do nothing returning id into v_id;
 if v_id is null then
   select id into v_id from public.eg_invoice_drafts where report_id=p_report_id;
   return v_id;
 end if;
 if p_labor_rate>0 and v_report.minutes_worked>0 then
   insert into public.eg_invoice_lines(company_id,invoice_id,kind,description,quantity,unit,unit_price,vat_rate)
   values(v_report.company_id,v_id,'labor','Lavoro: '||left(v_task.title,450),
          round(v_report.minutes_worked::numeric/60,3),'h',p_labor_rate,p_labor_vat);
 end if;
 insert into public.eg_invoice_lines(company_id,invoice_id,kind,description,quantity,unit,unit_price,vat_rate)
 select m.company_id,v_id,'material',m.material_name,m.quantity,m.unit,
   m.sale_price_snapshot,m.vat_rate_snapshot
 from public.eg_report_materials m where m.report_id=p_report_id;
 return v_id;
end $eg_invoice_create$;
revoke all on function private.eg_invoice_from_report(uuid,numeric,numeric) from public,anon;
grant execute on function private.eg_invoice_from_report(uuid,numeric,numeric) to authenticated;
create function public.eg_invoice_from_report(p_report_id uuid,p_labor_rate numeric,p_labor_vat numeric)
returns uuid language sql security invoker set search_path=''
as $eg_api$ select private.eg_invoice_from_report(p_report_id,p_labor_rate,p_labor_vat); $eg_api$;
revoke all on function public.eg_invoice_from_report(uuid,numeric,numeric) from public,anon;
grant execute on function public.eg_invoice_from_report(uuid,numeric,numeric) to authenticated;

create table if not exists public.eg_maintenance_plans (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.eg_companies(id) on delete cascade,
 client_id uuid not null,
 site_id uuid,
 assignee_id uuid not null,
 title text not null check(char_length(trim(title)) between 2 and 200),
 instructions text not null default '' check(char_length(instructions)<=4000),
 cadence text not null check(cadence in ('weekly','biweekly','monthly','quarterly')),
 anchor_date date not null,
 next_due_date date not null,
 start_time time,
 estimated_minutes integer check(estimated_minutes between 0 and 1440),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(company_id,id),
 foreign key(company_id,client_id) references public.eg_clients(company_id,id),
 foreign key(company_id,site_id) references public.eg_sites(company_id,id),
 foreign key(company_id,assignee_id) references public.eg_members(company_id,user_id)
);
create index if not exists eg_maintenance_active_due on public.eg_maintenance_plans(company_id,next_due_date) where active;
alter table public.eg_maintenance_plans enable row level security;
revoke all on public.eg_maintenance_plans from public,anon,authenticated;
grant select,insert,update on public.eg_maintenance_plans to authenticated;
drop policy if exists eg_maintenance_owner_select on public.eg_maintenance_plans;
create policy eg_maintenance_owner_select on public.eg_maintenance_plans for select to authenticated
 using(private.eg_is_owner(company_id));
drop policy if exists eg_maintenance_owner_insert on public.eg_maintenance_plans;
create policy eg_maintenance_owner_insert on public.eg_maintenance_plans for insert to authenticated
 with check(private.eg_is_owner(company_id));
drop policy if exists eg_maintenance_owner_update on public.eg_maintenance_plans;
create policy eg_maintenance_owner_update on public.eg_maintenance_plans for update to authenticated
 using(private.eg_is_owner(company_id)) with check(private.eg_is_owner(company_id));

alter table public.eg_tasks add column if not exists maintenance_plan_id uuid;
do $eg_task_constraint$
begin
 if not exists(select 1 from pg_constraint where conname='eg_tasks_maintenance_plan_fk') then
  alter table public.eg_tasks
  add constraint eg_tasks_maintenance_plan_fk foreign key(company_id,maintenance_plan_id)
  references public.eg_maintenance_plans(company_id,id);
 end if;
end $eg_task_constraint$;
create unique index if not exists eg_tasks_unique_plan_date
 on public.eg_tasks(maintenance_plan_id,due_date) where maintenance_plan_id is not null;

create or replace function private.eg_next_maintenance_date(p_previous date,p_anchor date,p_cadence text)
returns date
language plpgsql immutable security invoker set search_path=''
as $eg_next_date$
declare v_month date;v_months int;v_end_day int;
begin
 if p_cadence='weekly' then return p_previous+7; end if;
 if p_cadence='biweekly' then return p_previous+14; end if;
 if p_cadence not in ('monthly','quarterly') then raise exception 'Unknown cadence'; end if;
 v_months:=case when p_cadence='monthly' then 1 else 3 end;
 v_month:=(date_trunc('month',p_previous)::date+make_interval(months=>v_months))::date;
 v_end_day:=extract(day from (v_month+interval '1 month'-interval '1 day'))::integer;
 return make_date(extract(year from v_month)::integer,extract(month from v_month)::integer,
    least(extract(day from p_anchor)::integer,v_end_day));
end $eg_next_date$;
revoke all on function private.eg_next_maintenance_date(date,date,text) from public,anon;
grant execute on function private.eg_next_maintenance_date(date,date,text) to authenticated;

create or replace function private.eg_generate_maintenance(p_company_id uuid,p_horizon_days integer)
returns integer
language plpgsql security definer set search_path=''
as $eg_generate$
declare v_plan public.eg_maintenance_plans%rowtype; v_created int:=0;v_step int;v_added int;
begin
 if auth.uid() is null or not private.eg_is_owner(p_company_id) then
   raise exception 'Only business owners can generate maintenance tasks'; end if;
 if p_horizon_days is null or p_horizon_days<0 or p_horizon_days>90 then
   raise exception 'Invalid planning horizon'; end if;
 for v_plan in
   select * from public.eg_maintenance_plans
   where company_id=p_company_id and active and next_due_date<=current_date+p_horizon_days
   for update
 loop
  if not exists(select 1 from public.eg_members m where m.company_id=p_company_id
    and m.user_id=v_plan.assignee_id and m.role='worker' and m.active) then continue; end if;
  v_step:=0;
  while v_plan.next_due_date<=current_date+p_horizon_days and v_step<40 loop
    insert into public.eg_tasks(company_id,client_id,site_id,assignee_id,assigned_by,title,
       instructions,due_date,start_time,estimated_minutes,priority,status,maintenance_plan_id)
    values(v_plan.company_id,v_plan.client_id,v_plan.site_id,v_plan.assignee_id,auth.uid(),
       v_plan.title,v_plan.instructions,v_plan.next_due_date,v_plan.start_time,
       v_plan.estimated_minutes,'media','assigned',v_plan.id)
    on conflict (maintenance_plan_id,due_date) where maintenance_plan_id is not null
       do nothing;
    get diagnostics v_added=row_count;
    v_created:=v_created+v_added;
    v_plan.next_due_date:=private.eg_next_maintenance_date(v_plan.next_due_date,v_plan.anchor_date,v_plan.cadence);
    v_step:=v_step+1;
  end loop;
  update public.eg_maintenance_plans set next_due_date=v_plan.next_due_date where id=v_plan.id;
 end loop;
 return v_created;
end $eg_generate$;
revoke all on function private.eg_generate_maintenance(uuid,integer) from public,anon;
grant execute on function private.eg_generate_maintenance(uuid,integer) to authenticated;
create function public.eg_generate_maintenance(p_company_id uuid,p_horizon_days integer DEFAULT 30)
returns integer language sql security invoker set search_path=''
as $eg_api$ select private.eg_generate_maintenance(p_company_id,p_horizon_days); $eg_api$;
revoke all on function public.eg_generate_maintenance(uuid,integer) from public,anon;
grant execute on function public.eg_generate_maintenance(uuid,integer) to authenticated;

notify pgrst,'reload schema';
commit;
