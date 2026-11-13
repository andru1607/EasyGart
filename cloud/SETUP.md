# EasyGart Cloud e Supabase: attivazione

Stato: codice Cloud e migrazione pronti, NON ancora collegati a un database verificato. La demo principale continua a funzionare in locale.

## Risorse corrette
- Demo: https://easygarte.vercel.app/
- Cloud: https://easygarte.vercel.app/cloud/
- Repository: https://github.com/andru1607/EasyGart
- Progetto Supabase destinato a EasyGart: xdwsqkteykjjpzogwocx
- SQL da applicare: supabase/easygart_core_v1.sql
- Il collegamento ChatGPT vede ancora un altro progetto inattivo: fcvnwexavnqqpqwwiwqx. NON eseguire la migrazione lì.

## Passaggi per completare l'attivazione
1. Apri https://supabase.com/dashboard/project/xdwsqkteykjjpzogwocx e verifica Project Settings > Project ID.
2. Apri SQL Editor > New Query. Copia tutto il contenuto di https://github.com/andru1607/EasyGart/blob/main/supabase/easygart_core_v1.sql. Rivedi lo script e premi Run UNA SOLA VOLTA nel progetto corretto. Lo script non è ancora stato eseguito su PostgreSQL reale.
3. In Settings > API Keys copia ESCLUSIVAMENTE la chiave publishable che inizia con sb_publishable_. Non copiare sb_secret_, service_role, password o connection string.
4. Apri https://github.com/andru1607/EasyGart/blob/main/cloud/config.js e inserisci la chiave pubblica in publishableKey, lasciando invariato l'URL del progetto.
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

## Stato delle funzionalità
La nuova app Cloud comprende account, aziende, clienti, cantieri, inviti, assegnazioni, avanzamento e revoca dei dipendenti. Diario, turni, manutenzioni, foto, materiali e fatture della demo NON sono ancora migrati al Cloud. I dati del browser non si sincronizzano automaticamente.

## File
- cloud/index.html: portale responsive
- cloud/app.js: autenticazione e interazione con Supabase
- cloud/config.js: URL e segnaposto per chiave pubblicabile
- supabase/easygart_core_v1.sql: schema, grants, RLS e RPC
- tests/cloud-static.test.mjs: test statici GitHub Actions

Non inserire dati reali prima dei test di sicurezza su database.
