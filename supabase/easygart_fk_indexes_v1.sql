-- EasyGart production hardening: foreign-key indexes, safe to rerun.
-- Scope: existing public.eg_* tables only. No data deletion, no RLS changes.
-- Created indexes support FK checks, tenant filters and joins as the dataset grows.
begin;
do $easygart_fk_indexes$
declare
  fk record;
  columns_sql text;
  index_name text;
  made integer := 0;
begin
  if to_regclass('public.eg_companies') is null then
    raise exception 'EasyGart schema not installed in this project';
  end if;
  for fk in
    select con.conrelid,con.conkey,con.conname,
           ns.nspname as schema_name,c.relname as table_name
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace ns on ns.oid=c.relnamespace
    where con.contype='f' and ns.nspname='public'
      and c.relname like 'eg_%'
    -- Longer compound indexes may cover shorter FK prefixes.
    order by cardinality(con.conkey) desc,c.relname,con.conname
  loop
    if not exists (
      select 1 from pg_index i
      where i.indrelid=fk.conrelid and i.indisvalid and i.indisready
        and i.indnkeyatts>=cardinality(fk.conkey)
        and (select array_agg(v order by ord)
             from unnest(i.indkey::smallint[]) with ordinality as k(v,ord)
             where ord<=cardinality(fk.conkey))=fk.conkey
    ) then
      select string_agg(format('%I',a.attname),', ' order by x.ord)
      into columns_sql
      from unnest(fk.conkey) with ordinality as x(attnum,ord)
      join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=x.attnum;
      if columns_sql is null then
        raise exception 'Cannot determine FK columns for %',fk.conname;
      end if;
      index_name:='eg_fk_'||left(fk.table_name,35)||'_'||left(md5(fk.conname),10);
      execute format('create index if not exists %I on %I.%I (%s)',
                     index_name,fk.schema_name,fk.table_name,columns_sql);
      made:=made+1;
    end if;
  end loop;
  raise notice 'EasyGart foreign-key indexes created: %',made;
end
$easygart_fk_indexes$;
commit;
