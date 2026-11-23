# EasyGart

Gestionale per imprese di giardinaggio e manutenzione del verde, con interfaccia **italiana e tedesca**.

## App Cloud multiutente

**[Apri EasyGart Cloud](https://easygarte.vercel.app/cloud/)**

La versione Cloud è una **Progressive Web App (PWA)** installabile su iPhone e Android. Usa Supabase Auth, PostgreSQL con Row Level Security e Supabase Storage privato. Richiede Internet per autenticazione e salvataggio. Non è un'app nativa pubblicata negli store.

**Titolare:** aziende, clienti e cantieri, dipendenti/inviti, assegnazioni, controllo dei rapporti, catalogo materiali e prezzi, manutenzioni ricorrenti, bozze proforma, esportazione JSON/ZIP con allegati autorizzati.

**Dipendente:** compiti assegnati, timbrature e pause registrate dal server, rapporti di intervento, consumi materiali senza prezzi, foto prima/dopo e firma cliente come presa visione.

**Account:** registrazione con conferma email, recupero password e modifica della password. La lingua IT/DE può essere cambiata dall'interfaccia.

### Installazione

- **iOS:** Safari → Condividi → Aggiungi alla schermata Home.
- **Android:** Chrome → menu → Installa app.

La PWA mantiene offline soltanto i file pubblici dell'interfaccia; **non** memorizza in cache le risposte private del database o i file Storage. Non è un gestionale offline con sincronizzazione differita.

### Stato del rilascio

**Release candidate tecnica, non ancora autorizzata per dati reali.** Il codice e i test automatici non sostituiscono le verifiche su dispositivi fisici, i test di accesso con utenti autentici, le procedure privacy/lavoro e il backup con prova di ripristino. I dettagli e la checklist sono in **[RELEASE_AND_RECOVERY.md](cloud/RELEASE_AND_RECOVERY.md)**.

### Documentazione e database

- [Uso Cloud iOS/Android](cloud/OPERATIONS.md)
- [Configurazione Supabase](cloud/SETUP.md)
- [Backup, ripristino e rilascio](cloud/RELEASE_AND_RECOVERY.md)
- [Migrazioni SQL](supabase/)
- [Annullamento timbrature concluse](supabase/easygart_shift_soft_delete_v1.sql) (migrazione da applicare sul progetto EasyGart prima di usare la funzione)
- [Verifiche automatiche](tests/)

Il progetto Supabase Cloud è xdwsqkteykjjpzogwocx. Le migrazioni core, rapporti, presenze, media privati, confini RPC, business e pianificazione Cron sono state applicate al progetto corretto. La migrazione easygart_fk_indexes_v1.sql aggiunge indici per le chiavi esterne ed è idempotente.

**Sicurezza:** RLS sulle tabelle EasyGart, bucket privato per foto/firme, permessi distinti per titolare e dipendenti, header CSP e anti-clickjacking su Vercel. Non inserire mai password, service-role key o stringhe di connessione nel repository.

**Test:** GitHub Actions esegue controlli Node, test di browser mobile emulati (WebKit/Chromium) e una verifica pubblica in sola lettura della distribuzione Vercel. Le verifiche automatiche non sostituiscono collaudi reali.

## Demo indipendente

La pagina radice **[easygarte.vercel.app](https://easygarte.vercel.app/)** resta una demo storica che salva i dati **solo nel browser**. Non offre autenticazione o sincronizzazione Cloud. Non inserirvi dati di clienti, lavoratori o firme reali. La demo e la versione Cloud sono prodotti separati.

## Limiti funzionali

Le proforma non sono fatture elettroniche, non hanno emissione fiscale e non vengono inviate allo SDI. Le timbrature non sostituiscono automaticamente gli adempimenti giuslavoristici. I consumi materiali non costituiscono un magazzino completo. L'esportazione JSON/ZIP non sostituisce un backup PostgreSQL e Storage ripristinabile.
