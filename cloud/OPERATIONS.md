# EasyGart Cloud: installazione e utilizzo su iOS e Android

Versione 16 novembre 2026. Sito: https://easygarte.vercel.app/cloud/
Progetto Supabase corretto: xdwsqkteykjjpzogwocx.

## Installazione
**iPhone/iPad:** aprire il sito con Safari → Condividi → Aggiungi alla schermata Home → Aggiungi. Attivare "Apri come app" quando proposto.
**Android:** aprire con Chrome → menu ⋮ → Installa app (oppure Aggiungi a schermata Home).

EasyGart è una PWA, non un'app nativa App Store/Play Store. Servono Internet e una sessione Supabase valida per autenticarsi e salvare operazioni. Un service worker memorizza solo l'interfaccia pubblica, mai le risposte o i file personali di Supabase. I testi di alcuni moduli sono conservati nella sessione del browser per massimo 24 ore per recupero dopo un errore, escludendo password, email di accesso, firme e immagini.

## Dipendente
- Incarichi assegnati, aggiornamento stato, rapporti con bozza/invio/correzioni.
- Timbratura del turno e delle pause con orario del database.
- Consumi materiali associati ai rapporti, senza prezzi.
- Fino a 3 foto prima e 3 dopo per rapporto, massimo 5 MB ciascuna, in Storage privato. Formati supportati JPEG/PNG/WebP, conversione HEIC dove supportata dal browser.
- Firma sullo schermo del cliente presente, con nome e consenso. È una presa visione, non una firma elettronica qualificata.

## Titolare
- Clienti/cantieri, inviti dipendenti, assegnazioni e revisione rapporti.
- Catalogo materiali con unità, prezzo di acquisto e di vendita e IVA.
- Manutenzioni settimanali, bisettimanali, mensili e trimestrali. La funzione Cron genera task futuri ogni giorno alle 05:15 UTC e previene i duplicati.
- Bozze proforma con ore e consumi da rapporto approvato, righe modificabili e stampa/Salva PDF. Non sono fatture elettroniche e non vengono inviate al Sistema di Interscambio.
- Esportazione JSON dei dati gestionali oppure ZIP con file originali di foto/firma, entrambi accessibili soltanto al titolare. Lo ZIP non include l'intero ambiente Auth né sostituisce un backup PostgreSQL/Storage ripristinabile. Il download contiene dati personali e va protetto.

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
