# EasyGart

Gestionale per aziende di giardinaggio, in preparazione.

## Neon backend

- Organization ID: `org-proud-hall-00818085`
- Project ID: `noisy-darkness-89238153`
- Connessioni: `DATABASE_URL` (pooled, server-only) e `DATABASE_URL_UNPOOLED` (direct, migrazioni)

**Attenzione:** il repository contiene per ora solo lo scheletro di collegamento Neon. Nessuna connection string reale è stata recuperata o pubblicata; il frontend completo e la migrazione da Supabase non sono ancora presenti nel repository. Non usare questo codice per gestire dati reali.

Per configurare: consulta `.env.example`, inserisci i valori privati nelle variabili d'ambiente del progetto di hosting e installa `@neondatabase/serverless`. Non committare `.env.local` e non esporre i segreti con il prefisso `VITE_`.

Dopo la configurazione, l'endpoint `/api/db-health` su Vercel potrà verificare la connessione con `SELECT 1`.
