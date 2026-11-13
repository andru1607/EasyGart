# EasyGart

Gestionale per aziende di giardinaggio. **Versione demo online predisposta, non ancora abilitata su GitHub Pages.**

## Pubblicazione del sito (una sola attivazione GitHub)

1. Aprire **Settings → Pages** nel repository GitHub `andru1607/EasyGart`.
2. In **Build and deployment**, impostare **Source: Deploy from a branch**.
3. Scegliere **Branch: main**, cartella **/(root)** e premere **Save**.
4. Una volta completata la pubblicazione, il sito sarà su `https://andru1607.github.io/EasyGart/`.

Il file `index.html` è una demo indipendente e non necessita di build o dipendenze Node. Le modifiche a `main` aggiornano automaticamente il sito.

## Funzionalità demo

Dashboard, rapporti giornalieri con dettatura se supportata dal browser, presenze, attività, manutenzioni ricorrenti, rubrica clienti e cantieri, materiali e IVA, bozze fattura, fotografie, firma di presa visione e cambio lingua IT/DE.

## LIMITI DELLA VERSIONE PUBBLICA

Questa demo salva dati **soltanto nel browser locale** con localStorage. **Non ha autenticazione reale, sincronizzazione tra telefoni, database cloud, backup sicuri o fatturazione elettronica.** I dati demo non devono essere sostituiti con dati reali di lavoratori/clienti né con firme autentiche. L'indirizzo del sito è pubblico, anche se ciascuno vede i propri dati locali. L'installazione sullo smartphone dipende dal browser e dal supporto PWA. I documenti sono bozze/stampe di cortesia e non sostituiscono XML FatturaPA + invio SdI.

## Backend definitivo: Supabase

L'obiettivo è creare **un database Supabase separato**, configurare Auth e regole RLS per azienda, archiviazione privata per foto/firme, timbrature lato server, fatture e documenti. Le migrazioni pregresse v0.3.1 non sono state applicate a un database verificato: prima della pubblicazione con dati reali vanno testate con account di aziende differenti e controllate per sicurezza.

## File di preparazione precedenti

Il file `api/db-health.js` e `.env.example` provengono da una sperimentazione Neon non attiva; il frontend dimostrativo non li utilizza. **Non inserire mai credenziali nel repository**. Nessun database esterno è collegato alla demo.
