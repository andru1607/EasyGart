/* EasyGart Cloud: modulo di fine giornata, separato da timbrature e compiti. */
'use strict';
window.createEasyGartEndOfDay=function({client,getContext,esc}){
  let editingId=null;
  const ctx=()=>getContext();
  const tr=(it,de)=>ctx().locale==='de'?de:it;
  const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const opt=(value,label,selected=false)=>'<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';
  const workerName=id=>ctx().members.find(m=>m.user_id===id)?.full_name||tr('Dipendente','Mitarbeiter');
  const report=()=>ctx().reports.find(r=>r.id===editingId)||null;
  const canEdit=r=>{
    const c=ctx();
    return !!r && (c.isOwner || r.created_by===c.user?.id) &&
      (r.status!=='approved'||(c.isOwner&&!r.has_invoice));
  };
  function open(id=null){
    if(id&& !canEdit(ctx().reports.find(r=>r.id===id)))return false;
    editingId=id||null;return true;
  }
  function reset(){editingId=null}
  function getId(){return editingId}
  function tasksFor(workerId,siteId){
    return ctx().tasks.filter(x=>x.assignee_id===workerId&&(!x.site_id||x.site_id===siteId));
  }
  function markup(){
    const c=ctx(),r=report(),who=r?.created_by||c.user?.id||'';
    const siteId=r?.site_id||c.tasks.find(t=>t.id===r?.task_id)?.site_id||'';
    const hours=Math.floor((r?.minutes_worked||0)/60),mins=(r?.minutes_worked||0)%60;
    const editable=!r||canEdit(r);
    const taskOptions=tasksFor(who,siteId);
    const hasSites=c.sites.length>0;
    const workers=c.members.filter(m=>m.active&&['worker','owner'].includes(m.role));
    return '<div class="eg-work-page">'+
      '<div class="view-head"><div><div class="eyebrow">'+tr('Registrazione giornaliera','Tägliche Erfassung')+'</div>'+
      '<h1>'+tr(r?'Modifica rapporto':'Fine giornata',r?'Bericht bearbeiten':'Feierabend')+'</h1>'+
      '<p class="muted">'+tr('Indica il cantiere, le ore effettive e il lavoro svolto. Non serve una timbratura o un compito assegnato.',
        'Einsatzort, tatsächliche Stunden und erledigte Arbeiten eintragen. Keine Stempeluhr und keine zugewiesene Aufgabe erforderlich.')+'</p></div>'+
      '<button class="ghost small" data-action="eod-back">'+tr('Torna ai rapporti','Zurück zu Berichten')+'</button></div>'+
      (r?.manager_feedback?'<div class="alert warn">'+esc(r.manager_feedback)+'</div>':'')+
      (!hasSites?'<div class="alert warn">'+tr('Non ci sono cantieri: il titolare deve crearne uno nella sezione Clienti e cantieri.',
        'Keine Einsatzorte vorhanden: Die Betriebsleitung muss zuerst einen Einsatzort anlegen.')+'</div>':'')+
      (r&&!editable?'<div class="alert warn">'+tr('Questo rapporto è approvato e non è più modificabile.',
        'Dieser Bericht wurde freigegeben und kann nicht mehr bearbeitet werden.')+'</div>':'')+
      '<form data-form="eod-report" class="card eg-eod-form stacked">'+
      '<div class="eg-eod-step"><span class="eg-step-label">01</span><div class="eg-eod-fields">'+
      '<h2>'+tr('Dove e quando hai lavorato','Wo und wann wurde gearbeitet')+'</h2>'+
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
      '<div class="eg-eod-step"><span class="eg-step-label">02</span><div class="eg-eod-fields">'+
      '<h2>'+tr('Quante ore hai lavorato','Wie lange hast du gearbeitet')+'</h2>'+
      '<div class="eg-eod-time">'+
      '<label class="field"><span>'+tr('Ore','Stunden')+'</span><input type="number" inputmode="numeric" name="hours" min="0" max="24" step="1" value="'+hours+'" required></label>'+
      '<label class="field"><span>'+tr('Minuti','Minuten')+'</span><input type="number" inputmode="numeric" name="minutes" min="0" max="59" step="1" value="'+mins+'" required></label>'+
      '</div><p class="muted eg-small">'+tr('Inserisci solo il tempo effettivo, senza le pause. Le timbrature restano separate.',
        'Nur die tatsächliche Arbeitszeit ohne Pausen eingeben. Stempelzeiten bleiben getrennt.')+'</p>'+
      '</div></div>'+
      '<div class="eg-eod-step"><span class="eg-step-label">03</span><div class="eg-eod-fields">'+
      '<h2>'+tr('Che lavoro è stato fatto','Was wurde erledigt')+'</h2>'+
      '<label class="field"><span>'+tr('Rapporto dei lavori','Arbeitsbericht')+' *</span>'+
      '<textarea name="work_summary" rows="5" maxlength="6000" placeholder="'+tr('Es. potatura siepi, raccolta verde, pulizia vialetti…',
        'Z. B. Hecken geschnitten, Grünabfall entfernt, Wege gereinigt …')+'">'+esc(r?.work_summary||'')+'</textarea></label>'+
      '<label class="field"><span>'+tr('Materiali utilizzati (facoltativo)','Materialien (optional)')+'</span>'+
      '<textarea name="materials_used" maxlength="4000" rows="2">'+esc(r?.materials_used||'')+'</textarea></label>'+
      '<label class="field"><span>'+tr('Problemi e note (facoltativo)','Probleme und Hinweise (optional)')+'</span>'+
      '<textarea name="issues" maxlength="4000" rows="2">'+esc(r?.issues||'')+'</textarea></label>'+
      '</div></div>'+
      '<div class="eg-eod-submit">'+
      '<button type="submit" class="ghost" value="draft" '+(!editable||!hasSites?'disabled':'')+'>'+tr('Salva bozza','Entwurf speichern')+'</button>'+
      '<button type="submit" class="primary" value="send" '+(!editable||!hasSites?'disabled':'')+'>'+tr('Invia rapporto','Bericht senden')+'</button>'+
      '</div><p class="muted eg-small">'+tr('Puoi correggere i tuoi rapporti anche dopo l’invio, finché non sono approvati. Il titolare vede lo storico delle modifiche.',
        'Berichte bleiben bis zur Freigabe bearbeitbar. Die Betriebsleitung sieht das Änderungsprotokoll.')+'</p>'+
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
    const hours=Number(v.hours),minutes=Number(v.minutes);
    const total=hours*60+minutes;
    if(!Number.isInteger(hours)||!Number.isInteger(minutes)||hours<0||hours>24||
       minutes<0||minutes>59||total>1440)throw Error(tr('Inserisci ore valide','Bitte gültige Stunden eingeben'));
    const site=c.sites.find(s=>s.id===v.site_id);
    if(!site)throw Error(tr('Seleziona un cantiere','Bitte Einsatzort auswählen'));
    const worker=r?.created_by||(c.isOwner?v.worker_id:c.user?.id);
    if(!worker)throw Error(tr('Seleziona il dipendente','Bitte Mitarbeiter auswählen'));
    const task=v.task_id?tasksFor(worker,site.id).find(t=>t.id===v.task_id):null;
    if(v.task_id&&!task)throw Error(tr('Compito non valido','Ungültige Aufgabe'));
    if(send&&(total<1||String(v.work_summary||'').trim().length<10))
      throw Error(tr('Per inviare inserisci le ore e descrivi il lavoro (almeno 10 caratteri).',
        'Zum Senden Arbeitszeit und Tätigkeitsbeschreibung (mindestens 10 Zeichen) eingeben.'));
    const {error}=await client.rpc('eg_save_daily_report_v2',{
      p_report_id:r?.id||null,p_company_id:c.companyId,p_worker_id:worker,
      p_site_id:site.id,p_task_id:task?.id||null,p_work_date:v.work_date,
      p_minutes_worked:total,p_work_summary:String(v.work_summary||''),
      p_materials_used:String(v.materials_used||''),p_issues:String(v.issues||''),
      p_send:!!send
    });
    if(error)throw error;
    editingId=null;
    await c.onSaved(send);
  }
  return {markup,open,reset,getId,handleChange,submit,canEdit};
};
