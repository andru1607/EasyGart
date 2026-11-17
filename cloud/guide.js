/* EasyGart: guida interattiva bilingue, per ruolo e azienda. Nessun dato operativo viene salvato. */
(function(){
  'use strict';
  const VERSION='v1';
  const pair=(it,de)=>[it,de];
  const step=(id,view,title,intro,points)=>({id,view,title,intro,points});
  const chapters={
    setup:[
      step('welcome',null,pair('Benvenuto in EasyGart','Willkommen bei EasyGart'),
        pair('Un solo spazio per coordinare clienti, cantieri e squadra, e documentare gli interventi.','Ein gemeinsamer Ort, um Kunden, Einsatzorte und das Team zu organisieren und Einsätze zu dokumentieren.'),
        [pair('La guida si adatta al tuo ruolo e alla lingua scelta.','Die Anleitung passt sich deiner Rolle und Sprache an.'),
         pair('Puoi riaprirla in qualsiasi momento con il pulsante Guida.','Du kannst sie jederzeit über die Schaltfläche Anleitung erneut öffnen.')]),
      step('start',null,pair('Crea o raggiungi un’azienda','Betrieb anlegen oder beitreten'),
        pair('Il titolare crea lo spazio aziendale. Il dipendente accede con l’email invitata dal titolare.','Der Inhaber legt den Betrieb an. Mitarbeitende melden sich mit der eingeladenen E-Mail-Adresse an.'),
        [pair('Titolare: scegli Crea azienda e inserisci il nome.','Inhaber: Wähle Betrieb anlegen und gib den Namen ein.'),
         pair('Dipendente: verifica l’email e scegli Accetta inviti.','Mitarbeitende: Bestätige deine E-Mail und wähle Einladungen annehmen.'),
         pair('Ogni persona usa un account personale.','Jede Person verwendet ein eigenes Konto.')]),
      step('overview',null,pair('Come si svolge una giornata','So läuft ein Arbeitstag ab'),
        pair('Si crea l’incarico, si registrano le ore e le attività, si allegano prove e si controlla il risultato.','Ein Auftrag wird angelegt, Zeiten und Tätigkeiten werden erfasst, Nachweise hinzugefügt und das Ergebnis geprüft.'),
        [pair('Il titolare gestisce clienti, cantieri, squadra, materiali, manutenzioni e proforma.','Der Inhaber verwaltet Kunden, Einsatzorte, Team, Materialien, Wartungen und Proforma-Entwürfe.'),
         pair('I dipendenti consultano i compiti, timbrano e inviano rapporti con materiali, foto e firme.','Mitarbeitende sehen Aufgaben, erfassen Zeiten und senden Berichte mit Materialien, Fotos und Unterschriften.'),
         pair('Quando entrerai in azienda vedrai la guida dettagliata per il tuo ruolo.','Nach dem Beitritt siehst du die ausführliche Anleitung für deine Rolle.')])
    ],
    owner:[
      step('owner-start','tasks',pair('Il pannello del titolare','Der Bereich für den Inhaber'),
        pair('Organizza il lavoro e verifica ciò che viene registrato dalla squadra.','Organisiere die Arbeit und prüfe die Einträge deines Teams.'),
        [pair('Le sezioni sono nella barra di navigazione.','Die Bereiche findest du in der Navigation.'),
         pair('La guida può aprire direttamente la sezione descritta.','Die Anleitung kann den beschriebenen Bereich direkt öffnen.')]),
      step('clients','clients',pair('Clienti e cantieri','Kunden und Einsatzorte'),
        pair('Registra un cliente una volta sola e aggiungi tutti i giardini o luoghi di lavoro collegati.','Lege einen Kunden einmal an und füge alle zugehörigen Gärten und Einsatzorte hinzu.'),
        [pair('Apri Clienti e cantieri, crea un cliente e poi un cantiere.','Öffne Kunden und Einsatzorte, lege zuerst den Kunden und dann den Einsatzort an.'),
         pair('Il cantiere è associato al cliente e può avere un proprio indirizzo.','Der Einsatzort gehört zu einem Kunden und kann eine eigene Adresse haben.')]),
      step('team','team',pair('Squadra e inviti','Team und Einladungen'),
        pair('Invita i collaboratori usando il loro indirizzo email.','Lade Teammitglieder über ihre E-Mail-Adresse ein.'),
        [pair('Ogni collaboratore conferma l’email e accetta l’invito nel portale.','Jedes Teammitglied bestätigt seine E-Mail und nimmt die Einladung im Portal an.'),
         pair('Puoi consultare le persone attive e disattivare un accesso quando necessario.','Du kannst aktive Mitglieder sehen und einen Zugang bei Bedarf deaktivieren.'),
         pair('I dipendenti non ottengono permessi di gestione aziendale.','Mitarbeitende erhalten keine Rechte zur Betriebsverwaltung.')]),
      step('tasks','tasks',pair('Creare e assegnare compiti','Aufgaben erstellen und zuweisen'),
        pair('Ogni compito indica cosa fare, per chi, dove e quando.','Jede Aufgabe beschreibt, was für wen, wo und wann zu erledigen ist.'),
        [pair('Seleziona Assegna compito, il dipendente, il cliente, il cantiere e la data.','Wähle Aufgabe zuweisen, Mitarbeitende, Kunden, Einsatzort und Datum.'),
         pair('Aggiungi istruzioni, orario, durata indicativa e priorità quando servono.','Ergänze bei Bedarf Anweisungen, Uhrzeit, geschätzte Dauer und Priorität.'),
         pair('Controlla l’avanzamento e riapri un compito completato se occorre.','Prüfe den Fortschritt und öffne eine erledigte Aufgabe bei Bedarf erneut.')]),
      step('time','clock',pair('Presenze e pause','Arbeitszeiten und Pausen'),
        pair('Le timbrature registrano i momenti di ingresso, pausa, ripresa e uscita.','Die Zeiterfassung hält Arbeitsbeginn, Pause, Fortsetzung und Arbeitsende fest.'),
        [pair('In Timbrature vedi i turni registrati e puoi filtrarli per dipendente.','Unter Zeiterfassung siehst du die erfassten Schichten und kannst nach Mitarbeitenden filtern.'),
         pair('Gli orari vengono registrati dal server e sono un riepilogo operativo, non una busta paga.','Die Zeiten werden serverseitig erfasst und dienen als betrieblicher Überblick, nicht als Lohnabrechnung.')]),
      step('reports','reports',pair('Rapporti di intervento','Arbeitsberichte'),
        pair('I rapporti registrano i lavori e gli orari dichiarati a fine giornata, separati dalle timbrature.','Tagesberichte halten Arbeiten und manuell erfasste Zeiten getrennt von der Stempeluhr fest.'),
        [pair('Il collaboratore apre Fine giornata, sceglie il cantiere e registra inizio, fine, pause e attività.','Mitarbeitende öffnen Feierabend und erfassen Einsatzort, Beginn, Ende, Pausen und Tätigkeiten.'),
         pair('Può salvare una bozza o inviarla alla direzione.','Sie können einen Entwurf speichern oder den Bericht an die Leitung senden.'),
         pair('Dal tuo pannello consulti i rapporti ricevuti.','In deinem Bereich kannst du die eingegangenen Berichte einsehen.')]),
      step('owner-monthly','monthly',pair('Resoconto mensile','Monatsübersicht'),
        pair('Consulta tutte le attività per dipendente, mese e cantiere.','Alle Arbeiten nach Mitarbeitenden, Monat und Einsatzort anzeigen.'),
        [pair('Apri Resoconto mensile da Home, Rapporti o Menu.','Öffne die Monatsübersicht über Startseite, Berichte oder Menü.'),
         pair('Seleziona mese e dipendente per vedere rapporti, cantieri, materiali, quantità, ore e timbrature separate.','Wähle Monat und Mitarbeitenden für Berichte, Einsatzorte, Materialien, Mengen und getrennte Stunden.'),
         pair('Apri la scheda dei cantieri per consultare il dettaglio degli interventi e dei materiali; esporta il CSV se serve.','Öffne den Einsatzort für Arbeits- und Materialdetails; exportiere bei Bedarf CSV.')]),
      step('owner-sites','sites-history',pair('Archivio cantieri svolti','Archiv bearbeiteter Einsatzorte'),
        pair('Consulta per ogni cantiere chi ha lavorato, quando, per quante ore e con quali materiali.','Für jeden Einsatzort siehst du Mitarbeitende, Zeiten, Stunden und Materialien.'),
        [pair('Apri Cantieri svolti dal Menu o dal riepilogo mensile.','Öffne die bearbeiteten Einsatzorte über Menü oder Monatsübersicht.'),
         pair('Filtra per collaboratore e consulta tutte le lavorazioni registrate.','Filtere nach Mitarbeitenden und öffne den Arbeitsverlauf.')]),
      step('proof','reports',pair('Foto prima e dopo','Vorher- und Nachher-Fotos'),
        pair('Le immagini documentano il lavoro direttamente nel rapporto.','Bilder dokumentieren die Arbeiten direkt im Bericht.'),
        [pair('Si possono aggiungere fino a tre foto prima e tre foto dopo.','Es lassen sich bis zu drei Vorher- und drei Nachher-Fotos hinzufügen.'),
         pair('Le foto vengono caricate in un archivio privato, accessibile secondo i permessi.','Die Fotos werden privat gespeichert und nur nach Berechtigung angezeigt.'),
         pair('Per allegarle, il dipendente salva prima il rapporto come bozza.','Vor dem Hinzufügen speichert das Teammitglied den Bericht als Entwurf.')]),
      step('signature','reports',pair('Firma del cliente','Unterschrift des Kunden'),
        pair('Il cliente può confermare la presa visione direttamente sullo schermo.','Der Kunde kann die Kenntnisnahme direkt auf dem Bildschirm bestätigen.'),
        [pair('Si inserisce il nome del firmatario e si raccoglie il consenso.','Name und Einwilligung des Unterzeichnenden werden erfasst.'),
         pair('La firma rimane allegata al rapporto, ma non è una firma elettronica qualificata.','Die Unterschrift bleibt beim Bericht, ist aber keine qualifizierte elektronische Signatur.')]),
      step('approval','reports',pair('Controllare e approvare rapporti','Berichte prüfen und freigeben'),
        pair('La direzione verifica i dati prima di usarli per la preparazione degli addebiti.','Die Leitung kontrolliert die Angaben, bevor sie für einen Abrechnungsentwurf verwendet werden.'),
        [pair('Apri un rapporto inviato e controlla lavoro, materiale e allegati.','Öffne einen eingereichten Bericht und prüfe Arbeit, Material und Anhänge.'),
         pair('Approva il rapporto oppure richiedi correzioni con un messaggio.','Gib den Bericht frei oder fordere mit einer Nachricht Korrekturen an.')]),
      step('catalog','materials',pair('Catalogo dei materiali','Materialkatalog'),
        pair('Gestisci i materiali usati dall’azienda, con unità di misura e prezzi riservati alla direzione.','Verwalte betriebliche Materialien mit Maßeinheiten und Preisen, die der Leitung vorbehalten sind.'),
        [pair('Crea le voci del catalogo con descrizione, unità e prezzo.','Lege Katalogeinträge mit Beschreibung, Einheit und Preis an.'),
         pair('Il dipendente può registrare consumi nei rapporti senza vedere i prezzi.','Mitarbeitende können Materialverbrauch im Bericht erfassen, ohne Preise zu sehen.')]),
      step('usage','reports',pair('Consumi dei materiali','Materialverbrauch erfassen'),
        pair('Le quantità utilizzate sono collegate al rapporto di lavoro.','Verbrauchsmengen werden dem Arbeitsbericht zugeordnet.'),
        [pair('Il rapporto salva nome, unità e quantità del materiale. Se manca nel catalogo, puoi crearlo senza inserire prezzi.','Der Bericht speichert Materialname, Einheit und Menge. Fehlende Materialien lassen sich ohne Preisangabe anlegen.'),
         pair('Il titolare verifica i prezzi dei nuovi materiali prima di includerli nelle proforma.','Die Betriebsleitung bestätigt Preise für neue Materialien vor der Proforma.')]),
      step('maintenance','maintenance',pair('Manutenzioni ricorrenti','Wiederkehrende Pflege'),
        pair('Organizza interventi da ripetere a intervalli regolari.','Plane Arbeiten, die in regelmäßigen Abständen wiederkehren.'),
        [pair('Indica cliente, cantiere, attività, persona assegnata e frequenza.','Wähle Kunde, Einsatzort, Tätigkeit, zuständige Person und Intervall.'),
         pair('Avvia la generazione delle attività previste per i prossimi 30 giorni.','Starte die Erstellung der Aufgaben für die nächsten 30 Tage.'),
         pair('La generazione viene avviata dalla direzione, non è una promessa di esecuzione automatica.','Die Leitung startet die Erstellung; sie läuft nicht zwingend automatisch im Hintergrund.')]),
      step('invoice','invoices',pair('Bozze proforma','Proforma-Entwürfe'),
        pair('Prepara un riepilogo di addebito a partire da rapporti verificati e materiali.','Erstelle einen Abrechnungsentwurf aus geprüften Berichten und Materialien.'),
        [pair('Verifica le voci, le quantità e il prezzo prima di stampare.','Prüfe Positionen, Mengen und Preise vor dem Drucken.'),
         pair('Il sistema evita di trasferire due volte la stessa voce materiale già acquisita.','Bereits übernommene Materialpositionen werden nicht doppelt übertragen.'),
         pair('Le proforma non sono fatture fiscali e non vengono inviate allo SDI.','Proforma-Entwürfe sind keine steuerlichen Rechnungen und werden nicht elektronisch versendet.')]),
      step('archive','archive',pair('Dati ed esportazione','Daten und Export'),
        pair('Esporta copie dei dati aziendali e, nei limiti dei permessi, gli allegati.','Exportiere Betriebsdaten und, soweit berechtigt, Anhänge.'),
        [pair('Trovi esportazioni JSON o ZIP con i contenuti disponibili.','Verfügbare Inhalte kannst du als JSON oder ZIP exportieren.'),
         pair('Un export non sostituisce il backup verificato del database e dell’archivio.','Ein Export ersetzt keine geprüfte Sicherung von Datenbank und Dateiablage.')]),
      step('security',null,pair('Permessi e protezione dei dati','Berechtigungen und Datenschutz'),
        pair('I dati aziendali sono separati per impresa e gli accessi dipendono dal ruolo.','Betriebsdaten sind nach Unternehmen getrennt und Zugriffsrechte hängen von der Rolle ab.'),
        [pair('Non condividere password e account: invita ogni dipendente individualmente.','Teile keine Passwörter oder Konten: Lade jedes Teammitglied einzeln ein.'),
         pair('Disattiva l’accesso a chi non lavora più nell’azienda.','Deaktiviere Zugänge von Personen, die nicht mehr im Betrieb arbeiten.'),
         pair('Conserva gli esportati e gli allegati secondo le regole privacy applicabili.','Bewahre Exporte und Anhänge gemäß den geltenden Datenschutzregeln auf.')]),
      step('access',null,pair('Lingua, installazione e account','Sprache, Installation und Konto'),
        pair('Personalizza il tuo accesso senza cambiare i dati della squadra.','Passe den Zugang an, ohne die Teamdaten zu verändern.'),
        [pair('Passa da italiano a tedesco dal menu Lingua; i testi liberi non sono tradotti automaticamente.','Wechsle über die Sprachauswahl zwischen Italienisch und Deutsch; freie Texte werden nicht automatisch übersetzt.'),
         pair('Su iPhone aggiungi EasyGart alla schermata Home da Safari; su Android installala dal browser.','Füge EasyGart auf dem iPhone über Safari zum Home-Bildschirm hinzu oder installiere sie auf Android im Browser.'),
         pair('Usa Sicurezza account per cambiare password; per i dati del lavoro serve Internet.','Ändere dein Passwort unter Kontosicherheit; für Arbeitsdaten ist Internet erforderlich.')])
    ],
    worker:[
      step('worker-start','tasks',pair('Il tuo spazio di lavoro','Dein Arbeitsbereich'),
        pair('Qui trovi le attività assegnate a te e registri il lavoro che hai svolto.','Hier findest du deine Aufgaben und dokumentierst die ausgeführten Arbeiten.'),
        [pair('Ogni account è personale e mostra solo le informazioni autorizzate.','Jedes Konto ist persönlich und zeigt nur berechtigte Informationen an.'),
         pair('Le funzioni gestionali di azienda, prezzi e fatturazione sono riservate alla direzione.','Betriebsverwaltung, Preise und Abrechnung sind der Leitung vorbehalten.')]),
      step('worker-tasks','tasks',pair('Compiti assegnati','Zugewiesene Aufgaben'),
        pair('Apri Compiti per vedere le attività, il cliente, il cantiere, la data e le istruzioni.','Unter Aufgaben siehst du Tätigkeiten, Kunden, Einsatzorte, Termine und Anweisungen.'),
        [pair('Quando inizi, puoi segnare l’attività come avviata.','Beim Beginn kannst du die Aufgabe als gestartet markieren.'),
         pair('Quando hai terminato, segnala Completato.','Nach Abschluss markiere sie als Erledigt.'),
         pair('Il compito non sostituisce il rapporto che descrive il lavoro reale.','Eine Aufgabe ersetzt nicht den Bericht über die tatsächliche Arbeit.')]),
      step('worker-clock','clock',pair('Timbrature e pause','Arbeitszeiten und Pausen'),
        pair('Usa Timbrature per registrare il tuo turno sul server.','Verwende die Zeiterfassung, um deine Schicht serverseitig zu erfassen.'),
        [pair('Premi Entra all’inizio del lavoro e indica il cantiere se opportuno.','Wähle Arbeitsbeginn und bei Bedarf einen Einsatzort.'),
         pair('Usa Inizia pausa e Termina pausa; infine Esci dal turno.','Wähle Pause beginnen und Pause beenden; zum Schluss Arbeitsende.'),
         pair('Controlla lo storico per verificare eventuali dimenticanze.','Prüfe den Verlauf auf vergessene Einträge.')]),
      step('worker-report','reports',pair('Compilare il rapporto giornaliero','Tagesbericht ausfüllen'),
        pair('Il rapporto descrive ciò che hai eseguito, non soltanto ciò che era previsto.','Der Bericht beschreibt, was du ausgeführt hast, nicht nur, was geplant war.'),
        [pair('Apri Fine giornata, seleziona il cantiere e indica la data. Non occorre un compito assegnato.','Öffne Feierabend, wähle den Einsatzort und das Datum. Eine zugewiesene Aufgabe ist nicht erforderlich.'),
         pair('Inserisci manualmente ora di inizio, ora di fine, eventuale pausa e lavori svolti. Il sistema calcola le ore effettive.','Gib Beginn, Ende, mögliche Pause und erledigte Arbeiten manuell ein. Die Arbeitszeit wird automatisch berechnet.'),
         pair('Salva la bozza o inviala. Puoi modificare anche i rapporti passati e approvati, finché non sono collegati a proforma.','Speichere oder sende den Bericht. Auch ältere freigegebene Berichte bleiben bis zur Proforma-Verknüpfung änderbar.')]),
      step('worker-sites','sites-history',pair('I cantieri svolti','Bearbeitete Einsatzorte'),
        pair('Una lista dei cantieri in cui hai effettivamente registrato lavoro, con dettaglio di orari e materiali.','Eine Liste deiner bearbeiteten Einsatzorte mit Zeiten und Materialien.'),
        [pair('Apri Cantieri svolti dal Menu oppure dal riepilogo mensile.','Öffne Bearbeitete Einsatzorte über Menü oder Monatsübersicht.'),
         pair('Seleziona un cantiere per vedere le giornate passate e aprire i rapporti.','Wähle einen Einsatzort, um vergangene Tage und Berichte zu sehen.')]),
      step('worker-monthly','monthly',pair('Resoconto delle tue ore','Monatsübersicht deiner Stunden'),
        pair('Puoi consultare i tuoi rapporti e tutte le giornate passate.','Du kannst deine eigenen Berichte und frühere Arbeitstage ansehen.'),
        [pair('Apri Resoconto mensile per consultare ore, attività, materiali e cantieri delle giornate passate.','Öffne die Monatsübersicht für Stunden, Arbeiten, Materialien und Einsatzorte vergangener Tage.'),
         pair('Apri un rapporto per correggerlo, oppure visita Cantieri svolti per leggere tutto lo storico dei singoli cantieri.','Öffne einen Bericht zur Korrektur oder das Einsatzort-Archiv für den gesamten Verlauf.')]),
      step('worker-photos','reports',pair('Allegare foto prima e dopo','Vorher- und Nachher-Fotos hinzufügen'),
        pair('Le fotografie rendono verificabile lo stato del cantiere.','Fotos machen den Zustand des Einsatzorts nachvollziehbar.'),
        [pair('Salva prima il rapporto come bozza.','Speichere zuerst den Bericht als Entwurf.'),
         pair('Carica al massimo tre foto prima e tre dopo.','Lade höchstens drei Vorher- und drei Nachher-Fotos hoch.'),
         pair('Non includere persone o dati privati non necessari.','Fotografiere keine unnötigen personenbezogenen Daten oder Personen.')]),
      step('worker-sign','reports',pair('Raccogliere una firma','Unterschrift einholen'),
        pair('Se richiesto, il cliente può confermare la presa visione sul dispositivo.','Falls erforderlich, kann der Kunde die Kenntnisnahme auf dem Gerät bestätigen.'),
        [pair('Nel rapporto salva il nome, chiedi il consenso e fai firmare sullo schermo.','Erfasse im Bericht den Namen, hole die Einwilligung ein und lass auf dem Bildschirm unterschreiben.'),
         pair('La firma non è una firma elettronica qualificata.','Die Unterschrift ist keine qualifizierte elektronische Signatur.')]),
      step('worker-materials','reports',pair('Registrare il materiale usato','Materialverbrauch dokumentieren'),
        pair('Seleziona ogni materiale dal menu del catalogo, indica la quantità e aggiungilo al rapporto.','Wähle jedes Material aus dem Katalog, erfasse die Menge und füge es dem Bericht hinzu.'),
        [pair('Le quantità si collegano al rapporto di intervento.','Die Mengen werden dem Arbeitsbericht zugeordnet.'),
         pair('I prezzi restano riservati alla direzione.','Die Preise bleiben der Leitung vorbehalten.'),
         pair('Il materiale registrato non crea una fattura automatica.','Erfasstes Material erzeugt keine automatische Rechnung.')]),
      step('worker-feedback','reports',pair('Correzioni e approvazione','Korrekturen und Freigabe'),
        pair('Il titolare controlla il rapporto dopo l’invio.','Der Inhaber prüft den Bericht nach der Einreichung.'),
        [pair('Se ricevi una richiesta di correzione, apri il rapporto e leggi il feedback.','Wenn eine Korrektur verlangt wird, öffne den Bericht und lies die Rückmeldung.'),
         pair('Correggi le informazioni e invia nuovamente.','Korrigiere die Angaben und sende den Bericht erneut.'),
         pair('Un rapporto approvato non è modificabile liberamente.','Ein freigegebener Bericht kann nicht beliebig geändert werden.')]),
      step('worker-languages',null,pair('Italiano e tedesco','Italienisch und Deutsch'),
        pair('La lingua selezionata modifica pulsanti, menu e spiegazioni.','Die gewählte Sprache ändert Schaltflächen, Menüs und Erklärungen.'),
        [pair('Usa IT o DE nell’intestazione o in questa guida.','Wähle IT oder DE im Kopfbereich oder in dieser Anleitung.'),
         pair('Le descrizioni scritte dagli utenti non vengono tradotte automaticamente.','Von Nutzern geschriebene Beschreibungen werden nicht automatisch übersetzt.')]),
      step('worker-install',null,pair('EasyGart sul telefono','EasyGart auf dem Smartphone'),
        pair('La versione web può essere aggiunta alla schermata Home.','Die Webversion kann zum Startbildschirm hinzugefügt werden.'),
        [pair('iPhone: apri con Safari, tocca Condividi e Aggiungi alla schermata Home.','iPhone: Öffne die Seite in Safari und wähle Teilen und Zum Home-Bildschirm.'),
         pair('Android: apri dal browser e scegli Installa app.','Android: Öffne die Seite im Browser und wähle App installieren.'),
         pair('Per salvare rapporti, timbrature e allegati serve Internet.','Zum Speichern von Berichten, Zeiten und Anhängen ist Internet erforderlich.')]),
      step('worker-security',null,pair('Accesso e protezione dei dati','Zugang und Datenschutz'),
        pair('Mantieni protetto il tuo account e usa solo dati necessari al lavoro.','Schütze dein Konto und verwende nur arbeitsrelevante Daten.'),
        [pair('Usa Sicurezza account per cambiare la password.','Unter Kontosicherheit kannst du dein Passwort ändern.'),
         pair('Non condividere le credenziali con i colleghi.','Teile deine Zugangsdaten nicht mit Kolleginnen oder Kollegen.'),
         pair('Il titolare gestisce inviti e accessi; tu puoi sempre riaprire questa guida.','Der Inhaber verwaltet Einladungen und Zugänge; du kannst diese Anleitung jederzeit erneut öffnen.')])
    ]
  };
  const ui={
    it:{name:'Guida alle funzioni',owner:'Titolare',worker:'Dipendente',setup:'Primo accesso',
      chapter:'Argomenti',progress:'Passaggio',prev:'Indietro',next:'Avanti',finish:'Ho capito',
      skip:'Salta la guida',close:'Chiudi la guida',visit:'Apri la sezione',
      auto:'Puoi riaprire la guida in qualsiasi momento dal menu.',lang:'Lingua della guida'},
    de:{name:'Funktionsanleitung',owner:'Inhaber',worker:'Mitarbeitende',setup:'Erster Zugang',
      chapter:'Themen',progress:'Schritt',prev:'Zurück',next:'Weiter',finish:'Verstanden',
      skip:'Anleitung überspringen',close:'Anleitung schließen',visit:'Bereich öffnen',
      auto:'Du kannst die Anleitung jederzeit über das Menü erneut öffnen.',lang:'Sprache der Anleitung'}
  };
  const root=()=>document.getElementById('eg-guide-root');
  const escapeHTML=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const seenScopes=new Set();
  let current=null,scope='',visible=false,index=0,returnFocus=null;
  const scopedKey=ctx=>'easygart-guide-'+VERSION+':'+ctx.userId+':'+(ctx.companyId||'setup');
  function seen(key){
    if(seenScopes.has(key))return true;
    try{return localStorage.getItem(key)==='done'}catch{return false}
  }
  function remember(){
    if(!scope)return;
    seenScopes.add(scope);
    try{localStorage.setItem(scope,'done')}catch{}
  }
  function hide(mark=false){
    if(mark)remember();
    visible=false;
    const target=root();
    if(target)target.innerHTML='';
    document.body?.classList?.remove('eg-guide-lock');
    if(returnFocus?.isConnected) returnFocus.focus?.();
    returnFocus=null;
  }
  function paint(){
    const target=root();
    if(!target||!current||!visible)return;
    const lang=current.locale==='de'?'de':'it',n=lang==='de'?1:0;
    const labels=ui[lang],pages=chapters[current.role]||chapters.setup;
    index=Math.max(0,Math.min(index,pages.length-1));
    const page=pages[index];
    target.innerHTML='<div class="eg-guide-backdrop">'+
      '<section class="eg-guide-panel" role="dialog" aria-modal="true" aria-labelledby="eg-guide-title" aria-describedby="eg-guide-description">'+
        '<div class="eg-guide-head"><div><div class="eg-guide-kicker">EasyGart · '+escapeHTML(labels[current.role])+'</div>'+
          '<h2 id="eg-guide-title">'+escapeHTML(labels.name)+'</h2></div>'+
          '<div class="eg-guide-head-actions"><div class="eg-guide-languages" role="group" aria-label="'+escapeHTML(labels.lang)+'">'+
          ['it','de'].map(code=>'<button type="button" data-eg-guide="locale" data-language="'+code+'" aria-pressed="'+(lang===code)+'" class="'+(lang===code?'selected':'')+'">'+code.toUpperCase()+'</button>').join('')+'</div>'+
          '<button class="eg-guide-close" type="button" data-eg-guide="close" aria-label="'+escapeHTML(labels.close)+'">×</button></div></div>'+
        '<div class="eg-guide-progress"><span>'+escapeHTML(labels.progress)+' '+(index+1)+' / '+pages.length+'</span>'+
          '<div role="progressbar" aria-valuemin="1" aria-valuemax="'+pages.length+'" aria-valuenow="'+(index+1)+'" aria-label="'+escapeHTML(labels.progress)+'">'+
            '<i style="width:'+((index+1)/pages.length*100)+'%"></i></div></div>'+
        '<div class="eg-guide-layout"><nav class="eg-guide-chapters" aria-label="'+escapeHTML(labels.chapter)+'">'+
          pages.map((s,i)=>'<button type="button" data-eg-guide="goto" data-index="'+i+'" class="'+(i===index?'selected':'')+'" aria-current="'+(i===index?'step':'false')+'">'+
            '<span class="eg-guide-number">'+(i+1)+'</span><span>'+escapeHTML(s.title[n])+'</span></button>').join('')+'</nav>'+
          '<div class="eg-guide-content" tabindex="-1"><div class="eg-guide-step-count">'+escapeHTML(labels.progress)+' '+(index+1)+' / '+pages.length+'</div>'+
            '<h3 id="eg-guide-description">'+escapeHTML(page.title[n])+'</h3>'+
            '<p class="eg-guide-intro">'+escapeHTML(page.intro[n])+'</p>'+
            '<ol>'+page.points.map(x=>'<li>'+escapeHTML(x[n])+'</li>').join('')+'</ol>'+
            (page.view?'<button type="button" class="eg-guide-open" data-eg-guide="visit" data-guide-view="'+escapeHTML(page.view)+'">'+escapeHTML(labels.visit)+' <span aria-hidden="true">↗</span></button>':'')+
          '</div></div>'+
        '<div class="eg-guide-footer"><div class="eg-guide-footer-left"><button class="eg-guide-skip" type="button" data-eg-guide="skip">'+escapeHTML(labels.skip)+'</button>'+
          '<small>'+escapeHTML(labels.auto)+'</small></div>'+
          '<div class="eg-guide-step-actions"><button type="button" class="eg-guide-back" data-eg-guide="prev" '+(!index?'disabled':'')+'>'+escapeHTML(labels.prev)+'</button>'+
            '<button type="button" class="eg-guide-next" data-eg-guide="'+(index===pages.length-1?'finish':'next')+'">'+escapeHTML(index===pages.length-1?labels.finish:labels.next)+'</button>'+
          '</div></div>'+
      '</section></div>';
  }
  function open(){
    if(!current?.userId || !root())return;
    if(!visible)returnFocus=document.activeElement;
    visible=true;
    document.body?.classList?.add('eg-guide-lock');
    paint();
    root()?.querySelector('.eg-guide-close')?.focus?.();
  }
  function sync(ctx){
    if(!ctx?.active||!ctx.userId){
      if(visible)hide(false);
      current=null;scope='';
      return;
    }
    const role=['owner','worker'].includes(ctx.role)?ctx.role:'setup';
    const nextScope=scopedKey({...ctx,companyId:role==='setup'?'':ctx.companyId});
    const changed=nextScope!==scope;
    if(changed&&visible)hide(false);
    current={...ctx,role};
    scope=nextScope;
    if(changed){
      index=0;
      if(!seen(scope))open();
    }else if(visible)paint();
  }
  document.addEventListener('click',event=>{
    const btn=event.target?.closest?.('[data-eg-guide]');
    if(!btn||!root()?.contains(btn)||!visible)return;
    const action=btn.dataset.egGuide;
    if(action==='close'||action==='skip'||action==='finish'){hide(true);return}
    if(action==='next'){index++;paint();root()?.querySelector('.eg-guide-close')?.focus?.();return}
    if(action==='prev'){index--;paint();root()?.querySelector('.eg-guide-close')?.focus?.();return}
    if(action==='goto'){
      const next=Number(btn.dataset.index);
      if(Number.isInteger(next)&&next>=0&&next<(chapters[current.role]?.length||0)){
        index=next;paint();root()?.querySelector('.eg-guide-close')?.focus?.();
      }
      return;
    }
    if(action==='locale'){
      const next=btn.dataset.language==='de'?'de':'it';
      if(current.locale!==next){
        current.locale=next;current.onLocale?.(next);paint();
      }
      return;
    }
    if(action==='visit'){
      const view=btn.dataset.guideView;
      const allowed=(chapters[current.role]||[])[index]?.view===view;
      if(allowed&&view){hide(true);current?.onNavigate?.(view)}
    }
  });
  document.addEventListener('keydown',event=>{
    if(!visible)return;
    if(event.key==='Escape'){event.preventDefault();hide(true);return}
    if(event.key!=='Tab')return;
    const focusables=[...(root()?.querySelectorAll('button:not([disabled])')||[])];
    if(!focusables.length)return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  window.EASYGART_GUIDE={sync,open};
})();
