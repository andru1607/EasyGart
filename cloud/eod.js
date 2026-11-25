/* EasyGart Cloud: modulo di fine giornata, separato da timbrature e compiti. */
'use strict';
window.createEasyGartEndOfDay=function({client,getContext,esc}){
  let editingId=null;
  let catalog=[],chosen=[],newMaterialOpen=false,materialsReady=false;
  const unitLabel=u=>({'pz':'pz','kg':'kg','l':'l','m':'m','m2':'m²','m3':'m³','h':'h'})[u]||u;
  const amount=n=>String(Number(n||0));
  async function prepareOpen(id=null){
    if(!open(id))return false;
    catalog=[];chosen=[];materialsReady=false;newMaterialOpen=false;
    const c=ctx();
    const calls=[client.rpc('eg_list_materials',{p_company_id:c.companyId})];
    if(id)calls.push(client.rpc('eg_list_report_materials',{p_report_id:id}));
    const rows=await Promise.all(calls);
    for(const r of rows)if(r.error)throw r.error;
    catalog=rows[0].data||[];
    chosen=(rows[1]?.data||[]).map(x=>({id:x.material_id,name:x.material_name,unit:x.unit,quantity:Number(x.quantity)}));
    materialsReady=true;
    return true;
  }
  function addSelected(form){
    const id=form.querySelector('[name="material_pick"]')?.value;
    const qty=Number(form.querySelector('[name="material_pick_qty"]')?.value);
    const m=catalog.find(x=>x.id===id);
    if(!m)throw Error(tr('Seleziona un materiale dal catalogo','Material aus dem Katalog wählen'));
    if(!Number.isFinite(qty)||qty<=0||qty>100000)throw Error(tr('Quantità non valida','Ungültige Menge'));
    const existing=chosen.find(x=>x.id===id);
    if(existing)existing.quantity=qty;
    else chosen.push({id:m.id,name:m.name,unit:m.unit,quantity:qty});
  }
  function removeSelected(id){chosen=chosen.filter(x=>x.id!==id)}
  function toggleNewMaterial(){newMaterialOpen=!newMaterialOpen}
  async function createMaterial(form){
    const name=String(form.querySelector('[name="new_material_name"]')?.value||'').trim();
    const unit=String(form.querySelector('[name="new_material_unit"]')?.value||'pz');
    if(name.length<2||name.length>200)throw Error(tr('Inserisci un nome materiale valido','Materialnamen eingeben'));
    const r=await client.rpc('eg_create_basic_material',{p_company_id:ctx().companyId,p_name:name,p_unit:unit});
    if(r.error)throw r.error;
    const created=Array.isArray(r.data)?r.data[0]:r.data;
    if(!created?.id)throw Error(tr('Materiale non salvato','Material wurde nicht gespeichert'));
    if(!catalog.some(x=>x.id===created.id))catalog.push(created);
    if(!chosen.some(x=>x.id===created.id))chosen.push({id:created.id,name:created.name,unit:created.unit,quantity:1});
    newMaterialOpen=false;
  }
  function syncQuantities(form){
    return chosen.map(x=>{
      const input=form.querySelector('[name="quantity_'+x.id+'"]');
      const qty=Number(input?.value??x.quantity);
      if(!Number.isFinite(qty)||qty<=0||qty>100000)throw Error(tr('Controlla le quantità dei materiali','Materialmengen prüfen'));
      return {material_id:x.id,quantity:qty};
    });
  }
  const ctx=()=>getContext();
  const tr=(it,de)=>ctx().locale==='de'?de:it;
  const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const opt=(value,label,selected=false)=>'<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';
  const workerName=id=>ctx().members.find(m=>m.user_id===id)?.full_name||tr('Dipendente','Mitarbeiter');
  const report=()=>ctx().reports.find(r=>r.id===editingId)||null;
  const canEdit=r=>{
    const c=ctx();
    return !!r && (c.isOwner || r.created_by===c.user?.id) &&
      !r.invoice_locked;
  };
  function open(id=null){
    if(id&& !canEdit(ctx().reports.find(r=>r.id===id)))return false;
    editingId=id||null;chosen=[];newMaterialOpen=false;materialsReady=false;return true;
  }
  function reset(){editingId=null;catalog=[];chosen=[];newMaterialOpen=false;materialsReady=false}
  function getId(){return editingId}
  function tasksFor(workerId,siteId){
    return ctx().tasks.filter(x=>x.assignee_id===workerId&&(!x.site_id||x.site_id===siteId));
  }
  function markup(){
    const c=ctx(),r=report(),who=r?.created_by||c.user?.id||'';
    const siteId=r?.site_id||c.tasks.find(t=>t.id===r?.task_id)?.site_id||'';
    const startTime=String(r?.work_start_time||'').slice(0,5);
    const endTime=String(r?.work_end_time||'').slice(0,5);
    const breakMinutes=Number(r?.break_minutes||0);
    const editable=!r||canEdit(r);
    const taskOptions=tasksFor(who,siteId);
    const hasSites=c.sites.length>0;
    const workers=c.members.filter(m=>m.active&&['worker','owner'].includes(m.role));
    const materialRows=chosen.map(m=>'<div class="eg-material-line">'+
      '<div><strong>'+esc(m.name)+'</strong><small>'+esc(unitLabel(m.unit))+'</small></div>'+
      '<label class="field"><span>'+tr('Quantità','Menge')+'</span>'+
      '<input type="number" inputmode="decimal" name="quantity_'+esc(m.id)+'" min=".001" max="100000" step=".001" value="'+esc(amount(m.quantity))+'" required></label>'+
      '<button type="button" class="ghost small" data-action="eod-remove-material" data-id="'+esc(m.id)+'" aria-label="'+tr('Rimuovi materiale','Material entfernen')+'">×</button></div>').join('');
    const icons={
      calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
      clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      report:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 10h7M8.5 14h7"/></svg>'
    };
    return '<div class="eg-work-page">'+
      '<div class="view-head"><div><div class="eyebrow">'+tr('Registrazione giornaliera','Tägliche Erfassung')+'</div>'+
      '<h1>'+tr(r?'Modifica rapporto':'Fine giornata',r?'Bericht bearbeiten':'Feierabend')+'</h1>'+
      '<p class="muted">'+tr('Registra o correggi un rapporto, anche di una giornata passata. Indica gli orari manualmente.',
        'Einen Bericht erfassen oder nachträglich ändern. Beginn und Ende manuell eingeben.')+'</p></div>'+
      '<button class="ghost small" data-action="eod-back">'+tr('Indietro','Zurück')+'</button></div>'+
      (r?.manager_feedback?'<div class="alert warn">'+esc(r.manager_feedback)+'</div>':'')+
      (!hasSites?'<div class="alert warn">'+tr('Non ci sono cantieri: il titolare deve crearne uno nella sezione Clienti e cantieri.',
        'Keine Einsatzorte vorhanden: Die Betriebsleitung muss zuerst einen Einsatzort anlegen.')+'</div>':'')+
      (r&&!editable?'<div class="alert warn">'+tr('Questo rapporto è collegato a una proforma: non può essere modificato.',
        'Dieser Bericht ist einer Proforma zugeordnet und kann nicht bearbeitet werden.')+'</div>':'')+
      '<form data-form="eod-report" class="eg-eod-form stacked">'+
      '<div class="eg-eod-step card"><span class="eg-step-label">'+icons.calendar+'</span><div class="eg-eod-fields">'+
      '<h2>'+tr('1. Data e cantiere','1. Datum und Einsatzort')+'</h2>'+
      (c.isOwner?'<label class="field"><span>'+tr('Dipendente','Mitarbeiter')+'</span><select name="worker_id" id="eod-worker" '+(r?'disabled':'required')+'>'+
        workers.map(m=>opt(m.user_id,m.full_name||workerName(m.user_id),m.user_id===who)).join('')+
        '</select>'+(r?'<input type="hidden" name="worker_id" value="'+esc(who)+'">':'')+'</label>':'')+
      '<label class="field"><span>'+tr('Data','Datum')+'</span><input type="date" name="work_date" required value="'+esc(r?.work_date||dateToday())+'"></label>'+
      '<label class="field"><span>'+tr('Cantiere','Einsatzort')+' *</span><select name="site_id" id="eod-site" required>'+
        opt('',tr('Seleziona il cantiere','Einsatzort auswählen'),!siteId)+
        c.sites.map(s=>opt(s.id,s.name+' · '+(c.clients.find(x=>x.id===s.client_id)?.name||''),s.id===siteId)).join('')+
        '</select></label>'+
      '<label class="field"><span>'+tr('Compito collegato (facoltativo)','Zugewiesene Aufgabe (optional)')+'</span>'+
        '<select name="task_id" id="eod-task">'+opt('',tr('Nessun compito','Keine Aufgabe'),!r?.task_id)+
          taskOptions.map(t=>opt(t.id,t.title,t.id===r?.task_id)).join('')+'</select></label>'+
      '</div></div>'+
      '<div class="eg-eod-step card"><span class="eg-step-label">'+icons.clock+'</span><div class="eg-eod-fields">'+
      '<h2>'+tr('2. Orari di lavoro','2. Arbeitszeiten')+'</h2>'+
      '<p class="muted eg-small">'+tr('Indica quando hai iniziato e quando hai finito. Gli orari sono inseriti a mano.',
        'Beginn und Ende selbst eingeben. Die Zeiten werden manuell erfasst.')+'</p>'+
      '<div class="eg-eod-time">'+
      '<label class="field"><span>'+tr('Ora inizio','Beginn')+' *</span><input type="time" name="start_time" step="60" required value="'+esc(startTime)+'"></label>'+
      '<label class="field"><span>'+tr('Ora fine','Ende')+' *</span><input type="time" name="end_time" step="60" required value="'+esc(endTime)+'"></label>'+
      '</div>'+
      '<label class="field"><span>'+tr('Pausa (minuti, facoltativa)','Pause (Minuten, optional)')+'</span>'+
      '<input type="number" name="break_minutes" inputmode="numeric" min="0" max="1439" step="1" value="'+breakMinutes+'"></label>'+
      '<p class="muted eg-small">'+tr('Le ore effettive verranno calcolate automaticamente, sottraendo la pausa. Sono separate dalle timbrature.',
        'Die tatsächliche Arbeitszeit wird abzüglich Pause automatisch berechnet. Stempelzeiten bleiben getrennt.')+'</p>'+
      '</div></div>'+
      '<div class="eg-eod-step card"><span class="eg-step-label">'+icons.report+'</span><div class="eg-eod-fields">'+
      '<h2>'+tr('3. Che lavoro è stato fatto','3. Was wurde erledigt')+'</h2>'+
      '<label class="field"><span>'+tr('Rapporto dei lavori','Arbeitsbericht')+' *</span>'+
      '<textarea name="work_summary" rows="5" maxlength="6000" placeholder="'+tr('Es. potatura siepi, raccolta verde, pulizia vialetti…',
        'Z. B. Hecken geschnitten, Grünabfall entfernt, Wege gereinigt …')+'">'+esc(r?.work_summary||'')+'</textarea></label>'+
      '<div class="eg-material-entry"><h3>'+tr('Materiali utilizzati','Verwendete Materialien')+'</h3>'+
      '<p class="muted eg-small">'+tr('Scegli i materiali dal catalogo e indica le quantità. Puoi aggiungerne diversi.',
        'Materialien aus dem Katalog auswählen und Mengen angeben. Mehrere Einträge sind möglich.')+'</p>'+
      (materialRows||'<p class="muted eg-small">'+tr('Nessun materiale aggiunto','Noch kein Material hinzugefügt')+'</p>')+
      '<div class="eg-material-picker">'+
      '<label class="field"><span>'+tr('Materiale','Material')+'</span><select name="material_pick">'+
      opt('',tr('Seleziona un materiale','Material auswählen'))+
      catalog.map(m=>opt(m.id,m.name+' · '+unitLabel(m.unit))).join('')+'</select></label>'+
      '<label class="field"><span>'+tr('Quantità','Menge')+'</span><input name="material_pick_qty" type="number" inputmode="decimal" min=".001" max="100000" step=".001" value="1"></label></div>'+
      '<div class="eg-material-actions"><button type="button" class="secondary small" data-action="eod-add-material" '+(!materialsReady||!catalog.length?'disabled':'')+'>'+
       tr('+ Aggiungi materiale','+ Material hinzufügen')+'</button>'+
      '<button type="button" class="ghost small" data-action="eod-toggle-material">'+
       tr('Materiale non presente?','Material fehlt?')+'</button></div>'+
      (newMaterialOpen?'<div class="eg-material-new"><h4>'+tr('Crea un materiale','Neues Material')+'</h4>'+
       '<div class="eg-material-picker"><label class="field"><span>'+tr('Nome','Name')+'</span><input name="new_material_name" maxlength="200" placeholder="'+tr('Es. Terriccio universale','Z. B. Universalerde')+'"></label>'+
       '<label class="field"><span>'+tr('Unità','Einheit')+'</span><select name="new_material_unit">'+
         ['pz','kg','l','m','m2','m3','h'].map(x=>opt(x,unitLabel(x))).join('')+'</select></label></div>'+
       '<button type="button" class="secondary small" data-action="eod-create-material">'+tr('Crea e aggiungi','Anlegen und hinzufügen')+'</button>'+
       '<p class="muted eg-small">'+tr('Se creato da un dipendente, il prezzo sarà verificato dal titolare.',
         'Von Mitarbeitenden angelegte Materialien müssen durch die Leitung bepreist werden.')+'</p></div>':'')+
      (!materialsReady?'<p class="muted eg-small">'+tr('Caricamento catalogo materiali…','Materialkatalog wird geladen…')+'</p>':'')+
      '</div>'+
      '<label class="field"><span>'+tr('Note aggiuntive sui materiali (facoltative)','Zusätzliche Materialnotizen (optional)')+'</span>'+
      '<textarea name="materials_used" maxlength="4000" rows="2">'+esc(r?.materials_used||'')+'</textarea></label>'+
      '<label class="field"><span>'+tr('Problemi e note (facoltativo)','Probleme und Hinweise (optional)')+'</span>'+
      '<textarea name="issues" maxlength="4000" rows="2">'+esc(r?.issues||'')+'</textarea></label>'+
      '</div></div>'+
      '<div class="eg-eod-submit">'+
      '<button type="submit" class="ghost" value="draft" '+(!editable||!hasSites?'disabled':'')+'>'+tr(r?'Salva modifica':'Salva bozza',r?'Änderung speichern':'Entwurf speichern')+'</button>'+
      '<button type="submit" class="primary" value="send" '+(!editable||!hasSites?'disabled':'')+'>'+tr(r?'Salva e invia':'Invia rapporto',r?'Speichern und senden':'Bericht senden')+'</button>'+
      '</div><p class="muted eg-small">'+tr('Puoi correggere anche i rapporti approvati delle giornate passate. Ogni modifica richiede una nuova verifica. I rapporti collegati a proforma sono bloccati.',
        'Auch ältere freigegebene Berichte können geändert werden und müssen erneut geprüft werden. Mit Proforma verknüpfte Berichte sind gesperrt.')+'</p>'+
      '</form></div>';
  }
  function handleChange(el){
    if(!['eod-site','eod-worker'].includes(el.id))return false;
    const site=document.getElementById('eod-site')?.value||'';
    const worker=document.getElementById('eod-worker')?.value||ctx().user?.id||'';
    const select=document.getElementById('eod-task');
    if(select)select.innerHTML=opt('',tr('Nessun compito','Keine Aufgabe'))+
      tasksFor(worker,site).map(x=>opt(x.id,x.title)).join('');
    return true;
  }
  async function submit(form,send){
    const c=ctx(),r=report(),v=Object.fromEntries(new FormData(form));
    if(!materialsReady)throw Error(tr('Catalogo materiali non caricato','Materialkatalog nicht geladen'));
    const selectedMaterials=syncQuantities(form);
    const toMinutes=value=>{
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||'')))return null;
      const [h,m]=value.split(':').map(Number);
      return h*60+m;
    };
    const start=toMinutes(v.start_time),end=toMinutes(v.end_time);
    const pause=v.break_minutes===''?0:Number(v.break_minutes);
    if(start===null||end===null)throw Error(tr('Inserisci ora di inizio e ora di fine valide.',
      'Bitte gültige Beginn- und Endzeiten eingeben.'));
    const elapsed=(end-start+1440)%1440;
    if(!Number.isInteger(pause)||pause<0||pause>=elapsed||elapsed===0)
      throw Error(tr('Controlla gli orari e la pausa. La pausa deve essere inferiore al turno.',
        'Arbeitszeiten und Pause prüfen. Die Pause muss kürzer als die Schicht sein.'));
    const total=elapsed-pause;
    const site=c.sites.find(s=>s.id===v.site_id);
    if(!site)throw Error(tr('Seleziona un cantiere','Bitte Einsatzort auswählen'));
    const worker=r?.created_by||(c.isOwner?v.worker_id:c.user?.id);
    if(!worker)throw Error(tr('Seleziona il dipendente','Bitte Mitarbeiter auswählen'));
    const task=v.task_id?tasksFor(worker,site.id).find(t=>t.id===v.task_id):null;
    if(v.task_id&&!task)throw Error(tr('Compito non valido','Ungültige Aufgabe'));
    if(send&&(total<1||String(v.work_summary||'').trim().length<10))
      throw Error(tr('Per inviare inserisci le ore e descrivi il lavoro (almeno 10 caratteri).',
        'Zum Senden Arbeitszeit und Tätigkeitsbeschreibung (mindestens 10 Zeichen) eingeben.'));
    const {error}=await client.rpc('eg_save_daily_report_v5',{
      p_report_id:r?.id||null,p_company_id:c.companyId,p_worker_id:worker,
      p_site_id:site.id,p_task_id:task?.id||null,p_work_date:v.work_date,
      p_start_time:v.start_time,p_end_time:v.end_time,p_break_minutes:pause,
      p_work_summary:String(v.work_summary||''),
      p_materials_used:String(v.materials_used||''),p_issues:String(v.issues||''),
      p_materials:selectedMaterials,
      p_send:!!send
    });
    if(error)throw error;
    editingId=null;
    await c.onSaved(send);
  }
  return {markup,open,prepareOpen,reset,getId,handleChange,submit,canEdit,addSelected,removeSelected,toggleNewMaterial,createMaterial};
};
