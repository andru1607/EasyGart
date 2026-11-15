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
let companyPolicyError = false;
let pendingCompanyName = '';
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
let locale = (() => {try{return localStorage.getItem(localeKey)==='de'?'de':'it'}catch{return 'it'}})();
const german = {
  "Nel progetto EasyGart servono la migrazione SQL e una chiave pubblicabile:": "Im Supabase-Projekt EasyGart müssen die SQL-Migration ausgeführt und ein öffentlicher API-Schlüssel hinterlegt werden:",
  "Lingua": "Sprache",
  "Azienda": "Betrieb",
  "Sezioni": "Bereiche",
  "Stato": "Status",
  "Nome cliente": "Kundenname",
  "Account individuali: i dati vengono autorizzati da Supabase.": "Persönliche Benutzerkonten: Der Datenzugriff wird durch Supabase geregelt.",
  "I dipendenti devono registrarsi con lo stesso indirizzo email inserito dal titolare nell’invito. Verifica email obbligatoria.": "Mitarbeiter müssen sich mit derselben E-Mail-Adresse registrieren, die der Betriebsinhaber bei der Einladung angegeben hat. Die E-Mail-Adresse muss bestätigt werden.",
  "Se sei il titolare, crea l’azienda. Se sei dipendente, conferma la tua email e accetta l’invito.": "Wenn du Betriebsinhaber bist, lege deinen Betrieb an. Wenn du Mitarbeiter bist, bestätige deine E-Mail-Adresse und nimm die Einladung an.",
  "Usa questa opzione solo per creare un nuovo spazio aziendale indipendente.": "Verwende diese Option nur, um einen neuen, eigenständigen Betriebsbereich anzulegen.",
  "Un invito associato alla tua email verificata sarà collegato automaticamente al tuo account.": "Eine Einladung an deine bestätigte E-Mail-Adresse wird deinem Benutzerkonto zugeordnet.",
  "Prima inserisci un cliente e invita almeno un dipendente.": "Lege zuerst einen Kunden an und lade mindestens einen Mitarbeiter ein.",
  "La funzione rapporti non è ancora attiva nel database. Esegui la migrazione aggiuntiva": "Die Tagesberichte sind in der Datenbank noch nicht aktiviert. Führe die zusätzliche Migration aus",
  "nel progetto Supabase EasyGart.": "im Supabase-Projekt EasyGart aus.",
  "Controlla quanto svolto sul campo e approva i rapporti ricevuti.": "Prüfe die ausgeführten Arbeiten vor Ort und gib die eingegangenen Berichte frei.",
  "Racconta al titolare il lavoro svolto ogni giorno.": "Dokumentiere täglich deine durchgeführten Arbeiten für die Betriebsleitung.",
  "Operatore": "Mitarbeiter",
  "Per compilare il rapporto serve un compito assegnato dal titolare.": "Für einen Tagesbericht muss dir die Betriebsleitung eine Aufgabe zugewiesen haben.",
  "Attività non più assegnata": "Aufgabe nicht mehr zugewiesen",
  "Completa il rapporto e invialo al titolare. Dopo l’invio non è più modificabile finché non vengono richieste correzioni.": "Fülle den Bericht aus und sende ihn an die Betriebsleitung. Nach dem Absenden kannst du ihn erst wieder bearbeiten, wenn Korrekturen angefordert wurden.",
  "Descrivi in modo preciso gli interventi effettuati…": "Beschreibe die durchgeführten Arbeiten möglichst genau …",
  "Tipi e quantità di materiale, se presenti": "Art und Menge des verwendeten Materials, falls zutreffend",
  "Anomalie, interventi rimandati, comunicazioni importanti": "Besonderheiten, verschobene Arbeiten und wichtige Mitteilungen",
  "Le indicazioni sui materiali sono un riepilogo operativo e non generano addebiti o fatture automatiche.": "Materialangaben dienen ausschließlich der Arbeitsdokumentation und lösen keine automatische Berechnung oder Rechnungsstellung aus.",
  "Intervento": "Einsatz",
  "Descrizione non ancora compilata": "Beschreibung noch nicht ausgefüllt",
  "Motivo di eventuali correzioni o indicazioni operative": "Begründe erforderliche Korrekturen oder gib Hinweise zur Ausführung",
  "Elenco clienti": "Kundenliste",
  "Nessun cliente": "Keine Kunden vorhanden",
  "Cantieri": "Einsatzorte",
  "Nessun cantiere": "Keine Einsatzorte vorhanden",
  "Inserisci l’email del lavoratore. Condividi il link del portale: l’invito sarà associato alla sua email verificata.": "Gib die E-Mail-Adresse des Mitarbeiters ein und teile ihm den Portal-Link mit. Die Einladung wird seiner bestätigten E-Mail-Adresse zugeordnet.",
  "Link di accesso:": "Zugangslink:",
  "Nessun invito": "Keine offenen Einladungen",
  "Titolare": "Betriebsinhaber",
  "Attivo": "Aktiv",
  "Disattivato": "Deaktiviert",
  "Disattiva": "Deaktivieren",
  "Riattiva": "Reaktivieren",
  "Account e incarichi": "Benutzerkonten und Aufgaben",
  "Team Cloud • account e incarichi": "Team Cloud · Benutzerkonten und Aufgaben",
  "EasyGart Cloud MVP · La demo storica resta disponibile sulla pagina principale · Non inserire dati reali prima della verifica dei permessi.": "EasyGart Cloud MVP · Die bisherige Demoversion ist weiterhin auf der Startseite verfügbar · Vor der Berechtigungsprüfung keine Echtdaten eingeben.",
  "Il progetto Supabase di EasyGart deve avere la migrazione SQL e una chiave": "Im Supabase-Projekt EasyGart müssen die SQL-Migration ausgeführt und ein",
  "impostata in": "in",
  "Non inserire mai chiavi segrete.": "Niemals geheime Schlüssel eintragen.",
  "Registrazione avviata. Controlla la posta, conferma la tua email e poi accedi.": "Registrierung gestartet. Prüfe dein Postfach, bestätige deine E-Mail-Adresse und melde dich anschließend an.",
  "Invito registrato. Condividi il link del portale con il dipendente.": "Einladung gespeichert. Teile den Portal-Link mit dem Mitarbeiter.",
  "Rapporto inviato al titolare.": "Bericht an die Betriebsleitung gesendet.",
  "Bozza salvata.": "Entwurf gespeichert.",
  "Rapporto approvato.": "Bericht freigegeben.",
  "Richiesta di correzione inviata al dipendente.": "Korrekturanforderung an den Mitarbeiter gesendet.",
  "Nessun invito valido per questa email verificata.": "Für diese bestätigte E-Mail-Adresse liegt keine gültige Einladung vor.",
  "Disattivare il dipendente? Non potrà più accedere ai dati aziendali.": "Mitarbeiter deaktivieren? Er kann anschließend nicht mehr auf die Betriebsdaten zugreifen.",
  "Il nome deve contenere almeno 2 caratteri.": "Der Name muss mindestens zwei Zeichen enthalten.",
  "Sessione scaduta. Esci e accedi di nuovo prima di creare l’azienda.": "Die Sitzung ist abgelaufen. Melde dich ab und wieder an, bevor du den Betrieb anlegst.",
  "Permesso negato": "Zugriff verweigert.",
  "Il rapporto giornaliero viene compilato dal dipendente": "Tagesberichte werden von Mitarbeitern ausgefüllt.",
  "La migrazione dei rapporti non è stata attivata": "Die Datenbankmigration für Tagesberichte ist noch nicht aktiviert.",
  "Scegli un compito assegnato a te": "Wähle eine dir zugewiesene Aufgabe aus.",
  "Rapporto non modificabile": "Dieser Bericht kann nicht bearbeitet werden.",
  "Prima di inviare indica durata effettiva e almeno 10 caratteri di descrizione": "Gib vor dem Absenden die tatsächliche Arbeitsdauer und eine Beschreibung mit mindestens zehn Zeichen an.",
  "Solo il titolare può verificare i rapporti": "Nur der Betriebsinhaber darf Berichte prüfen.",
  "Rapporto non più in attesa di verifica": "Der Bericht wartet nicht mehr auf eine Prüfung.",
  "Decisione non valida": "Ungültige Entscheidung.",
  "Indica almeno 5 caratteri sulle modifiche richieste": "Beschreibe die erforderlichen Korrekturen mit mindestens fünf Zeichen.",
  "Dipendente, cliente o cantiere non validi.": "Ungültiger Mitarbeiter, Kunde oder Einsatzort.",
  "Attività non trovata": "Aufgabe nicht gefunden.",
  "Attività obbligatoria": "Eine Aufgabe ist erforderlich.",
  "Rapporto già presente per questo compito e questa giornata.": "Für diese Aufgabe und diesen Tag gibt es bereits einen Bericht.",
  "Rapporto non trovato": "Bericht nicht gefunden.",
  "Rapporto non trovato o non autorizzato": "Bericht nicht gefunden oder Zugriff verweigert.",
  "Rapporto già inviato e bloccato": "Der Bericht wurde bereits eingereicht und kann nicht bearbeitet werden.",
  "Solo il titolare può verificare": "Nur der Betriebsinhaber darf den Bericht prüfen.",
  "Rapporto non in attesa di verifica": "Der Bericht wartet nicht auf eine Prüfung.",
  "Durata del lavoro non valida": "Ungültige Arbeitsdauer.",
  "Data di lavoro non valida": "Ungültiges Arbeitsdatum.",
  "Testo troppo lungo": "Der Text ist zu lang.",
  "Per inviare, descrivi il lavoro (almeno 10 caratteri) e le ore effettive": "Beschreibe vor dem Absenden die Arbeit (mindestens zehn Zeichen) und gib die tatsächliche Arbeitszeit an.",
  "Accesso richiesto": "Anmeldung erforderlich.",
  "Conferma prima la tua email": "Bestätige zuerst deine E-Mail-Adresse.",
  "Non autorizzato": "Keine Berechtigung.",
  "Solo titolare può riaprire": "Nur der Betriebsinhaber darf die Aufgabe wieder öffnen.",
  "Stato non valido": "Ungültiger Status.",
  "Attività non assegnata": "Aufgabe ist nicht zugewiesen.",
  "Attività già completata": "Aufgabe bereits abgeschlossen.",
  "Email non valida": "Ungültige E-Mail-Adresse.",
  "Dipendente non trovato": "Mitarbeiter nicht gefunden.",
  "Non sei autorizzato a compilare questo rapporto": "Du bist nicht berechtigt, diesen Bericht auszufüllen.",
  "Solo titolare può cambiare lo stato del dipendente": "Nur der Betriebsinhaber darf den Mitarbeiterstatus ändern.",
  "Nessun rapporto personale": "Keine eigenen Berichte",
  "Errore sconosciuto": "Unbekannter Fehler.",
  "Impossibile completare l’operazione. Riprova o ricarica la pagina.": "Der Vorgang konnte nicht abgeschlossen werden. Bitte versuche es erneut oder lade die Seite neu.",
  "Email o password non validi.": "Ungültige E-Mail-Adresse oder ungültiges Passwort.",
  "Verifica il tuo indirizzo email prima di accedere.": "Bestätige deine E-Mail-Adresse, bevor du dich anmeldest.",
  "La sessione è scaduta. Accedi nuovamente.": "Die Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  "Il rapporto è già stato creato per questa giornata.": "Für diesen Tag wurde bereits ein Bericht erstellt.",
  "Non è stato possibile salvare: verifica i permessi del tuo account.": "Speichern fehlgeschlagen. Bitte überprüfe die Berechtigungen deines Benutzerkontos.",
  "Seleziona": "Auswählen",
  "Fatture": "Rechnungen",
  "Stato del rapporto": "Berichtsstatus",
  "Impossibile recuperare i rapporti.": "Tagesberichte konnten nicht geladen werden.",
  "Tabelle rapporti non disponibili": "Tabellen für Tagesberichte nicht verfügbar.",
  'Rapporti giornalieri':'Tagesberichte','Nuovo rapporto':'Neuer Tagesbericht',
  'Rapporti ricevuti':'Eingegangene Berichte','I miei rapporti':'Meine Berichte',
  'Rapporto giornaliero':'Tagesbericht','Rapporto da verificare':'Bericht zur Prüfung',
  'Salva bozza':'Entwurf speichern','Invia al titolare':'An die Betriebsleitung senden',
  'Da verificare':'Zur Prüfung','Approvati':'Freigegeben','Correzioni richieste':'Korrekturen erforderlich',
  'Bozza':'Entwurf','Inviato':'Eingereicht','Approvato':'Freigegeben',
  'Ore effettive (minuti)':'Tatsächliche Arbeitszeit (Minuten)',
  'Lavoro svolto':'Durchgeführte Arbeiten','Materiali utilizzati':'Verwendetes Material',
  'Problemi e imprevisti':'Probleme und Vorkommnisse',
  'Feedback del titolare':'Rückmeldung der Leitung','Approva':'Freigeben',
  'Richiedi correzioni':'Korrekturen anfordern','Torna ai rapporti':'Zurück zu den Berichten',
  'Tutti gli stati':'Alle Status','Tutti gli operatori':'Alle Mitarbeiter',
  'Nessun rapporto':'Keine Berichte',
  'Il database ha bloccato la creazione dell’azienda. Applica la correzione RLS di EasyGart nel SQL Editor e riprova.':'Die Datenbank hat die Firmenerstellung blockiert. Führe die EasyGart-RLS-Korrektur im SQL-Editor aus und versuche es erneut.',
  'Correzione necessaria':'Korrektur erforderlich','Apri SQL di riparazione':'SQL-Korrektur öffnen',
  'Eseguilo nel progetto Supabase EasyGart, poi riprova.':'Führe die Korrektur im Supabase-Projekt EasyGart aus und versuche es erneut.',
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
const displayDate = value => {
  const raw=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  const [year,month,day]=raw.split('-');
  return locale==='de'?day+'.'+month+'.'+year:day+'/'+month+'/'+year;
};
const statusLabel = task => task.status === 'done' ? 'Completato' : task.due_date < dateToday() ? 'In ritardo' : task.status === 'in_progress' ? 'In corso' : 'Assegnato';
const pillTone = task => task.status === 'done' ? '' : task.due_date < dateToday() ? 'red' : task.status === 'in_progress' ? 'amber' : '';
const memberIsOwner = () => memberships.some(m => m.company_id === selectedCompanyId && m.role === 'owner' && m.active);
const company = () => companies.find(c => c.id === selectedCompanyId);
const getName = (items,id) => items.find(x=>x.id===id)?.name || '—';
const getWorkerName = id => members.find(x=>x.user_id===id)?.full_name || '—';
const errorMessage = e => {
  const raw = e?.message || String(e || 'Errore sconosciuto');
  const code = String(e?.code || '');
  if (/eg_reports_one_daily_per_task/.test(raw)) return 'Il rapporto è già stato creato per questa giornata.';
  if (/invalid login credentials/i.test(raw)) return 'Email o password non validi.';
  if (/email not confirmed/i.test(raw)) return 'Verifica il tuo indirizzo email prima di accedere.';
  if (/jwt expired|refresh token not found|invalid refresh token/i.test(raw)) return 'La sessione è scaduta. Accedi nuovamente.';
  if (/^42501$/.test(code) || /permission denied|row.level security/i.test(raw))
    return 'Non è stato possibile salvare: verifica i permessi del tuo account.';
  if (Object.hasOwn(german,raw)) return raw;
  // Messaggi sconosciuti dal server non devono restare in italiano quando si seleziona DE.
  if (locale === 'de') return 'Impossibile completare l’operazione. Riprova o ricarica la pagina.';
  return raw;
};
const fail = e => {
  const message = e?.message || String(e || 'Errore sconosciuto');
  companyPolicyError = /eg_companies/.test(message) && /row.level security|42501/i.test(message+' '+(e?.code||''));
  notice = companyPolicyError
    ? 'Il database ha bloccato la creazione dell’azienda. Applica la correzione RLS di EasyGart nel SQL Editor e riprova.'
    : errorMessage(e);
  errorNotice = true;
  render();
};
const success = m => {notice=m;errorNotice=false;render()};
const withBusy = async cb => {
  if (busy) return;
  busy = true; disableButtons(true);
  try {await cb()} catch(e) {fail(e)} finally {busy=false;disableButtons(false)}
};
const disableButtons = disabled => document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=disabled);
const requireSuccess = r => {if(r.error)throw r.error;return r.data};
function render() {
  // Aggiorna anche i testi fuori dal contenitore dell'app (intestazione, footer, lingua HTML).
  if (document.documentElement) document.documentElement.lang = locale;
  const masthead = document.querySelector?.('.top-sub');
  if (masthead) masthead.textContent = tr('Team Cloud • account e incarichi');
  const footer = document.querySelector?.('footer.footer');
  if (footer) footer.textContent = tr('EasyGart Cloud MVP · La demo storica resta disponibile sulla pagina principale · Non inserire dati reali prima della verifica dei permessi.');
  topRight.innerHTML = '<select id="locale" aria-label="'+t('Lingua')+'" style="width:auto;background:#245343;border-color:#5b806a;color:#fff;padding:8px 10px">'+
    option('it','IT',locale==='it')+option('de','DE',locale==='de')+'</select>'+
    (user ? '<span style="font-size:12px;opacity:.8">'+esc(user.email)+'</span><button class="ghost small" data-action="signout">'+t('Esci')+'</button>' : '');
  const alert = (notice ? '<div id="notice" role="status" class="alert'+(errorNotice?' error':'')+'">'+t(notice)+'</div>' : '')+
    (companyPolicyError?'<div class="alert warn" style="margin-bottom:18px">'+
    '<strong>'+t('Correzione necessaria')+'</strong> · '+
    '<a href="https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_company_creation_fix.sql" target="_blank" rel="noopener noreferrer">'+t('Apri SQL di riparazione')+'</a>'+
    ' · '+t('Eseguilo nel progetto Supabase EasyGart, poi riprova.')+'</div>':'');
  if (!ready) {
    app.innerHTML = alert + '<div class="auth-wrap"><div class="eyebrow">EasyGart • cloud</div><h1>'+t('Configurazione richiesta')+'</h1>'+
      '<div class="card stacked"><p>'+t('L’interfaccia cloud è pronta, ma serve attivare Supabase prima di usarla.')+'</p>'+
      '<div class="alert warn">'+t('Nel progetto EasyGart servono la migrazione SQL e una chiave pubblicabile:')+' <code>sb_publishable_…</code> · <code>cloud/config.js</code>. '+t('Non inserire mai chiavi segrete.')+'</div>'+
      '<p><a href="../">'+t('La demo rimane disponibile')+'</a>.</p></div></div>';
    return;
  }
  if (!user) {app.innerHTML = alert + authMarkup();return}
  if (!memberships.length) {app.innerHTML = alert + onboardMarkup();return}
  const org = company();
  app.innerHTML = alert +
    '<div class="view-head"><div><div class="eyebrow">EasyGart Cloud</div><h1>'+esc(org?.name||'EasyGart')+'</h1>'+
    '<p>'+t('Solo i dati autorizzati dal server vengono mostrati.')+'</p></div>'+
    '<div class="toolbar">'+(companies.length>1?'<select id="company-select" aria-label="'+t('Azienda')+'" style="max-width:190px">'+companies.map(c=>option(c.id,c.name,c.id===selectedCompanyId)).join('')+'</select>':'')+
    '<button class="ghost" data-action="refresh">'+t('Ricarica')+'</button></div></div>'+
    '<nav class="nav" aria-label="'+t('Sezioni')+'">'+
      '<button data-action="view" data-view="tasks" class="'+(currentView==='tasks'?'active':'')+'">'+t('Compiti')+'</button>'+ 
      '<button data-action="view" data-view="reports" class="'+(currentView==='reports'?'active':'')+'">'+t('Rapporti giornalieri')+(memberIsOwner() && dailyReports.some(r=>r.status==='submitted')?' · '+dailyReports.filter(r=>r.status==='submitted').length:'')+'</button>'+ 
      (memberIsOwner()?'<button data-action="view" data-view="clients" class="'+(currentView==='clients'?'active':'')+'">'+t('Clienti e cantieri')+'</button>'+
      '<button data-action="view" data-view="team" class="'+(currentView==='team'?'active':'')+'">'+t('La tua squadra')+'</button>':'')+'</nav>'+
    (currentView==='reports'?reportsMarkup():currentView==='clients'&&memberIsOwner()?clientsMarkup():currentView==='team'&&memberIsOwner()?teamMarkup():tasksMarkup());
}
function authMarkup(){
  const signup=authMode==='signup';
  return '<div class="auth-wrap"><div class="eyebrow">EasyGart Cloud</div><h1>'+t('Accesso dipendenti')+'</h1>'+
    '<p class="muted" style="margin-bottom:20px">'+t("Account individuali: i dati vengono autorizzati da Supabase.")+'</p>'+
    '<div class="card"><div class="switch"><button class="'+(!signup?'primary':'ghost')+'" data-action="auth-mode" data-mode="signin">'+t('Accedi')+'</button>'+
      '<button class="'+(signup?'primary':'ghost')+'" data-action="auth-mode" data-mode="signup">'+t('Registrati')+'</button></div>'+
    '<form data-form="auth" class="stacked">'+field('Email','email','email','','autocomplete="email" required maxlength="200"')+
    field('Password','password','password','','autocomplete="'+(signup?'new-password':'current-password')+'" minlength="8" required')+
    '<button class="primary" type="submit">'+t(signup?'Crea un account':'Accedi')+'</button></form>'+
    '<p class="muted" style="font-size:12px;margin-top:18px">'+t("I dipendenti devono registrarsi con lo stesso indirizzo email inserito dal titolare nell’invito. Verifica email obbligatoria.")+'</p></div></div>';
}
function onboardMarkup(){
  return '<div class="view-head"><div><div class="eyebrow">EasyGart Cloud</div><h1>'+t('Nessuna azienda collegata')+'</h1>'+
  '<p>'+t("Se sei il titolare, crea l’azienda. Se sei dipendente, conferma la tua email e accetta l’invito.")+'</p></div></div>'+
  '<div class="two"><div class="card stacked"><h2>'+t('Crea azienda')+'</h2><p class="muted">'+t("Usa questa opzione solo per creare un nuovo spazio aziendale indipendente.")+'</p>'+
  '<form class="stacked" data-form="company">'+field('Nome azienda','name','text',pendingCompanyName,'required maxlength="150" minlength="2"')+
  '<button type="submit" class="primary">'+t('Crea azienda')+'</button></form></div>'+
  '<div class="card stacked"><h2>'+t('Accetta inviti')+'</h2><p class="muted">'+t("Un invito associato alla tua email verificata sarà collegato automaticamente al tuo account.")+'</p>'+
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
    '<div class="task-meta"><span>'+esc(displayDate(task.due_date))+(task.start_time?' · '+esc(task.start_time.slice(0,5)):'')+'</span>'+
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
  if(!clients.length||!workers.length)return '<div class="alert warn" style="margin-bottom:16px">'+t("Prima inserisci un cliente e invita almeno un dipendente.")+'</div>';
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
function reportStatusLabel(report){
  return {draft:'Bozza',submitted:'Inviato',approved:'Approvato',changes_requested:'Correzioni richieste'}[report.status]||report.status;
}
function formatReportMinutes(value){
  const n=Number(value)||0;
  return Math.floor(n/60)+' h '+String(n%60).padStart(2,'0')+' min';
}
function reportsMarkup(){
  const owner=memberIsOwner();
  if(!reportsReady){
    return '<div class="view-head"><div><h2>'+t('Rapporti giornalieri')+'</h2></div></div>'+
      '<div class="alert warn">'+t("La funzione rapporti non è ancora attiva nel database. Esegui la migrazione aggiuntiva")+' '+
      '<a target="_blank" rel="noopener noreferrer" href="https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_daily_reports_v1.sql">easygart_daily_reports_v1.sql</a> '+
      t('nel progetto Supabase EasyGart.')+' <span class="muted">'+(locale==='de'?t('Tabelle rapporti non disponibili'):esc(reportsSetupError))+'</span></div>';
  }
  let visible=dailyReports.filter(r=>owner||r.created_by===user.id);
  if(owner && selectedReportWorkerId!=='all')visible=visible.filter(r=>r.created_by===selectedReportWorkerId);
  if(reportStatusFilter!=='all')visible=visible.filter(r=>r.status===reportStatusFilter);
  visible.sort((a,b)=>b.work_date.localeCompare(a.work_date)||b.created_at.localeCompare(a.created_at));
  const pending=visible.filter(r=>r.status==='submitted').length;
  const corrections=visible.filter(r=>r.status==='changes_requested').length;
  const done=visible.filter(r=>r.status==='approved').length;
  const header= '<div class="view-head"><div><h2>'+t(owner?'Rapporti ricevuti':'I miei rapporti')+'</h2>'+
    '<p class="muted">'+t(owner?'Controlla quanto svolto sul campo e approva i rapporti ricevuti.':'Racconta al titolare il lavoro svolto ogni giorno.')+'</p></div>'+
    (!owner?'<button class="primary" data-action="report-new">+ '+t('Nuovo rapporto')+'</button>':'')+'</div>';
  const counts='<div class="grid" style="margin-bottom:18px">'+
    '<div class="card metric"><span>'+t('Da verificare')+'</span><strong>'+pending+'</strong></div>'+
    '<div class="card metric"><span>'+t('Correzioni richieste')+'</span><strong>'+corrections+'</strong></div>'+
    '<div class="card metric"><span>'+t('Approvati')+'</span><strong>'+done+'</strong></div></div>';
  const statusChoices=[['all','Tutti gli stati'],['draft','Bozza'],['submitted','Inviato'],['changes_requested','Correzioni richieste'],['approved','Approvato']];
  const filters='<div class="card" style="margin-bottom:16px"><div class="toolbar">'+
    '<label class="field" style="flex:1;min-width:145px"><span>'+t('Stato')+'</span><select id="report-status-filter">'+
    statusChoices.map(([value,label])=>option(value,tr(label),reportStatusFilter===value)).join('')+'</select></label>'+
    (owner?'<label class="field" style="flex:1;min-width:145px"><span>'+t('Dipendente')+'</span><select id="report-worker-filter">'+
      option('all',tr('Tutti gli operatori'),selectedReportWorkerId==='all')+
      members.filter(m=>m.role==='worker').map(m=>option(m.user_id,m.full_name||tr('Operatore'),selectedReportWorkerId===m.user_id)).join('')+'</select></label>':'')+
    '</div></div>';
  return header+counts+filters+
    (!owner&&reportEditingId!==null?reportFormMarkup():'')+
    '<section class="card"><div class="cardhead"><h2>'+t('Rapporti giornalieri')+'</h2><span class="pill">'+visible.length+'</span></div>'+
    (visible.length?visible.map(r=>reportCardMarkup(r,owner)).join(''):'<p class="muted">'+t('Nessun rapporto')+'</p>')+'</section>';
}
function reportFormMarkup(){
  const report=dailyReports.find(r=>r.id===reportEditingId)||null;
  if(reportEditingId!=='new'&&(!report||report.created_by!==user.id||
     !['draft','changes_requested'].includes(report.status)))return '';
  const ownTasks=tasks.filter(task=>task.assignee_id===user.id);
  if(!ownTasks.length)return '<div class="alert warn" style="margin-bottom:16px">'+t("Per compilare il rapporto serve un compito assegnato dal titolare.")+'</div>';
  const taskId=report?.task_id||ownTasks[0]?.id;
  const task=ownTasks.find(x=>x.id===taskId);
  const taskInput=report
    ? '<div class="field"><span>'+t('Compiti')+'</span><strong>'+esc(task?.title||tr('Attività non più assegnata'))+'</strong><input type="hidden" name="task_id" value="'+esc(taskId)+'"></div>'
    : select('Compiti','task_id',ownTasks.map(x=>option(x.id,x.title+(x.due_date?' · '+displayDate(x.due_date):''),x.id===taskId)).join(''),'required');
  return '<div class="card stacked" style="margin-bottom:18px"><div class="cardhead"><div><div class="eyebrow">EasyGart Cloud</div><h2>'+t(report?'Modifica':'Nuovo rapporto')+'</h2>'+
    '<p class="muted">'+t("Completa il rapporto e invialo al titolare. Dopo l’invio non è più modificabile finché non vengono richieste correzioni.")+'</p></div>'+
    '<button class="ghost small" data-action="report-cancel">'+t('Annulla')+'</button></div>'+
    (report?.manager_feedback?'<div class="alert warn"><strong>'+t('Feedback del titolare')+': </strong>'+esc(report.manager_feedback)+'</div>':'')+
    '<form data-form="daily-report" class="formgrid">'+
    taskInput+
    field('Data','work_date','date',report?.work_date||dateToday(),'required')+
    field('Ore effettive (minuti)','minutes_worked','number',report?.minutes_worked??'','min="0" max="1440" required')+
    '<label class="field span2"><span>'+t('Lavoro svolto')+' *</span><textarea name="work_summary" maxlength="6000" rows="5" placeholder="'+t("Descrivi in modo preciso gli interventi effettuati…")+'">'+esc(report?.work_summary||'')+'</textarea></label>'+
    '<label class="field span2"><span>'+t('Materiali utilizzati')+'</span><textarea name="materials_used" maxlength="4000" rows="2" placeholder="'+t("Tipi e quantità di materiale, se presenti")+'">'+esc(report?.materials_used||'')+'</textarea></label>'+
    '<label class="field span2"><span>'+t('Problemi e imprevisti')+'</span><textarea name="issues" maxlength="4000" rows="2" placeholder="'+t("Anomalie, interventi rimandati, comunicazioni importanti")+'">'+esc(report?.issues||'')+'</textarea></label>'+
    '<div class="span2 actions"><button class="ghost" type="submit" value="draft">'+t('Salva bozza')+'</button>'+
    '<button class="primary" type="submit" value="send">'+t('Invia al titolare')+'</button></div></form>'+
    '<p class="muted" style="font-size:12px">'+t("Le indicazioni sui materiali sono un riepilogo operativo e non generano addebiti o fatture automatiche.")+'</p></div>';
}
function reportCardMarkup(report,owner){
  const task=tasks.find(x=>x.id===report.task_id);
  const isPending=report.status==='submitted';
  const tone=isPending?'amber':report.status==='changes_requested'?'red':'';
  const title=task?.title||tr('Intervento');
  return '<article class="taskrow"><div style="flex:1;min-width:180px">'+
    '<div class="task-title">'+esc(title)+'</div>'+
    '<div class="task-meta"><span>'+esc(displayDate(report.work_date))+'</span>'+
    (owner?'<span>'+esc(getWorkerName(report.created_by))+'</span>':'')+
    '<span>'+esc(formatReportMinutes(report.minutes_worked))+'</span>'+
    '<span>'+esc(getName(clients,task?.client_id))+'</span>'+
    '<span>'+esc(getName(sites,task?.site_id))+'</span></div>'+
    '<p class="task-note">'+esc(report.work_summary||tr('Descrizione non ancora compilata'))+'</p>'+
    (report.materials_used?'<p class="task-note"><strong>'+t('Materiali utilizzati')+': </strong>'+esc(report.materials_used)+'</p>':'')+
    (report.issues?'<p class="task-note"><strong>'+t('Problemi e imprevisti')+': </strong>'+esc(report.issues)+'</p>':'')+
    (report.manager_feedback?'<div class="alert warn" style="margin-top:12px"><strong>'+t('Feedback del titolare')+': </strong>'+esc(report.manager_feedback)+'</div>':'')+
    (owner&&isPending?'<form data-form="daily-review" class="stacked" style="margin-top:16px">'+
      '<input type="hidden" name="report_id" value="'+esc(report.id)+'">'+
      '<label class="field"><span>'+t('Feedback del titolare')+'</span><textarea name="feedback" rows="2" maxlength="4000" placeholder="'+t("Motivo di eventuali correzioni o indicazioni operative")+'"></textarea></label>'+
      '<div class="actions"><button class="primary small" type="submit" value="approved">'+t('Approva')+'</button>'+
      '<button class="ghost small" type="submit" value="changes_requested">'+t('Richiedi correzioni')+'</button></div></form>':'')+
    (!owner&&['draft','changes_requested'].includes(report.status)?'<div style="margin-top:13px"><button class="secondary small" data-action="report-edit" data-id="'+esc(report.id)+'">'+t('Modifica')+'</button></div>':'')+
    '</div><div class="task-right"><span class="pill '+tone+'">'+t(reportStatusLabel(report))+'</span></div></article>';
}

function clientsMarkup(){
  return '<div class="view-head"><h2>'+t('Clienti e cantieri')+'</h2></div><div class="two">'+
    '<div class="card stacked"><h2>'+t('Nuovo cliente')+'</h2><form data-form="client" class="stacked">'+field('Nome cliente','name','text','','required maxlength="150"')+
    '<button type="submit" class="primary">'+t('Nuovo cliente')+'</button></form>'+
    '<h3>'+t("Elenco clienti")+'</h3>'+(clients.length?clients.map(c=>'<p>'+esc(c.name)+'</p>').join(''):'<p class="muted">'+t("Nessun cliente")+'</p>')+'</div>'+
    '<div class="card stacked"><h2>'+t('Nuovo cantiere')+'</h2><form data-form="site" class="stacked">'+
    select('Cliente','client_id',clients.map(c=>option(c.id,c.name)).join(''),'required')+
    field('Cantiere','name','text','','required maxlength="150"')+field('Indirizzo','address','text','')+
    '<button type="submit" class="primary" '+(!clients.length?'disabled':'')+'>'+t('Nuovo cantiere')+'</button></form>'+
    '<h3>'+t("Cantieri")+'</h3>'+(sites.length?sites.map(s=>'<p>'+esc(s.name)+' <span class="muted">· '+esc(getName(clients,s.client_id))+'</span></p>').join(''):'<p class="muted">'+t("Nessun cantiere")+'</p>')+'</div></div>';
}
function teamMarkup(){
  return '<div class="view-head"><h2>'+t('Squadra e inviti')+'</h2></div><div class="two">'+
    '<div class="card stacked"><h2>'+t('Invita dipendente')+'</h2><p class="muted">'+t("Inserisci l’email del lavoratore. Condividi il link del portale: l’invito sarà associato alla sua email verificata.")+'</p>'+
    '<form data-form="invite" class="stacked">'+field('Email','email','email','','required maxlength="200"')+
    '<button type="submit" class="primary">'+t('Invia invito')+'</button></form>'+
    '<p class="muted" style="font-size:12px">'+t('Link di accesso:')+' '+esc(location.origin+location.pathname)+'</p></div>'+
    '<div class="card stacked"><h2>'+t('La tua squadra')+'</h2>'+
    (members.length?members.map(m=>'<div class="taskrow"><div><strong>'+esc(m.full_name||'—')+'</strong><p class="muted">'+t(m.role==='owner'?'Titolare':'Dipendente')+'</p></div><div class="actions"><span class="pill">'+t(m.active?'Attivo':'Disattivato')+'</span>'+(m.role==='worker'?'<button class="ghost small" data-action="member-active" data-user="'+esc(m.user_id)+'" data-active="'+(!m.active)+'">'+t(m.active?'Disattiva':'Riattiva')+'</button>':'')+'</div></div>').join(''):'<p>'+t('Nessun dipendente')+'</p>')+
    '<h3>'+t('Inviti in attesa')+'</h3>'+
    (invites.filter(i=>!i.claimed_at).length?invites.filter(i=>!i.claimed_at).map(i=>'<p>'+esc(i.email)+' · <small>'+esc(displayDate(i.expires_at?.slice(0,10)))+'</small></p>').join(''):'<p class="muted">'+t('Nessun invito')+'</p>')+'</div></div>';
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
      pendingCompanyName=name;
      const currentUser=requireSuccess(await client.auth.getUser())?.user;
      if(!currentUser?.id)throw Error('Sessione scaduta. Esci e accedi di nuovo prima di creare l’azienda.');
      // L'ID del titolare deve coincidere con quello della sessione Supabase corrente.
      // Nessun RETURNING: la SELECT RLS richiede la membership creata dal trigger.
      requireSuccess(await client.from('eg_companies').insert({name,created_by:currentUser.id}));
      pendingCompanyName='';companyPolicyError=false;notice='';errorNotice=false;
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
    case 'daily-report':{
      if(memberIsOwner())throw Error('Il rapporto giornaliero viene compilato dal dipendente');
      if(!reportsReady)throw Error('La migrazione dei rapporti non è stata attivata');
      const task=tasks.find(x=>x.id===vals.task_id&&x.assignee_id===user.id);
      if(!task)throw Error('Scegli un compito assegnato a te');
      const old=reportEditingId==='new'?null:dailyReports.find(r=>r.id===reportEditingId);
      if(reportEditingId!=='new'&&(!old||old.created_by!==user.id||
         !['draft','changes_requested'].includes(old.status)))throw Error('Rapporto non modificabile');
      const send=formAction==='send';
      if(send && (String(vals.work_summary||'').trim().length<10 || Number(vals.minutes_worked)<1)){
        throw Error('Prima di inviare indica durata effettiva e almeno 10 caratteri di descrizione');
      }
      requireSuccess(await client.rpc('eg_save_daily_report',{
        p_report_id:old?.id||null,
        p_task_id:task.id,
        p_work_date:vals.work_date,
        p_minutes_worked:Number(vals.minutes_worked),
        p_work_summary:String(vals.work_summary||''),
        p_materials_used:String(vals.materials_used||''),
        p_issues:String(vals.issues||''),
        p_send:send
      }));
      reportEditingId=null;
      await refresh();
      notice=send?'Rapporto inviato al titolare.':'Bozza salvata.';
      errorNotice=false;render();break;
    }
    case 'daily-review':{
      if(!memberIsOwner())throw Error('Solo il titolare può verificare i rapporti');
      const report=dailyReports.find(r=>r.id===vals.report_id&&r.status==='submitted');
      if(!report)throw Error('Rapporto non più in attesa di verifica');
      if(!['approved','changes_requested'].includes(formAction))throw Error('Decisione non valida');
      const feedback=String(vals.feedback||'').trim();
      if(formAction==='changes_requested'&&feedback.length<5)throw Error('Indica almeno 5 caratteri sulle modifiche richieste');
      requireSuccess(await client.rpc('eg_review_daily_report',{
        p_report_id:report.id,p_action:formAction,p_feedback:feedback
      }));
      await refresh();notice=formAction==='approved'?'Rapporto approvato.':'Richiesta di correzione inviata al dipendente.';
      errorNotice=false;render();break;
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
    setInterval(()=>{
      const formFocused=!!document.activeElement?.closest?.('form');
      // Non cancellare i campi di un rapporto, di un compito o di un modulo mentre si scrive.
      if(user && document.visibilityState==='visible' && !busy && !formFocused &&
         reportEditingId===null && editingTaskId===null)refresh().catch(fail);
    },30000);
  }catch(e){fail(e)}
}
// Conserva i campi già compilati durante il cambio lingua o dei filtri.
function captureEditableForms(){
  if (!document.querySelectorAll) return [];
  return [...document.querySelectorAll('form[data-form]')]
    .filter(form => form.dataset.form !== 'auth')
    .map(form => ({
      type:form.dataset.form,
      fields:[...form.querySelectorAll('[name]')]
        .map(input=>({name:input.name,value:input.value,checked:input.checked,type:input.type}))
    }));
}
function restoreEditableForms(drafts){
  if(!document.querySelectorAll) return;
  for(const draft of drafts){
    const form=[...document.querySelectorAll('form[data-form]')]
      .find(candidate=>candidate.dataset.form===draft.type);
    if(!form)continue;
    const previousClient=draft.fields.find(field=>field.name==='client_id')?.value;
    if(draft.type==='task'&&previousClient){
      const site=form.querySelector('select[name="site_id"]');
      if(site)site.innerHTML=option('','—')+
        sites.filter(x=>x.client_id===previousClient).map(x=>option(x.id,x.name)).join('');
    }
    for(const field of draft.fields){
      const element=[...form.querySelectorAll('[name]')].find(el=>el.name===field.name);
      if(!element)continue;
      if(field.type==='checkbox'||field.type==='radio')element.checked=field.checked;
      else element.value=field.value;
    }
  }
}
function renderPreservingForms(){
  const drafts=captureEditableForms();
  render();
  restoreEditableForms(drafts);
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
  if(a==='view'){currentView=b.dataset.view;editingTaskId=null;reportEditingId=null;render();window.scrollTo?.({top:0,behavior:'instant'});return}
  if(a==='refresh'){withBusy(refresh);return}
  if(a==='signout'){withBusy(async()=>{requireSuccess(await client.auth.signOut());user=null;memberships=[];dailyReports=[];reportsReady=false;render()});return}
  if(a==='claim'){withBusy(async()=>{const n=requireSuccess(await client.rpc('eg_claim_invitations'));await refresh();if(!n)success('Nessun invito valido per questa email verificata.');});return}
  if(a==='report-new'){
    if(memberIsOwner()||!reportsReady)return;
    reportEditingId='new';render();document.querySelector?.('form[data-form="daily-report"]')?.scrollIntoView?.({behavior:'smooth',block:'start'});return;
  }
  if(a==='report-edit'){
    if(memberIsOwner()||!reportsReady)return;
    const report=dailyReports.find(r=>r.id===b.dataset.id&&r.created_by===user.id&&
      ['draft','changes_requested'].includes(r.status));
    if(!report)return;
    reportEditingId=report.id;render();return;
  }
  if(a==='report-cancel'){reportEditingId=null;render();return}
  if(a==='new-task'){editingTaskId='new';render();document.querySelector?.('form[data-form="task"]')?.scrollIntoView?.({behavior:'smooth',block:'start'});return}
  if(a==='edit-task'){editingTaskId=b.dataset.id;render();return}
  if(a==='cancel-edit'){editingTaskId=null;render();return}
  if(a==='member-active'){
    if(!memberIsOwner())return;
    const member=members.find(m=>m.user_id===b.dataset.user && m.role==='worker');
    if(!member)return;
    const enable=b.dataset.active==='true';
    if(!enable && !confirm(tr('Disattivare il dipendente? Non potrà più accedere ai dati aziendali.')))return;
    withBusy(async()=>{requireSuccess(await client.rpc('eg_set_worker_active',{p_company_id:selectedCompanyId,p_user_id:member.user_id,p_active:enable}));await refresh()});return;
  }
  if(a==='status'){withBusy(async()=>{requireSuccess(await client.rpc('eg_set_task_status',{p_task_id:b.dataset.id,p_status:b.dataset.status}));await refresh()});return}
});
document.addEventListener('change',e=>{
  if(e.target.id==='locale'){locale=e.target.value==='de'?'de':'it';try{localStorage.setItem(localeKey,locale)}catch{}renderPreservingForms();return}
  if(e.target.id==='company-select'){selectedCompanyId=e.target.value;currentView='tasks';selectedWorkerId='all';reportEditingId=null;selectedReportWorkerId='all';reportStatusFilter='all';withBusy(refresh);return}
  if(e.target.id==='report-status-filter'){reportStatusFilter=e.target.value;renderPreservingForms();return}
  if(e.target.id==='report-worker-filter'){selectedReportWorkerId=e.target.value;renderPreservingForms();return}
  if(e.target.id==='staff-filter'){selectedWorkerId=e.target.value;renderPreservingForms();return}
  if(e.target.id==='task-client'){
    const s=$('task-site');if(!s)return;
    s.innerHTML=option('','—')+sites.filter(x=>x.client_id===e.target.value).map(x=>option(x.id,x.name)).join('');
  }
});
render();
boot();