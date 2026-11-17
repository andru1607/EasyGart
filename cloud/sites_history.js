/* EasyGart: all-time worked sites, access controlled by Supabase RLS and safe RPC. */
'use strict';
window.createEasyGartSiteHistory=function({client,getContext,esc}){
 const c=()=>getContext(),tr=(it,de)=>c().locale==='de'?de:it;
 const safe=v=>esc(v??'');
 const pad=n=>String(n).padStart(2,'0');
 const fmt=n=>Math.floor(Math.max(0,n)/60)+' h '+pad(Math.round(Math.max(0,n)%60))+' min';
 const day=x=>String(x||'').slice(0,10).split('-').reverse().join('/');
 const display=id=>c().sites.find(s=>s.id===id)?.name||tr('Cantiere non trovato','Einsatzort nicht gefunden');
 const worker=id=>c().members.find(x=>x.user_id===id)?.full_name||tr('Operatore','Mitarbeiter');
 const mFor=id=>materials.filter(m=>m.report_id===id);
 const sd=r=>r.site_id||c().tasks.find(t=>t.id===r.task_id)?.site_id||null;
 const minutes=s=>s.status==='closed'&&s.ended_at?
  Math.max(0,Math.round((new Date(s.ended_at)-new Date(s.started_at))/60000-(s.break_seconds||0)/60)):0;
 const clock=v=>v?new Intl.DateTimeFormat(c().locale==='de'?'de-DE':'it-IT',
  {hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';
 let reports=[],shifts=[],materials=[],selectedSite=null,person='all';
 let ready=false,error='',partial=false,company='';
 const authorized=id=>c().isOwner||id===c().user?.id;
 const filteredReports=()=>reports.filter(x=>authorized(x.created_by)&&(person==='all'||x.created_by===person));
 const filteredShifts=()=>shifts.filter(x=>authorized(x.user_id)&&(person==='all'||x.user_id===person));
 const rsFor=id=>filteredReports().filter(r=>sd(r)===id);
 const ssFor=id=>filteredShifts().filter(s=>s.site_id===id);
 async function pages(query){
  let result=[];
  for(let n=0;n<30;n++){
   const {data,error:e}=await query.range(n*400,n*400+399);
   if(e)throw e;
   result.push(...(data||[]));
   if((data||[]).length<400)return result;
  }
  partial=true;return result;
 }
 async function refresh(companyId){
  if(!companyId){reset();return}
  company=companyId;ready=false;error='';partial=false;
  try{
   const [r,s,m]=await Promise.all([
    pages(client.from('eg_daily_reports')
      .select('id,task_id,site_id,created_by,work_date,work_start_time,work_end_time,break_minutes,minutes_worked,work_summary,materials_used,issues,status,invoice_locked')
      .eq('company_id',companyId).order('work_date',{ascending:false}).order('id',{ascending:false})),
    pages(client.from('eg_shifts')
      .select('id,user_id,site_id,started_at,ended_at,break_seconds,status')
      .eq('company_id',companyId).order('started_at',{ascending:false}).order('id',{ascending:false})),
    client.rpc('eg_list_month_materials',{p_company_id:companyId,p_begin:'2020-01-01',p_end:'2099-12-31'})
   ]);
   if(m.error)throw m.error;
   if(company!==companyId)return;
   reports=r;shifts=s;materials=m.data||[];ready=true;
  }catch(e){reports=[];shifts=[];materials=[];ready=false;error=String(e?.message||e)}
 }
 function reset(){reports=[];shifts=[];materials=[];selectedSite=null;person='all';ready=false;error='';company='';partial=false}
 function choosePerson(id){
  person=c().isOwner&&(id==='all'||c().members.some(m=>m.user_id===id))?id:'all';
  selectedSite=null;
 }
 function open(id){selectedSite=c().sites.some(x=>x.id===id)?id:null}
 function back(){selectedSite=null}
 function materialTotals(rs){
  const map=new Map();
  for(const r of rs)for(const x of mFor(r.id)){
   const key=x.material_id+'::'+x.unit;
   if(!map.has(key))map.set(key,{name:x.material_name,unit:x.unit,quantity:0});
   map.get(key).quantity+=Number(x.quantity)||0;
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,c().locale||'it'));
 }
 function workedSites(){
  const ids=new Set([...filteredReports().map(sd),...filteredShifts().map(s=>s.site_id)].filter(Boolean));
  return [...ids].map(id=>{
   const rs=rsFor(id),ss=ssFor(id);
   return {id,rs,ss,declared:rs.reduce((a,r)=>a+Number(r.minutes_worked||0),0),
     stamped:ss.reduce((a,s)=>a+minutes(s),0),days:new Set([
       ...rs.map(r=>r.work_date),...ss.map(s=>String(s.started_at).slice(0,10))]).size};
  }).sort((a,b)=>display(a.id).localeCompare(display(b.id),c().locale||'it'));
 }
 function siteCards(){
  const list=workedSites();
  return '<div class="view-head"><div><h2>'+tr('Cantieri svolti','Bearbeitete Einsatzorte')+'</h2>'+
   '<p class="muted">'+tr('Apri un cantiere per vedere tutte le giornate, ore, interventi e materiali.',
    'Öffne einen Einsatzort, um Tage, Stunden, Arbeiten und Materialien zu sehen.')+'</p></div></div>'+
   (c().isOwner?'<div class="card eg-site-filter"><label class="field"><span>'+tr('Dipendente','Mitarbeiter')+'</span>'+
     '<select id="eg-site-worker"><option value="all">'+tr('Tutta la squadra','Gesamtes Team')+'</option>'+
     c().members.map(m=>'<option value="'+safe(m.user_id)+'"'+(person===m.user_id?' selected':'')+'>'+safe(m.full_name)+'</option>').join('')+
     '</select></label></div>':'')+
   '<div class="eg-worked-sites">'+list.map(x=>'<button type="button" class="eg-worked-site card" data-action="site-history-open" data-id="'+safe(x.id)+'">'+
     '<span class="eg-worked-site-icon" aria-hidden="true">✿</span><span class="eg-worked-site-name"><strong>'+safe(display(x.id))+'</strong>'+
     '<small>'+x.days+' '+tr('giornate','Tage')+' · '+x.rs.length+' '+tr('rapporti','Berichte')+'</small></span>'+
     '<span class="eg-worked-site-hours"><b>'+fmt(x.declared)+'</b><small>'+tr('dichiarate','gemeldet')+'</small></span>'+
     '<span class="eg-worked-site-arrow" aria-hidden="true">›</span></button>').join('')+'</div>'+
   (!list.length?'<div class="card"><p class="muted">'+tr('Nessun cantiere lavorato registrato.','Noch keine bearbeiteten Einsatzorte.')+'</p></div>':'');
 }
 function detail(){
  const rs=rsFor(selectedSite),ss=ssFor(selectedSite);
  const site=c().sites.find(s=>s.id===selectedSite);
  const mat=materialTotals(rs);
  const reportsMarkup=rs.slice().sort((a,b)=>b.work_date.localeCompare(a.work_date)).map(r=>{
    const selected=mFor(r.id);
    return '<article class="eg-site-visit"><div class="eg-site-visit-top"><div><b>'+safe(day(r.work_date))+'</b>'+
     '<p class="muted">'+safe(worker(r.created_by))+' · '+
     (r.work_start_time&&r.work_end_time?safe(String(r.work_start_time).slice(0,5)+' – '+String(r.work_end_time).slice(0,5))+' · ':'')+
     fmt(Number(r.minutes_worked||0))+
     (r.break_minutes?' · '+tr('Pausa','Pause')+' '+r.break_minutes+' min':'')+'</p></div>'+
     '<button type="button" class="secondary small" data-action="site-history-open-report" data-id="'+safe(r.id)+'">'+
     tr('Apri rapporto','Bericht öffnen')+'</button></div>'+
     '<p class="eg-site-work">'+safe(r.work_summary||tr('Nessuna descrizione','Keine Beschreibung'))+'</p>'+
     (selected.length?'<div class="eg-site-material-lines">'+selected.map(m=>'<span>'+safe(m.material_name)+
       ' <b>'+safe(m.quantity)+' '+safe(m.unit)+'</b></span>').join('')+'</div>':'')+
     (r.materials_used?'<p class="muted eg-site-work">'+safe(r.materials_used)+'</p>':'')+
     (r.issues?'<p class="muted eg-site-work">'+safe(r.issues)+'</p>':'')+'</article>';
  }).join('');
  const shiftsMarkup=ss.map(s=>'<article class="eg-site-shift"><strong>'+
    safe(day(new Date(s.started_at).toISOString().slice(0,10)))+'</strong><span>'+safe(worker(s.user_id))+'</span>'+
    '<span>'+safe(clock(s.started_at))+' – '+safe(clock(s.ended_at))+'</span>'+
    '<b>'+fmt(minutes(s))+'</b></article>').join('');
  return '<div class="eg-site-detail"><div class="view-head"><div><div class="eyebrow">'+tr('Cantiere','Einsatzort')+'</div>'+
    '<h2>'+safe(display(selectedSite))+'</h2>'+
    (site?.address?'<p class="muted">'+safe(site.address)+'</p>':'')+'</div>'+
    '<button class="ghost" data-action="site-history-back">'+tr('Tutti i cantieri','Alle Einsatzorte')+'</button></div>'+
    '<div class="eg-site-kpis">'+
    '<div class="card metric"><span>'+tr('Ore dichiarate','Gemeldete Stunden')+'</span><strong>'+fmt(rs.reduce((a,r)=>a+Number(r.minutes_worked||0),0))+'</strong></div>'+
    '<div class="card metric"><span>'+tr('Ore timbrate','Erfasste Stunden')+'</span><strong>'+fmt(ss.reduce((a,s)=>a+minutes(s),0))+'</strong></div>'+
    '<div class="card metric"><span>'+tr('Rapporti','Berichte')+'</span><strong>'+rs.length+'</strong></div></div>'+
    '<section class="card eg-site-panel"><h3>'+tr('Materiali utilizzati complessivamente','Insgesamt verwendete Materialien')+'</h3>'+
    (mat.length?mat.map(m=>'<div class="eg-site-material-total"><strong>'+safe(m.name)+'</strong><span>'+
      safe(Number(m.quantity).toLocaleString(c().locale==='de'?'de-DE':'it-IT'))+' '+safe(m.unit)+'</span></div>').join(''):
      '<p class="muted">'+tr('Nessun materiale registrato','Keine Materialien erfasst')+'</p>')+'</section>'+
    '<section class="card eg-site-panel"><h3>'+tr('Interventi eseguiti','Durchgeführte Arbeiten')+'</h3>'+
    (reportsMarkup||'<p class="muted">'+tr('Nessun rapporto','Keine Berichte')+'</p>')+'</section>'+
    '<section class="card eg-site-panel"><h3>'+tr('Timbrature del cantiere','Zeiterfassung des Einsatzorts')+'</h3>'+
    (shiftsMarkup||'<p class="muted">'+tr('Nessuna timbratura','Keine Zeitbuchungen')+'</p>')+'</section></div>';
 }
 function markup(){
   if(!ready)return '<div class="view-head"><h2>'+tr('Cantieri svolti','Bearbeitete Einsatzorte')+'</h2></div>'+
   '<div class="card"><p class="muted">'+safe(error||tr('Caricamento cantieri…','Einsatzorte werden geladen…'))+'</p></div>';
   return (selectedSite?detail():siteCards())+
      (partial?'<div class="alert warn">'+tr('Archivio molto grande: dati non completi.','Sehr großes Archiv: Daten unvollständig.')+'</div>':'');
 }
 return {refresh,reset,markup,open,back,choosePerson,getReport:id=>reports.find(r=>r.id===id)||null};
};
