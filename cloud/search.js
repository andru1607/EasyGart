/* EasyGart: ricerca globale di compiti, cantieri e azioni disponibili al ruolo.
   Indice soltanto i dati già autorizzati/caricati per l'azienda corrente.
   Nessuna richiesta remota e nessuna memorizzazione della ricerca. */
'use strict';
window.createEasyGartSearch = function({getContext,esc}) {
  let opened=false,query='';
  const context=()=>getContext();
  const safe=value=>esc(String(value??''));
  const lang=(it,de)=>context().locale==='de'?de:it;
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ß/g,'ss').toLocaleLowerCase().trim();
  const fmtDate=value=>{
    const str=String(value||'');
    const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    return m ? m[3]+'/'+m[2]+'/'+m[1] : str;
  };
  function commands() {
    const c=context();
    if(!c.user||!c.companyId)return [];
    const owner=!!c.isOwner;
    const command=(id,it,de,detailIt,detailDe,view,keywords,op='view')=>({
      id:'cmd:'+id,kind:'command',title:lang(it,de),detail:lang(detailIt,detailDe),
      category:lang('Azione o sezione','Aktion oder Bereich'),view,op,
      keywords:[it,de,detailIt,detailDe,keywords].join(' ')
    });
    const common=[
      command('home','Home','Startseite','Panoramica azienda e giornata','Betrieb und Tagesübersicht','home','dashboard'),
      command('new-report','Nuovo rapporto di fine giornata','Neuer Tagesbericht','Registra orari, lavori e materiali','Arbeitszeiten, Arbeiten und Material erfassen','eod','nuovo rapporto dichiarare ore lavoro', 'new-report'),
      command('tasks','Compiti e attività','Aufgaben und Tätigkeiten','Vedi i lavori assegnati','Zugewiesene Arbeiten ansehen','tasks','attività lavoro elenco'),
      command('task-start','Inizia attività','Aufgabe starten','Apri un compito da iniziare','Eine Aufgabe zum Starten öffnen','tasks','avvia lavoro'),
      command('task-finish','Completa attività','Aufgabe abschließen','Apri un compito e segnalo come completato','Aufgabe öffnen und abschließen','tasks','finire lavoro fatto'),
      command('clock','Timbrature','Zeiterfassung','Entrata, uscita, pause e storico','Kommen, Gehen, Pausen und Verlauf','clock','orari turni timbrare'),
      command('delete-shift','Elimina timbratura','Zeiterfassung löschen','Apri lo storico e scegli la timbratura errata','Verlauf öffnen und fehlerhafte Schicht auswählen','clock','cancella ore eliminare orario doppio triplo'),
      command('clear-hours','Elimina solo orari','Nur Arbeitszeiten löschen','Apri il calendario e correggi le ore senza eliminare il rapporto','Kalender öffnen und Zeiten ohne Bericht löschen','calendar-hours','cancella ore doppie triple errore'),
      command('personal-calendar','Le mie ore','Meine Arbeitszeiten','Apri il calendario personale','Persönlichen Kalender öffnen','calendar-hours','orari personali mie ore'),
      command('calendar-hours','Calendario orari','Stundenkalender','Consulta le ore e i giorni lavorati','Arbeitszeiten und Arbeitstage ansehen','calendar-hours','giorno presenze','view'),
      command('calendar','Calendario orari e rapporti','Arbeitszeit- und Berichtskalender','Consulta ore, attività e rapporti','Zeiten, Tätigkeiten und Berichte ansehen','calendar','giorno lavoro'),
      command('reports','Rapporti giornalieri','Tagesberichte','Consulta, modifica e correggi i rapporti','Berichte anzeigen, bearbeiten und korrigieren','reports','rapporti storico lavori'),
      command('monthly','Resoconto mensile','Monatsübersicht','Totali ore, attività e materiali','Stunden, Tätigkeiten und Material im Monat','monthly','riepilogo statistiche'),
      command('sites-history','Cantieri e rapporti','Einsatzorte und Berichte','Elenco di tutti i cantieri, con interventi e documenti','Alle Einsatzorte mit Arbeitsberichten','sites-history','cantieri storico lista lavori consultare'),
      command('site-reports','Rapporti per singolo cantiere','Berichte je Einsatzort','Apri lo storico completo del cantiere','Arbeitsberichte nach Einsatzort ansehen','sites-history','rapporti cantiere lista'),
      command('edit-report','Modifica rapporto e orari','Bericht und Arbeitszeiten bearbeiten','Apri un rapporto per correggere data, ore e materiali','Datum, Zeiten und Material korrigieren','reports','modificare orari rapporto vecchio'),
      command('my-history','Storico ore e attività','Arbeitszeiten und Tätigkeiten im Verlauf','Riepiloghi giornalieri e mensili','Tages- und Monatsübersichten','monthly','ore lavorate mese storico'),
      command('guide','Guida alle funzioni','Funktionshilfe','Scopri come usare EasyGart','EasyGart Funktionen kennenlernen','guide','aiuto help assistenza','guide'),
      command('account-security','Sicurezza e password','Sicherheit und Passwort','Modifica la password del tuo account','Kontopasswort ändern','account','cambia password sicurezza profilo','account-security'),
      command('install','Installa EasyGart sul telefono','EasyGart auf Handy installieren','Apri le istruzioni per installare l’app','Installationsanleitung für die App öffnen','install','iphone android home schermata installa','install'),
      command('reload','Aggiorna dati','Daten aktualisieren','Ricarica i dati dell’azienda','Firmendaten aktualisieren','home','ricarica aggiorna sincronizza','reload')
    ];
    if(!owner)return common;
    const ownerActions=[
      command('new-task','Assegna un compito','Aufgabe zuweisen','Crea una nuova attività per la squadra','Neue Aufgabe für das Team erstellen','tasks','nuovo incarico assegnare','new-task'),
      command('clients','Clienti e cantieri','Kunden und Einsatzorte','Apri la rubrica aziendale','Firmenverzeichnis öffnen','clients','rubrica anagrafica'),
      command('new-client','Nuovo cliente','Neuer Kunde','Aggiungi un cliente alla rubrica','Kunden zum Verzeichnis hinzufügen','clients','crea cliente','new-client'),
      command('new-site','Nuovo cantiere','Neuer Einsatzort','Aggiungi un cantiere al cliente','Neuen Einsatzort beim Kunden anlegen','clients','crea cantiere','new-site'),
      command('delete-client','Elimina cliente','Kunde löschen','Apri la rubrica per eliminare un cliente errato','Verzeichnis öffnen, um einen falschen Kunden zu löschen','clients','cancella rimuovi cliente doppione'),
      command('edit-client','Modifica cliente e recapiti','Kundendaten bearbeiten','Correggi nomi, indirizzi e note dei clienti','Namen, Adressen und Notizen korrigieren','clients','aggiorna anagrafica telefono email'),
      command('edit-site','Modifica cantiere','Einsatzort bearbeiten','Correggi nome o indirizzo del cantiere','Namen oder Adresse des Einsatzorts korrigieren','clients','aggiorna modifica indirizzo cantiere'),
      command('import-hours','Importa orari da screenshot','Arbeitszeiten aus Screenshot importieren','Leggi e verifica le ore dalle Note','Zeiten aus Notizen einlesen und prüfen','import','ocr screenshot fotografia orari','import-hours'),
      command('import-clients','Importa clienti da screenshot','Kunden aus Screenshot importieren','Leggi i clienti dalle Note e verifica i dati','Kunden aus Notizen einlesen und prüfen','import','ocr screenshot foto clienti','import-clients'),
      command('team','La tua squadra','Dein Team','Gestisci i dipendenti','Mitarbeitende verwalten','team','personale dipendenti'),
      command('admin-delegate','Concedi o revoca permessi admin','Admin-Rechte vergeben oder entziehen','Scegli un dipendente dalla squadra','Mitarbeiter im Team auswählen','team','admin titolare delega autorizzazioni'),
      command('invite','Invita dipendente','Mitarbeiter einladen','Invia un nuovo invito alla squadra','Neue Einladung ans Team senden','team','aggiungi personale','invite'),
      command('materials','Catalogo materiali','Materialkatalog','Gestisci materiali e prezzi','Material und Preise verwalten','materials','materiale magazzino'),
      command('new-material','Aggiungi materiale','Material hinzufügen','Apri il modulo per un nuovo materiale','Formular für neues Material öffnen','materials','nuovo prodotto quantità prezzo listino','new-material'),
      command('maintenance','Manutenzioni ricorrenti','Wiederkehrende Pflege','Pianifica i lavori periodici','Wiederkehrende Arbeiten planen','maintenance','pianifica intervento ricorrente'),
      command('new-maintenance','Nuova manutenzione','Neue Pflegeplanung','Apri il modulo per la manutenzione ricorrente','Formular zur wiederkehrenden Pflege öffnen','maintenance','crea ricorrenza programmare lavoro','new-maintenance'),
      command('invoices','Bozze proforma','Proforma-Entwürfe','Prepara le proforma','Proforma-Entwürfe vorbereiten','invoices','fatture preventivo'),
      command('new-invoice','Crea proforma','Proforma erstellen','Apri il modulo per una nuova bozza','Formular für neuen Entwurf öffnen','invoices','fattura crea emissione','new-invoice'),
      command('company-settings','Nome azienda e impostazioni','Firmenname und Einstellungen','Aggiorna i dati dell’azienda','Firmendaten aktualisieren','team','impostazioni azienda modifica nome'),
      command('archive','Dati ed esportazione','Daten und Export','Esporta i dati aziendali','Firmendaten exportieren','archive','backup scarica export'),
      command('export-data','Esporta e salva i dati','Daten exportieren und sichern','Apri gli strumenti di esportazione e backup','Export und Backup öffnen','archive','zip json backup foto dati')
    ];
    return common.concat(c.isPrimaryOwner?ownerActions:
      ownerActions.filter(action=>action.id!=='cmd:admin-delegate'));
  }
  function items(){
    const c=context();
    const commandsList=commands();
    const visibleTask=(c.tasks||[]).filter(x=>c.isOwner||x.assignee_id===c.user?.id);
    const jobs=visibleTask.map(task=>{
      const site=(c.sites||[]).find(s=>s.id===task.site_id);
      const client=(c.clients||[]).find(v=>v.id===task.client_id);
      const name=site?.name||'';
      const assigned=c.isOwner?(c.members||[]).find(x=>x.user_id===task.assignee_id)?.full_name||'':'';
      return {id:'task:'+task.id,kind:'task',title:task.title||lang('Attività','Aufgabe'),
        category:lang('Attività','Aufgabe'),detail:[name,fmtDate(task.due_date),assigned].filter(Boolean).join(' · '),
        keywords:[task.title,task.instructions,site?.name,client?.name,assigned,task.status,task.due_date].join(' '),
        entityId:task.id};
    });
    const places=(c.sites||[]).map(site=>({
      id:'site:'+site.id,kind:'site',entityId:site.id,title:site.name,
      category:lang('Cantiere','Einsatzort'),
      detail:(c.clients||[]).find(x=>x.id===site.client_id)?.name||'',
      keywords:[site.name,site.address,(c.clients||[]).find(x=>x.id===site.client_id)?.name].join(' ')
    }));
    const customers=c.isOwner?(c.clients||[]).flatMap(v=>[{
      id:'client:'+v.id,kind:'client',entityId:v.id,title:v.name,
      category:lang('Cliente','Kunde'),detail:lang('Apri in rubrica','Im Verzeichnis öffnen'),
      keywords:[v.name,v.email,v.address,v.phone,v.notes].join(' ')
    },{
      id:'client-edit:'+v.id,kind:'client-edit',entityId:v.id,
      title:lang('Modifica cliente: ','Kunde bearbeiten: ')+v.name,
      category:lang('Modifica','Bearbeiten'),detail:lang('Aggiorna i dati in rubrica','Daten im Verzeichnis ändern'),
      keywords:[v.name,v.email,v.address,'modifica cliente recapiti'].join(' ')
    }]):[];
    const siteEdits=c.isOwner?(c.sites||[]).map(site=>({
      id:'site-edit:'+site.id,kind:'site-edit',entityId:site.id,
      title:lang('Modifica cantiere: ','Einsatzort bearbeiten: ')+site.name,
      category:lang('Modifica','Bearbeiten'),detail:lang('Correggi il cantiere','Einsatzort bearbeiten'),
      keywords:[site.name,site.address,'modifica indirizzo cantiere'].join(' ')
    })):[];
    const materials=c.isOwner?(c.materials||[]).map(m=>({
      id:'material:'+m.id,kind:'material',entityId:m.id,title:m.name,
      category:lang('Materiale','Material'),
      detail:[m.unit,m.active===false?lang('Disattivo','Inaktiv'):''].filter(Boolean).join(' · '),
      keywords:[m.name,m.unit,'catalogo materiale modifica prodotto'].join(' ')
    })):[];
    const reports=(c.reports||[]).filter(r=>!r.deleted_at&&
      (c.isOwner||r.created_by===c.user?.id||r.site_id&&['submitted','approved'].includes(r.status)))
      .map(report=>{
        const site=(c.sites||[]).find(x=>x.id===report.site_id);
        const task=(c.tasks||[]).find(x=>x.id===report.task_id);
        const who=c.isOwner?(c.members||[]).find(x=>x.user_id===report.created_by)?.full_name||'':'';
        return {id:'report:'+report.id,kind:'report',entityId:report.id,
          category:lang('Rapporto','Bericht'),
          title:[site?.name||task?.title||lang('Rapporto giornaliero','Tagesbericht'),fmtDate(report.work_date)].filter(Boolean).join(' · '),
          detail:[who,report.work_summary].filter(Boolean).join(' · ').slice(0,175),
          keywords:[site?.name,task?.title,report.work_summary,report.work_date,who].join(' ')
        };
      });
    return [...commandsList,...jobs,...places,...customers,...siteEdits,...materials,...reports];
  }
  function results(){
    const q=normalize(query);
    const index=items();
    if(!q){
      const favorites=context().isOwner?
        ['personal-calendar','new-report','new-client','new-task','clock','clear-hours','sites-history','monthly','team','import-hours','import-clients','guide']:
        ['personal-calendar','clock','new-report','tasks','clear-hours','sites-history','reports','monthly','guide'];
      return favorites.map(key=>index.find(x=>x.id==='cmd:'+key)).filter(Boolean);
    }
    const words=q.split(/\s+/).filter(Boolean);
    return index.map((item,i)=>{
      const title=normalize(item.title),type=normalize(item.category);
      const hay=normalize([item.title,item.detail,item.keywords,item.category].join(' '));
      if(!words.every(word=>hay.includes(word)))return null;
      const score=(title.startsWith(q)?50:0)+(title.includes(q)?20:0)+(type.includes(q)?4:0)
        +(item.kind==='command'?8:0)+(item.kind==='task'?5:0);
      return {item,i,score};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,22).map(x=>x.item);
  }
  function resultsMarkup(){
    const found=results();
    if(!found.length)return '<p class="eg-search-empty">'+lang('Nessun risultato per questa ricerca.','Keine Treffer für diese Suche.')+'</p>';
    return '<div class="eg-search-list" role="group" aria-label="'+safe(lang('Risultati ricerca','Suchergebnisse'))+'">'+found.map(item=>
      '<button type="button" class="eg-search-result" data-action="search-pick" data-search-id="'+safe(item.id)+'">'+
      '<span class="eg-search-result-main"><span class="eg-search-tag">'+safe(item.category)+'</span>'+
      '<strong>'+safe(item.title)+'</strong>'+
      (item.detail?'<small>'+safe(item.detail)+'</small>':'')+'</span><span aria-hidden="true" class="eg-search-arrow">›</span></button>'
    ).join('')+'</div>';
  }
  function markup(){
    if(!opened)return '';
    return '<div class="eg-search-shade" data-action="search-close" aria-hidden="true"></div>'+
      '<section class="eg-search-dialog" role="dialog" aria-modal="true" aria-labelledby="eg-search-title">'+
      '<div class="eg-search-heading"><h2 id="eg-search-title">'+lang('Cerca in EasyGart','EasyGart durchsuchen')+'</h2>'+
      '<button type="button" class="eg-search-x" aria-label="'+safe(lang('Chiudi ricerca','Suche schließen'))+'" data-action="search-close">×</button></div>'+
      '<label class="eg-search-input-wrap"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+
      '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>'+
      '<input type="search" id="eg-search-input" aria-label="'+safe(lang('Cerca attività, cantieri o azioni','Aufgaben, Einsatzorte oder Aktionen suchen'))+'" '+
      'placeholder="'+safe(lang('Cerca attività, cantieri o azioni…','Aufgaben, Einsatzorte oder Aktionen suchen…'))+'" '+
      'autocomplete="off" spellcheck="false" value="'+safe(query)+'"></label>'+
      '<div id="eg-search-results" class="eg-search-results">'+resultsMarkup()+'</div>'+
      '<p class="eg-search-privacy">'+lang('Mostriamo soltanto i dati e le operazioni autorizzati per il tuo ruolo.','Es werden nur für deine Rolle erlaubte Daten und Aktionen angezeigt.')+'</p>'+
      '</section>';
  }
  return {
    open(){const c=context();if(!c.user||!c.companyId)return false;query='';opened=true;return true},
    close(){opened=false;query=''},
    isOpen:()=>opened,
    setQuery(value){query=String(value||'').slice(0,160)},
    get:(id)=>items().find(item=>item.id===id)||null,
    results,
    resultsMarkup,
    markup
  };
};
