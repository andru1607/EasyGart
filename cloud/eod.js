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
      !r.invoice_locked;
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
    const startTime=String(r?.work_start_time||'').slice(0,5);
    const endTime=String(r?.work_end_time||'').slice(0,5);
    const breakMinutes=Number(r?.break_minutes||0);
    const editable=!r||canEdit(r);
    const taskOptions=tasksFor(who,siteId);
    const hasSites=c.sites.length>0;
    const workers=c.members.filter(m=>m.active&&['worker','owner'].includes(m.role));
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
      '<button class="ghost small" data-action="eod-back">'+tr('Torna ai rapporti','Zurück zu Berichten')+'</button></div>'+
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
      '<label class="field"><span>'+tr('Materiali utilizzati (facoltativo)','Materialien (optional)')+'</span>'+
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
    const {error}=await client.rpc('eg_save_daily_report_v4',{
      p_report_id:r?.id||null,p_company_id:c.companyId,p_worker_id:worker,
      p_site_id:site.id,p_task_id:task?.id||null,p_work_date:v.work_date,
      p_start_time:v.start_time,p_end_time:v.end_time,p_break_minutes:pause,
      p_work_summary:String(v.work_summary||''),
      p_materials_used:String(v.materials_used||''),p_issues:String(v.issues||''),
      p_send:!!send
    });
    if(error)throw error;
    editingId=null;
    await c.onSaved(send);
  }
  return {markup,open,reset,getId,handleChange,submit,canEdit};
};
