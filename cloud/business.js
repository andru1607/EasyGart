/* EasyGart Cloud • materiali, consumi, manutenzioni ricorrenti, bozze proforma.
   Tutti i dati di fatturazione restano privati al titolare tramite Supabase RLS. */
'use strict';
window.createEasyGartBusiness=function createEasyGartBusiness({client,getContext,t,tr,esc,onSuccess,rerender}){
  let ready=false, error='';
  let materials=[], catalog=[], plans=[], invoices=[], lines=[], usage=[];
  let selectedReportId=null, workerUsage=[],showNewMaterial=false,showNewPlan=false;
  let editingPlanId=null,selectedInvoiceId=null;
  const ctx=()=>getContext();
  const owner=()=>!!ctx().isOwner;
  const b=t;
  const safe=x=>esc(x);
  const opt=(value,label,selected=false)=>'<option value="'+safe(value)+'"'+(selected?' selected':'')+'>'+safe(label)+'</option>';
  const money=n=>new Intl.NumberFormat(ctx().locale==='de'?'de-DE':'it-IT',
    {style:'currency',currency:'EUR'}).format(Number(n)||0);
  const num=n=>Number(n)||0;
  const date=d=>{
    if(!d)return '—';
    const x=String(d).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return safe(x);
    const [year,month,day]=x.split('-');
    return ctx().locale==='de'?day+'.'+month+'.'+year:day+'/'+month+'/'+year;
  };
  const translateCadence=c=>tr(({weekly:'Ogni settimana',biweekly:'Ogni due settimane',
    monthly:'Ogni mese',quarterly:'Ogni trimestre'})[c]||'Ogni mese');
  const memberName=id=>ctx().members.find(x=>x.user_id===id)?.full_name||tr('Dipendente');
  const clientName=id=>ctx().clients.find(x=>x.id===id)?.name||'—';
  const siteName=id=>ctx().sites.find(x=>x.id===id)?.name||'—';
  const taskName=report=>ctx().tasks.find(x=>x.id===report?.task_id)?.title||tr('Intervento');
  const reportUsages=id=>usage.filter(x=>x.report_id===id);
  const totalLine=l=>{
    const base=Math.round((num(l.quantity)*num(l.unit_price)+Number.EPSILON)*100)/100;
    const vat=Math.round((base*num(l.vat_rate)/100+Number.EPSILON)*100)/100;
    return {base,vat,gross:base+vat};
  };
  const summary=invoiceId=>{
    const chosen=lines.filter(x=>x.invoice_id===invoiceId);
    return chosen.reduce((acc,l)=>{
      const v=totalLine(l);
      acc.base+=v.base;acc.vat+=v.vat;acc.total+=v.gross;
      return acc;
    },{base:0,vat:0,total:0});
  };
  const getError=e=>e?.message||tr('Operazione non riuscita.');
  const db=r=>{if(r.error)throw r.error;return r.data};
  const warning=()=>'<div class="alert warn">'+b('Gestione aziendale non ancora disponibile. Controlla la migrazione SQL.')+
    ' <a href="https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_business_v1.sql" rel="noopener noreferrer" target="_blank">'+b('Apri SQL gestionale')+'</a>'+
    (error?'<p class="muted">'+safe(error.slice(0,180))+'</p>':'')+'</div>';
  const reportEditable=r=>ctx().user&&r&&r.created_by===ctx().user.id &&
    ['draft','changes_requested'].includes(r.status)&&!owner();
  async function refresh(companyId){
    if(!companyId){reset();return 0}
    try{
      if(owner()){
        const rr=await Promise.all([
          client.from('eg_materials').select('*').eq('company_id',companyId).order('name'),
          client.from('eg_maintenance_plans').select('*').eq('company_id',companyId).order('next_due_date'),
          client.from('eg_invoice_drafts').select('*').eq('company_id',companyId).order('created_at',{ascending:false}).limit(200),
          client.from('eg_invoice_lines').select('*').eq('company_id',companyId).limit(1200),
          client.from('eg_report_materials').select('*').eq('company_id',companyId).limit(1000)
        ]);
        rr.forEach(db);
        [materials,plans,invoices,lines,usage]=rr.map(x=>x.data||[]);
        ready=true;error='';
        if(plans.some(x=>x.active&&x.next_due_date<=new Date(Date.now()+30*86400000).toISOString().slice(0,10))){
          // Generation is idempotent and bounded at the server; no duplicate job on refresh.
          const gen=await client.rpc('eg_generate_maintenance',{p_company_id:companyId,p_horizon_days:30});
          if(gen.error)throw gen.error;
          return Number(gen.data)||0;
        }
      }else{
        const rr=await client.rpc('eg_list_materials',{p_company_id:companyId});
        catalog=db(rr)||[];ready=true;error='';
        materials=[];invoices=[];lines=[];plans=[];usage=[];
      }
    }catch(e){ready=false;error=getError(e);return 0}
    return 0;
  }
  function reset(){
    ready=false;error='';materials=[];catalog=[];plans=[];invoices=[];lines=[];usage=[];
    selectedReportId=null;workerUsage=[];showNewMaterial=false;showNewPlan=false;
    editingPlanId=null;selectedInvoiceId=null;
  }
  function materialCatalogMarkup(){
    if(!owner())return '';
    const add=showNewMaterial?'<form data-form="biz-material" class="formgrid eg-business-form">'+
      '<label class="field"><span>'+b('Nome materiale')+'</span><input name="name" minlength="2" maxlength="200" required></label>'+
      '<label class="field"><span>'+b('Unità')+'</span><select name="unit">'+
        ['pz','kg','l','m','m2','m3','h'].map(x=>opt(x,x)).join('')+'</select></label>'+
      '<label class="field"><span>'+b('Costo unitario')+' (€)</span><input name="purchase_price" type="number" min="0" max="9999999" step=".01" value="0" required></label>'+
      '<label class="field"><span>'+b('Prezzo vendita unitario')+' (€)</span><input name="sale_price" type="number" min="0" max="9999999" step=".01" value="0" required></label>'+
      '<label class="field"><span>'+b('IVA')+' (%)</span><input name="vat_rate" type="number" min="0" max="30" step=".01" value="22" required></label>'+
      '<div class="span2 actions"><button class="primary" type="submit">'+b('Salva materiale')+'</button>'+
      '<button class="ghost" type="button" data-action="biz-cancel-material">'+b('Annulla')+'</button></div></form>':'';
    const rows=materials.map(m=>'<div class="taskrow"><div><strong>'+safe(m.name)+'</strong>'+
      '<div class="task-meta"><span>'+safe(m.unit)+'</span>'+
      '<span>'+b('Costo')+': '+money(m.purchase_price)+'</span>'+
      '<span>'+b('Vendita')+': '+money(m.sale_price)+'</span>'+
      '<span>'+b('IVA')+': '+safe(m.vat_rate)+'%</span></div></div>'+
      '<div class="actions"><span class="pill">'+b(m.active?'Attivo':'Disattivato')+'</span>'+
      '<button data-action="biz-toggle-material" data-id="'+safe(m.id)+'" class="ghost small">'+
      b(m.active?'Disattiva':'Riattiva')+'</button></div></div>').join('');
    return '<div class="view-head"><h2>'+b('Catalogo materiali')+'</h2>'+
      '<button class="primary" data-action="biz-new-material">'+b('Nuovo materiale')+'</button></div>'+
      '<p class="muted">'+b('I prezzi sono visibili soltanto al titolare. I dipendenti vedono nome e unità di misura.')+'</p>'+
      (add?'<div class="card" style="margin-bottom:17px">'+add+'</div>':'')+
      '<section class="card"><h3>'+b('Materiali registrati')+' <span class="pill">'+materials.length+'</span></h3>'+
      (rows||'<p class="muted">'+b('Nessun materiale nel catalogo.')+'</p>')+'</section>';
  }
  function reportMaterialsMarkup(report){
    if(!ready||!report)return '';
    const editing=reportEditable(report);
    const current=owner()?reportUsages(report.id):selectedReportId===report.id?workerUsage:[];
    const rows=current.map(x=>'<div class="taskrow"><div><strong>'+safe(x.material_name)+'</strong>'+
      '<p class="muted">'+safe(x.quantity)+' '+safe(x.unit)+'</p></div>'+
      (editing&&selectedReportId===report.id?
        '<button class="ghost small" data-action="biz-remove-usage" data-report-id="'+safe(report.id)+'" data-material-id="'+safe(x.material_id)+'">'+b('Rimuovi')+'</button>':'')+'</div>').join('');
    const panel=editing&&selectedReportId===report.id?'<div class="eg-business-inline">'+
      '<form data-form="biz-usage" class="formgrid">'+
      '<input type="hidden" name="report_id" value="'+safe(report.id)+'">'+
      '<label class="field"><span>'+b('Materiale utilizzato')+'</span><select name="material_id" required>'+
       catalog.map(m=>opt(m.id,m.name+' · '+m.unit)).join('')+'</select></label>'+
      '<label class="field"><span>'+b('Quantità utilizzata')+'</span><input name="quantity" type="number" min=".001" max="100000" step=".001" required></label>'+
      '<div class="span2 actions"><button class="primary small" type="submit" '+(!catalog.length?'disabled':'')+'>'+
      b('Registra consumo')+'</button>'+
      '<button class="ghost small" type="button" data-action="biz-close-usage">'+b('Chiudi')+'</button></div></form>'+
      (!catalog.length?'<p class="muted">'+b('Il titolare deve prima inserire materiali nel catalogo.')+'</p>':'')+
      '</div>':'';
    return '<div class="eg-business-usage"><div class="cardhead"><h3>'+b('Materiali consumati')+'</h3>'+
      (editing?'<button class="secondary small" data-action="biz-open-usage" data-id="'+safe(report.id)+'">'+b('Gestisci consumi')+'</button>':'')+
      '</div>'+
      (rows||'<p class="muted">'+b('Nessun consumo registrato.')+'</p>')+
      panel+'</div>';
  }
  function planFormMarkup(){
    if(!owner())return '';
    const plan=plans.find(x=>x.id===editingPlanId)||null;
    const team=ctx().members.filter(m=>m.role==='worker'&&m.active);
    const client=plan?.client_id||ctx().clients[0]?.id||'';
    const siteChoices=ctx().sites.filter(x=>x.client_id===client);
    return '<div class="card eg-business-form" style="margin-bottom:17px"><h3>'+
      b(plan?'Modifica manutenzione':'Nuova manutenzione ricorrente')+'</h3>'+
      '<form data-form="biz-maintenance" class="formgrid">'+
      '<label class="field"><span>'+b('Descrizione intervento')+'</span><input name="title" minlength="2" maxlength="200" value="'+safe(plan?.title||'')+'" required></label>'+
      '<label class="field"><span>'+b('Frequenza')+'</span><select name="cadence">'+
        ['weekly','biweekly','monthly','quarterly'].map(x=>opt(x,translateCadence(x),plan?.cadence===x)).join('')+'</select></label>'+
      '<label class="field"><span>'+b('Cliente')+'</span><select name="client_id" data-biz-client="1" required>'+
        ctx().clients.map(x=>opt(x.id,x.name,x.id===client)).join('')+'</select></label>'+
      '<label class="field"><span>'+b('Cantiere (facoltativo)')+'</span><select name="site_id" data-biz-site="1">'+
        opt('','—')+siteChoices.map(x=>opt(x.id,x.name,x.id===plan?.site_id)).join('')+'</select></label>'+
      '<label class="field"><span>'+b('Dipendente')+'</span><select name="assignee_id" required>'+
        team.map(x=>opt(x.user_id,x.full_name,x.user_id===plan?.assignee_id)).join('')+'</select></label>'+
      '<label class="field"><span>'+b('Prossima scadenza')+'</span><input name="next_due_date" type="date" value="'+safe(plan?.next_due_date||'')+'" required></label>'+
      '<label class="field"><span>'+b('Ora prevista (facoltativa)')+'</span><input name="start_time" type="time" value="'+safe(plan?.start_time?.slice(0,5)||'')+'"></label>'+
      '<label class="field"><span>'+b('Durata prevista (minuti)')+'</span><input name="estimated_minutes" type="number" min="0" max="1440" value="'+safe(plan?.estimated_minutes??'')+'"></label>'+
      '<label class="field span2"><span>'+b('Istruzioni')+'</span><textarea name="instructions" rows="3" maxlength="4000">'+safe(plan?.instructions||'')+'</textarea></label>'+
      '<div class="span2 actions"><button type="submit" class="primary" '+(!team.length||!ctx().clients.length?'disabled':'')+'>'+b('Salva pianificazione')+'</button>'+
      '<button class="ghost" type="button" data-action="biz-cancel-plan">'+b('Annulla')+'</button></div></form></div>';
  }
  function maintenanceMarkup(){
    if(!owner())return '';
    const rows=plans.map(plan=>'<div class="taskrow"><div><strong>'+safe(plan.title)+'</strong>'+
      '<div class="task-meta"><span>'+safe(clientName(plan.client_id))+'</span>'+
      '<span>'+safe(siteName(plan.site_id))+'</span>'+
      '<span>'+safe(memberName(plan.assignee_id))+'</span>'+
      '<span>'+safe(translateCadence(plan.cadence))+'</span>'+
      '<span>'+b('Prossima scadenza')+': '+date(plan.next_due_date)+'</span></div></div>'+
      '<div class="actions"><span class="pill">'+b(plan.active?'Attivo':'Disattivato')+'</span>'+
      '<button class="ghost small" data-action="biz-edit-plan" data-id="'+safe(plan.id)+'">'+b('Modifica')+'</button>'+
      '<button class="ghost small" data-action="biz-toggle-plan" data-id="'+safe(plan.id)+'">'+
        b(plan.active?'Disattiva':'Riattiva')+'</button></div></div>').join('');
    return '<div class="view-head"><div><h2>'+b('Manutenzioni ricorrenti')+'</h2>'+
      '<p class="muted">'+b('Le attività si generano senza duplicati quando il titolare apre o aggiorna l’app. Per la generazione anche a portale chiuso serve attivare il processo programmato sul server.')+'</p></div>'+
      '<div class="actions"><button class="secondary" data-action="biz-generate">'+b('Genera prossimi interventi')+'</button>'+
      '<button class="primary" data-action="biz-new-plan">'+b('Nuovo piano')+'</button></div></div>'+
      (showNewPlan||editingPlanId?planFormMarkup():'')+
      '<section class="card"><h3>'+b('Piani di manutenzione')+'</h3>'+
      (rows||'<p class="muted">'+b('Nessun piano programmato.')+'</p>')+'</section>';
  }
  function invoicesMarkup(){
    if(!owner())return '';
    const available=ctx().reports.filter(r=>r.status==='approved'&&!invoices.some(i=>i.report_id===r.id));
    const create='<section class="card" style="margin-bottom:17px"><h3>'+b('Crea bozza da rapporto approvato')+'</h3>'+
      '<p class="muted">'+b('I materiali e le ore del rapporto vengono copiati in una bozza modificabile. Non viene emessa alcuna fattura fiscale.')+'</p>'+
      '<form data-form="biz-invoice" class="formgrid">'+
      '<label class="field span2"><span>'+b('Rapporto approvato')+'</span><select name="report_id" required>'+
        available.map(r=>opt(r.id,date(r.work_date)+' · '+taskName(r)+' · '+clientName(ctx().tasks.find(x=>x.id===r.task_id)?.client_id))).join('')+'</select></label>'+
      '<label class="field"><span>'+b('Tariffa oraria (€)')+'</span><input name="labor_rate" type="number" min="0" max="10000" step=".01" value="0" required></label>'+
      '<label class="field"><span>'+b('IVA manodopera (%)')+'</span><input name="labor_vat" type="number" min="0" max="30" step=".01" value="22" required></label>'+
      '<div class="span2"><button class="primary" type="submit" '+(!available.length?'disabled':'')+'>'+b('Crea bozza')+'</button></div></form></section>';
    const entries=invoices.map(i=>{
      const sum=summary(i.id),rep=ctx().reports.find(x=>x.id===i.report_id);
      return '<div class="taskrow"><div><strong>'+safe(clientName(i.client_id))+'</strong>'+
        '<div class="task-meta"><span>'+date(i.created_at)+'</span><span>'+safe(taskName(rep))+'</span>'+
        '<span>'+b('Totale stimato')+': '+money(sum.total)+'</span></div></div>'+
        '<button class="secondary small" data-action="biz-invoice-detail" data-id="'+safe(i.id)+'">'+b('Apri bozza')+'</button></div>';
    }).join('');
    return '<div class="view-head"><h2>'+b('Bozze proforma')+'</h2></div>'+
      '<div class="alert warn">'+b('Non è una fattura elettronica. Per emissione fiscale, numerazione e invio SDI serve un software conforme.')+'</div>'+
      create+
      '<section class="card"><h3>'+b('Bozze archiviate')+'</h3>'+
      (entries||'<p class="muted">'+b('Nessuna bozza creata.')+'</p>')+'</section>'+
      (selectedInvoiceId?invoiceDetailMarkup(selectedInvoiceId):'');
  }
  function invoiceDetailMarkup(id){
    const invoice=invoices.find(x=>x.id===id);if(!invoice)return '';
    const rows=lines.filter(l=>l.invoice_id===id);
    const s=summary(id);
    const list=rows.map(l=>'<div class="taskrow"><div><strong>'+safe(l.description)+'</strong>'+
      '<p class="muted">'+safe(l.quantity)+' '+safe(l.unit)+' × '+money(l.unit_price)+
      ' · '+b('IVA')+' '+safe(l.vat_rate)+'% = '+money(totalLine(l).gross)+'</p></div>'+
      '<button class="ghost small" data-action="biz-line-delete" data-id="'+safe(l.id)+'">'+b('Rimuovi')+'</button></div>').join('');
    return '<section class="card eg-invoice-detail" style="margin-top:17px" id="biz-invoice-detail">'+
      '<div class="cardhead"><h3>'+b('Dettaglio bozza')+'</h3>'+
      '<div class="actions"><button class="secondary" data-action="biz-print-invoice" data-id="'+safe(id)+'">'+b('Stampa / Salva PDF')+'</button>'+
      '<button class="ghost" data-action="biz-invoice-close">'+b('Chiudi')+'</button></div></div>'+
      '<p><strong>'+safe(clientName(invoice.client_id))+'</strong></p>'+
      list+'<div class="eg-invoice-total"><p>'+b('Imponibile')+': <strong>'+money(s.base)+'</strong></p>'+
      '<p>'+b('IVA')+': <strong>'+money(s.vat)+'</strong></p><h3>'+b('Totale')+': '+money(s.total)+'</h3></div>'+
      '<form data-form="biz-invoice-line" class="formgrid">'+
      '<input type="hidden" name="invoice_id" value="'+safe(id)+'">'+
      '<label class="field span2"><span>'+b('Descrizione voce')+'</span><input name="description" minlength="2" maxlength="500" required></label>'+
      '<label class="field"><span>'+b('Quantità')+'</span><input name="quantity" type="number" min=".001" max="100000" step=".001" value="1" required></label>'+
      '<label class="field"><span>'+b('Unità')+'</span><input name="unit" maxlength="20" value="pz" required></label>'+
      '<label class="field"><span>'+b('Prezzo unitario (€)')+'</span><input name="unit_price" type="number" min="0" max="9999999" step=".01" required></label>'+
      '<label class="field"><span>'+b('IVA')+' (%)</span><input name="vat_rate" type="number" min="0" max="30" step=".01" value="22" required></label>'+
      '<div class="span2"><button class="secondary" type="submit">'+b('Aggiungi voce')+'</button></div></form></section>';
  }
  function printInvoice(id){
    const invoice=invoices.find(x=>x.id===id);if(!invoice)return;
    const summaryData=summary(id);
    const rep=ctx().reports.find(r=>r.id===invoice.report_id);
    const rows=lines.filter(x=>x.invoice_id===id);
    const body=rows.map(l=>'<tr><td>'+safe(l.description)+'</td><td>'+safe(l.quantity)+' '+safe(l.unit)+'</td>'+
      '<td>'+money(l.unit_price)+'</td><td>'+safe(l.vat_rate)+'%</td><td>'+money(totalLine(l).gross)+'</td></tr>').join('');
    const sheet='<div class="eg-print-sheet">'+
      '<p style="font-size:13px;letter-spacing:1px;font-weight:bold">'+b('DOCUMENTO PROFORMA · NON DOCUMENTO FISCALE')+'</p>'+
      '<h1>'+safe(ctx().companyName||'EasyGart')+'</h1>'+
      '<p>'+b('Cliente')+': <strong>'+safe(clientName(invoice.client_id))+'</strong></p>'+
      '<p>'+b('Data')+': '+date(invoice.created_at)+' · '+b('Lavoro')+': '+safe(taskName(rep))+'</p>'+
      '<table><thead><tr><th>'+b('Descrizione')+'</th><th>'+b('Quantità')+'</th><th>'+b('Prezzo')+'</th><th>'+b('IVA')+'</th><th>'+b('Totale')+'</th></tr></thead><tbody>'+
      body+'</tbody></table><div class="eg-invoice-total"><p>'+b('Imponibile')+': '+money(summaryData.base)+'</p>'+
      '<p>'+b('IVA')+': '+money(summaryData.vat)+'</p><h2>'+b('Totale')+': '+money(summaryData.total)+'</h2></div>'+
      '<p>'+b('Questa bozza non costituisce una fattura emessa e non dispone di numerazione fiscale.')+'</p></div>';
    const zone=document.getElementById('eg-print-zone');
    if(!zone)return;
    zone.innerHTML=sheet;
    window.print?.();
  }
  function markup(view){
    if(!ready)return warning();
    if(!owner())return '<p class="muted">'+b('Solo il titolare può gestire questa sezione.')+'</p>';
    if(view==='materials')return materialCatalogMarkup();
    if(view==='maintenance')return maintenanceMarkup();
    if(view==='invoices')return invoicesMarkup();
    return '';
  }
  async function handleSubmit(form){
    if(!ready)throw Error(tr('Gestione aziendale non disponibile.'));
    const c=ctx(),vals=Object.fromEntries(new FormData(form)),kind=form.dataset.form;
    if(kind==='biz-usage'){
      const report=c.reports.find(x=>x.id===vals.report_id);
      if(!reportEditable(report))throw Error(tr('Rapporto non modificabile.'));
      db(await client.rpc('eg_set_report_material',{p_report_id:report.id,
        p_material_id:vals.material_id,p_quantity:Number(vals.quantity)}));
      await reloadWorkerUsage(report.id);onSuccess(tr('Consumo registrato.'));rerender();return;
    }
    if(!owner())throw Error(tr('Solo il titolare può modificare questi dati.'));
    if(kind==='biz-material'){
      const payload={company_id:c.companyId,name:String(vals.name||'').trim(),unit:vals.unit,
        purchase_price:Number(vals.purchase_price),sale_price:Number(vals.sale_price),
        vat_rate:Number(vals.vat_rate)};
      db(await client.from('eg_materials').insert(payload));
      showNewMaterial=false;await c.reload();onSuccess(tr('Materiale salvato.'));return;
    }
    if(kind==='biz-maintenance'){
      const requestedClient=c.clients.find(x=>x.id===vals.client_id);
      const requestedSite=c.sites.find(x=>x.id===vals.site_id);
      const person=c.members.find(x=>x.user_id===vals.assignee_id&&x.role==='worker'&&x.active);
      if(!requestedClient||!person||(vals.site_id&&requestedSite?.client_id!==requestedClient.id))
        throw Error(tr('Cliente, cantiere o dipendente non valido.'));
      const old=plans.find(x=>x.id===editingPlanId);
      const nextDue=vals.next_due_date;
      const payload={company_id:c.companyId,client_id:requestedClient.id,site_id:vals.site_id||null,
        assignee_id:person.user_id,title:String(vals.title||'').trim(),
        instructions:String(vals.instructions||'').trim(),cadence:vals.cadence,
        next_due_date:nextDue,start_time:vals.start_time||null,
        estimated_minutes:vals.estimated_minutes?Number(vals.estimated_minutes):null};
      if(old){
        db(await client.from('eg_maintenance_plans').update(payload).eq('id',old.id).eq('company_id',c.companyId));
      }else{
        db(await client.from('eg_maintenance_plans').insert({...payload,anchor_date:nextDue}));
      }
      showNewPlan=false;editingPlanId=null;await c.reload();onSuccess(tr('Piano di manutenzione salvato.'));return;
    }
    if(kind==='biz-invoice'){
      const r=c.reports.find(x=>x.id===vals.report_id&&x.status==='approved');
      if(!r)throw Error(tr('Scegli un rapporto approvato.'));
      const id=db(await client.rpc('eg_invoice_from_report',{
        p_report_id:r.id,p_labor_rate:Number(vals.labor_rate),p_labor_vat:Number(vals.labor_vat)
      }));
      selectedInvoiceId=id;await c.reload();onSuccess(tr('Bozza proforma creata.'));return;
    }
    if(kind==='biz-invoice-line'){
      const draft=invoices.find(x=>x.id===vals.invoice_id);
      if(!draft)throw Error(tr('Bozza non trovata.'));
      const payload={company_id:c.companyId,invoice_id:draft.id,kind:'other',
        description:String(vals.description||'').trim(),quantity:Number(vals.quantity),
        unit:vals.unit,unit_price:Number(vals.unit_price),vat_rate:Number(vals.vat_rate)};
      db(await client.from('eg_invoice_lines').insert(payload));
      await c.reload();onSuccess(tr('Voce aggiunta alla bozza.'));return;
    }
  }
  async function reloadWorkerUsage(reportId){
    const r=await client.rpc('eg_list_report_materials',{p_report_id:reportId});
    workerUsage=db(r)||[];
  }
  async function handleAction(el){
    const a=el.dataset.action,c=ctx(),id=el.dataset.id;
    if(a==='biz-new-material'){showNewMaterial=true;rerender();return}
    if(a==='biz-cancel-material'){showNewMaterial=false;rerender();return}
    if(a==='biz-open-usage'){
      const report=c.reports.find(x=>x.id===id);
      if(!reportEditable(report))return;
      selectedReportId=id;await reloadWorkerUsage(id);rerender();return;
    }
    if(a==='biz-close-usage'){selectedReportId=null;workerUsage=[];rerender();return}
    if(a==='biz-remove-usage'){
      const report=c.reports.find(x=>x.id===el.dataset.reportId);
      if(!reportEditable(report))return;
      db(await client.rpc('eg_set_report_material',{p_report_id:report.id,
        p_material_id:el.dataset.materialId,p_quantity:0}));
      await reloadWorkerUsage(report.id);rerender();return;
    }
    if(!owner())return;
    if(a==='biz-toggle-material'){
      const m=materials.find(x=>x.id===id);if(!m)return;
      db(await client.from('eg_materials').update({active:!m.active}).eq('id',m.id).eq('company_id',c.companyId));
      await c.reload();return;
    }
    if(a==='biz-new-plan'){showNewPlan=true;editingPlanId=null;rerender();return}
    if(a==='biz-edit-plan'){editingPlanId=id;showNewPlan=false;rerender();return}
    if(a==='biz-cancel-plan'){editingPlanId=null;showNewPlan=false;rerender();return}
    if(a==='biz-toggle-plan'){
      const plan=plans.find(x=>x.id===id);if(!plan)return;
      db(await client.from('eg_maintenance_plans').update({active:!plan.active})
        .eq('id',plan.id).eq('company_id',c.companyId));
      await c.reload();return;
    }
    if(a==='biz-generate'){
      const count=Number(db(await client.rpc('eg_generate_maintenance',{
        p_company_id:c.companyId,p_horizon_days:30
      })))||0;
      await c.reload();onSuccess(tr('Attività generate:')+' '+count);return;
    }
    if(a==='biz-invoice-detail'){selectedInvoiceId=id;rerender();return}
    if(a==='biz-invoice-close'){selectedInvoiceId=null;rerender();return}
    if(a==='biz-line-delete'){
      const line=lines.find(x=>x.id===id);if(!line)return;
      if(!confirm(tr('Eliminare questa voce dalla bozza?')))return;
      db(await client.from('eg_invoice_lines').delete().eq('id',id).eq('company_id',c.companyId));
      await c.reload();return;
    }
    if(a==='biz-print-invoice'){printInvoice(id);return}
  }
  function handleChange(element){
    if(element.dataset.bizClient){
      const form=element.closest('form');const site=form?.querySelector('select[data-biz-site]');
      if(site)site.innerHTML=opt('','—')+
        ctx().sites.filter(x=>x.client_id===element.value).map(x=>opt(x.id,x.name)).join('');
      return true;
    }
    return false;
  }
  return {refresh,reset,markup,reportMaterialsMarkup,handleSubmit,handleAction,handleChange,
    hasOpenForm:()=>showNewMaterial||showNewPlan||!!editingPlanId,
    visible:()=>ready,summary};
};