# EasyGart Cloud: installazione e utilizzo su iOS e Android

Versione 16 novembre 2026. Sito: https://easygarte.vercel.app/cloud/
Progetto Supabase corretto: xdwsqkteykjjpzogwocx.

## Installazione
**iPhone/iPad:** aprire il sito con Safari → Condividi → Aggiungi alla schermata Home → Aggiungi. Attivare "Apri come app" quando proposto.
**Android:** aprire con Chrome → menu ⋮ → Installa app (oppure Aggiungi a schermata Home).

EasyGart è una PWA, non un'app nativa App Store/Play Store. Servono Internet e una sessione Supabase valida per autenticarsi e salvare operazioni. Un service worker memorizza solo l'interfaccia pubblica, mai le risposte o i file personali di Supabase. I testi di alcuni moduli sono conservati nella sessione del browser per massimo 24 ore per recupero dopo un errore, escludendo password, email di accesso, firme e immagini.

## Account e recupero password

Dalla schermata di accesso scegliere **Password dimenticata?**, inserire l'email e seguire il link ricevuto. Il collegamento riporta a EasyGart Cloud e permette di impostare una password nuova di almeno 12 caratteri. Dopo il cambio password è necessario effettuare nuovamente l'accesso. Chi è già autenticato trova **Sicurezza account** nell'intestazione. Il flusso è disponibile in italiano e tedesco. La consegna delle email richiede configurazione corretta di Supabase Auth/SMTP e URL di redirect autorizzati.

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
