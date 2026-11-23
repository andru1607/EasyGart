// EasyGart Cloud MVP • Supabase Auth e RLS • non usare con dati reali prima dei test RLS.
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

const egNavIcon=name=>{
  const paths={
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    leaf:'<path d="M20 4C12 4 5 7 5 15a5 5 0 0 0 5 5c8 0 11-7 10-16Z"/><path d="M6 20c3-6 7-8 13-11"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    reports:'<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'+
   ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(paths[name]||'')+'</svg>';
};

const cfg = window.EASYGART_SUPABASE_CONFIG || {};
const app = $('app'), topRight = $('top-right');
let client = null;
let operations = null;
let globalSearch = null;
let screenshotImport = null;
let importReturnView = 'home';
let clientContactsReady = false;
let calendar = null;
let hoursCalendar = null;
let endOfDay = null;
let reportMaterialRows = new Map();
let monthly = null;
let siteHistory = null;
let editingFromSite = false;
let menuOpen = false;
let business = null;
let authMode = 'signin';
// Capture the recovery marker before Supabase processes and clears URL tokens.
let recoveryLinkOpened = /(?:^|[?&#])type=recovery(?:[&#]|$)/.test(location.search+location.hash);
let notice = '';
let errorNotice = false;
let companyPolicyError = false;
let pendingCompanyName = '';
let busy = false;
let selectedCompanyId = '';
let currentView = 'home';
let selectedWorkerId = 'all';
let editingTaskId = null;
let user = null;
let memberships = [], companies = [], members = [], clients = [], sites = [], tasks = [], invites = [];
let adminDelegations=[],adminDelegationReady=false;
let editingClientId=null,editingSiteId=null;
let dailyReports = [], reportsReady = false, reportsSetupError = '', reportEditingId = null;
let selectedReportWorkerId = 'all', reportStatusFilter = 'all';
let selectedReportId = null;
let pendingReportDeletionId = null;
let reportReturnView = 'reports';
let editingFromMonthly=false;
let editingFromCalendar=null;
const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || '') && /^sb_publishable_/.test(cfg.publishableKey || '');
const localeKey = 'easygarte_cloud_language';
let locale = (() => {try{return localStorage.getItem(localeKey)==='de'?'de':'it'}catch{return 'it'}})();
const german = {
  'Home':'Startseite','Fine giornata':'Feierabend','Menu':'Menü','Altre sezioni':'Weitere Bereiche',
  'Cerca':'Suche','Cerca attività e azioni':'Aufgaben und Aktionen suchen',
  'Impostazioni e account':'Einstellungen und Konto','Seleziona una sezione':'Bereich auswählen',
  'Inserisci gli orari e il cantiere':'Arbeitszeiten und Einsatzort erfassen','Rapporti':'Berichte',
  'Resoconto mensile':'Monatsübersicht','Apri resoconto mensile':'Monatsübersicht öffnen',
  'Tutti i dipendenti':'Alle Mitarbeitenden','Rapporti per dipendente':'Berichte nach Mitarbeitenden',
  'Modifiche storiche consentite finché il rapporto non è collegato a una proforma.':'Historische Korrekturen sind erlaubt, solange der Bericht keiner Proforma zugeordnet ist.',
  'Caricamento materiali…':'Materialien werden geladen…','Nessun materiale registrato':'Keine Materialien erfasst',
  'Elimina rapporto':'Bericht löschen',
  'Conferma eliminazione':'Löschen bestätigen',
  'Vuoi eliminare questo rapporto?':'Diesen Bericht wirklich löschen?',
  'Il rapporto scomparirà da rapporti, calendario, riepilogi mensili e storico cantieri. Resterà una traccia interna della cancellazione.':'Der Bericht wird aus Berichten, Kalender, Monatsübersichten und Einsatzort-Verlauf entfernt. Ein interner Löschvermerk bleibt erhalten.',
  'Elimina definitivamente dalla vista':'Aus den Ansichten entfernen',
  'Annulla':'Abbrechen',
  'Rapporto eliminato.':'Bericht gelöscht.',
  'Panoramica azienda':'Betriebsübersicht','La tua giornata':'Dein Arbeitstag',
  'Ogni funzione ha la sua schermata. Inizia dalla registrazione di fine giornata.':'Jede Funktion hat eine eigene Seite. Beginne mit dem Feierabendbericht.',
  'Inserisci le ore e il cantiere':'Stunden und Einsatzort erfassen',
  'Consulta giornate e ore':'Tage und Stunden ansehen',
  'Consulta e modifica i rapporti':'Berichte ansehen und bearbeiten',
  'Attività assegnate':'Zugewiesene Aufgaben','Compiti aperti':'Offene Aufgaben',
  'Rapporti da verificare':'Zu prüfende Berichte','Rapporti registrati':'Gespeicherte Berichte',
  'Ultimi rapporti':'Letzte Berichte','Vedi tutti':'Alle anzeigen','Apri':'Öffnen','Dettaglio rapporto':'Berichtsdetails',
  'Visualizza ore e attività mensili':'Monatliche Stunden und Tätigkeiten ansehen',
  'Cantieri svolti':'Bearbeitete Einsatzorte','Apri lo storico dei cantieri':'Einsatzort-Verlauf öffnen',
  'Calendario orari':'Stundenkalender',
  'Calendario orari e rapporti':'Arbeitszeit- und Berichtskalender',
  'Consulta gli orari senza i rapporti':'Arbeitszeiten ohne Berichte ansehen',
  'Consulta orari, lavori e cantieri':'Zeiten, Arbeiten und Einsatzorte ansehen',
  "Password dimenticata?": "Passwort vergessen?",
  "Recupera password": "Passwort zurücksetzen",
  "Inserisci la tua email: riceverai un link per impostare una nuova password.": "Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Festlegen eines neuen Passworts.",
  "Invia link di recupero": "Wiederherstellungslink senden",
  "Torna all’accesso": "Zurück zur Anmeldung",
  "Se l’indirizzo è registrato, riceverai un’email con le istruzioni per recuperare la password.": "Wenn die Adresse registriert ist, erhältst du eine E-Mail mit Anweisungen zum Zurücksetzen des Passworts.",
  "Imposta nuova password": "Neues Passwort festlegen",
  "Scegli una password unica di almeno 12 caratteri.": "Wähle ein einzigartiges Passwort mit mindestens 12 Zeichen.",
  "Nuova password": "Neues Passwort",
  "Conferma nuova password": "Neues Passwort bestätigen",
  "Salva nuova password": "Neues Passwort speichern",
  "Le due password non coincidono.": "Die beiden Passwörter stimmen nicht überein.",
  "La password deve contenere almeno 12 caratteri.": "Das Passwort muss mindestens 12 Zeichen lang sein.",
  "Password aggiornata. Accedi di nuovo con la nuova password.": "Passwort aktualisiert. Melde dich mit dem neuen Passwort erneut an.",
  "Sicurezza account": "Kontosicherheit",
  "Modifica password": "Passwort ändern",
  "Per motivi di sicurezza, dopo la modifica dovrai accedere nuovamente.": "Aus Sicherheitsgründen musst du dich nach der Änderung erneut anmelden.",
  "Connessione assente. Riprova quando torni online: i testi del modulo sono conservati in questa sessione.": "Keine Internetverbindung. Bitte versuche es online erneut. Die Formulareingaben bleiben in dieser Sitzung erhalten.",
  "Dati ed esportazione": "Daten und Export",
  "Installa app": "App installieren",
  "Su iPhone apri Condividi e scegli Aggiungi alla schermata Home. Su Android usa Installa app dal menu del browser.": "Auf dem iPhone wähle im Teilen-Menü 'Zum Home-Bildschirm'. Unter Android verwende im Browsermenü 'App installieren'.",
  "Catalogo materiali": "Materialkatalog",
  "Manutenzioni ricorrenti": "Wiederkehrende Wartungen",
  "Bozze proforma": "Proforma-Entwürfe",
  "Usa una password unica di almeno 12 caratteri, preferibilmente generata da un gestore password.": "Verwende ein einmaliges Passwort mit mindestens 12 Zeichen, am besten aus einem Passwortmanager.",
  "Per registrarti usa almeno 12 caratteri per la password.": "Für die Registrierung muss das Passwort mindestens 12 Zeichen lang sein.",
  "Impossibile leggere questa foto. Converti il file in JPEG.": "Dieses Foto kann nicht gelesen werden. Bitte konvertiere es in JPEG.",
  "Per aggiungere foto prima/dopo e firma del cliente, salva prima il rapporto come bozza.": "Um Vorher-/Nachher-Fotos und die Kundenunterschrift hinzuzufügen, speichere den Bericht zuerst als Entwurf.",
  "Apri lo script SQL": "SQL-Skript öffnen",
  "Calendario": "Kalender",
  "Timbrature": "Zeiterfassung",
  "Timbrature della squadra": "Zeiterfassung des Teams",
  "Le mie timbrature": "Meine Zeiterfassung",
  "Gli orari vengono registrati dal server, non dal telefono.": "Die Zeiten werden vom Server erfasst, nicht vom Smartphone.",
  "Turni conclusi": "Abgeschlossene Schichten",
  "Ore lavorate registrate": "Erfasste Arbeitszeit",
  "Turni aperti": "Offene Schichten",
  "Non specificato": "Nicht angegeben",
  "Turno attuale": "Aktuelle Schicht",
  "Non hai un turno aperto.": "Du hast derzeit keine offene Schicht.",
  "Pausa in corso": "Pause läuft",
  "Turno in corso": "Schicht läuft",
  "In pausa": "In Pause",
  "Al lavoro": "Bei der Arbeit",
  "Entrata": "Arbeitsbeginn",
  "Tempo lavorato": "Arbeitszeit",
  "Cantiere (facoltativo)": "Einsatzort (optional)",
  "Entra": "Einstempeln",
  "Inizia pausa": "Pause beginnen",
  "Termina pausa": "Pause beenden",
  "Esci dal turno": "Ausstempeln",
  "Uscita": "Arbeitsende",
  "Pause": "Pausen",
  "Storico timbrature": "Zeiterfassungsverlauf",
  "Nessuna timbratura registrata.": "Noch keine Zeiteinträge vorhanden.",
  "Le ore sono indicative per il riepilogo operativo, non sostituiscono il cedolino o le registrazioni obbligatorie.": "Die Arbeitszeiten dienen der betrieblichen Übersicht und ersetzen weder die Lohnabrechnung noch gesetzlich vorgeschriebene Aufzeichnungen.",
  "Concluso": "Abgeschlossen",
  "Foto prima": "Vorher-Fotos",
  "Foto dopo": "Nachher-Fotos",
  "Aggiungi foto": "Fotos hinzufügen",
  "Firma cliente": "Kundenunterschrift",
  "Raccogli firma sullo schermo": "Unterschrift auf dem Bildschirm erfassen",
  "Nessuna firma registrata.": "Noch keine Unterschrift erfasst.",
  "La firma documenta la presa visione sul posto: non è una firma elettronica qualificata.": "Die Unterschrift dokumentiert die Kenntnisnahme vor Ort. Sie ist keine qualifizierte elektronische Signatur.",
  "Foto e firme": "Fotos und Unterschriften",
  "Anteprima non disponibile. Ricarica la pagina.": "Vorschau nicht verfügbar. Bitte Seite neu laden.",
  "Elimina allegato": "Anhang löschen",
  "Nome e cognome del firmatario": "Vor- und Nachname der unterzeichnenden Person",
  "Il cliente firma direttamente sullo schermo del dispositivo.": "Der Kunde unterschreibt direkt auf dem Bildschirm des Geräts.",
  "Area firma": "Unterschriftsfeld",
  "Cancella tratto": "Unterschrift löschen",
  "Confermo che il firmatario è presente e acconsente alla registrazione della propria firma sul rapporto.": "Ich bestätige, dass die unterzeichnende Person anwesend ist und der Erfassung ihrer Unterschrift im Bericht zustimmt.",
  "Salva firma": "Unterschrift speichern",
  "Solo i dipendenti possono timbrare.": "Nur Mitarbeiter können sich einstempeln.",
  "Attiva prima la migrazione delle presenze su Supabase.": "Aktiviere zuerst die Datenbankmigration für die Zeiterfassung in Supabase.",
  "Timbratura registrata.": "Zeitbuchung gespeichert.",
  "Formato immagine non supportato.": "Nicht unterstütztes Bildformat.",
  "Immagine troppo grande. Scegli una foto più piccola.": "Das Bild ist zu groß. Bitte wähle ein kleineres Foto.",
  "Impossibile prenotare il caricamento.": "Upload konnte nicht vorbereitet werden.",
  "Rapporto non modificabile.": "Bericht kann nicht bearbeitet werden.",
  "Massimo tre fotografie per fase.": "Maximal drei Fotos pro Phase.",
  "Fotografie caricate nel deposito privato.": "Fotos wurden im geschützten Speicher hochgeladen.",
  "Il cliente deve firmare nell’area dedicata.": "Der Kunde muss im Unterschriftsfeld unterschreiben.",
  "Nome e consenso del firmatario obbligatori.": "Name und Einwilligung der unterzeichnenden Person sind erforderlich.",
  "Impossibile salvare la firma.": "Unterschrift konnte nicht gespeichert werden.",
  "Firma salvata in archivio privato.": "Unterschrift wurde im geschützten Speicher abgelegt.",
  "Allegato non modificabile.": "Dieser Anhang kann nicht bearbeitet werden.",
  "Eliminare definitivamente questo allegato?": "Diesen Anhang endgültig löschen?",
  "Allegato eliminato.": "Anhang gelöscht.",
  "Le timbrature non sono ancora attive. Applica la migrazione SQL delle presenze.": "Die Zeiterfassung ist noch nicht aktiviert. Führe die SQL-Migration für die Zeiterfassung aus.",
  "Le foto e le firme non sono ancora attive. Applica la migrazione SQL dei media privati.": "Fotos und Unterschriften sind noch nicht aktiviert. Führe die SQL-Migration für geschützte Medien aus.",
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
  'Guida':'Anleitung','Apri guida':'Anleitung öffnen',
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
const tr = s => locale === 'de' ? (german[s] || window.EASYGART_BUSINESS_I18N?.[s] || s) : s;
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
const memberIsPrimaryOwner=()=>memberships.some(m=>m.company_id===selectedCompanyId&&m.role==='owner'&&m.active);
const memberIsAdmin=()=>memberships.some(m=>m.company_id===selectedCompanyId&&m.role==='worker'&&m.active)&&
  adminDelegations.some(d=>d.company_id===selectedCompanyId&&d.user_id===user?.id);
const memberIsOwner = () => memberIsPrimaryOwner()||memberIsAdmin();
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
  renderPreservingForms(); // Non perdere rapporto o compito se il server rifiuta il salvataggio.
};
const success = m => {notice=m;errorNotice=false;render()};
const withBusy = async cb => {
  if (busy) return;
  busy = true; disableButtons(true);
  try {await cb()} catch(e) {fail(e)} finally {busy=false;disableButtons(false)}
};
const disableButtons = disabled => document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=disabled);
const requireSuccess = r => {if(r.error)throw r.error;return r.data};
// Mobile resilience: short-lived local drafts for text fields only (never passwords/photos/signatures).
const DRAFT_PREFIX='easygart-cloud-draft-v1:';
const DRAFT_TTL=24*60*60*1000;
const DRAFT_FORMS=new Set(['eod-report','daily-report','task','client','site','biz-material','biz-maintenance','biz-invoice-line']);
function draftKeyForForm(form){
  if(!form||!DRAFT_FORMS.has(form.dataset?.form)||!user?.id||!selectedCompanyId)return null;
  const type=form.dataset.form;
  const hidden=form.querySelector?.('[name="report_id"],[name="invoice_id"]')?.value||'';
  const scope=hidden||(type==='daily-report'?(reportEditingId||'new'):
    type==='eod-report'?(endOfDay?.getId?.()||'new'):
    type==='task'?(editingTaskId||'new'):
    type==='biz-maintenance'?(form.dataset.bizPlanId||'new'):'new');
  return DRAFT_PREFIX+[user.id,selectedCompanyId,type,scope].join(':');
}
function saveSessionDraft(form){
  const key=draftKeyForForm(form);
  if(!key||typeof sessionStorage==='undefined')return;
  try{
    const fields=[...(form.querySelectorAll?.('[name]')||[])].filter(el=>
      el.name&&!['hidden','password','email','file','radio'].includes(el.type));
    const values=fields.map(el=>({name:el.name,value:el.value,checked:el.checked,type:el.type}));
    sessionStorage.setItem(key,JSON.stringify({timestamp:Date.now(),values}));
  }catch{}
}
function restoreSessionDrafts(){
  if(typeof sessionStorage==='undefined')return;
  for(const form of (document.querySelectorAll?.('form[data-form]')||[])){
    const key=draftKeyForForm(form);
    if(!key)continue;
    try{
      const raw=sessionStorage.getItem(key);
      if(!raw)continue;
      const parsed=JSON.parse(raw);
      if(Date.now()-parsed.timestamp>DRAFT_TTL){sessionStorage.removeItem(key);continue}
      for(const field of parsed.values||[]){
        const input=[...(form.querySelectorAll?.('[name]')||[])].find(el=>el.name===field.name);
        if(!input||['hidden','password','email','file'].includes(input.type))continue;
        if(input.type==='checkbox')input.checked=field.checked;
        else input.value=field.value;
      }
    }catch{}
  }
}
function clearDraftKey(key){if(key&&typeof sessionStorage!=='undefined'){try{sessionStorage.removeItem(key)}catch{}}}
function clearAccountDrafts(){
  if(typeof sessionStorage==='undefined'||!user?.id)return;
  try{
    const prefix=DRAFT_PREFIX+user.id+':';
    for(let i=sessionStorage.length-1;i>=0;i--){
      const key=sessionStorage.key(i);
      if(key?.startsWith(prefix))sessionStorage.removeItem(key);
    }
  }catch{}
}

function render() {
  // Aggiorna anche i testi fuori dal contenitore dell'app (intestazione, footer, lingua HTML).
  if (document.documentElement) document.documentElement.lang = locale;
  window.EASYGART_INSTALL?.updateNetworkText?.();
  const masthead = document.querySelector?.('.top-sub');
  if (masthead) masthead.textContent = tr('Team Cloud • account e incarichi');
  const footer = document.querySelector?.('footer.footer');
  if (footer) footer.textContent = tr('EasyGart Cloud MVP · La demo storica resta disponibile sulla pagina principale · Non inserire dati reali prima della verifica dei permessi.');
  topRight.innerHTML = '<select id="locale" aria-label="'+t('Lingua')+'" style="width:auto;background:#245343;border-color:#5b806a;color:#fff;padding:8px 10px">'+
    option('it','IT',locale==='it')+option('de','DE',locale==='de')+'</select>'+
    (user ? '<span style="font-size:12px;opacity:.8">'+esc(user.email)+'</span>'+
      (!window.EASYGART_INSTALL?.isStandalone?.()?'<button class="ghost small" data-action="install">'+t('Installa app')+'</button>':'')+
      '<button class="ghost small" data-action="account-password">'+t('Sicurezza account')+'</button>'+ 
      '<button class="ghost small" data-action="signout">'+t('Esci')+'</button>' : '');
  const displayNotice = errorNotice && locale==='de' && !Object.hasOwn(german,notice) &&
    !Object.hasOwn(window.EASYGART_BUSINESS_I18N||{},notice)
    ? 'Impossibile completare l’operazione. Riprova o ricarica la pagina.'
    : notice;
  const alert = (notice ? '<div id="notice" role="status" class="alert'+(errorNotice?' error':'')+'">'+t(displayNotice)+'</div>' : '')+
    (companyPolicyError?'<div class="alert warn" style="margin-bottom:18px">'+
    '<strong>'+t('Correzione necessaria')+'</strong> · '+
    '<a href="https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_company_creation_fix.sql" target="_blank" rel="noopener noreferrer">'+t('Apri SQL di riparazione')+'</a>'+
    ' · '+t('Eseguilo nel progetto Supabase EasyGart, poi riprova.')+'</div>':'');
  // The guide is independent of the data views: it appears only for authenticated users,
  // once per account and company, and never while changing the account password.
  window.EASYGART_GUIDE?.sync({
    active:ready && !!user && authMode!=='reset',
    userId:user?.id||'',
    companyId:memberships.length?selectedCompanyId:'',
    role:memberships.length?(memberIsPrimaryOwner()?'owner':memberIsAdmin()?'admin':'worker'):'setup',
    locale,
    onLocale(next){
      if(next!==locale){
        locale=next==='de'?'de':'it';
        try{localStorage.setItem(localeKey,locale)}catch{}
        renderPreservingForms();
      }
    },
    onNavigate(view){
      const workerViews=['home','eod','tasks','clock','calendar','calendar-hours','reports','monthly','sites-history'];
      const ownerViews=['clients','team','materials','maintenance','invoices','archive','import'];
      if(!workerViews.includes(view)&&!(memberIsOwner()&&ownerViews.includes(view)))return;
      endOfDay?.reset();currentView=view;menuOpen=false;editingTaskId=null;reportEditingId=null;
      if(view==='monthly')monthly?.refresh(selectedCompanyId).then(render).catch(fail);
      if(view==='calendar-hours')hoursCalendar?.refresh(selectedCompanyId).then(render).catch(fail);
      if(view==='sites-history')siteHistory?.refresh(selectedCompanyId).then(render).catch(fail);
      render();
    }
  });
  if (!ready) {
    app.innerHTML = alert + '<div class="auth-wrap"><div class="eyebrow">EasyGart • cloud</div><h1>'+t('Configurazione richiesta')+'</h1>'+
      '<div class="card stacked"><p>'+t('L’interfaccia cloud è pronta, ma serve attivare Supabase prima di usarla.')+'</p>'+
      '<div class="alert warn">'+t('Nel progetto EasyGart servono la migrazione SQL e una chiave pubblicabile:')+' <code>sb_publishable_…</code> · <code>cloud/config.js</code>. '+t('Non inserire mai chiavi segrete.')+'</div>'+
      '<p><a href="../">'+t('La demo rimane disponibile')+'</a>.</p></div></div>';
    return;
  }
  if (!user) {app.innerHTML = alert + authMarkup();return}
  if (authMode==='reset') {app.innerHTML=alert+passwordResetMarkup();return}
  if (!memberships.length) {app.innerHTML = alert + onboardMarkup();return}
  const org = company();
  app.innerHTML = alert +
    '<div class="view-head eg-app-intro"><div><div class="eyebrow">'+t('Azienda')+'</div><h1>'+esc(org?.name||'EasyGart')+'</h1>'+
    '<p>'+t('Solo i dati autorizzati dal server vengono mostrati.')+'</p></div>'+
    '<div class="toolbar">'+(companies.length>1?'<select id="company-select" aria-label="'+t('Azienda')+'" style="max-width:190px">'+companies.map(c=>option(c.id,c.name,c.id===selectedCompanyId)).join('')+'</select>':'')+
    '<button type="button" class="eg-search-trigger" data-action="search-open" aria-label="'+t('Cerca attività e azioni')+'">'+
      '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg><span>'+t('Cerca')+'</span></button>'+
    '<button class="ghost" data-action="refresh">'+t('Ricarica')+'</button></div></div>'+
    '<nav class="eg-main-nav" aria-label="'+t('Sezioni')+'">'+
      '<button data-action="view" data-view="home" '+(currentView==='home'?'aria-current="page" ':'')+'class="'+(currentView==='home'?'active':'')+'">'+egNavIcon('home')+'<span>'+t('Home')+'</span></button>'+
      '<button data-action="eod-new" '+(currentView==='eod'?'aria-current="page" ':'')+'class="'+(currentView==='eod'?'active':'')+'">'+egNavIcon('leaf')+'<span>'+t('Fine giornata')+'</span></button>'+
      '<button data-action="view" data-view="calendar-hours" '+(['calendar','calendar-hours'].includes(currentView)?'aria-current="page" ':'')+'class="'+(['calendar','calendar-hours'].includes(currentView)?'active':'')+'">'+egNavIcon('calendar')+'<span>'+t('Calendario')+'</span></button>'+
      '<button data-action="view" data-view="reports" '+(['reports','report-detail'].includes(currentView)?'aria-current="page" ':'')+'class="'+(['reports','report-detail'].includes(currentView)?'active':'')+'">'+egNavIcon('reports')+'<span>'+t('Rapporti')+'</span></button>'+
      '<button data-action="toggle-menu" aria-expanded="'+menuOpen+'" class="'+(menuOpen?'active':'')+'">'+egNavIcon('menu')+'<span>'+t('Menu')+'</span></button></nav>'+
    (menuOpen?'<nav class="eg-extra-nav" aria-label="'+t('Altre sezioni')+'">'+
      '<button data-action="view" data-view="tasks">'+t('Compiti')+'</button>'+
      '<button data-action="view" data-view="clock">'+t('Timbrature')+'</button>'+ 
      '<button data-action="view" data-view="calendar-hours">'+t('Calendario orari')+'</button>'+ 
      '<button data-action="view" data-view="calendar">'+t('Calendario orari e rapporti')+'</button>'+
      (memberIsOwner()?'<button data-action="view" data-view="clients">'+t('Clienti e cantieri')+'</button>'+
      '<button data-action="view" data-view="team">'+t('La tua squadra')+'</button>'+
      '<button data-action="view" data-view="materials">'+t('Catalogo materiali')+'</button>'+
      '<button data-action="view" data-view="maintenance">'+t('Manutenzioni ricorrenti')+'</button>'+
      '<button data-action="view" data-view="invoices">'+t('Bozze proforma')+'</button>'+
      '<button data-action="view" data-view="archive">'+t('Dati ed esportazione')+'</button>'+
       '<button data-action="import-open" data-kind="hours">'+(locale==='de'?'Screenshot importieren':'Importa screenshot')+'</button>':'')+
      '<button data-action="monthly-view">'+t('Resoconto mensile')+'</button>'+ 
      '<button data-action="site-history-view">'+t('Cantieri svolti')+'</button>'+
      '<div class="eg-menu-divider"><span>'+t('Impostazioni e account')+'</span></div>'+ '<button data-action="guide-open">'+t('Guida')+'</button>'+ '<button data-action="account-password">'+t('Sicurezza account')+'</button>'+ (!window.EASYGART_INSTALL?.isStandalone?.()?'<button data-action="install">'+t('Installa app')+'</button>':'')+ '<button data-action="signout">'+t('Esci')+'</button></nav>':'')+
    (currentView==='home'?homeMarkup():currentView==='eod'?(endOfDay?.markup()||''):
      currentView==='clock'?(operations?.clockMarkup()||''):currentView==='calendar-hours'?(hoursCalendar?.markup()||''):currentView==='calendar'?(calendar?.markup()||''):
      currentView==='reports'?reportsMarkup():currentView==='monthly'?(monthly?.markup()||''):currentView==='sites-history'?(siteHistory?.markup()||''):currentView==='report-detail'?reportDetailMarkup():currentView==='clients'&&memberIsOwner()?clientsMarkup():
      currentView==='import'&&memberIsOwner()?(screenshotImport?.markup()||''):
      currentView==='team'&&memberIsOwner()?teamMarkup():
      ['materials','maintenance','invoices','archive'].includes(currentView)&&memberIsOwner()?
       (business?.markup(currentView)||''):tasksMarkup())+
    (pendingReportDeletionId?reportDeletionDialogMarkup():'')+(operations?.deletionDialogMarkup()||'')+(globalSearch?.markup()||'');
  restoreSessionDrafts();
}
function authMarkup(){
  if(authMode==='forgot')return '<div class="auth-wrap"><div class="eyebrow">EasyGart Cloud</div>'+
    '<h1>'+t('Recupera password')+'</h1><div class="card stacked">'+
    '<p>'+t('Inserisci la tua email: riceverai un link per impostare una nuova password.')+'</p>'+
    '<form data-form="password-request" class="stacked">'+field('Email','email','email','','autocomplete="email" required maxlength="200"')+
    '<button class="primary" type="submit">'+t('Invia link di recupero')+'</button></form>'+
    '<button class="ghost" data-action="auth-mode" data-mode="signin">'+t('Torna all’accesso')+'</button></div></div>';
  const signup=authMode==='signup';
  return '<div class="auth-wrap"><div class="eyebrow">EasyGart Cloud</div><h1>'+t('Accesso dipendenti')+'</h1>'+
    '<p class="muted" style="margin-bottom:20px">'+t("Account individuali: i dati vengono autorizzati da Supabase.")+'</p>'+
    '<div class="card"><div class="switch"><button class="'+(!signup?'primary':'ghost')+'" data-action="auth-mode" data-mode="signin">'+t('Accedi')+'</button>'+
      '<button class="'+(signup?'primary':'ghost')+'" data-action="auth-mode" data-mode="signup">'+t('Registrati')+'</button></div>'+
    '<form data-form="auth" class="stacked">'+field('Email','email','email','','autocomplete="email" required maxlength="200"')+
    field('Password','password','password','','autocomplete="'+(signup?'new-password':'current-password')+'" minlength="'+(signup?'12':'8')+'" required')+
    (signup?'<p class="muted" style="font-size:12px;margin:2px 0 12px">'+t('Usa una password unica di almeno 12 caratteri, preferibilmente generata da un gestore password.')+'</p>':'')+
    '<button class="primary" type="submit">'+t(signup?'Crea un account':'Accedi')+'</button></form>'+ 
    (!signup?'<button class="ghost small" data-action="auth-mode" data-mode="forgot">'+t('Password dimenticata?')+'</button>':'')+
    '<p class="muted" style="font-size:12px;margin-top:18px">'+t("I dipendenti devono registrarsi con lo stesso indirizzo email inserito dal titolare nell’invito. Verifica email obbligatoria.")+'</p></div></div>';
}
function passwordResetMarkup(){
  return '<div class="auth-wrap"><div class="eyebrow">EasyGart Cloud</div>'+
    '<h1>'+t('Imposta nuova password')+'</h1><div class="card stacked">'+
    '<p>'+t('Scegli una password unica di almeno 12 caratteri.')+'</p>'+
    '<form data-form="password-update" class="stacked">'+
    field('Nuova password','password','password','','autocomplete="new-password" minlength="12" required')+
    field('Conferma nuova password','confirm_password','password','','autocomplete="new-password" minlength="12" required')+
    '<button class="primary" type="submit">'+t('Salva nuova password')+'</button></form>'+
    '<p class="muted">'+t('Per motivi di sicurezza, dopo la modifica dovrai accedere nuovamente.')+'</p>'+
    '</div></div>';
}
function onboardMarkup(){
  return '<div class="view-head"><div><div class="eyebrow">EasyGart Cloud</div><h1>'+t('Nessuna azienda collegata')+'</h1>'+
  '<p>'+t("Se sei il titolare, crea l’azienda. Se sei dipendente, conferma la tua email e accetta l’invito.")+'</p></div></div>'+
  '<div style="margin-bottom:16px"><button class="secondary small" data-action="guide-open">'+t('Apri guida')+'</button></div>'+ 
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
  return '<article class="taskrow" tabindex="-1" data-search-task="'+esc(task.id)+'"><div style="flex:1"><div class="task-title">'+esc(task.title)+'</div>'+
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
function homeMarkup(){
  const owner=memberIsOwner(),mine=dailyReports.filter(r=>owner||r.created_by===user.id);
  const pending=dailyReports.filter(r=>r.status==='submitted'&&(owner||r.created_by===user.id)).length;
  const last=mine.slice().sort((a,b)=>b.work_date.localeCompare(a.work_date)).slice(0,4);
  const todo=tasks.filter(x=>owner||x.assignee_id===user.id).filter(x=>x.status!=='done');
  const actions=[
    ['eod-new','Fine giornata','Inserisci gli orari e il cantiere'],
    ['view','Calendario orari','Consulta gli orari senza i rapporti','calendar-hours'],
    ['view','Calendario orari e rapporti','Consulta orari, lavori e cantieri','calendar'],
    ['view','Rapporti giornalieri','Consulta e modifica i rapporti','reports'],
    ['monthly-view','Resoconto mensile','Visualizza ore e attività mensili'],
    ['site-history-view','Cantieri svolti','Apri lo storico dei cantieri'],
    ['view','Compiti','Attività assegnate','tasks']
  ];
  if(owner)actions.unshift(['import-open',locale==='de'?'Screenshot importieren':'Importa screenshot',
     locale==='de'?'Zeiten und Kunden aus Notizen übernehmen':'Importa orari e clienti dalle Note']);
  return '<div class="eg-home-page"><div class="view-head"><div><h2>'+t(owner?'Panoramica azienda':'La tua giornata')+'</h2>'+
    '<p class="muted">'+t('Ogni funzione ha la sua schermata. Inizia dalla registrazione di fine giornata.')+'</p></div></div>'+
    '<div class="eg-home-actions">'+actions.map(([action,title,description,view])=>
      '<button class="eg-home-action" data-action="'+action+'"'+(view?' data-view="'+view+'"':'')+'>'+
      '<strong>'+t(title)+'</strong><span>'+t(description)+'</span><b aria-hidden="true">›</b></button>').join('')+'</div>'+
    '<div class="eg-home-summary"><div class="card metric"><span>'+t('Compiti aperti')+'</span><strong>'+todo.length+'</strong></div>'+
    '<div class="card metric"><span>'+t('Rapporti da verificare')+'</span><strong>'+pending+'</strong></div>'+
    '<div class="card metric"><span>'+t('Rapporti registrati')+'</span><strong>'+mine.length+'</strong></div></div>'+
    '<section class="card"><div class="cardhead"><h2>'+t('Ultimi rapporti')+'</h2><button class="ghost small" data-action="view" data-view="reports">'+t('Vedi tutti')+'</button></div>'+
    (last.length?last.map(r=>{
      const task=tasks.find(x=>x.id===r.task_id);
      return '<div class="taskrow"><div><strong>'+esc(getName(sites,r.site_id||task?.site_id))+'</strong>'+
       '<div class="task-meta">'+esc(displayDate(r.work_date))+' · '+esc(formatReportMinutes(r.minutes_worked))+
       (owner?' · '+esc(getWorkerName(r.created_by)):'')+'</div></div>'+
       '<button class="secondary small" data-action="view" data-view="reports">'+t('Apri')+'</button></div>';
    }).join(''):'<p class="muted">'+t('Nessun rapporto')+'</p>')+'</section></div>';
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
  const header= '<div class="view-head"><div><h2>'+t(owner?'Rapporti per dipendente':'I miei rapporti')+'</h2>'+
    '<p class="muted">'+t(owner?'Controlla quanto svolto sul campo e approva i rapporti ricevuti.':'Racconta al titolare il lavoro svolto ogni giorno.')+'</p></div>'+
    '<div class="actions"><button class="secondary" data-action="monthly-view">'+t('Resoconto mensile')+'</button>'+ '<button class="primary" data-action="eod-new">+ '+t('Nuovo rapporto')+'</button></div></div>';
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
      members.filter(m=>['worker','owner'].includes(m.role)).map(m=>option(m.user_id,m.full_name||tr('Operatore'),selectedReportWorkerId===m.user_id)).join('')+'</select></label>':'')+
    '</div></div>';
  const grouped=owner? [...new Set(visible.map(r=>r.created_by))].map(uid=>{
    const rows=visible.filter(r=>r.created_by===uid);
    return '<section class="card eg-owner-report-group"><div class="cardhead"><div><div class="eyebrow">'+t('Dipendente')+'</div>'+
      '<h3>'+esc(getWorkerName(uid))+'</h3></div><span class="pill">'+rows.length+' '+t('Rapporti')+'</span></div>'+
      rows.map(r=>reportSummaryMarkup(r,true)).join('')+'</section>';
  }).join(''):''; 
  return header+counts+filters+
    '<p class="muted eg-report-help">'+t('Modifiche storiche consentite finché il rapporto non è collegato a una proforma.')+'</p>'+
    (owner?(grouped||'<div class="card"><p class="muted">'+t('Nessun rapporto')+'</p></div>'):
    '<section class="card"><div class="cardhead"><h2>'+t('Rapporti giornalieri')+'</h2><span class="pill">'+visible.length+'</span></div>'+
    (visible.length?visible.map(r=>reportSummaryMarkup(r,false)).join(''):'<p class="muted">'+t('Nessun rapporto')+'</p>')+'</section>');
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
    '<p class="muted" style="font-size:12px">'+t('Per aggiungere foto prima/dopo e firma del cliente, salva prima il rapporto come bozza.')+'</p>'+ 
    '<p class="muted" style="font-size:12px">'+t("Le indicazioni sui materiali sono un riepilogo operativo e non generano addebiti o fatture automatiche.")+'</p></div>';
}
function reportSummaryMarkup(report,owner){
  const task=tasks.find(x=>x.id===report.task_id);
  const place=getName(sites,report.site_id||task?.site_id);
  const label=task?.title||place;
  return '<div class="eg-report-list-item"><div class="eg-report-list-content">'+
    '<strong>'+esc(label)+'</strong><div class="task-meta"><span>'+esc(displayDate(report.work_date))+'</span>'+ (owner?'<span class="eg-author-tag">'+esc(getWorkerName(report.created_by))+'</span>':'')+
    '<span>'+esc(formatReportMinutes(report.minutes_worked))+'</span>'+
    (report.work_start_time&&report.work_end_time?
      '<span>'+esc(String(report.work_start_time).slice(0,5))+' – '+esc(String(report.work_end_time).slice(0,5))+'</span>':'')+
    (owner?'<span>'+esc(getWorkerName(report.created_by))+'</span>':'')+
    '<span class="pill '+(report.status==='submitted'?'amber':'')+'">'+t(reportStatusLabel(report))+'</span></div>'+
    '<p class="muted eg-report-preview">'+esc((report.work_summary||'').slice(0,130))+'</p></div>'+
    '<div class="actions"><button class="secondary small" data-action="report-open" data-id="'+esc(report.id)+'">'+t('Apri')+'</button></div></div>';
}
async function loadReportMaterialRows(id){
  const r=await client.rpc('eg_list_report_materials',{p_report_id:id});
  if(r.error)throw r.error;
  reportMaterialRows.set(id,r.data||[]);
}
function reportMaterialDetailMarkup(report){
  const materials=reportMaterialRows.get(report.id);
  return '<div class="eg-report-material-details"><h3>'+t('Materiali utilizzati')+'</h3>'+
    (materials===undefined?'<p class="muted">'+t('Caricamento materiali…')+'</p>':
      materials.length?materials.map(m=>'<div class="eg-detail-material-row"><strong>'+esc(m.material_name)+'</strong>'+
        '<span>'+esc(m.quantity)+' '+esc(m.unit)+'</span></div>').join(''):
      '<p class="muted">'+t('Nessun materiale registrato')+'</p>')+
    '</div>';
}
function canDeleteReport(report){
  return !!report && !!user && !report.deleted_at && !report.invoice_locked &&
    (memberIsOwner() || report.created_by===user.id);
}
function reportDeletionDialogMarkup(){
  const report=dailyReports.find(r=>r.id===pendingReportDeletionId);
  if(!canDeleteReport(report))return '';
  const task=tasks.find(t=>t.id===report.task_id);
  const location=getName(sites,report.site_id||task?.site_id);
  return '<div class="eg-delete-overlay">'+
    '<div class="eg-delete-dialog" role="alertdialog" aria-modal="true" '+
      'aria-labelledby="eg-delete-title" aria-describedby="eg-delete-description">'+
    '<div class="eg-delete-icon" aria-hidden="true">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '+
       'stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>'+
    '</div>'+
    '<h2 id="eg-delete-title">'+t('Conferma eliminazione')+'</h2>'+
    '<p id="eg-delete-description">'+t('Vuoi eliminare questo rapporto?')+'</p>'+
    '<div class="eg-delete-report-summary"><strong>'+esc(location)+'</strong>'+
      '<span>'+esc(displayDate(report.work_date))+' · '+esc(getWorkerName(report.created_by))+'</span>'+
    '</div>'+
    '<p class="eg-delete-explanation">'+
      t('Il rapporto scomparirà da rapporti, calendario, riepilogi mensili e storico cantieri. Resterà una traccia interna della cancellazione.')+'</p>'+
    '<div class="eg-delete-actions">'+
     '<button class="ghost" type="button" data-action="report-delete-cancel">'+t('Annulla')+'</button>'+
     '<button class="eg-danger-solid" type="button" data-action="report-delete-confirm">'+t('Elimina definitivamente dalla vista')+'</button>'+
    '</div></div></div>';
}
function reportDetailMarkup(){
  const report=dailyReports.find(r=>r.id===selectedReportId);
  if(!report)return '<div class="alert warn">'+t('Rapporto non trovato')+'</div>';
  return '<div class="view-head"><div><h2>'+t('Dettaglio rapporto')+'</h2>'+
    '<p class="muted">'+esc(displayDate(report.work_date))+' · '+esc(formatReportMinutes(report.minutes_worked))+'</p></div>'+
    '<button class="ghost" data-action="report-back">'+t(reportReturnView==='monthly'?'Resoconto mensile':
      reportReturnView==='calendar'?'Calendario orari e rapporti':reportReturnView==='calendar-hours'?'Calendario orari':
      reportReturnView==='sites-history'?'Cantieri svolti':'Torna ai rapporti')+'</button></div>'+
    '<section class="card">'+reportCardMarkup(report,memberIsOwner())+'</section>';
}
function reportCardMarkup(report,owner){
  const task=tasks.find(x=>x.id===report.task_id);
  const isPending=report.status==='submitted';
  const tone=isPending?'amber':report.status==='changes_requested'?'red':'';
  const title=task?.title||getName(sites,report.site_id)||tr('Intervento');
  return '<article class="taskrow"><div style="flex:1;min-width:180px">'+
    '<div class="task-title">'+esc(title)+'</div>'+ '<div class="eg-report-author">'+t('Dipendente')+': <strong>'+esc(getWorkerName(report.created_by))+'</strong></div>'+
    '<div class="task-meta"><span>'+esc(displayDate(report.work_date))+'</span>'+
    (owner?'<span>'+esc(getWorkerName(report.created_by))+'</span>':'')+
    '<span>'+esc(formatReportMinutes(report.minutes_worked))+'</span>'+
    (report.work_start_time&&report.work_end_time?
      '<span>'+esc(String(report.work_start_time).slice(0,5))+' – '+esc(String(report.work_end_time).slice(0,5))+'</span>':'')+
    '<span>'+esc(getName(clients,task?.client_id))+'</span>'+
    '<span>'+esc(getName(sites,report.site_id||task?.site_id))+'</span></div>'+
    '<p class="task-note">'+esc(report.work_summary||tr('Descrizione non ancora compilata'))+'</p>'+
    (report.materials_used?'<p class="task-note"><strong>'+t('Materiali utilizzati')+': </strong>'+esc(report.materials_used)+'</p>':'')+
    (report.issues?'<p class="task-note"><strong>'+t('Problemi e imprevisti')+': </strong>'+esc(report.issues)+'</p>':'')+
    (report.manager_feedback?'<div class="alert warn" style="margin-top:12px"><strong>'+t('Feedback del titolare')+': </strong>'+esc(report.manager_feedback)+'</div>':'')+
    (operations?operations.mediaMarkup(report):'')+
    reportMaterialDetailMarkup(report)+
    (owner&&isPending?'<form data-form="daily-review" class="stacked" style="margin-top:16px">'+
      '<input type="hidden" name="report_id" value="'+esc(report.id)+'">'+
      '<label class="field"><span>'+t('Feedback del titolare')+'</span><textarea name="feedback" rows="2" maxlength="4000" placeholder="'+t("Motivo di eventuali correzioni o indicazioni operative")+'"></textarea></label>'+
      '<div class="actions"><button class="primary small" type="submit" value="approved">'+t('Approva')+'</button>'+
      '<button class="ghost small" type="submit" value="changes_requested">'+t('Richiedi correzioni')+'</button></div></form>':'')+
    '<div class="eg-report-detail-actions">'+
    (endOfDay?.canEdit(report)?'<button class="secondary small" data-action="report-edit" data-id="'+esc(report.id)+'">'+t('Modifica')+'</button>':'')+
    (canDeleteReport(report)?'<button class="eg-danger-outline small" data-action="report-delete-open" data-id="'+esc(report.id)+'">'+t('Elimina rapporto')+'</button>':'')+
    '</div>'+
    '</div><div class="task-right"><span class="pill '+tone+'">'+t(reportStatusLabel(report))+'</span></div></article>';
}

function clientsMarkup(){
  const editingClient=clients.find(c=>c.id===editingClientId)||null;
  const editingSite=sites.find(s=>s.id===editingSiteId)||null;
  const tr2=(it,de)=>locale==='de'?de:it;
  const clientForm='<div class="card stacked"><div class="cardhead"><h2>'+
    (editingClient?tr2('Modifica cliente','Kunde bearbeiten'):t('Nuovo cliente'))+'</h2>'+
    '<button type="button" class="secondary small" data-action="import-open" data-kind="clients">'+
      tr2('Da screenshot','Aus Screenshot')+'</button></div>'+
    '<form data-form="client" class="stacked">'+
    field('Nome cliente','name','text',editingClient?.name||'','required maxlength="150"')+
    (clientContactsReady?
      field(tr2('Telefono','Telefon'),'phone','tel',editingClient?.phone||'','maxlength="80"')+
      field('Email','email','email',editingClient?.email||'','maxlength="200"')+
      field(tr2('Indirizzo','Adresse'),'address','text',editingClient?.address||'','maxlength="300"'):'')+
    '<label class="field"><span>'+tr2('Note','Notizen')+'</span><textarea name="notes" maxlength="4000" rows="3">'+
      esc(editingClient?.notes||'')+'</textarea></label>'+
    '<div class="actions"><button type="submit" class="primary">'+
      (editingClient?tr2('Salva modifiche','Änderungen speichern'):t('Nuovo cliente'))+'</button>'+
      (editingClient?'<button type="button" class="ghost" data-action="cancel-client-edit">'+
        tr2('Annulla','Abbrechen')+'</button>':'')+'</div></form>'+
    '<h3>'+t('Elenco clienti')+'</h3>'+
    (clients.length?clients.map(c=>
      '<div class="eg-entity-item" tabindex="-1" data-search-client="'+esc(c.id)+'"><div><strong>'+esc(c.name)+'</strong>'+
      (clientContactsReady&&[c.phone,c.email,c.address].some(Boolean)?
        '<small class="muted" style="display:block">'+esc([c.phone,c.email,c.address].filter(Boolean).join(' · '))+'</small>':'')+
      (c.notes?'<small class="muted" style="display:block;white-space:pre-wrap">'+esc(c.notes)+'</small>':'')+
      '</div><button type="button" class="secondary small" data-action="edit-client" data-id="'+esc(c.id)+'">'+
      tr2('Modifica','Bearbeiten')+'</button></div>').join(''):'<p class="muted">'+t('Nessun cliente')+'</p>')+
    '</div>';
  const siteForm='<div class="card stacked"><h2>'+
    (editingSite?tr2('Modifica cantiere','Einsatzort bearbeiten'):t('Nuovo cantiere'))+'</h2>'+
    '<form data-form="site" class="stacked">'+
    select('Cliente','client_id',clients.map(c=>option(c.id,c.name,c.id===(editingSite?.client_id||clients[0]?.id))).join(''),'required')+
    field('Cantiere','name','text',editingSite?.name||'','required maxlength="150"')+
    field('Indirizzo','address','text',editingSite?.address||'','maxlength="500"')+
    '<div class="actions"><button type="submit" class="primary" '+(!clients.length?'disabled':'')+'>'+
      (editingSite?tr2('Salva modifiche','Änderungen speichern'):t('Nuovo cantiere'))+'</button>'+
      (editingSite?'<button type="button" class="ghost" data-action="cancel-site-edit">'+
        tr2('Annulla','Abbrechen')+'</button>':'')+'</div></form>'+
    '<h3>'+t('Cantieri')+'</h3>'+
    (sites.length?sites.map(site=>
      '<div class="eg-entity-item"><div><strong>'+esc(site.name)+'</strong>'+
      '<small class="muted" style="display:block">'+esc(getName(clients,site.client_id))+
      (site.address?' · '+esc(site.address):'')+'</small></div>'+
      '<div class="actions"><button type="button" class="secondary small" data-action="open-site-reports" data-id="'+esc(site.id)+'">'+
      tr2('Rapporti','Berichte')+'</button>'+
      '<button type="button" class="ghost small" data-action="edit-site" data-id="'+esc(site.id)+'">'+
      tr2('Modifica','Bearbeiten')+'</button></div></div>').join(''):'<p class="muted">'+t('Nessun cantiere')+'</p>')+'</div>';
  return '<div class="view-head"><h2>'+t('Clienti e cantieri')+'</h2></div><div class="two">'+
    clientForm+siteForm+'</div>';
}
function teamMarkup(){
  const delegateIds=new Set(adminDelegations.map(x=>x.user_id));
  const canDelegate=memberIsPrimaryOwner();
  const warning=!adminDelegationReady&&canDelegate?
    '<p class="alert warn">'+(locale==='de'?'Die Admin-Delegation muss zunächst in der EasyGart-Datenbank aktiviert werden.':
       'La delega amministrativa richiede prima la migrazione nel database EasyGart.')+
    ' <a target="_blank" rel="noopener noreferrer" href="https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_admin_delegation_site_reports_v1.sql">'+
    (locale==='de'?'SQL öffnen':'Apri SQL')+'</a></p>':'';
  const explanation=locale==='de'?
    'Der Inhaber kann einem Mitarbeiter den gesamten Verwaltungszugriff geben oder entziehen. Der Mitarbeiter nutzt weiterhin sein eigenes Konto und kann seine Zeiten erfassen. Nur der ursprüngliche Inhaber verwaltet diese Delegation.':
    'Il titolare può concedere o revocare i permessi di gestione a un dipendente. Il dipendente conserva il proprio account e può continuare a timbrare. Solo il titolare originale gestisce la delega.';
  const companySettings='<section class="card stacked" style="margin-bottom:16px">'+
    '<h3>'+(locale==='de'?'Firmeneinstellungen':'Impostazioni azienda')+'</h3>'+
    '<form data-form="company-settings" class="stacked">'+
    field('Nome azienda','name','text',company()?.name||'','required minlength="2" maxlength="150"')+
    '<button type="submit" class="secondary">'+(locale==='de'?'Firmenname speichern':'Salva nome azienda')+
    '</button></form></section>';
  return '<div class="view-head"><h2>'+t('Squadra e inviti')+'</h2></div>'+
    companySettings+'<div class="two">'+
    '<div class="card stacked"><h2>'+t('Invita dipendente')+'</h2><p class="muted">'+t("Inserisci l’email del lavoratore. Condividi il link del portale: l’invito sarà associato alla sua email verificata.")+'</p>'+
    '<form data-form="invite" class="stacked">'+field('Email','email','email','','required maxlength="200"')+
    '<button type="submit" class="primary">'+t('Invia invito')+'</button></form>'+
    '<p class="muted" style="font-size:12px">'+t('Link di accesso:')+' '+esc(location.origin+location.pathname)+'</p></div>'+
    '<div class="card stacked"><h2>'+t('La tua squadra')+'</h2>'+
    '<p class="muted">'+explanation+'</p>'+warning+
    (members.length?members.map(m=>{
      const delegated=delegateIds.has(m.user_id);
      const roleText=m.role==='owner'?t('Titolare'):delegated?
        (locale==='de'?'Mitarbeiter · Admin':'Dipendente · Admin'):t('Dipendente');
      const privilegeButton=canDelegate&&adminDelegationReady&&m.role==='worker'?
        '<button type="button" class="'+(delegated?'ghost':'secondary')+' small" data-action="member-admin" data-user="'+esc(m.user_id)+'" data-enable="'+(!delegated)+'"'+(!m.active?' disabled':'')+'>'+
         (delegated?(locale==='de'?'Admin entziehen':'Revoca admin'):(locale==='de'?'Admin zuweisen':'Concedi admin'))+'</button>':'';
      return '<div class="taskrow"><div><strong>'+esc(m.full_name||'—')+'</strong>'+
        '<p class="muted">'+roleText+'</p></div><div class="actions">'+
        '<span class="pill">'+t(m.active?'Attivo':'Disattivato')+'</span>'+
        privilegeButton+
        (m.role==='worker'&&m.user_id!==user?.id?
          '<button class="ghost small" data-action="member-active" data-user="'+esc(m.user_id)+'" data-active="'+(!m.active)+'">'+
            t(m.active?'Disattiva':'Riattiva')+'</button>':'')+
        '</div></div>';
    }).join(''):'<p>'+t('Nessun dipendente')+'</p>')+
    '<h3>'+t('Inviti in attesa')+'</h3>'+
    (invites.filter(i=>!i.claimed_at).length?invites.filter(i=>!i.claimed_at).map(i=>
      '<p>'+esc(i.email)+' · <small>'+esc(displayDate(i.expires_at?.slice(0,10)))+'</small></p>').join(''):
      '<p class="muted">'+t('Nessun invito')+'</p>')+'</div></div>';
}
async function refresh() {
  if(!client||!user)return;
  const list=requireSuccess(await client.from('eg_members').select('company_id,user_id,full_name,role,active').eq('user_id',user.id).eq('active',true));
  memberships=list||[];
  if(!memberships.length) {companies=[];members=[];clients=[];sites=[];tasks=[];invites=[];dailyReports=[];reportsReady=false;reportMaterialRows.clear();endOfDay?.reset();operations?.reset();calendar?.reset();hoursCalendar?.reset();business?.reset();render();return}
  const cids=memberships.map(x=>x.company_id);
  companies=requireSuccess(await client.from('eg_companies').select('id,name').in('id',cids))||[];
  if(!cids.includes(selectedCompanyId))selectedCompanyId=cids[0];
  const org=selectedCompanyId;
  // Check delegation for this user BEFORE owner-only queries.
  const delegationResponse=await client.from('eg_admin_delegations')
    .select('company_id,user_id,granted_at').eq('company_id',org);
  adminDelegationReady=!delegationResponse.error;
  adminDelegations=adminDelegationReady?delegationResponse.data||[]:[];
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
  const contactResponse=owner?await client.from('eg_clients')
    .select('id,company_id,name,phone,email,address,notes').eq('company_id',org):null;
  clientContactsReady=!!contactResponse&&!contactResponse.error;
  if(clientContactsReady)clients=contactResponse.data||[];
  else if(owner){
    // Legacy schema: notes is available even before the optional contact-fields migration.
    const notesResponse=await client.from('eg_clients').select('id,notes').eq('company_id',org);
    if(!notesResponse.error){
      const byId=new Map((notesResponse.data||[]).map(x=>[x.id,x.notes||'']));
      clients=clients.map(x=>({...x,notes:byId.get(x.id)||''}));
    }
  }
  invites=owner?(results[4]?.data||[]):[];
  // La migrazione dei rapporti può non essere ancora installata: non bloccare gli altri moduli.
  const reportResponse = await client.from('eg_daily_reports').select('*')
    .eq('company_id',org).order('work_date',{ascending:false}).limit(250);
  if(reportResponse.error) {
    reportsReady=false;dailyReports=[];reportsSetupError=reportResponse.error.message||'Tabelle rapporti non disponibili';
  } else {
    reportsReady=true;reportsSetupError='';dailyReports=reportResponse.data||[];
    // Un rapporto storico aperto dal resoconto non deve sparire al refresh.
    if(selectedReportId && currentView==='report-detail' &&
       !dailyReports.some(r=>r.id===selectedReportId)){
      const pinned=await client.from('eg_daily_reports').select('*')
        .eq('company_id',org).eq('id',selectedReportId).maybeSingle();
      if(!pinned.error&&pinned.data)dailyReports.push(pinned.data);
    }
  }
  await operations?.refresh(org);
  await calendar?.refresh(org);
  if(currentView==='calendar-hours')await hoursCalendar?.refresh(org);
  const created=await business?.refresh(org);
  if(created>0){
    const newTasks=requireSuccess(await client.from('eg_tasks').select('*').eq('company_id',org));
    tasks=newTasks||[];
  }
  if(!owner&&!['home','eod','tasks','reports','report-detail','clock','calendar','calendar-hours','monthly','sites-history'].includes(currentView))currentView='home';
  render();
}
async function onAuth(form){
  const vals=Object.fromEntries(new FormData(form));
  const email=String(vals.email||'').trim().toLowerCase(),password=String(vals.password||'');
  if(authMode==='signup'){
    if(password.length<12)throw Error('Per registrarti usa almeno 12 caratteri per la password.');
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
  if(form.dataset.form==='eod-report')return endOfDay.submit(form,formAction==='send');
  if(form.dataset.form==='ops-signature')return operations?.saveSignature(form);
  if(form.dataset.form?.startsWith('biz-'))return business?.handleSubmit(form,formAction);
  const vals=Object.fromEntries(new FormData(form));
  switch(form.dataset.form){
    case 'auth':await onAuth(form);break;
    case 'password-request':{
      const email=String(vals.email||'').trim().toLowerCase();
      if(!email)throw Error('Email obbligatoria.');
      requireSuccess(await client.auth.resetPasswordForEmail(email,{
        redirectTo:location.origin+'/cloud/'
      }));
      authMode='signin';
      success('Se l’indirizzo è registrato, riceverai un’email con le istruzioni per recuperare la password.');
      break;
    }
    case 'password-update':{
      if(!user?.id)throw Error('Sessione scaduta. Esci e accedi di nuovo prima di creare l’azienda.');
      const password=String(vals.password||''),confirm=String(vals.confirm_password||'');
      if(password.length<12)throw Error('La password deve contenere almeno 12 caratteri.');
      if(password!==confirm)throw Error('Le due password non coincidono.');
      requireSuccess(await client.auth.updateUser({password}));
      requireSuccess(await client.auth.signOut({scope:'global'}));
      user=null;memberships=[];companies=[];members=[];clients=[];sites=[];tasks=[];dailyReports=[];
      reportsReady=false;operations?.reset();calendar?.reset();hoursCalendar?.reset();business?.reset();
      authMode='signin';recoveryLinkOpened=false;
      const print=$('eg-print-zone');if(print)print.textContent='';
      success('Password aggiornata. Accedi di nuovo con la nuova password.');
      break;
    }
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
    case 'company-settings':{
      if(!memberIsOwner())throw Error('Permesso negato');
      const name=String(vals.name||'').trim();
      if(name.length<2||name.length>150)throw Error(locale==='de'?'Ungültiger Firmenname.':'Nome azienda non valido.');
      requireSuccess(await client.from('eg_companies').update({name})
        .eq('id',selectedCompanyId).select('id').single());
      await refresh();break;
    }
    case 'client':{
      if(!memberIsOwner())throw Error('Permesso negato');
      const name=String(vals.name||'').trim(),notes=String(vals.notes||'').trim();
      if(name.length<2||name.length>150||notes.length>4000)throw Error(tr('Nome o note non validi.'));
      const payload={name,notes};
      if(clientContactsReady){
        payload.phone=String(vals.phone||'').trim().slice(0,80);
        payload.email=String(vals.email||'').trim().slice(0,200);
        payload.address=String(vals.address||'').trim().slice(0,300);
      }
      const exists=clients.some(c=>c.id!==editingClientId&&
        c.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase());
      if(exists)throw Error(locale==='de'?'Kunde bereits vorhanden.':'Cliente già presente.');
      if(editingClientId){
        if(!clients.some(c=>c.id===editingClientId))throw Error('Cliente non trovato');
        requireSuccess(await client.from('eg_clients').update(payload)
          .eq('company_id',selectedCompanyId).eq('id',editingClientId).select('id').single());
        editingClientId=null;
      }else{
        requireSuccess(await client.from('eg_clients').insert({...payload,company_id:selectedCompanyId}).select('id').single());
      }
      await refresh();break;
    }
    case 'site':{
      if(!memberIsOwner())throw Error('Permesso negato');
      const customer=clients.find(c=>c.id===vals.client_id);
      const name=String(vals.name||'').trim(),address=String(vals.address||'').trim();
      if(!customer||name.length<2||name.length>150||address.length>500)throw Error('Dati cantiere non validi');
      const payload={client_id:customer.id,name,address};
      if(editingSiteId){
        const old=sites.find(s=>s.id===editingSiteId);
        if(!old)throw Error('Cantiere non trovato');
        if(old.client_id!==payload.client_id&&tasks.some(t=>t.site_id===old.id)){
          throw Error(locale==='de'?'Einsatzort mit zugewiesenen Aufgaben kann nicht zu einem anderen Kunden verschoben werden. Name und Adresse können bearbeitet werden.':
            'Il cantiere ha attività collegate: per ora puoi modificarne nome e indirizzo, ma non spostarlo a un altro cliente.');
        }
        requireSuccess(await client.from('eg_sites').update(payload)
          .eq('company_id',selectedCompanyId).eq('id',editingSiteId).select('id').single());
        editingSiteId=null;
      }else{
        requireSuccess(await client.from('eg_sites').insert({...payload,company_id:selectedCompanyId}).select('id').single());
      }
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
    siteHistory = window.createEasyGartSiteHistory({client,esc,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),members,sites,clients,tasks,locale})});
    monthly = window.createEasyGartMonthly({client,esc,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),members,sites,clients,tasks,locale})});
    endOfDay = window.createEasyGartEndOfDay({client,esc,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),
        members,sites,clients,tasks,reports:dailyReports,locale,
        onSaved:async send=>{
          const backToMonth=editingFromMonthly,backToSite=editingFromSite,backToCalendar=editingFromCalendar;
          editingFromMonthly=false;editingFromSite=false;editingFromCalendar=null;menuOpen=false;
          currentView=backToCalendar|| (backToSite?'sites-history':backToMonth?'monthly':'reports');
          await refresh();
          if(backToMonth)await monthly?.refresh(selectedCompanyId);
          if(backToSite)await siteHistory?.refresh(selectedCompanyId);
          if(backToCalendar==='calendar-hours')await hoursCalendar?.refresh(selectedCompanyId);
          notice=send?'Rapporto inviato al titolare.':'Modifiche salvate.';
          errorNotice=false;render();
        }})
    });
    screenshotImport = window.createEasyGartImport({
      client,esc,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),
        locale,members,sites,clients,reports:dailyReports}),
      onImported:async()=>{
        await refresh();
        if(currentView==='import'){notice='';errorNotice=false}
      },
      rerender:render
    });
    globalSearch = window.createEasyGartSearch({
      esc,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),
        locale,tasks,sites,clients,members,reports:dailyReports})
    });
    operations = window.createEasyGartOperations({
      client,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),
        isWorker:memberships.some(m=>m.company_id===selectedCompanyId&&m.user_id===user?.id&&m.role==='worker'&&m.active),
        members,sites,tasks,reports:dailyReports,locale,reload:refresh}),
      t,tr,esc,onSuccess:success,rerender:render
    });
    calendar = window.createEasyGartCalendar({client,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),members,sites,tasks,locale}),
      esc,rerender:render,mode:'work'
    });
    hoursCalendar = window.createEasyGartCalendar({client,
      getContext:()=>({companyId:selectedCompanyId,user,isOwner:memberIsOwner(),members,sites,tasks,locale}),
      esc,rerender:render,mode:'hours'
    });
    business = window.createEasyGartBusiness({
      client,
      getContext:()=>({companyId:selectedCompanyId,companyName:company()?.name||'EasyGart',
        user,isOwner:memberIsOwner(),members,clients,sites,tasks,reports:dailyReports,locale,reload:refresh}),
      t,tr,esc,onSuccess:success,rerender:render
    });
    const r=await client.auth.getUser();
    if(r.error&&r.error.status!==400)throw r.error;
    user=r.data?.user||null;
    if(user){
      if(recoveryLinkOpened){authMode='reset';recoveryLinkOpened=false;render()}
      else await refresh();
    }else{recoveryLinkOpened=false;render()}
    client.auth.onAuthStateChange((ev,session)=>{
      if(ev==='PASSWORD_RECOVERY'){
        user=session?.user||user;
        if(user){authMode='reset';recoveryLinkOpened=false;render()}
        return;
      }
      if(!['SIGNED_IN','SIGNED_OUT'].includes(ev))return;
      setTimeout(async()=>{ try{
        user=session?.user||null;
        if(!user){pendingReportDeletionId=null;memberships=[];companies=[];tasks=[];dailyReports=[];reportsReady=false;reportMaterialRows.clear();endOfDay?.reset();monthly?.reset();siteHistory?.reset();operations?.reset();calendar?.reset();hoursCalendar?.reset();business?.reset();const print=$('eg-print-zone');if(print)print.textContent='';render()}else await refresh();
      }catch(e){fail(e)} },0);
    });
    setInterval(()=>{
      const formFocused=!!document.activeElement?.closest?.('form');
      // Non cancellare i campi di un rapporto, di un compito o di un modulo mentre si scrive.
      if(user && authMode!=='reset' && document.visibilityState==='visible' && navigator.onLine!==false && !busy && !formFocused &&
         reportEditingId===null && editingTaskId===null && !operations?.isSigning?.() &&
         !business?.hasOpenForm?.() && currentView!=='eod')refresh().catch(fail);
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
        .filter(input=>input.name&&input.type!=='file'&&input.type!=='password')
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
      if(!element||element.type==='file'||element.type==='password')continue;
      if(field.type==='checkbox'||field.type==='radio')element.checked=field.checked;
      else element.value=field.value;
    }
  }
}
function renderPreservingForms(){
  const drafts=captureEditableForms();
  const signature=operations?.captureSignature?.();
  render();
  restoreEditableForms(drafts);
  operations?.restoreSignature?.(signature);
}
async function openSearchResult(item){
  if(!user||!selectedCompanyId||!item) return;
  menuOpen=false;
  editingTaskId=null;reportEditingId=null;pendingReportDeletionId=null;
  const getTarget = () => document.querySelector('[data-search-task="'+item.entityId+'"]');
  let focusSelector='';
  if(item.kind==='task'){
    if(!tasks.some(task=>task.id===item.entityId&&(memberIsOwner()||task.assignee_id===user.id)))return;
    selectedWorkerId='all';currentView='tasks';
  }else if(item.kind==='report'){
    const report=dailyReports.find(r=>r.id===item.entityId);
    if(!report||(!memberIsOwner()&&report.created_by!==user.id))return;
    await loadReportMaterialRows(report.id);
    selectedReportId=report.id;reportReturnView='reports';currentView='report-detail';
  }else if(item.kind==='site'){
    if(!sites.some(site=>site.id===item.entityId))return;
    siteHistory?.choosePerson('all');
    await siteHistory?.refresh(selectedCompanyId);
    siteHistory?.open(item.entityId);currentView='sites-history';
  }else if(item.kind==='client'){
    if(!memberIsOwner()||!clients.some(c=>c.id===item.entityId))return;
    currentView='clients';focusSelector='[data-search-client="'+item.entityId+'"]';
  }else if(item.kind==='command'){
    const allowed=new Set(['home','eod','tasks','clock','calendar','calendar-hours','reports','monthly','sites-history']);
    const ownerOnly=new Set(['clients','team','materials','maintenance','invoices','archive']);
    const op=item.op||'view';
    if(op==='guide'){window.EASYGART_GUIDE?.open?.();return}
    if(op==='new-report'){
      if(!reportsReady)return;
      editingFromMonthly=false;editingFromSite=false;editingFromCalendar=null;
      await endOfDay?.prepareOpen(null);currentView='eod';
    }else{
      if(!allowed.has(item.view)&&!(memberIsOwner()&&ownerOnly.has(item.view)))return;
      currentView=item.view;
      if(op==='new-task'){
        if(!memberIsOwner())return;
        editingTaskId='new';selectedWorkerId='all';
        focusSelector='form[data-form="task"] input[name="title"]';
      }
      if(op==='new-client'&&memberIsOwner())focusSelector='form[data-form="client"] input[name="name"]';
      if(op==='new-site'&&memberIsOwner())focusSelector='form[data-form="site"] input[name="name"]';
      if(op==='invite'&&memberIsOwner())focusSelector='form[data-form="invite"] input[name="email"]';
      if(item.view==='calendar')await calendar?.refresh(selectedCompanyId);
      if(item.view==='calendar-hours')await hoursCalendar?.refresh(selectedCompanyId);
      if(item.view==='monthly')await monthly?.refresh(selectedCompanyId);
      if(item.view==='sites-history'){siteHistory?.back();await siteHistory?.refresh(selectedCompanyId)}
    }
  }else return;
  render();
  if(item.kind==='task'){const target=getTarget();target?.scrollIntoView?.({behavior:'smooth',block:'center'});target?.focus?.({preventScroll:true})}
  else if(focusSelector){
    const target=document.querySelector(focusSelector);
    target?.scrollIntoView?.({behavior:'smooth',block:'center'});
    if(target?.matches?.('input')||item.kind==='client')target?.focus?.({preventScroll:true});
  }else window.scrollTo?.({top:0,behavior:'instant'});
}
document.addEventListener('submit',e=>{
  const form=e.target.closest('form[data-form]');
  if(!form)return;
  e.preventDefault();
  const key=draftKeyForForm(form);
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
    saveSessionDraft(form);
    fail({message:'Connessione assente. Riprova quando torni online: i testi del modulo sono conservati in questa sessione.'});
    return;
  }
  withBusy(async()=>{await submitForm(form,e.submitter?.value||'draft');clearDraftKey(key)});
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(!b)return;
  const a=b.dataset.action;
  if(a==='import-open'){
    if(!memberIsOwner())return;
    if(screenshotImport?.open(b.dataset.kind||'hours')){
      importReturnView=currentView;
      currentView='import';menuOpen=false;render();
      window.scrollTo?.({top:0,behavior:'instant'});
    }
    return;
  }
  if(a==='import-close'){
    currentView=['calendar','calendar-hours','clients','home'].includes(importReturnView)?importReturnView:'home';
    importReturnView='home';screenshotImport?.reset();render();return
  }
  if(a==='import-kind'){if(memberIsOwner()){screenshotImport?.setMode(b.dataset.kind);render()}return}
  if(a==='import-analyse'){if(memberIsOwner()){screenshotImport?.analyse();render()}return}
  if(a==='import-add-row'){if(memberIsOwner()){screenshotImport?.addRow();render()}return}
  if(a==='import-save'){
    if(memberIsOwner())withBusy(()=>screenshotImport?.save());
    return;
  }
  if(a==='search-open'){
    if(globalSearch?.open()){
      renderPreservingForms();
      document.getElementById('eg-search-input')?.focus?.();
    }
    return;
  }
  if(a==='search-close'){
    globalSearch?.close();renderPreservingForms();
    document.querySelector('[data-action="search-open"]')?.focus?.();
    return;
  }
  if(a==='search-pick'){
    const item=globalSearch?.get(b.dataset.searchId);
    if(!item)return;
    globalSearch.close();renderPreservingForms();
    withBusy(()=>openSearchResult(item));return;
  }
  if(a.startsWith('cal-')){
    const activeCalendar=currentView==='calendar-hours'?hoursCalendar:calendar;
    if(a==='cal-switch'){
      const target=b.dataset.target;
      if(!['calendar','calendar-hours'].includes(target)||target===currentView)return;
      withBusy(async()=>{
        const next=target==='calendar-hours'?hoursCalendar:calendar;
        next?.setSelection(activeCalendar?.getSelection());
        await next?.refresh(selectedCompanyId);
        currentView=target;menuOpen=false;render();
      });return;
    }
    if(a==='cal-delete-shift'){withBusy(()=>operations?.openShiftDeletion(b.dataset.id));return}
    if(a==='cal-delete-report'){
      withBusy(async()=>{
        const id=b.dataset.id;
        if(!id)return;
        let report=dailyReports.find(r=>r.id===id);
        if(!report){
          const response=await client.from('eg_daily_reports').select('*')
            .eq('company_id',selectedCompanyId).eq('id',id).single();
          if(response.error)throw response.error;
          report=response.data;
          dailyReports=[report,...dailyReports.filter(r=>r.id!==id)];
        }
        if(!canDeleteReport(report))throw Error(
          locale==='de'?'Dieser Bericht kann nicht gelöscht werden.':'Non puoi eliminare questo rapporto.');
        reportReturnView=currentView;
        pendingReportDeletionId=id;
        render();
        document.querySelector?.('[data-action="report-delete-cancel"]')?.focus?.();
      });return;
    }
    if(a==='cal-edit-hours'){
      withBusy(async()=>{
        const id=b.dataset.id;
        if(!id)return;
        let report=dailyReports.find(r=>r.id===id);
        if(!report){
          const response=await client.from('eg_daily_reports').select('*')
            .eq('company_id',selectedCompanyId).eq('id',id).single();
          if(response.error)throw response.error;
          report=response.data;dailyReports=[report,...dailyReports.filter(r=>r.id!==id)];
        }
        if(!endOfDay?.canEdit(report))throw Error(
          locale==='de'?'Die Zeiten können nicht bearbeitet werden.':'Non puoi modificare questi orari.');
        const fromCalendar=currentView;
        await endOfDay.prepareOpen(id);
        editingFromCalendar=fromCalendar;editingFromMonthly=false;editingFromSite=false;
        currentView='eod';menuOpen=false;render();
        window.scrollTo?.({top:0,behavior:'instant'});
      });return;
    }
    if(a==='cal-open-report'){
      withBusy(async()=>{
        const id=b.dataset.id;
        let report=dailyReports.find(r=>r.id===id);
        if(!report){
          const response=await client.from('eg_daily_reports').select('*')
            .eq('company_id',selectedCompanyId).eq('id',id).single();
          if(response.error)throw response.error;
          report=response.data;dailyReports=[report,...dailyReports.filter(r=>r.id!==id)];
        }
        await loadReportMaterialRows(id);
        selectedReportId=id;reportReturnView=currentView;menuOpen=false;
        currentView='report-detail';render();window.scrollTo?.({top:0,behavior:'instant'});
      });return;
    }
    if(a==='cal-reports'){currentView='reports';render();return}
    if(a==='cal-monthly'){
      withBusy(async()=>{
        const selected=activeCalendar?.getMonth();
        monthly?.setMonth(selected?.year,selected?.month);
        currentView='monthly';menuOpen=false;
        await monthly?.refresh(selectedCompanyId);render();
      });return;
    }
    if(activeCalendar)withBusy(()=>activeCalendar.handleAction(b));return;
  }
  if(a.startsWith('ops-')){
    if(a==='ops-clock'&&typeof navigator!=='undefined'&&navigator.onLine===false){
      fail({message:'Connessione assente. Riprova quando torni online: i testi del modulo sono conservati in questa sessione.'});
      return;
    }
    withBusy(()=>operations?.handleAction(b));return
  }
  if(a.startsWith('biz-')){withBusy(()=>business?.handleAction(b));return}
  if(a==='install'){
    withBusy(async()=>{
      const installed=await window.EASYGART_INSTALL?.install?.();
      if(!installed){
        notice='Su iPhone apri Condividi e scegli Aggiungi alla schermata Home. Su Android usa Installa app dal menu del browser.';
        errorNotice=false;render();
      }
    });return;
  }
  if(a==='auth-mode'){
    const mode=b.dataset.mode;
    if(!user&&['signin','signup','forgot'].includes(mode)){authMode=mode;notice='';render()}
    return;
  }
  if(a==='guide-open'){window.EASYGART_GUIDE?.open?.();return}
  if(a==='account-password'){
    if(!user)return;
    authMode='reset';notice='';render();return;
  }
  if(a==='view'){
    const view=b.dataset.view;
    if(view==='calendar-hours'){
      withBusy(async()=>{
        currentView=view;menuOpen=false;selectedReportId=null;pendingReportDeletionId=null;
        endOfDay?.reset();editingTaskId=null;reportEditingId=null;
        await hoursCalendar?.refresh(selectedCompanyId);render();
        window.scrollTo?.({top:0,behavior:'instant'});
      });return;
    }
    currentView=view;menuOpen=false;selectedReportId=null;pendingReportDeletionId=null;
    endOfDay?.reset();editingTaskId=null;reportEditingId=null;
    render();window.scrollTo?.({top:0,behavior:'instant'});return;
  }
  if(a==='refresh'){withBusy(refresh);return}
  if(a==='signout'){withBusy(async()=>{clearAccountDrafts();requireSuccess(await client.auth.signOut());user=null;authMode='signin';globalSearch?.close();screenshotImport?.reset();pendingReportDeletionId=null;
  adminDelegations=[];adminDelegationReady=false;editingClientId=null;editingSiteId=null;memberships=[];dailyReports=[];reportsReady=false;reportMaterialRows.clear();endOfDay?.reset();monthly?.reset();siteHistory?.reset();operations?.reset();calendar?.reset();hoursCalendar?.reset();business?.reset();const print=$('eg-print-zone');if(print)print.textContent='';render()});return}
  if(a==='claim'){withBusy(async()=>{const n=requireSuccess(await client.rpc('eg_claim_invitations'));await refresh();if(!n)success('Nessun invito valido per questa email verificata.');});return}
  if(a==='toggle-menu'){menuOpen=!menuOpen;renderPreservingForms();return}
  if(a==='site-history-view'){
    withBusy(async()=>{siteHistory?.choosePerson('all');siteHistory?.back();
      currentView='sites-history';menuOpen=false;
      await siteHistory?.refresh(selectedCompanyId);render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='monthly-site'){
    withBusy(async()=>{siteHistory?.choosePerson(monthly?.getPerson?.()||'all');
      await siteHistory?.refresh(selectedCompanyId);siteHistory?.open(b.dataset.id);
      currentView='sites-history';menuOpen=false;render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='edit-client'&&memberIsOwner()){
    if(!clients.some(c=>c.id===b.dataset.id))return;
    editingClientId=b.dataset.id;render();
    document.querySelector('form[data-form="client"]')?.scrollIntoView?.({behavior:'smooth',block:'start'});return;
  }
  if(a==='cancel-client-edit'){editingClientId=null;render();return}
  if(a==='edit-site'&&memberIsOwner()){
    if(!sites.some(c=>c.id===b.dataset.id))return;
    editingSiteId=b.dataset.id;render();
    document.querySelector('form[data-form="site"]')?.scrollIntoView?.({behavior:'smooth',block:'start'});return;
  }
  if(a==='cancel-site-edit'){editingSiteId=null;render();return}
  if(a==='open-site-reports'){
    if(!sites.some(site=>site.id===b.dataset.id))return;
    withBusy(async()=>{
      await siteHistory?.refresh(selectedCompanyId);
      siteHistory?.open(b.dataset.id);
      currentView='sites-history';menuOpen=false;render();
      window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='site-history-open'){siteHistory?.open(b.dataset.id);render();window.scrollTo?.({top:0,behavior:'instant'});return}
  if(a==='site-history-back'){siteHistory?.back();render();return}
  if(a==='site-history-edit-report'){
    withBusy(async()=>{
      const id=b.dataset.id;
      let report=dailyReports.find(r=>r.id===id);
      if(!report){
        const response=await client.from('eg_daily_reports').select('*')
          .eq('company_id',selectedCompanyId).eq('id',id).single();
        if(response.error)throw response.error;
        report=response.data;dailyReports=[report,...dailyReports.filter(x=>x.id!==id)];
      }
      if(!endOfDay?.canEdit(report))throw Error(locale==='de'?
        'Dieser Bericht kann nicht bearbeitet werden.':'Non puoi modificare questo rapporto.');
      await endOfDay.prepareOpen(id);
      editingFromSite=true;editingFromMonthly=false;editingFromCalendar=null;
      currentView='eod';menuOpen=false;render();
      window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='site-history-open-report'){
    withBusy(async()=>{
      const id=b.dataset.id;
      let report=dailyReports.find(r=>r.id===id);
      if(!report){
        const response=await client.from('eg_daily_reports').select('*')
          .eq('company_id',selectedCompanyId).eq('id',id).single();
        if(response.error)throw response.error;
        report=response.data;dailyReports=[report,...dailyReports.filter(x=>x.id!==id)];
      }
      if(memberIsOwner()||report.created_by===user?.id){
        await loadReportMaterialRows(id);
      }else{
        try{await loadReportMaterialRows(id)}catch{reportMaterialRows.set(id,[])}
      }
      selectedReportId=id;reportReturnView='sites-history';currentView='report-detail';
      render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='monthly-view'){
    withBusy(async()=>{currentView='monthly';menuOpen=false;
      await monthly?.refresh(selectedCompanyId);render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='monthly-month'){
    withBusy(async()=>{await monthly?.monthStep(Number(b.dataset.step));render();});return;
  }
  if(a==='monthly-export'){monthly?.exportCSV();return}
  if(a==='monthly-open-report'){
    withBusy(async()=>{
      const id=b.dataset.id;
      let report=dailyReports.find(r=>r.id===id);
      if(!report){
        const response=await client.from('eg_daily_reports').select('*')
          .eq('company_id',selectedCompanyId).eq('id',id).single();
        if(response.error)throw response.error;
        report=response.data;
        dailyReports=[report,...dailyReports.filter(x=>x.id!==id)];
      }
      if(!report)return;
      await loadReportMaterialRows(report.id);
      selectedReportId=report.id;reportReturnView='monthly';
      currentView='report-detail';menuOpen=false;render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='eod-new'||a==='report-new'){
    editingFromMonthly=false;editingFromSite=false;editingFromCalendar=null;
    if(!reportsReady)return;
    withBusy(async()=>{
      await endOfDay?.prepareOpen(null);
      currentView='eod';menuOpen=false;render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='report-open'){
    const report=dailyReports.find(r=>r.id===b.dataset.id);
    if(!report)return;
    withBusy(async()=>{
      await loadReportMaterialRows(report.id);
      selectedReportId=report.id;reportReturnView='reports';
      currentView='report-detail';menuOpen=false;render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='report-back'){selectedReportId=null;pendingReportDeletionId=null;currentView=reportReturnView;render();return}
  if(a==='report-delete-open'){
    const report=dailyReports.find(r=>r.id===b.dataset.id);
    if(!canDeleteReport(report))return;
    pendingReportDeletionId=report.id;render();
    document.querySelector?.('[data-action="report-delete-cancel"]')?.focus?.();
    return;
  }
  if(a==='report-delete-cancel'){pendingReportDeletionId=null;render();return}
  if(a==='report-delete-confirm'){
    const id=pendingReportDeletionId;
    const report=dailyReports.find(r=>r.id===id);
    if(!canDeleteReport(report))return;
    pendingReportDeletionId=null;
    withBusy(async()=>{
      const response=await client.rpc('eg_delete_daily_report',{p_report_id:id});
      if(response.error)throw response.error;
      if(response.data!==true)throw Error(t('Impossibile eliminare il rapporto'));
      selectedReportId=null;reportMaterialRows.delete(id);
      endOfDay?.reset();dailyReports=dailyReports.filter(r=>r.id!==id);
      const returnTo=reportReturnView;
      currentView='reports';
      await refresh();
      if(returnTo==='monthly')await monthly?.refresh(selectedCompanyId);
      if(returnTo==='sites-history')await siteHistory?.refresh(selectedCompanyId);
      if(returnTo==='calendar-hours')await hoursCalendar?.refresh(selectedCompanyId);
      currentView=['monthly','sites-history','calendar','calendar-hours'].includes(returnTo)?returnTo:'reports';
      notice='Rapporto eliminato.';errorNotice=false;render();
      window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='report-edit'){
    if(!reportsReady||!endOfDay?.canEdit(dailyReports.find(r=>r.id===b.dataset.id)))return;
    withBusy(async()=>{
      await endOfDay?.prepareOpen(b.dataset.id);
      editingFromMonthly=reportReturnView==='monthly';
    editingFromSite=reportReturnView==='sites-history';
    editingFromCalendar=['calendar','calendar-hours'].includes(reportReturnView)?reportReturnView:null;
      currentView='eod';menuOpen=false;render();window.scrollTo?.({top:0,behavior:'instant'});
    });return;
  }
  if(a==='eod-add-material'){
    const form=b.closest('form[data-form="eod-report"]');if(!form)return;
    try{endOfDay?.addSelected(form);renderPreservingForms()}catch(err){fail(err)}return;
  }
  if(a==='eod-remove-material'){endOfDay?.removeSelected(b.dataset.id);renderPreservingForms();return}
  if(a==='eod-toggle-material'){endOfDay?.toggleNewMaterial();renderPreservingForms();return}
  if(a==='eod-create-material'){
    const form=b.closest('form[data-form="eod-report"]');if(!form)return;
    withBusy(async()=>{await endOfDay?.createMaterial(form);renderPreservingForms()});return;
  }
  if(a==='eod-back'){endOfDay?.reset();currentView=editingFromCalendar|| (editingFromSite?'sites-history':editingFromMonthly?'monthly':'reports');editingFromMonthly=false;editingFromSite=false;editingFromCalendar=null;render();return}
  if(a==='report-cancel'){reportEditingId=null;render();return}
  if(a==='new-task'){editingTaskId='new';render();document.querySelector?.('form[data-form="task"]')?.scrollIntoView?.({behavior:'smooth',block:'start'});return}
  if(a==='edit-task'){editingTaskId=b.dataset.id;render();return}
  if(a==='cancel-edit'){editingTaskId=null;render();return}
  if(a==='member-admin'){
    if(!memberIsPrimaryOwner()||!adminDelegationReady)return;
    const target=members.find(m=>m.user_id===b.dataset.user&&m.role==='worker');
    if(!target)return;
    const enable=b.dataset.enable==='true';
    const question=enable?
      (locale==='de'?'Diesem Mitarbeiter alle Verwaltungsrechte erteilen?':'Concedere a questo dipendente tutti i permessi gestionali?'):
      (locale==='de'?'Admin-Zugriff für diesen Mitarbeiter entziehen?':'Revocare i permessi amministrativi a questo dipendente?');
    if(!confirm(question))return;
    withBusy(async()=>{
      const result=await client.rpc('eg_set_admin_delegate',{
        p_company_id:selectedCompanyId,p_user_id:target.user_id,p_enable:enable
      });
      requireSuccess(result);
      await refresh();
      success(enable?(locale==='de'?'Admin-Zugriff aktiviert.':'Permessi admin concessi.'):
        (locale==='de'?'Admin-Zugriff entzogen.':'Permessi admin revocati.'));
    });return;
  }
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
document.addEventListener('input',e=>{
  if(e.target?.id==='eg-site-history-search'){
    const selection=e.target.selectionStart;
    siteHistory?.setSearch(e.target.value);
    render();
    const input=document.getElementById('eg-site-history-search');
    if(input){input.focus({preventScroll:true});input.setSelectionRange?.(selection,selection)}
    return;
  }
  if(e.target?.id==='eg-import-raw'){
    screenshotImport?.setRaw(e.target.value);
    return;
  }
  if(e.target?.dataset?.importKey&&e.target.type!=='checkbox'){
    screenshotImport?.setField(Number(e.target.dataset.importRow),e.target.dataset.importKey,e.target.value);
    return;
  }
  if(e.target?.id==='eg-search-input'){
    globalSearch?.setQuery(e.target.value);
    const area=document.getElementById('eg-search-results');
    if(area)area.innerHTML=globalSearch?.resultsMarkup()||'';
    return;
  }
  const form=e.target?.closest?.('form[data-form]');
  if(form)saveSessionDraft(form);
});
document.addEventListener('change',e=>{
  if(e.target.id==='eg-import-image'){
    if(!memberIsOwner())return;
    const chosen=e.target.files?.[0];
    if(!chosen)return;
    withBusy(async()=>{await screenshotImport?.readScreenshot(chosen);render()});
    return;
  }
  if(e.target?.dataset?.importKey==='include'){
    screenshotImport?.setField(Number(e.target.dataset.importRow),'include',e.target.checked);
    return;
  }
  if(e.target.dataset.bizClient){business?.handleChange(e.target);return}
  if(e.target.dataset.opsInput){
    if(typeof navigator!=='undefined'&&navigator.onLine===false){
      fail({message:'Connessione assente. Riprova quando torni online: i testi del modulo sono conservati in questa sessione.'});
      return;
    }
    withBusy(()=>operations?.uploadPhotos(e.target));return
  }
  if(e.target.id==='eg-calendar-worker'){(currentView==='calendar-hours'?hoursCalendar:calendar)?.handleChange(e.target);return}
  if(e.target.id==='eg-month-worker'){monthly?.chooseWorker(e.target.value);render();return}
  if(e.target.id==='eg-site-worker'){siteHistory?.choosePerson(e.target.value);render();return}
  if(['eod-site','eod-worker'].includes(e.target.id)){endOfDay?.handleChange(e.target);return}
  if(e.target.dataset.opsFilter){operations?.handleChange(e.target);return}
  if(e.target.id==='locale'){locale=e.target.value==='de'?'de':'it';try{localStorage.setItem(localeKey,locale)}catch{}renderPreservingForms();return}
  if(e.target.id==='company-select'){const print=$('eg-print-zone');if(print)print.textContent='';selectedCompanyId=e.target.value;globalSearch?.close();screenshotImport?.reset();
    adminDelegations=[];adminDelegationReady=false;editingClientId=null;editingSiteId=null;
    currentView='home';pendingReportDeletionId=null;siteHistory?.reset();reportMaterialRows.clear();endOfDay?.reset();monthly?.reset();siteHistory?.reset();menuOpen=false;selectedWorkerId='all';reportEditingId=null;selectedReportWorkerId='all';reportStatusFilter='all';withBusy(refresh);return}
  if(e.target.id==='report-status-filter'){reportStatusFilter=e.target.value;renderPreservingForms();return}
  if(e.target.id==='report-worker-filter'){selectedReportWorkerId=e.target.value;renderPreservingForms();return}
  if(e.target.id==='staff-filter'){selectedWorkerId=e.target.value;renderPreservingForms();return}
  if(e.target.id==='task-client'){
    const s=$('task-site');if(!s)return;
    s.innerHTML=option('','—')+sites.filter(x=>x.client_id===e.target.value).map(x=>option(x.id,x.name)).join('');
  }
});
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key?.toLowerCase()==='k'&&!e.altKey){
    if(!user||!memberships.length||authMode==='reset')return;
    e.preventDefault();
    if(globalSearch?.isOpen()){document.getElementById('eg-search-input')?.focus?.();return}
    if(globalSearch?.open()){renderPreservingForms();document.getElementById('eg-search-input')?.focus?.()}
    return;
  }
  if(!globalSearch?.isOpen())return;
  if(e.key==='Escape'){
    e.preventDefault();
    globalSearch.close();renderPreservingForms();
    document.querySelector('[data-action="search-open"]')?.focus?.();
  }else if(e.key==='Enter'&&e.target?.id==='eg-search-input'){
    const item=globalSearch.results()[0];
    if(!item)return;
    e.preventDefault();globalSearch.close();renderPreservingForms();
    withBusy(()=>openSearchResult(item));
  }
});
document.addEventListener('pointerdown',e=>operations?.pointerStart(e));
document.addEventListener('pointermove',e=>operations?.pointerMove(e));
document.addEventListener('pointerup',()=>operations?.pointerEnd());
document.addEventListener('pointercancel',()=>operations?.pointerEnd());
render();
boot();