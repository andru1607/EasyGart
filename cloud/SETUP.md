# EasyGart Cloud e Supabase: attivazione

Stato: Cloud collegato al progetto EasyGart su Supabase e migrazioni applicate. Vedere [OPERATIONS.md](./OPERATIONS.md) per l'uso iOS/Android, le funzioni gestionali e i limiti di produzione.

## Risorse corrette
- Demo: https://easygarte.vercel.app/
- Cloud: https://easygarte.vercel.app/cloud/
- Repository: https://github.com/andru1607/EasyGart
- Progetto Supabase destinato a EasyGart: xdwsqkteykjjpzogwocx
- SQL base: supabase/easygart_core_v1.sql
- SQL aggiuntivo rapporti giornalieri: supabase/easygart_daily_reports_v1.sql
- Il collegamento ChatGPT vede ancora un altro progetto inattivo: fcvnwexavnqqpqwwiwqx. NON eseguire la migrazione lì.

## Passaggi per completare l'attivazione
1. Apri https://supabase.com/dashboard/project/xdwsqkteykjjpzogwocx e verifica Project Settings > Project ID.
2. Apri SQL Editor > New Query. Copia tutto il contenuto di https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_core_v1.sql. Rivedi lo script e premi Run UNA SOLA VOLTA nel progetto corretto. Lo script non è ancora stato eseguito su PostgreSQL reale.
3. La chiave pubblica publishable è già configurata nel repository, non è necessario copiarla di nuovo. Mai usare sb_secret_, service_role, password o connection string nel frontend.
4. Dopo aver verificato l'esecuzione della migrazione base, apri una NUOVA query nel SQL Editor del medesimo progetto e applica https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_daily_reports_v1.sql. Questo script aggiuntivo crea rapporti giornalieri, revisioni e regole di accesso.
5. In Supabase > Authentication > URL Configuration imposta Site URL a https://easygarte.vercel.app/cloud/ e aggiungi lo stesso Redirect URL. Lascia attiva la conferma email.
6. Apri https://easygarte.vercel.app/cloud/. Crea un account titolare, conferma la tua email, accedi e crea una società.
7. Crea cliente e cantiere, invita un dipendente tramite email dal pannello squadra, condividigli il link del portale.
8. Il dipendente si registra con la STESSA email, verifica l'email e accetta gli inviti. Il titolare assegna i compiti; il dipendente li vede e può segnarli iniziati o completati.

## Prove obbligatorie prima di usare dati reali
- Due aziende diverse non leggono o modificano i dati reciproci.
- Un dipendente non può creare/riassegnare compiti con chiamate dirette all'API.
- Il dipendente vede soltanto i compiti a lui assegnati.
- Revocando un dipendente, nuove richieste vengono rifiutate.
- Inviti non verificati o scaduti non vengono accettati.
- Verifica di RLS su PostgreSQL, differenze tra aziende, eventi in concorrenza, redirect Auth, iPhone e Android.
- Configurazione di SMTP, backup e GDPR prima dell'uso lavorativo.

## Risoluzione errore creazione azienda (RLS)
Se dopo il login compare `new row violates row-level security policy for table "eg_companies"`, non disattivare RLS e non creare un altro account.
1. Apri **esclusivamente** il progetto Supabase EasyGart `xdwsqkteykjjpzogwocx`.
2. Nel SQL Editor, crea una nuova query e incolla tutto il contenuto di [easygart_company_creation_fix.sql](../supabase/easygart_company_creation_fix.sql).
3. Esegui lo script. L'ultima SELECT mostra le policy applicate. Il file è transazionale e non cancella dati aziendali.
4. Torna a https://easygarte.vercel.app/cloud/ e riprova **Crea azienda** con l'account già esistente.
5. Verifica che la dashboard mostri l'azienda appena creata e che il titolare sia presente nella sezione squadra.

Questa correzione ripristina le regole di INSERT per il titolare e il trigger che crea automaticamente la sua membership. Non concede permessi ad anon e non consente a un utente di scegliere arbitrariamente il proprietario. I test automatici verificano il codice, ma la prova con due account sul database reale rimane necessaria.

## Rapporti giornalieri dipendente → titolare
Dopo l'applicazione della migrazione aggiuntiva:
1. Il titolare assegna un compito a un dipendente.
2. Il dipendente entra in **Rapporti giornalieri** e preme **Nuovo rapporto**; sceglie il compito assegnato, indica data, minuti effettivi, lavori effettuati, materiali e imprevisti.
3. Il dipendente può **Salva bozza** oppure **Invia al titolare**. Per inviare sono richiesti almeno 10 caratteri di descrizione e minuti effettivi > 0.
4. Il titolare vede il rapporto nella sua sezione **Rapporti giornalieri**, può **Approva** o **Richiedi correzioni** con un feedback.
5. Il dipendente può correggere e reinviare soltanto se il titolare lo richiede.
6. Stato approvazione e storico eventi sono registrati in Supabase; il portale aggiorna il riepilogo periodicamente, non manda notifiche push.

La migrazione aggiuntiva va eseguita DOPO il file SQL base, sempre e soltanto nel progetto EasyGart. Se non è stata applicata, il portale mostra un avviso e il modulo compiti rimane utilizzabile.

## Timbrature, pause, fotografie e firma cliente

Attivazione **separata**, sullo stesso progetto Supabase EasyGart, senza modificare gli altri servizi:

1. Verifica che lo script base e lo script dei rapporti giornalieri siano già stati applicati con esito **Success**.
2. Apri una **nuova query SQL** nel progetto ID `xdwsqkteykjjpzogwocx` e applica tutto [easygart_attendance_v1.sql](../supabase/easygart_attendance_v1.sql). Crea `eg_shifts` e `eg_shift_events`, con RLS e funzione `eg_shift_action`.
3. Apri un'altra **nuova query SQL** dello stesso progetto e applica tutto [easygart_private_media_v1.sql](../supabase/easygart_private_media_v1.sql). Crea `eg_report_media`, un bucket privato `eg-report-media`, policy Storage e funzioni di prenotazione/finalizzazione/rimozione.
4. Riapri **https://easygarte.vercel.app/cloud/** in una sessione già autenticata e premi **Ricarica**. Le nuove sezioni appaiono solo dopo aver applicato gli script.
5. Prova **con dati fittizi** su due dispositivi: il dipendente preme **Entra → Inizia pausa → Termina pausa → Esci dal turno**, mentre il titolare verifica le ore e le pause.
6. Dal proprio account il dipendente crea un rapporto sul compito assegnato, lo **salva come bozza**, aggiunge fino a **3 foto prima e 3 foto dopo**, chiede al cliente presente di firmare sullo schermo (nome e consenso richiesti) e infine invia il rapporto. Il titolare lo vede con fotografie e presa visione, approva o chiede correzioni.

**Regole e limitazioni:**
- Orari del turno e delle pause generati sul server. I dipendenti possono visualizzare e registrare solo i propri turni. Il titolare consulta la squadra, senza poter alterare retroattivamente gli orari tramite l'app.
- Più turni al giorno sono consentiti; un solo turno aperto per dipendente e azienda. La pausa aperta è chiusa automaticamente all'uscita.
- Le foto non usano un bucket pubblico: i caricamenti richiedono un rapporto personale **in bozza o da correggere**, e l'accesso avviene tramite URL firmati temporanei. Fino a **5 MB per file**, JPEG/PNG/WebP; il browser tenta di convertire i formati iPhone supportati. Le autorizzazioni di Storage e i metadati sono controllati da RLS e RPC.
- Firma del cliente raccolta sul dispositivo: obbligatori tratto disegnato, nome e consenso; una firma per rapporto. È una **presa visione**, non una firma elettronica avanzata o qualificata; per impieghi con valore legale specifico servono ulteriori verifiche e procedure.
- Una volta inviato o approvato un rapporto, gli allegati non sono più modificabili dal dipendente fino a eventuale richiesta di correzioni.
- Le foto, le firme e i dati personali non devono essere usati in produzione prima dei test reali di RLS, retention, privacy, informativa e consenso, backups e procedure di cancellazione.
- La sincronizzazione non è in tempo reale continuo: il portale aggiorna i dati periodicamente (circa 30 secondi) o tramite il pulsante Ricarica.

**Test obbligatori su Supabase reale:**
- Worker A non vede, scarica, modifica o cancella immagini, firme e turni di Worker B, né quelli di un'altra azienda.
- Il titolare della stessa azienda legge i documenti della squadra, ma gli altri titolari non possono accedere ai file privati anche conoscendone il percorso.
- Un dipendente disattivato non può fare nuove timbrature né prenotare/caricare foto o firme.
- Inviare un rapporto impedisce nuovi upload, mentre la bozza permette cancellazione e sostituzione. Verificare limiti 3/3 e firma unica, due tentativi simultanei, errori e pulizia dei caricamenti incompleti.
- Controllare Safari iOS per scelta foto, HEIC, navigazione e firma touch, su rete reale e con due account autentici. I test automatici attuali sono unitari/statici e **non sostituiscono questi controlli**.

## Stato delle funzionalità
La nuova app Cloud comprende account, aziende, clienti, cantieri, inviti, assegnazioni, avanzamento, revoca dei dipendenti, rapporti giornalieri, **timbrature e pause, foto prima/dopo e firma cliente**, dopo l'attivazione dei rispettivi SQL e la verifica in ambiente reale. Manutenzioni ricorrenti, listini materiali e fatture della demo NON sono ancora migrati al Cloud. I dati della demo nel browser non si sincronizzano automaticamente.

## File
- cloud/index.html: portale responsive
- cloud/app.js: autenticazione e interazione con Supabase
- cloud/config.js: URL e segnaposto per chiave pubblicabile
- supabase/easygart_core_v1.sql: schema, grants, RLS e RPC
- supabase/easygart_daily_reports_v1.sql: rapporti giornalieri, verifica titolare, audit eventi e RLS
- supabase/easygart_company_creation_fix.sql: correzione mirata RLS per creazione azienda
- tests/cloud-static.test.mjs: test statici GitHub Actions
- tests/cloud-daily-reports.test.mjs: test su permessi SQL e viste dipendente/titolare

Non inserire dati reali prima dei test di sicurezza su database.

- supabase/easygart_attendance_v1.sql: timbrature, pause, eventi e RLS
- supabase/easygart_private_media_v1.sql: storage privato, foto, firme, prenotazioni e RLS
- cloud/operations.js: moduli operativi Cloud
- tests/cloud-operations.test.mjs: test automatici delle nuove funzioni

## Moduli e installazione 2026-11-16
Per catalogo, consumi, manutenzioni automatiche, proforma, esportazione JSON e installazione iOS/Android vedere [OPERATIONS.md](./OPERATIONS.md).
