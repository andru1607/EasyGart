-- Confirming an employee-proposed material updates only non-invoiced
-- report price snapshots, so a later draft invoice uses the reviewed price.
CREATE OR REPLACE FUNCTION private.eg_reprice_uninvoiced_new_material()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF old.requires_review=true AND new.requires_review=false THEN
   UPDATE public.eg_report_materials rm
   SET sale_price_snapshot=new.sale_price,vat_rate_snapshot=new.vat_rate,updated_at=now()
   FROM public.eg_daily_reports r
   WHERE rm.material_id=new.id AND rm.company_id=new.company_id
     AND r.id=rm.report_id AND r.company_id=new.company_id
     AND r.invoice_locked=false
     AND NOT EXISTS(SELECT 1 FROM public.eg_invoice_drafts i WHERE i.report_id=r.id);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eg_review_material_price_snapshot ON public.eg_materials;
CREATE TRIGGER eg_review_material_price_snapshot
AFTER UPDATE OF requires_review,sale_price,vat_rate ON public.eg_materials
FOR EACH ROW EXECUTE FUNCTION private.eg_reprice_uninvoiced_new_material();
