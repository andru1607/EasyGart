-- EasyGart Cloud • fotografie private prima/dopo e firma del cliente (2026-11)
-- Dipendenze: easygart_core_v1.sql + easygart_daily_reports_v1.sql.
-- Progetto UNICO: EasyGart xdwsqkteykjjpzogwocx.
-- Le firme sono prese visione sul posto, NON firme elettroniche qualificate.
begin;

do $eg_check$
begin
  if to_regclass('public.eg_daily_reports') is null
    or to_regprocedure('private.eg_is_owner(uuid)') is null
    or to_regprocedure('private.eg_is_member(uuid)') is null then
    raise exception 'Rapporti giornalieri EasyGart assenti: applica prima easygart_daily_reports_v1.sql';
  end if;
end
$eg_check$;

-- Bucket esclusivamente privato: mai usare URL pubblici o service_role nel frontend.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('eg-report-media','eg-report-media',false,5242880,
  array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update
  set public=false,file_size_limit=excluded.file_size_limit,
      allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.eg_report_media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  report_id uuid not null,
  author_id uuid not null references auth.users(id),
  kind text not null check(kind in ('before','after','signature')),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  bytes integer not null check(bytes between 1 and 5242880),
  signer_name text,
  signature_consent boolean not null default false,
  storage_path text not null unique,
  status text not null default 'reserved' check(status in ('reserved','uploaded')),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  constraint eg_media_report_fk foreign key(company_id,report_id)
    references public.eg_daily_reports(company_id,id) on delete cascade,
  constraint eg_media_signature_data check (
    (kind='signature' and mime_type='image/png'
      and char_length(trim(coalesce(signer_name,''))) between 2 and 120
      and signature_consent)
    or (kind in ('before','after') and signer_name is null and not signature_consent)
  )
);
create unique index if not exists eg_report_one_signature
  on public.eg_report_media(report_id) where kind='signature';
create index if not exists eg_media_report_kind_idx
  on public.eg_report_media(company_id,report_id,kind);
create index if not exists eg_media_reserved_idx
  on public.eg_report_media(status,created_at) where status='reserved';

revoke all on public.eg_report_media from public,anon,authenticated;
grant select on public.eg_report_media to authenticated;
alter table public.eg_report_media enable row level security;
drop policy if exists eg_media_read on public.eg_report_media;
create policy eg_media_read on public.eg_report_media for select to authenticated
using (
  status='uploaded' and (
    private.eg_is_owner(company_id)
    or (private.eg_is_member(company_id) and author_id=(select auth.uid()))
  )
);

-- Le funzioni private sono usate soltanto dalle policy di Storage.
-- Verificano la riga autorizzata, non soltanto la cartella del file.
create or replace function private.eg_media_can_read(p_path text)
returns boolean language sql stable security definer set search_path='' as $eg_read$
  select auth.uid() is not null and exists(
    select 1 from public.eg_report_media m
    where m.storage_path=p_path and m.status='uploaded'
      and (
        private.eg_is_owner(m.company_id)
        or (private.eg_is_member(m.company_id) and m.author_id=auth.uid())
      )
  );
$eg_read$;
create or replace function private.eg_media_can_upload(p_path text)
returns boolean language sql stable security definer set search_path='' as $eg_upload$
  select auth.uid() is not null and exists(
    select 1 from public.eg_report_media m
      join public.eg_daily_reports r
        on r.id=m.report_id and r.company_id=m.company_id
      join public.eg_members staff
        on staff.company_id=m.company_id and staff.user_id=auth.uid()
    where m.storage_path=p_path and m.status='reserved'
      and m.author_id=auth.uid() and r.created_by=auth.uid()
      and r.status in ('draft','changes_requested')
      and staff.active and staff.role='worker'
  );
$eg_upload$;
create or replace function private.eg_media_can_delete(p_path text)
returns boolean language sql stable security definer set search_path='' as $eg_delete$
  select auth.uid() is not null and exists(
    select 1 from public.eg_report_media m
      join public.eg_daily_reports r
        on r.id=m.report_id and r.company_id=m.company_id
      join public.eg_members staff
        on staff.company_id=m.company_id and staff.user_id=auth.uid()
    where m.storage_path=p_path and m.author_id=auth.uid()
      and r.created_by=auth.uid() and r.status in ('draft','changes_requested')
      and staff.active and staff.role='worker'
  );
$eg_delete$;
revoke all on function private.eg_media_can_read(text),
  private.eg_media_can_upload(text),private.eg_media_can_delete(text) from public,anon;
grant execute on function private.eg_media_can_read(text),
  private.eg_media_can_upload(text),private.eg_media_can_delete(text) to authenticated;

-- Importante: queste policy interessano SOLO il bucket eg-report-media.
drop policy if exists eg_media_objects_select on storage.objects;
create policy eg_media_objects_select on storage.objects for select to authenticated
using (bucket_id='eg-report-media' and private.eg_media_can_read(name));
drop policy if exists eg_media_objects_insert on storage.objects;
create policy eg_media_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='eg-report-media' and private.eg_media_can_upload(name));
drop policy if exists eg_media_objects_delete on storage.objects;
create policy eg_media_objects_delete on storage.objects for delete to authenticated
using (bucket_id='eg-report-media' and private.eg_media_can_delete(name));

-- Prenota un percorso imprevedibile e limita a 3 foto per fase e 1 firma per rapporto.
-- Nessuna riga è caricabile senza autorizzazione e prenotazione server.
create or replace function public.eg_media_reserve(
  p_report_id uuid,
  p_kind text,
  p_mime text,
  p_bytes integer,
  p_signer_name text default null,
  p_consent boolean default false
) returns jsonb
language plpgsql security definer set search_path='' as $eg_reserve$
declare
  v_uid uuid := auth.uid();
  v_report public.eg_daily_reports%rowtype;
  v_id uuid := gen_random_uuid();
  v_path text;
  v_extension text;
  v_count int;
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  if p_kind not in ('before','after','signature') then raise exception 'Tipo di allegato non valido'; end if;
  if p_mime not in ('image/jpeg','image/png','image/webp') then raise exception 'Formato immagine non valido'; end if;
  if p_bytes is null or p_bytes < 1 or p_bytes > 5242880 then
    raise exception 'Il file deve essere inferiore a 5 MB';
  end if;
  if p_kind='signature' then
    if p_mime<>'image/png' or not coalesce(p_consent,false) or
      char_length(trim(coalesce(p_signer_name,''))) not between 2 and 120 then
      raise exception 'Firma: nome e consenso obbligatori';
    end if;
  elsif p_signer_name is not null or coalesce(p_consent,false) then
    raise exception 'Dati firma non validi per una foto';
  end if;
  select * into v_report from public.eg_daily_reports
    where id=p_report_id for update;
  if not found then raise exception 'Rapporto non trovato'; end if;
  if v_report.created_by<>v_uid or v_report.status not in ('draft','changes_requested')
    or not exists (
      select 1 from public.eg_members m where m.company_id=v_report.company_id
        and m.user_id=v_uid and m.role='worker' and m.active
    ) then raise exception 'Rapporto non modificabile da questo account'; end if;
  -- Rimuove vecchie prenotazioni prive di file (es. browser chiuso durante il caricamento).
  delete from public.eg_report_media m where m.report_id=v_report.id and m.status='reserved'
    and m.created_at<now()-interval '1 hour'
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id='eg-report-media' and o.name=m.storage_path
    );
  select count(*) into v_count from public.eg_report_media
    where report_id=v_report.id and kind=p_kind;
  if v_count >= (case when p_kind='signature' then 1 else 3 end) then
    raise exception 'Limite di allegati raggiunto';
  end if;
  v_extension := case p_mime when 'image/png' then 'png' when 'image/webp' then 'webp' else 'jpg' end;
  v_path := v_report.company_id::text||'/'||v_report.id::text||'/'||p_kind||'/'||v_id::text||'.'||v_extension;
  insert into public.eg_report_media(
    id,company_id,report_id,author_id,kind,mime_type,bytes,signer_name,
    signature_consent,storage_path,status
  ) values(
    v_id,v_report.company_id,v_report.id,v_uid,p_kind,p_mime,p_bytes,
    case when p_kind='signature' then trim(p_signer_name) else null end,
    p_kind='signature',v_path,'reserved'
  );
  return jsonb_build_object('id',v_id,'path',v_path);
end
$eg_reserve$;
revoke all on function public.eg_media_reserve(uuid,text,text,integer,text,boolean)
  from public,anon;
grant execute on function public.eg_media_reserve(uuid,text,text,integer,text,boolean)
  to authenticated;

-- Finalizza SOLTANTO se l'oggetto esiste nel bucket riservato.
create or replace function public.eg_media_finalize(p_media_id uuid)
returns void language plpgsql security definer set search_path='' as $eg_finalize$
declare
  v_uid uuid := auth.uid();
  v_media public.eg_report_media%rowtype;
  v_report public.eg_daily_reports%rowtype;
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  select * into v_media from public.eg_report_media where id=p_media_id for update;
  if not found or v_media.author_id<>v_uid then raise exception 'Allegato non autorizzato'; end if;
  select * into v_report from public.eg_daily_reports
    where id=v_media.report_id and company_id=v_media.company_id for update;
  if not found or v_report.status not in ('draft','changes_requested')
    or v_report.created_by<>v_uid or not exists (
      select 1 from public.eg_members m where m.company_id=v_media.company_id
      and m.user_id=v_uid and m.role='worker' and m.active
    ) then raise exception 'Rapporto non modificabile'; end if;
  if v_media.status='uploaded' then return; end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id='eg-report-media'
      and o.name=v_media.storage_path
  ) then raise exception 'File non presente nel bucket privato'; end if;
  update public.eg_report_media set status='uploaded',uploaded_at=now() where id=v_media.id;
end
$eg_finalize$;
revoke all on function public.eg_media_finalize(uuid) from public,anon;
grant execute on function public.eg_media_finalize(uuid) to authenticated;

-- Il file va rimosso prima dal bucket con la policy DELETE; poi il record viene eliminato.
create or replace function public.eg_media_release(p_media_id uuid)
returns void language plpgsql security definer set search_path='' as $eg_release$
declare
  v_uid uuid := auth.uid();
  v_media public.eg_report_media%rowtype;
  v_report public.eg_daily_reports%rowtype;
begin
  if v_uid is null then raise exception 'Accesso richiesto'; end if;
  select * into v_media from public.eg_report_media where id=p_media_id for update;
  if not found or v_media.author_id<>v_uid then raise exception 'Allegato non trovato'; end if;
  select * into v_report from public.eg_daily_reports
    where id=v_media.report_id and company_id=v_media.company_id for update;
  if not found or v_report.status not in ('draft','changes_requested')
    or v_report.created_by<>v_uid or not exists (
      select 1 from public.eg_members m where m.company_id=v_media.company_id
      and m.user_id=v_uid and m.role='worker' and m.active
    ) then raise exception 'Rapporto non modificabile'; end if;
  if exists (
    select 1 from storage.objects o where o.bucket_id='eg-report-media'
      and o.name=v_media.storage_path
  ) then raise exception 'Rimuovere prima il file dallo Storage'; end if;
  delete from public.eg_report_media where id=v_media.id;
end
$eg_release$;
revoke all on function public.eg_media_release(uuid) from public,anon;
grant execute on function public.eg_media_release(uuid) to authenticated;

commit;

-- Verifica: una tabella media con RLS e policy private nel bucket eg-report-media.
select tablename,policyname,cmd from pg_policies
where (schemaname='public' and tablename='eg_report_media')
   or (schemaname='storage' and tablename='objects' and policyname like 'eg_media_%')
order by schemaname,tablename,policyname;
