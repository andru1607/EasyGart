// EasyGart Cloud MVP • Supabase Auth e RLS • non usare con dati reali prima dei test RLS.
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const cfg = window.EASYGART_SUPABASE_CONFIG || {};
const app = $('app'), topRight = $('top-right');
let client = null;
let authMode = 'signin';
let notice = '';
let errorNotice = false;
let busy = false;
let selectedCompanyId = '';
let currentView = 'tasks';
let selectedWorkerId = 'all';
let editingTaskId = null;
let user = null;
let memberships = [], companies = [], members = [], clients = [], sites = [], tasks = [], invites = [];
let dailyReports = [], reportsReady = false, reportsSetupError = '', reportEditingId = null;
let selectedReportWorkerId = 'all', reportStatusFilter = 'all';
const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || '') && /^sb_publishable_/.test(cfg.publishableKey || '');
const localeKey = 'easygarte_cloud_language';
let locale = localStorage.getItem(localeKey) === 'de' ? 'de' : 'it';
const german = {
  'Rapporti giornalieri':'Tagesberichte','Nuovo rapporto':'Neuer Tagesbericht',
  'Rapporti ricevuti':'Eingegangene Berichte','I miei rapporti':'Meine Berichte',
  'Rapporto giornaliero':'Tagesbericht','Rapporto da verificare':'Bericht zur Prüfung',
  'Salva bozza':'Entwurf speichern','Invia al titolare':'An Vorgesetzten senden',
  'Da verificare':'Zur Prüfung','Approvati':'Freigegeben','Correzioni richieste':'Korrekturen erforderlich',
  'Bozza':'Entwurf','Inviato':'Eingereicht','Approvato':'Freigegeben',
  'Ore effettive (minuti)':'Tatsächliche Arbeitszeit (Minuten)',
  'Lavoro svolto':'Durchgeführte Arbeiten','Materiali utilizzati':'Verwendetes Material',
  'Problemi e imprevisti':'Probleme und Vorkommnisse',
  'Feedback del titolare':'Rückmeldung der Leitung','Approva':'Freigeben',
  'Richiedi correzioni':'Korrekturen anfordern','Torna ai rapporti':'Zurück zu den Berichten',
  'Tutti gli stati':'Alle Status','Tutti gli operatori':'Alle Mitarbeiter',
  'Nessun rapporto':'Keine Berichte',
  'Accesso dipendenti':'Mitarbeiter-Login','Accedi':'Anmelden','Registrati':'Registrieren',
  'Password':'Passwort','Conferma email':'E-Mail bestätigen','Email':'E-Mail',
  'Crea un account':'Konto erstellen','Esci':'Abmelden','Aggiorna':'Aktualisieren',
  'Configurazione richiesta':'Konfiguration erforderlich',
  'L’interfaccia cloud è pronta, ma serve attivare Supabase prima di usarla.':'Die Cloud-Oberfläche ist vorbereitet. Supabase muss noch aktiviert werden.',
  'Crea azienda':'Betrieb erstellen','Nome azienda':'Firmenname',
  'Accetta inviti':'Einladungen annehmen','Nessuna azienda collegata':'Kein verbundener Betrieb',
  'La tua squadra':'Dein Team','Compiti':'Aufgaben','Clienti e cantieri':'Kunden und Einsatzorte',
  'Invita dipendente':'Mitarbeiter einladen','Assegna compito':'Aufgabe zuweisen',
  'Da fare':'Offen','In corso':'In Arbeit','Completate':'Erledigt',
  'Assegnato':'Zugewiesen','Completato':'Erledigt','In ritardo':'Überfällig',
  'Inizia':'Starten','Completa':'Abschließen','Riapri':'Erneut öffnen',
  'Modifica':'Bearbeiten','Annulla':'Abbrechen','Salva modifiche':'Änderungen speichern',
  'Titolo attività':'Aufgabentitel','Istruzioni':'Anweisungen','Dipendente':'Mitarbeiter',
  'Cliente':'Kunde','Cantiere':'Einsatzort','Data':'Datum','Ora':'Uhrzeit',
  'Durata stimata (minuti)':'Geschätzte Dauer (Minuten)','Priorità':'Priorität',
  'Bassa':'Niedrig','Media':'Mittel','Alta':'Hoch','Salva compito':'Aufgabe speichern',
  'Nuovo cliente':'Neuer Kunde','Nuovo cantiere':'Neuer Einsatzort','Indirizzo':'Adresse',
  'Invia invito':'Einladung erstellen','Inviti in attesa':'Ausstehende Einladungen',
  'Nessuna attività':'Keine Aufgaben','Nessun dipendente':'Keine Mitarbeiter',
  'La demo rimane disponibile':'Die Demoversion bleibt verfügbar',
  'Solo i dati autorizzati dal server vengono mostrati.':'Nur serverseitig freigegebene Daten werden angezeigt.',
  'Tutti i dipendenti':'Alle Mitarbeiter','Squadra e inviti':'Team und Einladungen',
  'Attività assegnate':'Zugewiesene Aufgaben','I miei compiti':'Meine Aufgaben',
  'Tutti':'Alle','Aperte':'Offen','Scadute':'Überfällig','Ricarica':'Neu laden'
};
const tr = s => locale === 'de' ? german[s] || s : s;
const t = s => esc(tr(s));
const field = (label,name,type='text',value='',options='') => '<label class="field"><span>'+t(label)+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+options+'></label>';
const select = (label,name,opts,extra='') => '<label class="field"><span>'+t(label)+'</span><select name="'+name+'" '+extra+'>'+opts+'</select></label>';
const option = (value,label,chosen=false) => '<option value="'+esc(value)+'"'+(chosen?' selected':'')+'>'+esc(label)+'</option>';
const dateToday = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const statusLabel = task => task.status === 'done' ? 'Completato' : task.due_date < dateToday() ? 'In ritardo' : task.status === 'in_progress' ? 'In corso' : 'Assegnato';
const pillTone = task => task.status === 'done' ? '' : task.due_date < dateToday() ? 'red' : task.status === 'in_progress' ? 'amber' : '';
const memberIsOwner = () => memberships.some(m => m.company_id === selectedCompanyId && m.role === 'owner' && m.active);
const company = () => companies.find(c => c.id === selectedCompanyId);
const getName = (items,id) => items.find(x=>x.id===id)?.name || '—';
const getWorkerName = id => members.find(x=>x.user_id===id)?.full_name || '—';
const fail = e => {notice = e?.message || String(e || 'Errore sconosciuto');errorNotice = true;render()};
const success = m => {notice=m;errorNotice=false;render()};
const withBusy = async cb => {
  if (busy) return;
  busy = true; disableButtons(true);
  try {await cb()} catch(e) {fail(e)} finally {busy=false;disableButtons(false)}
};
const disableButtons = disabled => document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=disabled);
const requireSuccess = r => {if(r.error)throw r.error;return r.data};
function render() {
  topRight.innerHTML = '<select id="locale" aria-label="Lingua" style="width:auto;background:#245343;border-color:#5b806a;color:#fff;padding:8px 10px">'+
    option('it','IT',locale==='it')+option('de','DE',locale==='de')+'</select>'+
    (user ? '<span style="font-size:12px;opacity:.8">'+esc(user.email)+'</span><button class="ghost small" data-action="signout">'+t('Esci')+'</button>' : '');
  const alert = notice ? '<div id="notice" role="status" class="alert'+(errorNotice?' error':'')+'">'+esc(notice)+'</div>' : '';
  if (!ready) {
    app.innerHTML = alert + '<div class="auth-wrap"><div class="eyebrow">EasyGart • cloud</div><h1>'+t('Configurazione richiesta')+'</h1>'+
      '<div class="card stacked"><p>'+t('L’interfaccia cloud è pronta, ma serve attivare Supabase prima di usarla.')+'</p>'+
      '<div class="alert warn">Il progetto Supabase di EasyGart deve avere la migrazione SQL e una chiave <code>sb_publishable_…</code> impostata in <code>cloud/config.js</code>. Non inserire mai chiavi segrete.</div>'+
      '<p><a href="../">'+t('La demo rimane disponibile')+'</a>.</p></div></div>';
    return;
  }
  if (!user) {app.innerHTML = alert + authMarkup();return}
  if (!memberships.length) {app.innerHTML = alert + onboardMarkup();return}
  const org = company();
  app.innerHTML = alert +
    '<div class="view-head"><div><div class="eyebrow">EasyGart Cloud</div><h1>'+esc(org?.name||'EasyGart')+'</h1>'+
    '<p>'+t('Solo i dati autorizzati dal server vengono mostrati.')+'</p></div>'+
    '<div class="toolbar">'+(companies.length>1?'<select id="company-select" aria-label="Azienda" style="max-width:190px">'+companies.map(c=>option(c.id,c.name,c.id===selectedCompanyId)).join('')+'</select>':'')+
    '<button class="ghost" data-action="refresh">'+t('Ricarica')+'</button></div></div>'+
    '<nav class="nav" aria-label="Sezioni">'+
      '<button data-action="view" data-view="tasks" class="'+(currentView==='tasks'?'active':'')+'">'+t('Compiti')+'</button>'+ 
      '<button data-action="view" data-view="reports" class="'+(currentView==='reports'?'active':'')+'">'+t('Rapporti giornalieri')+(memberIsOwner() && dailyReports.some(r=>r.status==='submitted')?' · '+dailyReports.filter(r=>r.status==='submitted').length:'')+'</button>'+ 
      (memberIsOwner()?'<button data-action="view" data-view="clients" class="'+(currentView==='clients'?'active':'')+'">'+t('Clienti e cantieri')+'</button>'+
      '<button data-action="view" data-view="team" class="'+(currentView==='team'?'active':'')+'">'+t('La tua squadra')+'</button>':'')+'</nav>'+
    (currentView==='reports'?reportsMarkup():currentView==='clients'&&memberIsOwner()?clientsMarkup():currentView==='team'&&memberIsOwner()?teamMarkup():tasksMarkup());
}
function authMarkup(){
  const signup=authMode==='signup';
  return '<div class="auth-wrap"><div class="eyebrow">EasyGart Cloud</div><h1>'+t('Accesso dipendenti')+'</h1>'+
    '<p class="muted" style="margin-bottom:20px">Account individuali: i dati vengono autorizzati da Supabase.</p>'+
    '<div class="card"><div class="switch"><button class="'+(!signup?'primary':'ghost')+'" data-action="auth-mode" data-mode="signin">'+t('Accedi')+'</button>'+
      '<button class="'+(signup?'primary':'ghost')+'" data-action="auth-mode" data-mode="signup">'+t('Registrati')+'</button></div>'+
    '<form data-form="auth" class="stacked">'+field('Email','email','email','','autocomplete="email" required maxlength="200"')+
    field('Password','password','password','','autocomplete="'+(signup?'new-password':'current-password')+'" minlength="8" required')+
    '<button class="primary" type="submit">'+t(signup?'Crea un account':'Accedi')+'</button></form>'+
    '<p class="muted" style="font-size:12px;margin-top:18px">I dipendenti devono registrarsi con lo stesso indirizzo email inserito dal titolare nell’invito. Verifica email obbligatoria.</p></div></div>';
}
function onboardMarkup(){
  return '<div class="view-head"><div><div class="eyebrow">EasyGart Cloud</div><h1>'+t('Nessuna azienda collegata')+'</h1>'+
  '<p>Se sei il titolare, crea l’azienda. Se sei dipendente, conferma la tua email e accetta l’invito.</p></div></div>'+
  '<div class="two"><div class="card stacked"><h2>'+t('Crea azienda')+'</h2><p class="muted">Usa questa opzione solo per creare un nuovo spazio aziendale indipendente.</p>'+
  '<form class="stacked" data-form="company">'+field('Nome azienda','name','text','','required maxlength="150" minlength="2"')+
  '<button type="submit" class="primary">'+t('Crea azienda')+'</button></form></div>'+
  '<div class="card stacked"><h2>'+t('Accetta inviti')+'</h2><p class="muted">Un invito associato alla tua email verificata sarà collegato automaticamente al tuo account.</p>'+
  '<button data-action="claim" class="secondary">'+t('Accetta inviti')+'</button></div></div>';
}
function tasksMarkup(){
  const owner=memberIsOwner();
  let visible=tasks.filter(x=>owner||x.assignee_id===user.id);
  if(owner&&selectedWorkerId!=='all')visible=visible.filter(x=>x.assignee_id===selectedWorkerId);
  visible.sort((a,b)=>(a.status==='done')-(b.status==='done') || a.due_date.localeCompare(b.due_date) || (a.start_time||'').localeCompare(b.start_time||''));
  const assigned=visible.filter(x=>x.status==='assigned').length,working=visible.filter(x=>x.status==='in_progress').length,done=visible.filter(x=>x.status==='done').length;
  return '<div class="view-head"><div><h2>'+t(owner?'Attività assegnate':'I miei compiti')+'</h2><p class="muted">'+t('Solo i dati autorizzati dal server vengono mostrati.')+'</p></div>'+
    (owner?'<button class="primary" data-action="new-task">+ '+t('Assegna compito')+'</button>':'')+'</div>'+
    '<div class="grid" style="margin-bottom:20px"><div class="card metric"><span>'+t('Da fare')+'</span><strong>'+assigned+'</strong></div>'+
    '<div class="card metric"><span>'+t('In corso')+'</span><strong>'+working+'</strong></div>'+
    '<div class="card metric"><span>'+t('Completate')+'</span><strong>'+done+'</strong></div></div>'+
    (owner?'<div class="card" style="margin-bottom:16px"><label class="field">'+t('Dipendente')+
      '<select id="staff-filter">'+option('all',tr('Tutti i dipendenti'),selectedWorkerId==='all')+
        members.filter(m=>m.role==='worker').map(m=>option(m.user_id,m.full_name,m.user_id===selectedWorkerId)).join('')+'</select></label></div>':'')+
    (editingTaskId!==null&&owner?taskFormMarkup():editingTaskId==='new'&&owner?taskFormMarkup():'')+
    '<div class="card"><div class="cardhead"><h2>'+t('Compiti')+'</h2><span class="pill">'+visible.length+'</span></div>'+
      (visible.length?visible.map(taskMarkup).join(''):'<p class="muted">'+t('Nessuna attività')+'</p>')+'</div>';
}
function taskMarkup(task){
  const actions = task.status==='done' ? (memberIsOwner()?'<button class="ghost small" data-action="status" data-id="'+esc(task.id)+'" data-status="assigned">'+t('Riapri')+'</button>':'') :
    (task.status==='assigned'?'<button class="secondary small" data-action="status" data-id="'+esc(task.id)+'" data-status="in_progress">'+t('Inizia')+'</button>':'')+
    '<button class="primary small" data-action="status" data-id="'+esc(task.id)+'" data-status="done">'+t('Completa')+'</button>';
  return '<article class="taskrow"><div style="flex:1"><div class="task-title">'+esc(task.title)+'</div>'+
    '<div class="task-meta"><span>'+esc(task.due_date)+(task.start_time?' · '+esc(task.start_time.slice(0,5)):'')+'</span>'+
      '<span>'+esc(getName(clients,task.client_id))+'</span>'+
      '<span>'+esc(getName(sites,task.site_id))+'</span>'+
      (memberIsOwner()?'<span>'+esc(getWorkerName(task.assignee_id))+'</span>':'')+
      '<span>'+esc(tr({alta:'Alta',media:'Media',bassa:'Bassa'}[task.priority]||'Media'))+'</span></div>'+
      (task.instructions?'<p class="task-note">'+esc(task.instructions)+'</p>':'')+'</div>'+
    '<div class="task-right"><span class="pill '+pillTone(task)+'">'+t(statusLabel(task))+'</span>'+
    '<div class="actions">'+actions+(memberIsOwner()?'<button class="ghost small" data-action="edit-task" data-id="'+esc(task.id)+'">'+t('Modifica')+'</button>':'')+'</div></div></article>';
}
function taskFormMarkup(){
  const task=tasks.find(x=>x.id===editingTaskId)||{};
  const filteredSites=sites.filter(s=>s.client_id===(task.client_id||clients[0]?.id));
  const workers=members.filter(m=>m.active&&m.role==='worker');
  if(!clients.length||!workers.length)return '<div class="alert warn" style="margin-bottom:16px">Prima inserisci un cliente e invita almeno un dipendente.</div>';
  return '<div class="card stacked" style="margin-bottom:18px"><div class="cardhead"><h2>'+t(editingTaskId==='new'?'Assegna compito':'Modifica')+'</h2>'+
    '<button class="ghost small" data-action="cancel-edit">'+t('Annulla')+'</button></div>'+
    '<form data-form="task" class="formgrid">'+field('Titolo attività','title','text',task.title||'','required minlength="2" maxlength="200"')+
    select('Dipendente','assignee_id',workers.map(w=>option(w.user_id,w.full_name,task.assignee_id===w.user_id)).join(''),'required')+
    select('Cliente','client_id',clients.map(c=>option(c.id,c.name,task.client_id===c.id)).join(''),'id="task-client" required')+
    select('Cantiere','site_id',option('','—')+filteredSites.map(s=>option(s.id,s.name,task.site_id===s.id)).join(''),'id="task-site"')+
    field('Data','due_date','date',task.due_date||dateToday(),'required')+
    field('Ora','start_time','time',task.start_time?.slice(0,5)||'')+
    field('Durata stimata (minuti)','estimated_minutes','number',task.estimated_minutes??'','min="0" max="1440" step="5"')+
    select('Priorità','priority',['bassa','media','alta'].map(p=>option(p,tr({bassa:'Bassa',media:'Media',alta:'Alta'}[p]),(task.priority||'media')===p)).join(''))+
    '<label class="field span2">'+t('Istruzioni')+'<textarea name="instructions" maxlength="4000">'+esc(task.instructions||'')+'</textarea></label>'+
    '<div class="span2 actions"><button class="primary" type="submit">'+t(editingTaskId==='new'?'Salva compito':'Salva modifiche')+'</button></div></form></div>';
}
function clientsMarkup(){
  return '<div class="view-head"><h2>'+t('Clienti e cantieri')+'</h2></div><div class="two">'+
    '<div class="card stacked"><h2>'+t('Nuovo cliente')+'</h2><form data-form="client" class="stacked">'+field('Nome azienda','name','text','','required maxlength="150"')+
    '<button type="submit" class="primary">'+t('Nuovo cliente')+'</button></form>'+
    '<h3>Elenco clienti</h3>'+(clients.length?clients.map(c=>'<p>'+esc(c.name)+'</p>').join(''):'<p class="muted">Nessun cliente</p>')+'</div>'+
    '<div class="card stacked"><h2>'+t('Nuovo cantiere')+'</h2><form data-form="site" class="stacked">'+
    select('Cliente','client_id',clients.map(c=>option(c.id,c.name)).join(''),'required')+
    field('Cantiere','name','text','','required maxlength="150"')+field('Indirizzo','address','text','')+
    '<button type="submit" class="primary" '+(!clients.length?'disabled':'')+'>'+t('Nuovo cantiere')+'</button></form>'+
    '<h3>Cantieri</h3>'+(sites.length?sites.map(s=>'<p>'+esc(s.name)+' <span class="muted">· '+esc(getName(clients,s.client_id))+'</span></p>').join(''):'<p class="muted">Nessun cantiere</p>')+'</div></div>';
}
function teamMarkup(){
  return '<div class="view-head"><h2>'+t('Squadra e inviti')+'</h2></div><div class="two">'+
    '<div class="card stacked"><h2>'+t('Invita dipendente')+'</h2><p class="muted">Inserisci l’email del lavoratore. Condividi il link del portale: l’invito sarà associato alla sua email verificata.</p>'+
    '<form data-form="invite" class="stacked">'+field('Email','email','email','','required maxlength="200"')+
    '<button type="submit" class="primary">'+t('Invia invito')+'</button></form>'+
    '<p class="muted" style="font-size:12px">Link di accesso: '+esc(location.origin+location.pathname)+'</p></div>'+
    '<div class="card stacked"><h2>'+t('La tua squadra')+'</h2>'+
    (members.length?members.map(m=>'<div class="taskrow"><div><strong>'+esc(m.full_name||'—')+'</strong><p class="muted">'+esc(m.role)+'</p></div><div class="actions"><span class="pill">'+(m.active?'Attivo':'Disattivato')+'</span>'+(m.role==='worker'?'<button class="ghost small" data-action="member-active" data-user="'+esc(m.user_id)+'" data-active="'+(!m.active)+'">'+(m.active?'Disattiva':'Riattiva')+'</button>':'')+'</div></div>').join(''):'<p>'+t('Nessun dipendente')+'</p>')+
    '<h3>'+t('Inviti in attesa')+'</h3>'+
    (invites.filter(i=>!i.claimed_at).length?invites.filter(i=>!i.claimed_at).map(i=>'<p>'+esc(i.email)+' · <small>'+esc(i.expires_at?.slice(0,10))+'</small></p>').join(''):'<p class="muted">Nessun invito</p>')+'</div></div>';
}
async function refresh() {
  if(!client||!user)return;
  const list=requireSuccess(await client.from('eg_members').select('company_id,user_id,full_name,role,active').eq('user_id',user.id).eq('active',true));
  memberships=list||[];
  if(!memberships.length) {companies=[];members=[];clients=[];sites=[];tasks=[];invites=[];dailyReports=[];reportsReady=false;render();return}
  const cids=memberships.map(x=>x.company_id);
  companies=requireSuccess(await client.from('eg_companies').select('id,name').in('id',cids))||[];
  if(!cids.includes(selectedCompanyId))selectedCompanyId=cids[0];
  const org=selectedCompanyId;
  const owner=memberIsOwner();
  const requests = [
    client.from('eg_tasks').select('*').eq('company_id',org),
    client.from('eg_clients').select('id,company_id,name').eq('company_id',org),
    client.from('eg_sites').select('id,company_id,client_id,name,address').eq('company_id',org),
    client.from('eg_members').select('company_id,user_id,full_name,role,active').eq('company_id',org)
  ];
  if(owner)requests.push(client.from('eg_invites').select('id,email,claimed_at,expires_at').eq('company_id',org));
  const results=await Promise.all(requests);
  for (const x of results)if(x.error)throw x.error;
  [tasks,clients,sites,members] = results.slice(0,4).map(x=>x.data||[]);
  invites=owner?(results[4]?.data||[]):[];
  // La migrazione dei rapporti può non essere ancora installata: non bloccare gli altri moduli.
  const reportResponse = await client.from('eg_daily_reports').select('*')
    .eq('company_id',org).order('work_date',{ascending:false}).limit(250);
  if(reportResponse.error) {
    reportsReady=false;dailyReports=[];reportsSetupError=reportResponse.error.message||'Tabelle rapporti non disponibili';
  } else {
    reportsReady=true;reportsSetupError='';dailyReports=reportResponse.data||[];
  }
  if(!owner&&!['tasks','reports'].includes(currentView))currentView='tasks';
  render();
}
async function onAuth(form){
  const vals=Object.fromEntries(new FormData(form));
  const email=String(vals.email||'').trim().toLowerCase(),password=String(vals.password||'');
  if(authMode==='signup'){
    const r=await client.auth.signUp({email,password,options:{emailRedirectTo:location.href.split('?')[0].split('#')[0]}});
    requireSuccess(r);
    if(!r.data?.session){authMode='signin';success('Registrazione avviata. Controlla la posta, conferma la tua email e poi accedi.');return}
  }else{
    requireSuccess(await client.auth.signInWithPassword({email,password}));
  }
  user=requireSuccess(await client.auth.getUser())?.user||null;
  notice='';await refresh();
}
async function submitForm(form,formAction='draft'){
  const vals=Object.fromEntries(new FormData(form));
  switch(form.dataset.form){
    case 'auth':await onAuth(form);break;
    case 'company':{
      const name=String(vals.name||'').trim();
      if(name.length<2)throw Error('Il nome deve contenere almeno 2 caratteri.');
      requireSuccess(await client.from('eg_companies').insert({name,created_by:user.id}).select('id').single());
      await refresh();break;
    }
    case 'client':{
      if(!memberIsOwner())throw Error('Permesso negato');
      requireSuccess(await client.from('eg_clients').insert({company_id:selectedCompanyId,name:String(vals.name||'').trim()}).select('id').single());
      await refresh();break;
    }
    case 'site':{
      if(!memberIsOwner())throw Error('Permesso negato');
      requireSuccess(await client.from('eg_sites').insert({company_id:selectedCompanyId,client_id:vals.client_id,name:String(vals.name||'').trim(),address:String(vals.address||'').trim()}).select('id').single());
      await refresh();break;
    }
    case 'invite':{
      if(!memberIsOwner())throw Error('Permesso negato');
      requireSuccess(await client.rpc('eg_invite_worker',{p_company_id:selectedCompanyId,p_email:String(vals.email||'').trim().toLowerCase()}));
      await refresh();notice='Invito registrato. Condividi il link del portale con il dipendente.';errorNotice=false;render();break;
    }
    case 'task':{
      if(!memberIsOwner())throw Error('Permesso negato');
      const target=members.find(m=>m.user_id===vals.assignee_id&&m.active&&m.role==='worker');
      const c=clients.find(c=>c.id===vals.client_id);
      const site=sites.find(s=>s.id===vals.site_id);
      if(!target||!c||(vals.site_id&&(site?.client_id!==c.id)))throw Error('Dipendente, cliente o cantiere non validi.');
      const payload={title:String(vals.title||'').trim(),company_id:selectedCompanyId,client_id:vals.client_id,
        site_id:vals.site_id||null,assignee_id:vals.assignee_id,due_date:vals.due_date,start_time:vals.start_time||null,
        estimated_minutes:vals.estimated_minutes===''?null:Number(vals.estimated_minutes),
        priority:vals.priority,instructions:String(vals.instructions||'').trim()};
      if(editingTaskId==='new'){
        requireSuccess(await client.from('eg_tasks').insert({...payload,assigned_by:user.id}).select('id').single());
      }else{
        const old=tasks.find(t=>t.id===editingTaskId);
        if(!old)throw Error('Attività non trovata');
        const reassign=old.assignee_id!==payload.assignee_id;
        requireSuccess(await client.from('eg_tasks').update({...payload,...(reassign?{status:'assigned',started_at:null,done_at:null,completed_by:null,assigned_by:user.id,assigned_at:new Date().toISOString()}:{})})
          .eq('id',old.id).eq('company_id',selectedCompanyId).select('id').single());
      }
      editingTaskId=null;await refresh();break;
    }
  }
}
async function boot(){
  if(!ready){render();return}
  try{
    const mod=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
    client=mod.createClient(cfg.url,cfg.publishableKey,{
      auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true},
      global:{headers:{'x-client-info':'easygarte-cloud-v1'}}
    });
    const r=await client.auth.getUser();
    if(r.error&&r.error.status!==400)throw r.error;
    user=r.data?.user||null;
    if(user)await refresh();else render();
    client.auth.onAuthStateChange((ev,session)=>{
      if(!['SIGNED_IN','SIGNED_OUT'].includes(ev))return;
      setTimeout(async()=>{ try{
        user=session?.user||null;
        if(!user){memberships=[];companies=[];tasks=[];dailyReports=[];reportsReady=false;render()}else await refresh();
      }catch(e){fail(e)} },0);
    });
    setInterval(()=>{if(user && document.visibilityState==='visible' && !busy)refresh().catch(fail)},30000);
  }catch(e){fail(e)}
}
document.addEventListener('submit',e=>{
  const form=e.target.closest('form[data-form]');
  if(!form)return;
  e.preventDefault();
  withBusy(()=>submitForm(form,e.submitter?.value||'draft'));
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(!b)return;
  const a=b.dataset.action;
  if(a==='auth-mode'){authMode=b.dataset.mode;notice='';render();return}
  if(a==='view'){currentView=b.dataset.view;editingTaskId=null;reportEditingId=null;render();return}
  if(a==='refresh'){withBusy(refresh);return}
  if(a==='signout'){withBusy(async()=>{requireSuccess(await client.auth.signOut());user=null;memberships=[];dailyReports=[];reportsReady=false;render()});return}
  if(a==='claim'){withBusy(async()=>{const n=requireSuccess(await client.rpc('eg_claim_invitations'));await refresh();if(!n)success('Nessun invito valido per questa email verificata.');});return}
  if(a==='new-task'){editingTaskId='new';render();return}
  if(a==='edit-task'){editingTaskId=b.dataset.id;render();return}
  if(a==='cancel-edit'){editingTaskId=null;render();return}
  if(a==='member-active'){
    if(!memberIsOwner())return;
    const member=members.find(m=>m.user_id===b.dataset.user && m.role==='worker');
    if(!member)return;
    const enable=b.dataset.active==='true';
    if(!enable && !confirm('Disattivare il dipendente? Non potrà più accedere ai dati aziendali.'))return;
    withBusy(async()=>{requireSuccess(await client.rpc('eg_set_worker_active',{p_company_id:selectedCompanyId,p_user_id:member.user_id,p_active:enable}));await refresh()});return;
  }
  if(a==='status'){withBusy(async()=>{requireSuccess(await client.rpc('eg_set_task_status',{p_task_id:b.dataset.id,p_status:b.dataset.status}));await refresh()});return}
});
document.addEventListener('change',e=>{
  if(e.target.id==='locale'){locale=e.target.value==='de'?'de':'it';localStorage.setItem(localeKey,locale);render();return}
  if(e.target.id==='company-select'){selectedCompanyId=e.target.value;currentView='tasks';selectedWorkerId='all';reportEditingId=null;selectedReportWorkerId='all';reportStatusFilter='all';withBusy(refresh);return}
  if(e.target.id==='staff-filter'){selectedWorkerId=e.target.value;render();return}
  if(e.target.id==='task-client'){
    const s=$('task-site');if(!s)return;
    s.innerHTML=option('','—')+sites.filter(x=>x.client_id===e.target.value).map(x=>option(x.id,x.name)).join('');
  }
});
render();
boot();