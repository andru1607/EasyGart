# EasyGart Cloud e Supabase: attivazione

Stato: codice Cloud e migrazione pronti, NON ancora collegati a un database verificato. La demo principale continua a funzionare in locale.

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

## Rapporti giornalieri dipendente → titolare
Dopo l'applicazione della migrazione aggiuntiva:
1. Il titolare assegna un compito a un dipendente.
2. Il dipendente entra in **Rapporti giornalieri** e preme **Nuovo rapporto**; sceglie il compito assegnato, indica data, minuti effettivi, lavori effettuati, materiali e imprevisti.
3. Il dipendente può **Salva bozza** oppure **Invia al titolare**. Per inviare sono richiesti almeno 10 caratteri di descrizione e minuti effettivi > 0.
4. Il titolare vede il rapporto nella sua sezione **Rapporti giornalieri**, può **Approva** o **Richiedi correzioni** con un feedback.
5. Il dipendente può correggere e reinviare soltanto se il titolare lo richiede.
6. Stato approvazione e storico eventi sono registrati in Supabase; il portale aggiorna il riepilogo periodicamente, non manda notifiche push.

La migrazione aggiuntiva va eseguita DOPO il file SQL base, sempre e soltanto nel progetto EasyGart. Se non è stata applicata, il portale mostra un avviso e il modulo compiti rimane utilizzabile.

## Stato delle funzionalità
La nuova app Cloud comprende account, aziende, clienti, cantieri, inviti, assegnazioni, avanzamento, revoca dei dipendenti e rapporti giornalieri dopo l'attivazione del relativo SQL. Timbrature, manutenzioni, foto e firme, listini materiali/fatture della demo NON sono ancora migrati al Cloud. I dati della demo nel browser non si sincronizzano automaticamente.

## File
- cloud/index.html: portale responsive
- cloud/app.js: autenticazione e interazione con Supabase
- cloud/config.js: URL e segnaposto per chiave pubblicabile
- supabase/easygart_core_v1.sql: schema, grants, RLS e RPC
- supabase/easygart_daily_reports_v1.sql: rapporti giornalieri, verifica titolare, audit eventi e RLS
- tests/cloud-static.test.mjs: test statici GitHub Actions
- tests/cloud-daily-reports.test.mjs: test su permessi SQL e viste dipendente/titolare

Non inserire dati reali prima dei test di sicurezza su database.
