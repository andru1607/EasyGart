/* EasyGart Cloud: full monthly operational overview, IT/DE.
 * Independent totals for submitted/manual work reports and server-stamped attendance.
 * RLS on eg_daily_reports and eg_shifts controls row access.
 */
'use strict';
window.createEasyGartMonthly=function({client,getContext,esc,onOpenReport}){
  const ctx=()=>getContext(),two=v=>String(v).padStart(2,'0');
  const today=new Date();
  let year=today.getFullYear(),month=today.getMonth(),person='all';
  let reports=[],shifts=[],tasks=[],materials=[],ready=false,error='',partial=false,loadedCompany='';
  const tr=(it,de)=>ctx().locale==='de'?de:it;
  const monthFirst=()=>new Date(year,month,1),monthEnd=()=>new Date(year,month+1,1);
  const monthKey=()=>year+'-'+two(month+1);
  const ymd=d=>d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate());
  const duration=m=>Math.floor(Math.max(0,m)/60)+' h '+two(Math.round(Math.max(0,m)%60))+' min';
  const worker=id=>ctx().members.find(m=>m.user_id===id)?.full_name||tr('Operatore','Mitarbeiter');
  const site=id=>ctx().sites.find(s=>s.id===id)?.name||tr('Cantiere non indicato','Einsatzort nicht angegeben');
  const shiftMinutes=s=>s.status==='closed'&&s.ended_at?
    Math.max(0,Math.round((new Date(s.ended_at)-new Date(s.started_at))/60000-(s.break_seconds||0)/60)):0;
  const isVisible=id=>ctx().isOwner||id===ctx().user?.id;
  const reportForPerson=r=>isVisible(r.created_by)&&(person==='all'||r.created_by===person);
  const shiftForPerson=s=>isVisible(s.user_id)&&(person==='all'||s.user_id===person);
  const safe=x=>esc(x??'');
  async function fetchAll(query){
    const out=[];
    for(let i=0;i<30;i++){
      const {data,error:err}=await query.range(i*400,i*400+399);
      if(err)throw err;
      out.push(...(data||[]));
      if((data||[]).length<400)return out;
    }
    partial=true;
    return out;
  }
  async function refresh(companyId){
    if(!companyId){reset();return}
    ready=false;error='';partial=false;loadedCompany=companyId;
    const from=ymd(monthFirst()),to=ymd(monthEnd());
    const after=new Date(year,month,-1).toISOString();
    const before=new Date(year,month+1,2).toISOString();
    try{
      const [r,s,t,m]=await Promise.all([
        fetchAll(client.from('eg_daily_reports')
          .select('id,company_id,task_id,site_id,created_by,work_date,work_start_time,work_end_time,break_minutes,minutes_worked,work_summary,materials_used,issues,status,invoice_locked')
          .eq('company_id',companyId).gte('work_date',from).lt('work_date',to)
          .order('work_date',{ascending:true}).order('id',{ascending:true})),
        fetchAll(client.from('eg_shifts')
          .select('id,user_id,site_id,started_at,ended_at,break_seconds,status')
          .eq('company_id',companyId).gte('started_at',after).lt('started_at',before)
          .order('started_at',{ascending:true}).order('id',{ascending:true})),
        fetchAll(client.from('eg_tasks')
          .select('id,assignee_id,site_id,client_id,title,instructions,due_date,status')
          .eq('company_id',companyId).gte('due_date',from).lt('due_date',to)
          .order('due_date',{ascending:true}).order('id',{ascending:true})),
        client.rpc('eg_list_month_materials',{p_company_id:companyId,p_begin:from,p_end:to})
      ]);
      if(loadedCompany!==companyId)return;
      if(m.error)throw m.error;
      materials=m.data||[];
      reports=r;tasks=t;shifts=s.filter(x=>{
        const d=new Date(x.started_at);
        return d.getFullYear()===year&&d.getMonth()===month;
      });
      ready=true;
    }catch(e){reports=[];shifts=[];tasks=[];materials=[];error=String(e?.message||e);ready=false}
  }
  function reset(){const d=new Date();year=d.getFullYear();month=d.getMonth();person='all';
    reports=[];shifts=[];tasks=[];materials=[];ready=false;error='';partial=false;loadedCompany=''}
  const visibleReports=()=>reports.filter(reportForPerson).sort((a,b)=>
    a.work_date.localeCompare(b.work_date)||a.id.localeCompare(b.id));
  const visibleShifts=()=>shifts.filter(shiftForPerson);
  const usedForReport=id=>materials.filter(m=>m.report_id===id);
  const materialAggregate=rs=>{
    const map=new Map();
    for(const r of rs)for(const m of usedForReport(r.id)){
      const key=m.material_id+':'+m.unit;
      if(!map.has(key))map.set(key,{name:m.material_name,unit:m.unit,quantity:0});
      map.get(key).quantity+=Number(m.quantity)||0;
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,ctx().locale||'it'));
  };
  const materialsMarkup=rs=>{
    const items=materialAggregate(rs);
    return items.length?items.map(m=>'<div class="eg-month-material-total"><strong>'+safe(m.name)+'</strong>'+
      '<span>'+safe(Number(m.quantity).toLocaleString(ctx().locale==='de'?'de-DE':'it-IT'))+' '+safe(m.unit)+'</span></div>').join(''):
      '<p class="muted">'+tr('Nessun materiale registrato','Keine Materialien erfasst')+'</p>';
  };
  const materialListForReport=r=>{
    const ms=usedForReport(r.id);
    return ms.length?'<div class="eg-month-used-materials">'+ms.map(m=>'<span>'+safe(m.material_name)+
      ': <b>'+safe(m.quantity)+' '+safe(m.unit)+'</b></span>').join('')+'</div>':'';
  };
  const visibleTasks=()=>tasks.filter(t=>isVisible(t.assignee_id)&&(person==='all'||t.assignee_id===person));
  function peopleList(){
    const c=ctx(),ids=new Set([...reports.map(r=>r.created_by),...shifts.map(s=>s.user_id),...tasks.map(t=>t.assignee_id)]);
    if(c.isOwner)for(const m of c.members)ids.add(m.user_id);
    else ids.add(c.user?.id);
    return [...ids].filter(Boolean).filter(isVisible).sort((a,b)=>worker(a).localeCompare(worker(b),c.locale||'it'));
  }
  function summary(rs,ss){
    const days=new Set([...rs.map(r=>r.work_date),...ss.map(s=>ymd(new Date(s.started_at)))]);
    return {reports:rs.length,shifts:ss.length,
      declared:rs.reduce((n,r)=>n+Math.max(0,Number(r.minutes_worked)||0),0),
      stamped:ss.reduce((n,s)=>n+shiftMinutes(s),0),
      days:days.size,approved:rs.filter(r=>r.status==='approved').length};
  }
  const statusLabel=s=>({
    draft:tr('Bozza','Entwurf'),submitted:tr('Inviato','Eingereicht'),
    changes_requested:tr('Da correggere','Korrektur nötig'),approved:tr('Approvato','Freigegeben')
  })[s]||s;
  function reportRow(r){
    const task=ctx().tasks.find(t=>t.id===r.task_id);
    const times=r.work_start_time&&r.work_end_time?String(r.work_start_time).slice(0,5)+' – '+String(r.work_end_time).slice(0,5):tr('Orari non registrati','Zeiten nicht erfasst');
    return '<article class="eg-month-row"><div class="eg-month-row-main">'+
      '<div class="eg-month-date">'+safe(r.work_date.split('-').reverse().join('/'))+'</div>'+
      '<div class="eg-month-row-content"><strong>'+safe(site(r.site_id||task?.site_id))+'</strong>'+
      '<p class="muted">'+safe(times)+' · '+duration(r.minutes_worked||0)+
      (r.break_minutes?' · '+tr('Pausa','Pause')+' '+r.break_minutes+' min':'')+'</p>'+
      (task?'<p class="eg-month-note"><b>'+tr('Compito','Aufgabe')+':</b> '+safe(task.title)+'</p>':'')+
      '<p class="eg-month-note">'+safe(r.work_summary||tr('Nessuna descrizione','Keine Beschreibung'))+'</p>'+
      materialListForReport(r)+
      (r.materials_used?'<p class="eg-month-note"><b>'+tr('Note materiali','Materialnotizen')+':</b> '+safe(r.materials_used)+'</p>':'')+
      (r.issues?'<p class="eg-month-note"><b>'+tr('Note','Hinweise')+':</b> '+safe(r.issues)+'</p>':'')+
      '</div></div><div class="eg-month-row-actions"><span class="pill">'+safe(statusLabel(r.status))+'</span>'+
      '<button type="button" class="secondary small" data-action="monthly-open-report" data-id="'+safe(r.id)+'">'+
      (r.invoice_locked?tr('Visualizza','Ansehen'):tr('Apri / modifica','Öffnen / bearbeiten'))+'</button></div></article>';
  }
  function shiftRow(s){
    const date=ymd(new Date(s.started_at));
    const format=ts=>ts?new Intl.DateTimeFormat(ctx().locale==='de'?'de-DE':'it-IT',
      {hour:'2-digit',minute:'2-digit'}).format(new Date(ts)):'—';
    return '<article class="eg-month-shift"><strong>'+safe(date.split('-').reverse().join('/'))+'</strong>'+
      '<span>'+safe(site(s.site_id))+'</span><span>'+safe(format(s.started_at))+' – '+safe(format(s.ended_at))+'</span>'+
      '<span>'+duration(shiftMinutes(s))+'</span>'+
      '<small>'+safe(s.status==='closed'?tr('Conclusa','Abgeschlossen'):tr('In corso','Laufend'))+'</small></article>';
  }
  function personCard(uid,rs,ss){
    const sum=summary(rs,ss),assigned=visibleTasks().filter(t=>t.assignee_id===uid);
    const taskRows=assigned.map(t=>
      '<div class="eg-month-task"><strong>'+safe(t.due_date.split('-').reverse().join('/'))+'</strong>'+
      '<div><b>'+safe(t.title)+'</b><p class="muted">'+safe(site(t.site_id))+
      (t.instructions?' · '+safe(t.instructions):'')+'</p></div>'+
      '<span class="pill">'+tr(t.status==='done'?'Fatto':'Da fare',
        t.status==='done'?'Erledigt':'Offen')+'</span></div>').join('');
    return '<section class="card eg-month-person"><div class="eg-month-person-head">'+
      '<div><div class="eyebrow">'+tr('Rapporti di','Berichte von')+'</div><h3>'+safe(worker(uid))+'</h3>'+
      '<p class="muted">'+sum.reports+' '+tr('rapporti','Berichte')+' · '+sum.days+' '+tr('giorni con attività','Arbeitstage')+'</p></div>'+
      '<div class="eg-month-person-total"><strong>'+duration(sum.declared)+'</strong>'+
      '<small>'+tr('Ore dichiarate','Gemeldete Stunden')+'</small></div></div>'+
      '<div class="eg-month-inner"><h4>'+tr('Dettaglio lavori','Arbeitsdetails')+'</h4>'+
      (rs.length?rs.map(reportRow).join(''):'<p class="muted">'+tr('Nessun rapporto questo mese.','Keine Berichte in diesem Monat.')+'</p>')+
      '<details class="eg-month-shifts"><summary>'+tr('Timbrature del mese','Zeiterfassung des Monats')+
        ' · '+duration(sum.stamped)+'</summary>'+
      (ss.length?ss.map(shiftRow).join(''):'<p class="muted">'+tr('Nessuna timbratura.','Keine Zeitbuchungen.')+'</p>')+
      '</details><details class="eg-month-shifts"><summary>'+tr('Materiali utilizzati nel mese','Im Monat verwendete Materialien')+'</summary>'+materialsMarkup(rs)+'</details>'+
      '<details class="eg-month-shifts"><summary>'+tr('Compiti previsti nel mese','Aufgaben dieses Monats')+' · '+assigned.length+'</summary>'+ (assigned.length?taskRows:'<p class="muted">'+tr('Nessun compito previsto.','Keine Aufgaben geplant.')+'</p>')+'</details></div></section>';
  }
  function markup(){
    const c=ctx(),locale=c.locale==='de'?'de-DE':'it-IT',
      title=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(monthFirst());
    if(!ready)return '<div class="view-head"><h2>'+tr('Resoconto mensile','Monatsübersicht')+'</h2></div>'+
      '<div class="card eg-month-empty">'+safe(error||tr('Caricamento dati mensili…','Monatsdaten werden geladen…'))+'</div>';
    const rs=visibleReports(),ss=visibleShifts(),all=summary(rs,ss),people=peopleList();
    const filter=c.isOwner?'<label class="field eg-month-worker-select"><span>'+tr('Dipendente','Mitarbeiter')+'</span>'+
      '<select id="eg-month-worker">'+
      '<option value="all">'+tr('Tutti i dipendenti','Alle Mitarbeitenden')+'</option>'+
      people.map(id=>'<option value="'+safe(id)+'"'+(person===id?' selected':'')+'>'+safe(worker(id))+'</option>').join('')+
      '</select></label>':'';
    return '<div class="eg-monthly-page">'+
      '<div class="view-head"><div><div class="eyebrow">'+tr('Archivio e statistiche','Archiv und Statistik')+'</div>'+
      '<h2>'+tr('Resoconto mensile','Monatsübersicht')+'</h2>'+
      '<p class="muted">'+tr('Attività, cantieri e ore, divisi per dipendente e giornata.',
        'Arbeiten, Einsatzorte und Stunden nach Mitarbeitenden und Tagen.')+'</p></div>'+
      '<button class="secondary" data-action="monthly-export">'+tr('Esporta CSV','CSV exportieren')+'</button></div>'+
      '<section class="card eg-month-controls"><div class="eg-month-switch">'+
      '<button type="button" class="ghost" data-action="monthly-month" data-step="-1" aria-label="'+tr('Mese precedente','Vorheriger Monat')+'">‹</button>'+
      '<h3>'+safe(title)+'</h3>'+
      '<button type="button" class="ghost" data-action="monthly-month" data-step="1" aria-label="'+tr('Mese successivo','Nächster Monat')+'">›</button>'+
      '</div>'+filter+'</section>'+
      '<div class="eg-month-metrics">'+
      '<div class="card metric"><span>'+tr('Ore dichiarate','Gemeldete Stunden')+'</span><strong>'+duration(all.declared)+'</strong></div>'+
      '<div class="card metric"><span>'+tr('Ore timbrate','Erfasste Stunden')+'</span><strong>'+duration(all.stamped)+'</strong></div>'+
      '<div class="card metric"><span>'+tr('Rapporti','Berichte')+'</span><strong>'+all.reports+'</strong></div>'+
      '<div class="card metric"><span>'+tr('Giornate con attività','Tage mit Einträgen')+'</span><strong>'+all.days+'</strong></div></div>'+
      '<p class="muted eg-month-help">'+tr('Ore dichiarate e timbrate sono due registrazioni diverse e non vengono sommate. I rapporti includono anche le bozze.',
        'Gemeldete Stunden und Stempelzeiten werden separat angezeigt und nicht addiert. Entwürfe sind enthalten.')+'</p>'+
      (c.isOwner&&person==='all'?'<h3 class="eg-month-subtitle">'+tr('Rapporti distinti per dipendente','Berichte nach Mitarbeitenden')+'</h3>':'')+
      (person==='all'?people.map(uid=>personCard(uid,rs.filter(r=>r.created_by===uid),
        ss.filter(s=>s.user_id===uid))).join(''):personCard(person,rs,ss))+
      (!people.length?'<div class="card"><p class="muted">'+tr('Nessuna attività registrata nel mese.','Keine Aktivität im gewählten Monat.')+'</p></div>':'')+
      (partial?'<div class="alert warn">'+tr('Raggiunto il limite di caricamento: il mese potrebbe essere incompleto.',
        'Ladelimit erreicht: Monat möglicherweise unvollständig.')+'</div>':'')+'</div>';
  }
  async function monthStep(step){
    if(![-1,1].includes(step))return;
    const next=new Date(year,month+step,1);
    year=next.getFullYear();month=next.getMonth();await refresh(ctx().companyId);
  }
  function setMonth(nextYear,nextMonth){
    if(Number.isInteger(nextYear)&&nextYear>=2020&&nextYear<=2100&&Number.isInteger(nextMonth)&&nextMonth>=0&&nextMonth<=11){year=nextYear;month=nextMonth}
  }
  function chooseWorker(value){
    const people=peopleList();
    person=ctx().isOwner&&(value==='all'||people.includes(value))?value:'all';
  }
  function csv(){
    const c=ctx(),data=[['Tipo','Dipendente','Data','Cantiere','Inizio','Fine','Pausa_min','Minuti_lavorati','Stato','Attivita','Materiali','Note']];
    for(const r of visibleReports())data.push(['Rapporto',worker(r.created_by),r.work_date,site(r.site_id),
      String(r.work_start_time||'').slice(0,5),String(r.work_end_time||'').slice(0,5),r.break_minutes||0,
      r.minutes_worked||0,statusLabel(r.status),r.work_summary||'',r.materials_used||'',r.issues||'']);
    for(const t of visibleTasks())data.push(['Compito',worker(t.assignee_id),t.due_date,site(t.site_id),      '','','','',t.status,t.title,'',t.instructions||'']);
    for(const s of visibleShifts())data.push(['Timbratura',worker(s.user_id),ymd(new Date(s.started_at)),site(s.site_id),
      s.started_at||'',s.ended_at||'',Math.round((s.break_seconds||0)/60),shiftMinutes(s),s.status,'','','']);
    const cell=v=>{
      const raw=String(v??'');
      // Spreadsheet exports must not evaluate user-entered text as formulas.
      const safeValue=/^[\s]*[=+@\-]/.test(raw)?"'"+raw:raw;
      return '"'+safeValue.replaceAll('"','""')+'"';
    };
    return '\uFEFF'+data.map(row=>row.map(cell).join(';')).join('\r\n');
  }
  function exportCSV(){
    const blob=new Blob([csv()],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='easygart-resoconto-'+monthKey()+(person==='all'?'':'-dipendente')+'.csv';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  return {refresh,markup,reset,setMonth,monthStep,chooseWorker,exportCSV,getPerson:()=>person,getReport:id=>reports.find(r=>r.id===id)||null};
};
