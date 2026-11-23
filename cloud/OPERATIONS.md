# EasyGart Cloud: installazione e utilizzo su iOS e Android

Versione 16 novembre 2026. Sito: https://easygarte.vercel.app/cloud/
Progetto Supabase corretto: xdwsqkteykjjpzogwocx.

## Installazione
**iPhone/iPad:** aprire il sito con Safari → Condividi → Aggiungi alla schermata Home → Aggiungi. Attivare "Apri come app" quando proposto.
**Android:** aprire con Chrome → menu ⋮ → Installa app (oppure Aggiungi a schermata Home).

EasyGart è una PWA, non un'app nativa App Store/Play Store. Servono Internet e una sessione Supabase valida per autenticarsi e salvare operazioni. Un service worker memorizza solo l'interfaccia pubblica, mai le risposte o i file personali di Supabase. I testi di alcuni moduli sono conservati nella sessione del browser per massimo 24 ore per recupero dopo un errore, escludendo password, email di accesso, firme e immagini.

## Account e recupero password

Dalla schermata di accesso scegliere **Password dimenticata?**, inserire l'email e seguire il link ricevuto. Il collegamento riporta a EasyGart Cloud e permette di impostare una password nuova di almeno 12 caratteri. Dopo il cambio password è necessario effettuare nuovamente l'accesso. Chi è già autenticato trova **Sicurezza account** nell'intestazione. Il flusso è disponibile in italiano e tedesco. La consegna delle email richiede configurazione corretta di Supabase Auth/SMTP e URL di redirect autorizzati.

## Navigazione semplificata e ricerca sempre visibile

La versione mobile di EasyGart ha una **barra di ricerca globale fissa in alto durante lo scorrimento** e una navigazione principale differente in base al ruolo.

- **Dipendente e dipendente con delega admin:** Home, Timbrature, Rapporto, Cantieri, Altro. La delega non rimuove le timbrature personali. L'admin può raggiungere tutte le funzioni gestionali tramite Altro e ricerca.
- **Titolare:** Home, Squadra, Rapporti, Cantieri, Altro.
- **Altro:** sezioni organizzate in Lavoro quotidiano, Consultazioni, Gestione aziendale (se autorizzato) e Account e supporto. Non serve percorrere tutte le schermate per trovare un'operazione.
- **Home:** quattro azioni rapide contestuali al ruolo, indicatori essenziali e accesso diretto al dettaglio degli ultimi rapporti.
- **Lente sempre visibile:** ricerca per nomi e indirizzi di cantieri, clienti, attività assegnate, rapporti accessibili e materiali del catalogo (solo titolare e admin). Indicizza anche azioni come import da screenshot, nuova proforma, creazione materiali e manutenzioni, modifica di un cliente/cantiere, resoconti, permessi di squadra e impostazioni account. I risultati rispettano il ruolo e le informazioni già autorizzate da Supabase; la ricerca avviene localmente sui dati caricati e non manda la query a terzi.
- Su tastiera: **⌘K / Ctrl+K**. Sul telefono basta toccare la barra superiore, visibile anche dopo uno scroll lungo.

La navigazione funziona dal frontend senza migrazioni aggiuntive, ma le precedenti funzioni che dipendono dalla delega e dalla condivisione dei rapporti necessitano ancora dell'attivazione della rispettiva migrazione SQL EasyGart, con verifica dal database.

## Deleghe amministrative e rapporti per cantiere

Il titolare fondatore può attribuire **tutti i permessi gestionali di EasyGart** a un dipendente esistente. Vai in **Squadra e inviti** → scegli il dipendente → **Concedi admin**. Il dipendente resta registrato come lavoratore, mantiene le proprie timbrature e può anche amministrare clienti, cantieri, materiali, rapporti, compiti, inviti e riepiloghi. Il titolare originale resta il proprietario dell'azienda e **solo lui** può concedere o revocare queste deleghe. Per revocare usare **Revoca admin**; l'effetto sui permessi server è immediato. Non condividere password.

**Obbligatoria prima dell'uso:** eseguire esclusivamente nel progetto Supabase EasyGart `xdwsqkteykjjpzogwocx` la migrazione [easygart_admin_delegation_site_reports_v1.sql](../supabase/easygart_admin_delegation_site_reports_v1.sql), dopo le migrazioni core, dei rapporti e delle timbrature. L'app mostra un avviso se la funzione non è installata. Il connettore Supabase di questa chat non ha accesso a quel progetto; il file nel repository **non modifica il database da solo**.

**Cantieri:** la sezione **Cantieri svolti** ora mostra **tutti i cantieri esistenti**, anche quelli senza lavori, con ricerca per nome/indirizzo. Apri un cantiere per leggere i rapporti in ordine di data, orari dichiarati, autore, attività e materiali visibili. I dipendenti possono leggere **i propri rapporti e quelli inviati/approvati dalla squadra** nello stesso account aziendale; le bozze non pubblicate dei colleghi rimangono riservate. I permessi di lettura sono stabiliti dalla RLS del database, non solo dall'interfaccia. Le timbrature dei colleghi non vengono rese pubbliche ai dipendenti ordinari.

**Modifiche:** da **Clienti e cantieri** premi **Modifica** sul cliente o cantiere per correggere dati, quindi **Salva modifiche**. Il pulsante **Rapporti** apre lo storico del cantiere. Nel dettaglio del cantiere, **Modifica** sul rapporto apre la schermata di lavoro già esistente, quando autorizzato. Dipendenti normali possono modificare i propri rapporti; titolare e amministratori quelli della squadra. Le timbrature server non vengono riscritte come se fossero nuove; i rapporti collegati a proforma rimangono protetti. Il catalogo dei materiali e le attività conservano i rispettivi controlli di modifica già previsti.

**Collaudo richiesto prima di dati reali:** con due dipendenti e due aziende verifica assegnazione/revoca delega, accesso ai soli dati aziendali, lavoro e timbrature personali dell'admin, apertura dei rapporti inviati da altri lavoratori, protezione delle bozze, modifica cliente/cantiere, e aggiornamento dei totali. La migrazione include una tabella di audit con chi ha concesso o revocato la delega.

## Importazione da screenshot (titolare)

Il titolare può aprire **Importa screenshot** dal menu, da **Clienti e cantieri > Da screenshot** o dai collegamenti rapidi. La schermata ha due modalità: **Orari e rapporti** e **Clienti**. Su iPhone si può scegliere uno screenshot dalla libreria Foto; in alternativa si può incollare il testo copiato dalle Note. Il motore OCR Tesseract.js viene scaricato solo quando serve e legge lo screenshot sul dispositivo. Non carica l'immagine su Supabase; il testo viene mantenuto nella memoria della schermata fino alla chiusura.

**Orari:** il riconoscimento propone data, dipendente, cantiere, inizio, fine, pausa e una descrizione modificabile. Supporta anche turni spezzati come `08:00-12:00 13:00-17:00` (pausa calcolata di 60 minuti) e intervalli `8-12 13-17`. Ogni riga va verificata e confermata dal titolare. Viene creato un **rapporto giornaliero in bozza** con le ore dichiarate, consultabile nei due calendari e nei riepiloghi; **non** viene creata una falsa timbratura del server. Il titolare deve completare l'attività svolta e inviare il rapporto quando opportuno. Date ambigue e pause discordanti sono segnalate. Il controllo blocca duplicati esatti e sovrapposizioni con rapporti già registrati per lo stesso dipendente nel periodo selezionato, compresi i turni a cavallo della mezzanotte; verificare comunque i dati prima del salvataggio.

**Clienti:** il riconoscimento propone nomi, telefono, email e indirizzo. Il titolare può correggere ogni riga prima di importare. Se non è ancora attiva la migrazione [easygart_client_contacts_v1.sql](../supabase/easygart_client_contacts_v1.sql), i recapiti vengono **conservati nel campo note del cliente**, non scartati. Per avere telefono, email e indirizzo in campi separati bisogna eseguire la migrazione SQL nel **solo progetto EasyGart** `xdwsqkteykjjpzogwocx` e verificare il risultato. La creazione dei clienti usa i permessi RLS esistenti e non crea automaticamente cantieri.

**Precisione e privacy:** il riconoscimento OCR non garantisce precisione assoluta, soprattutto su grafia a mano, immagini sfocate o screenshot con più colonne. Controllare numeri, nomi, pause e date prima del salvataggio. Il browser scarica libreria e dati linguistici da servizi esterni, ma l'immagine resta locale; per foto non supportate o senza rete si può incollare il testo. Verificare sul dispositivo reale e con account autorizzati prima di usare dati personali di clienti e dipendenti.

## Cancellazione degli orari dal calendario (IT/DE)

1. Apri **Calendario > Solo orari** oppure **Calendario > Orari e rapporti**, scegli il mese e il giorno già registrato.
2. **Timbratura conclusa:** tocca **Elimina orario / Zeiteintrag löschen**. La cancellazione riguarda solo la timbratura e conserva una traccia per il titolare. Il pulsante è visibile anche se manca l'aggiornamento SQL, ma in tal caso la finestra spiega che la funzione non è ancora attiva.
3. **Orario dichiarato nel rapporto:** tocca **Modifica orari / Arbeitszeiten bearbeiten** per cambiare inizio, fine e pausa. In alternativa, **Elimina rapporto e orari / Bericht und Zeiten löschen** apre una conferma che cancella l'intero rapporto, **non soltanto le ore**. Materiali e descrizione vengono quindi rimossi dalle viste come previsto dalla cancellazione del rapporto. Non usare questa seconda opzione se vuoi conservare i lavori documentati.
4. Ogni dipendente può intervenire soltanto sulle proprie registrazioni, il titolare può intervenire sulle registrazioni della squadra; non è possibile cancellare un turno aperto o un rapporto già bloccato per proforma.

**Attivazione necessaria:** la cancellazione delle sole timbrature dipende dalla migrazione SQL [easygart_shift_soft_delete_v1.sql](../supabase/easygart_shift_soft_delete_v1.sql) da applicare nel progetto Supabase EasyGart `xdwsqkteykjjpzogwocx`. Il repository non ha accesso al database tramite il connettore Supabase attuale, quindi la funzione non va considerata operativa fino a verifica. La cancellazione del rapporto utilizza invece l'RPC già prevista per i rapporti e va verificata con un account reale.

## Ricerca rapida per tutti

Premere la lente **Cerca / Suche** nella testata della dashboard, oppure **⌘K** (Mac) o **Ctrl+K** (computer). La ricerca trova le attività assegnate, i cantieri, i rapporti già caricati, le sezioni e le azioni disponibili in base al ruolo. Senza testo mostra le azioni rapide; digitando vengono cercati titoli, descrizioni dei compiti, date e luoghi. Toccare un risultato per aprire la relativa schermata o attività; **Esc** chiude la ricerca.

Esempi: `potatura` apre il compito, `resoconto mensile` apre il riepilogo, `cancella ore` apre la sezione timbrature, `nuovo cliente` è disponibile soltanto al titolare. La ricerca non esegue cancellazioni o operazioni rischiose automaticamente, e non rende visibili dati di altri dipendenti quando non autorizzati. Indicizza i dati già caricati nell'azienda selezionata, inclusi soltanto i rapporti presenti nell'elenco corrente. La ricerca non viene inviata a un servizio esterno.

## Dipendente
- Incarichi assegnati, aggiornamento stato, rapporti con bozza/invio/correzioni.
- Timbratura del turno e delle pause con orario del database.
- Dopo l'attivazione della migrazione di annullamento, può cancellare **le proprie timbrature già concluse** in Timbrature > Storico oppure da ciascuno dei due calendari. Il sistema richiede conferma; i rapporti giornalieri restano separati.
- Consumi materiali associati ai rapporti, senza prezzi.
- Fino a 3 foto prima e 3 dopo per rapporto, massimo 5 MB ciascuna, in Storage privato. Formati supportati JPEG/PNG/WebP, conversione HEIC dove supportata dal browser.
- Firma sullo schermo del cliente presente, con nome e consenso. È una presa visione, non una firma elettronica qualificata.

## Titolare
- Può annullare le timbrature concluse dei dipendenti. In Timbrature > **Mostra annullate** consulta la data, l'autore e le ore originali delle timbrature cancellate.
- Clienti/cantieri, inviti dipendenti, assegnazioni e revisione rapporti.
- Catalogo materiali con unità, prezzo di acquisto e di vendita e IVA.
- Manutenzioni settimanali, bisettimanali, mensili e trimestrali. La funzione Cron genera task futuri ogni giorno alle 05:15 UTC e previene i duplicati.
- Bozze proforma con ore e consumi da rapporto approvato, righe modificabili e stampa/Salva PDF. Non sono fatture elettroniche e non vengono inviate al Sistema di Interscambio.
- Esportazione JSON dei dati gestionali oppure ZIP con file originali di foto/firma, entrambi accessibili soltanto al titolare. Lo ZIP non include l'intero ambiente Auth né sostituisce un backup PostgreSQL/Storage ripristinabile. Il download contiene dati personali e va protetto.

## Attivazione cancellazione timbrature

La funzione richiede l'esecuzione di [easygart_shift_soft_delete_v1.sql](../supabase/easygart_shift_soft_delete_v1.sql) **esclusivamente** nel progetto Supabase EasyGart `xdwsqkteykjjpzogwocx`, dopo la migrazione delle presenze. Senza questa migrazione i pulsanti di cancellazione non si attivano. Il repository non applica automaticamente la modifica al database.

Il pulsante **Elimina orario / Zeiteintrag löschen** appare soltanto per turni conclusi che l'utente è autorizzato a cancellare. I dati originali restano nel database con `deleted_at` e `deleted_by`, ma non sono conteggiati nello storico attivo, nei due calendari né nel riepilogo mensile delle **timbrature**. Se per la stessa giornata esiste un rapporto con ore dichiarate, quelle restano visibili e vengono conteggiate secondo le regole del riepilogo. Le timbrature attive non possono essere eliminate.

Prima dell'uso reale, verificare con almeno due dipendenti: cancellazione del proprio turno chiuso, impossibilità di cancellare quello altrui, impossibilità di cancellare un turno aperto, visibilità audit al titolare e aggiornamento dei totali.

## Sicurezza e limiti
- Supabase RLS protegge 17 tabelle di business; lo schema privato ospita la logica privilegiata e le API esposte non usano SECURITY DEFINER.
- Il bucket delle foto/firme è privato; le anteprime impiegano URL temporanei.
- Le nuove registrazioni richiedono almeno 12 caratteri nel frontend, ma servono anche regole Auth lato server. Il controllo delle password violate è disponibile su Supabase Pro.
- Prima di impiegare dati veri occorrono informativa privacy, basi giuridiche e tempi di conservazione, backup PostgreSQL/Storage con ripristino verificato e collaudo su due account reali. La funzionalità ZIP non sostituisce queste verifiche.
- La registrazione presenze non sostituisce automaticamente tutti gli adempimenti legali relativi al lavoro. Il catalogo registra consumi, non è un inventario di magazzino completo.

## Schema e test
Nel progetto EasyGart sono state applicate le migrazioni core, rapporti, presenze, storage privato, protezione delle RPC, business e pianificazione Cron.
I test SQL a identità simulate, entro transazioni con rollback, hanno coperto: isolamento tra dipendenti, piano ricorrente, timbrature, consumi, allegati riservati, approvazione, bozza proforma e idempotenza.
GitHub Actions esegue test statici su ogni modifica Cloud e un collaudo browser WebKit/Chromium (emulazione, non dispositivo fisico).

## Rilascio e recupero

La procedura di backup amministrativo, il ripristino in un progetto di prova e la checklist finale iOS/Android sono in [RELEASE_AND_RECOVERY.md](./RELEASE_AND_RECOVERY.md).
