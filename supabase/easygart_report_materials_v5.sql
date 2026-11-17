-- EasyGart: material lines in daily reports, private prices, site access for workers.
-- No employee can read catalog purchase/sale prices through RLS or public RPCs.

ALTER TABLE public.eg_materials ADD COLUMN IF NOT EXISTS requires_review boolean NOT NULL DEFAULT false;

-- Workers may select a site even without an assigned task. The "worked at"
-- views still show only their own reports and clock entries.
DROP POLICY IF EXISTS eg_sites_read ON public.eg_sites;
CREATE POLICY eg_sites_read ON public.eg_sites FOR SELECT TO authenticated
  USING (private.eg_is_member(company_id));

CREATE OR REPLACE FUNCTION private.eg_create_basic_material(
 p_company_id uuid,p_name text,p_unit text)
RETURNS TABLE(id uuid,name text,unit text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_name text:=trim(coalesce(p_name,''));v_material public.eg_materials%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT private.eg_is_member(p_company_id) THEN RAISE EXCEPTION 'Accesso negato'; END IF;
 IF char_length(v_name) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION 'Nome materiale non valido'; END IF;
 IF p_unit NOT IN ('pz','kg','l','m','m2','m3','h') THEN RAISE EXCEPTION 'Unità non valida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::text||lower(v_name)||p_unit, 112));
 SELECT * INTO v_material FROM public.eg_materials m WHERE m.company_id=p_company_id
 AND lower(m.name)=lower(v_name) AND m.unit=p_unit ORDER BY m.created_at LIMIT 1;
 IF FOUND THEN
   IF NOT v_material.active THEN RAISE EXCEPTION 'Materiale non attivo: contatta il titolare'; END IF;
 ELSE
   INSERT INTO public.eg_materials(company_id,name,unit,purchase_price,sale_price,vat_rate,active,requires_review)
   VALUES(p_company_id,v_name,p_unit,0,0,22,true,true) RETURNING * INTO v_material;
 END IF;
 RETURN QUERY SELECT v_material.id,v_material.name,v_material.unit;
END $$;

CREATE OR REPLACE FUNCTION public.eg_create_basic_material(p_company_id uuid,p_name text,p_unit text)
RETURNS TABLE(id uuid,name text,unit text) LANGUAGE sql SET search_path=''
AS $$ SELECT * FROM private.eg_create_basic_material(p_company_id,p_name,p_unit); $$;
REVOKE ALL ON FUNCTION public.eg_create_basic_material(uuid,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.eg_create_basic_material(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.eg_list_month_materials(
 p_company_id uuid,p_begin date,p_end date)
RETURNS TABLE(report_id uuid,material_id uuid,material_name text,unit text,quantity numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.eg_is_member(p_company_id) THEN RAISE EXCEPTION 'Accesso negato'; END IF;
 IF p_begin IS NULL OR p_end IS NULL OR p_end<=p_begin OR p_begin<date '2020-01-01'
 OR p_end>date '2100-01-01' THEN RAISE EXCEPTION 'Intervallo non valido'; END IF;
 RETURN QUERY SELECT x.report_id,x.material_id,x.material_name,x.unit,x.quantity
 FROM public.eg_report_materials x
 JOIN public.eg_daily_reports r ON r.id=x.report_id AND r.company_id=x.company_id
 WHERE x.company_id=p_company_id AND r.work_date>=p_begin AND r.work_date<p_end
 AND (private.eg_is_owner(p_company_id) OR r.created_by=auth.uid())
 ORDER BY r.work_date,x.material_name;
END $$;

CREATE OR REPLACE FUNCTION public.eg_list_month_materials(
 p_company_id uuid,p_begin date,p_end date)
RETURNS TABLE(report_id uuid,material_id uuid,material_name text,unit text,quantity numeric)
LANGUAGE sql SET search_path=''
AS $$ SELECT * FROM private.eg_list_month_materials(p_company_id,p_begin,p_end); $$;
REVOKE ALL ON FUNCTION public.eg_list_month_materials(uuid,date,date) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.eg_list_month_materials(uuid,date,date) TO authenticated;

CREATE OR REPLACE FUNCTION private.eg_save_daily_report_v5(
 p_report_id uuid,p_company_id uuid,p_worker_id uuid,p_site_id uuid,p_task_id uuid,
 p_work_date date,p_start_time time,p_end_time time,p_break_minutes integer,
 p_work_summary text,p_materials_used text,p_issues text,p_send boolean,
 p_materials jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_id uuid; v_item jsonb; v_material_id uuid; v_qty numeric;
 v_material public.eg_materials%rowtype;
 v_ids uuid[]:=ARRAY[]::uuid[];
 v_old jsonb;v_new jsonb;
BEGIN
 IF p_materials IS NULL OR jsonb_typeof(p_materials)<>'array' OR jsonb_array_length(p_materials)>40
 THEN RAISE EXCEPTION 'Elenco materiali non valido'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_materials) LOOP
   IF jsonb_typeof(v_item)<>'object' THEN RAISE EXCEPTION 'Materiale non valido'; END IF;
   BEGIN
     v_material_id:=(v_item->>'material_id')::uuid;
     v_qty:=(v_item->>'quantity')::numeric;
   EXCEPTION WHEN others THEN
     RAISE EXCEPTION 'Selezione materiale o quantità non valida';
   END;
   IF v_material_id IS NULL OR v_qty IS NULL OR v_qty<=0 OR v_qty>100000
     OR v_material_id=ANY(v_ids) THEN RAISE EXCEPTION 'Materiale duplicato o quantità non valida'; END IF;
   v_ids:=array_append(v_ids,v_material_id);
   SELECT * INTO v_material FROM public.eg_materials m
     WHERE m.id=v_material_id AND m.company_id=p_company_id
       AND (m.active OR EXISTS(SELECT 1 FROM public.eg_report_materials x
         WHERE x.report_id=p_report_id AND x.material_id=m.id));
   IF NOT FOUND THEN RAISE EXCEPTION 'Materiale non disponibile in questa azienda'; END IF;
 END LOOP;

 IF p_report_id IS NOT NULL THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.material_id,'quantity',x.quantity)
       ORDER BY x.material_id),'[]'::jsonb) INTO v_old
   FROM public.eg_report_materials x WHERE x.report_id=p_report_id;
 ELSE v_old:='[]'::jsonb;
 END IF;

 -- V4 validates company, role, author, site, report ownership, invoice lock,
 -- dates and time values and logs before/after edits in the same transaction.
 v_id:=private.eg_save_daily_report_v4(p_report_id,p_company_id,p_worker_id,p_site_id,
   p_task_id,p_work_date,p_start_time,p_end_time,p_break_minutes,p_work_summary,
   p_materials_used,p_issues,p_send);

 DELETE FROM public.eg_report_materials x WHERE x.report_id=v_id
   AND NOT (x.material_id=ANY(v_ids));

 FOR v_item IN SELECT value FROM jsonb_array_elements(p_materials) LOOP
   v_material_id:=(v_item->>'material_id')::uuid;
   v_qty:=(v_item->>'quantity')::numeric;
   SELECT * INTO v_material FROM public.eg_materials m
     WHERE m.id=v_material_id AND m.company_id=p_company_id;
   INSERT INTO public.eg_report_materials(company_id,report_id,material_id,material_name,unit,
     quantity,sale_price_snapshot,vat_rate_snapshot)
   VALUES(p_company_id,v_id,v_material_id,v_material.name,v_material.unit,
     v_qty,v_material.sale_price,v_material.vat_rate)
   ON CONFLICT(report_id,material_id) DO UPDATE SET quantity=excluded.quantity,updated_at=now()
     WHERE public.eg_report_materials.quantity IS DISTINCT FROM excluded.quantity;
 END LOOP;

 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.material_id,'quantity',x.quantity)
       ORDER BY x.material_id),'[]'::jsonb) INTO v_new
 FROM public.eg_report_materials x WHERE x.report_id=v_id;
 IF v_old IS DISTINCT FROM v_new THEN
  INSERT INTO public.eg_daily_report_events(company_id,report_id,actor_id,action,note)
  VALUES(p_company_id,v_id,auth.uid(),'edited',
    jsonb_build_object('materiali_prima',v_old,'materiali_dopo',v_new)::text);
 END IF;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.eg_save_daily_report_v5(
 p_report_id uuid,p_company_id uuid,p_worker_id uuid,p_site_id uuid,p_task_id uuid,
 p_work_date date,p_start_time time,p_end_time time,p_break_minutes integer,
 p_work_summary text,p_materials_used text,p_issues text,p_send boolean,
 p_materials jsonb)
RETURNS uuid LANGUAGE sql SET search_path=''
AS $$ SELECT private.eg_save_daily_report_v5(
 p_report_id,p_company_id,p_worker_id,p_site_id,p_task_id,p_work_date,p_start_time,
 p_end_time,p_break_minutes,p_work_summary,p_materials_used,p_issues,p_send,p_materials); $$;
REVOKE ALL ON FUNCTION public.eg_save_daily_report_v5(
 uuid,uuid,uuid,uuid,uuid,date,time,time,integer,text,text,text,boolean,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.eg_save_daily_report_v5(
 uuid,uuid,uuid,uuid,uuid,date,time,time,integer,text,text,text,boolean,jsonb) TO authenticated;

-- Don't produce zero-priced invoice lines for materials proposed by staff
-- before the owner has reviewed the price. The owner can edit the catalog
-- and explicitly clear requires_review.
CREATE OR REPLACE FUNCTION private.eg_validate_invoice_materials()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.eg_report_materials x
 JOIN public.eg_materials m ON m.id=x.material_id AND m.company_id=x.company_id
 WHERE x.report_id=NEW.report_id AND m.requires_review)
 THEN RAISE EXCEPTION 'Materiali non ancora prezzati: verificare il catalogo prima di creare la proforma'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eg_invoice_requires_material_review ON public.eg_invoice_drafts;
CREATE TRIGGER eg_invoice_requires_material_review BEFORE INSERT ON public.eg_invoice_drafts
FOR EACH ROW EXECUTE FUNCTION private.eg_validate_invoice_materials();
