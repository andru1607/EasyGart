/* EasyGart Cloud: calendario IT/DE. Le autorizzazioni sono gestite da Supabase RLS. */
'use strict';
window.createEasyGartCalendar=function({client,getContext,esc,rerender}){
 const ctx=()=>getContext(),p=n=>String(n).padStart(2,'0');
 const key=d=>d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
 const now=new Date();let year=now.getFullYear(),month=now.getMonth(),chosen=key(now);
 let worker='all',reports=[],shifts=[],ready=false,error='',overflow=false,loadingKey='';
 const tr=(it,de)=>ctx().locale==='de'?de:it;
 const hm=n=>Math.floor(Math.max(0,n)/60)+' h '+p(Math.floor(Math.max(0,n)%60))+' min';
 const who=id=>ctx().members.find(m=>m.user_id===id)?.full_name||tr('Dipendente','Mitarbeiter');
 const where=id=>ctx().sites.find(x=>x.id===id)?.name||tr('Non indicato','Nicht angegeben');
 const minutes=s=>s.status==='closed'&&s.ended_at?Math.max(0,Math.round((new Date(s.ended_at)-new Date(s.started_at))/60000-(s.break_seconds||0)/60)):0;
 const clock=x=>x?new Intl.DateTimeFormat(ctx().locale==='de'?'de-DE':'it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date(x)):'—';
 async function pages(q){
  const all=[];
  for(let n=0;n<20;n++){
   const {data,error:e}=await q.range(n*500,n*500+499);
   if(e)throw e;
   const batch=data||[];all.push(...batch);
   if(batch.length<500)return all;
  }
  overflow=true;return all;
 }
 async function refresh(id){
  if(!id){reset();return}
  const load=id+':'+year+':'+month;loadingKey=load;ready=false;error='';overflow=false;
  const begin=key(new Date(year,month,1)),end=key(new Date(year,month+1,1));
  try{
   const [r,s]=await Promise.all([
    pages(client.from('eg_daily_reports').select('id,task_id,site_id,created_by,work_date,minutes_worked,work_summary,materials_used,issues,status')
     .eq('company_id',id).gte('work_date',begin).lt('work_date',end).order('work_date')),
    pages(client.from('eg_shifts').select('id,user_id,site_id,started_at,ended_at,break_seconds,status')
     .eq('company_id',id).gte('started_at',new Date(year,month,-1).toISOString())
     .lt('started_at',new Date(year,month+1,2).toISOString()).order('started_at'))
   ]);
   if(loadingKey!==load)return;
   reports=r;shifts=s;ready=true;
  }catch(e){if(loadingKey===load){reports=[];shifts=[];error=String(e?.message||e)}}
 }
 function reset(){const d=new Date();year=d.getFullYear();month=d.getMonth();chosen=key(d);worker='all';reports=[];shifts=[];ready=false;error='';loadingKey=''}
 function aggregate(){
  const c=ctx(),days=new Map(),get=d=>{
   if(!days.has(d))days.set(d,{reports:[],shifts:[],r:0,s:0});
   return days.get(d);
  };
  for(const r of reports){
   if((!c.isOwner&&r.created_by!==c.user?.id)||(worker!=='all'&&r.created_by!==worker))continue;
   const row=get(r.work_date);row.reports.push(r);row.r+=Math.max(0,Number(r.minutes_worked)||0);
  }
  for(const s of shifts){
   if((!c.isOwner&&s.user_id!==c.user?.id)||(worker!=='all'&&s.user_id!==worker))continue;
   const d=new Date(s.started_at);
   if(d.getFullYear()!==year||d.getMonth()!==month)continue;
   const row=get(key(d));row.shifts.push(s);row.s+=minutes(s);
  }
  return days;
 }
 const dayHours=v=>!v?0:v.shifts.some(s=>s.status==='closed')?v.s:v.r;
 const kind=v=>v?.shifts.some(s=>s.status==='closed')?tr('timbrate','erfasst'):tr('dichiarate','gemeldet');
 function markup(){
  const c=ctx();
  if(!ready)return '<div class="view-head"><h2>'+tr('Calendario','Kalender')+'</h2></div><div class="alert warn">'+
   esc(error||tr('Premi Ricarica per consultare il calendario.','Bitte Kalender neu laden.'))+'</div>';
  const data=aggregate(),first=new Date(year,month,1),nDays=new Date(year,month+1,0).getDate();
  const start=(first.getDay()+6)%7;
  const monthTitle=new Intl.DateTimeFormat(c.locale==='de'?'de-DE':'it-IT',{month:'long',year:'numeric'}).format(first);
  const week=c.locale==='de'?['Mo','Di','Mi','Do','Fr','Sa','So']:['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  let grid=week.map(d=>'<div class="eg-calendar-week">'+d+'</div>').join('')+'<div class="eg-calendar-days">';
  for(let i=0;i<start;i++)grid+='<div aria-hidden="true"></div>';
  for(let i=1;i<=nDays;i++){
   const d=key(new Date(year,month,i)),v=data.get(d);
   grid+='<button type="button" data-action="cal-day" data-day="'+d+'" aria-pressed="'+(chosen===d)+'" class="eg-calendar-day'+(chosen===d?' selected':'')+(v?' filled':'')+'">'+
    '<strong>'+i+'</strong>'+(v?'<span>'+hm(dayHours(v))+'</span><small>'+kind(v)+'</small>':'<small>·</small>')+'</button>';
  }
  grid+='</div>';
  const selected=data.get(chosen),details=[];
  for(const s of selected?.shifts||[]){
   details.push('<article class="eg-calendar-record"><strong>'+tr('Timbratura','Zeiterfassung')+' · '+esc(who(s.user_id))+'</strong><p class="muted">'+
    esc(clock(s.started_at))+' – '+esc(clock(s.ended_at))+' · '+hm(minutes(s))+' · '+esc(where(s.site_id))+
    ' · '+tr('Pausa','Pause')+': '+hm(Math.round((s.break_seconds||0)/60))+'</p></article>');
  }
  for(const r of selected?.reports||[]){
   const task=c.tasks.find(x=>x.id===r.task_id);
   const stat={draft:tr('Bozza','Entwurf'),submitted:tr('Inviato','Eingereicht'),approved:tr('Approvato','Freigegeben'),changes_requested:tr('Da correggere','Korrektur nötig')}[r.status]||r.status;
   details.push('<article class="eg-calendar-record"><strong>'+esc(task?.title||tr('Attività','Auftrag'))+' · '+esc(who(r.created_by))+'</strong>'+
    '<p class="muted">'+esc(where(r.site_id||task?.site_id))+' · '+hm(Number(r.minutes_worked)||0)+' · '+esc(stat)+'</p>'+
    '<p class="eg-calendar-note">'+esc(r.work_summary||tr('Nessuna descrizione','Keine Beschreibung'))+'</p>'+
    (r.materials_used?'<p class="eg-calendar-note"><b>'+tr('Materiali','Materialien')+':</b> '+esc(r.materials_used)+'</p>':'')+
    (r.issues?'<p class="eg-calendar-note"><b>'+tr('Osservazioni','Bemerkungen')+':</b> '+esc(r.issues)+'</p>':'')+'</article>');
  }
  const selectedTitle=new Intl.DateTimeFormat(c.locale==='de'?'de-DE':'it-IT',{dateStyle:'full'}).format(new Date(chosen+'T12:00:00'));
  const staffFilter=c.isOwner?'<label class="field">'+tr('Dipendente','Mitarbeiter')+'<select id="eg-calendar-worker">'+
   '<option value="all">'+tr('Tutta la squadra','Gesamtes Team')+'</option>'+
   c.members.map(m=>'<option value="'+esc(m.user_id)+'"'+(worker===m.user_id?' selected':'')+'>'+esc(m.full_name||'—')+'</option>').join('')+
   '</select></label>':'';
  return '<div class="view-head"><div><h2>'+tr('Calendario lavori e ore','Arbeits- und Stundenkalender')+'</h2><p class="muted">'+
    tr('Ogni giorno mostra ore, cantiere e rapporto dei lavori.','Jeder Tag zeigt Stunden, Einsatzort und Arbeitsbericht.')+'</p></div></div>'+
   '<section class="card eg-calendar-controls"><div class="eg-calendar-toolbar"><div class="actions">'+
    '<button type="button" class="ghost small" data-action="cal-month" data-step="-1">‹</button>'+
    '<h3>'+esc(monthTitle)+'</h3><button type="button" class="ghost small" data-action="cal-month" data-step="1">›</button>'+
    '</div>'+staffFilter+'</div></section>'+
   '<div class="grid eg-calendar-totals">'+
    '<div class="card metric"><span>'+tr('Ore timbrate','Erfasste Stunden')+'</span><strong>'+hm([...data.values()].reduce((v,x)=>v+x.s,0))+'</strong></div>'+
    '<div class="card metric"><span>'+tr('Ore dichiarate nei rapporti','Gemeldete Stunden')+'</span><strong>'+hm([...data.values()].reduce((v,x)=>v+x.r,0))+'</strong></div>'+
    '<div class="card metric"><span>'+tr('Giornate con attività','Tage mit Einträgen')+'</span><strong>'+data.size+'</strong></div></div>'+
   '<section class="card eg-calendar-card"><div class="eg-calendar-grid">'+grid+'</div></section>'+
   '<section class="card eg-calendar-detail"><div class="cardhead"><div><h2>'+esc(selectedTitle)+'</h2><p class="muted">'+hm(dayHours(selected))+
    (selected?' · '+kind(selected):'')+'</p></div><button type="button" class="secondary small" data-action="cal-reports">'+tr('Apri rapporti','Berichte öffnen')+'</button></div>'+
    (details.length?details.join(''):'<p class="muted">'+tr('Nessuna attività registrata.','Keine Einträge vorhanden.')+'</p>')+'</section>'+
   '<p class="muted eg-calendar-foot">'+tr('Ore timbrate e ore dichiarate restano separate per evitare doppi conteggi.','Erfasste und gemeldete Stunden bleiben getrennt, damit sie nicht doppelt gezählt werden.')+'</p>'+
   (overflow?'<div class="alert warn">'+tr('Troppi dati: mese non completo.','Zu viele Einträge: Monatsübersicht unvollständig.')+'</div>':'');
 }
 async function handleAction(button){
  if(button.dataset.action==='cal-day'){
   if(/^\d{4}-\d{2}-\d{2}$/.test(button.dataset.day||'')){chosen=button.dataset.day;rerender()}
  }else if(button.dataset.action==='cal-month'){
   const step=Number(button.dataset.step);if(![-1,1].includes(step))return;
   const next=new Date(year,month+step,1);
   year=next.getFullYear();month=next.getMonth();chosen=key(next);
   await refresh(ctx().companyId);rerender();
  }
 }
 function handleChange(select){
  if(select.id!=='eg-calendar-worker')return false;
  const c=ctx();
  worker=c.isOwner&&(select.value==='all'||c.members.some(m=>m.user_id===select.value))?select.value:'all';
  rerender();return true;
 }
 return {refresh,markup,reset,handleAction,handleChange};
};