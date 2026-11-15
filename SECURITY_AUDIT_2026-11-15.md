# EasyGart Cloud: verifica della sicurezza
Data: 15 novembre 2026. Progetto Supabase: `xdwsqkteykjjpzogwocx`.

## Modifiche applicate al database reale
- Migrazione `supabase/easygart_security_rpc_boundary_v1.sql` applicata con esito positivo.
- 10 procedure con privilegi elevati spostate nello schema `private`, con 10 funzioni pubbliche `SECURITY INVOKER` compatibili con le chiamate originali.
- Nessuna procedura `eg_*` con `SECURITY DEFINER` rimane nello schema `public`.
- I permessi di esecuzione di tutte le 10 API pubbliche sono negati al ruolo anonimo, mentre rimangono disponibili agli utenti autenticati. I controlli autorizzativi restano nella logica privata originale.
- La RLS rimane attiva su tutte le 12 tabelle applicative. Si contano 21 policy applicative e 3 policy Storage, senza concedere scrittura diretta ad utenti anonimi.
- L'archivio `eg-report-media` resta privato.

## Verifiche eseguite
1. **Verifica RLS negativa in transazione con rollback**: un'identità autenticata fittizia priva di appartenenza vede zero aziende, dipendenti, timbrature, rapporti e foto.
2. **Verifica RPC negativa in transazione con rollback**: timbratura, prenotazione allegati e inviti da parte dell'identità fittizia vengono respinti.
3. **Verifica account titolare in transazione con rollback**: appartenenza e lettura della propria azienda conservate.
4. **Verifica anonimo**: SELECT su `eg_companies` rifiutata per mancanza di permessi. Nessun accesso a procedure Cloud per il ruolo anonimo.
5. **Verifica permessi e policy**: 12 tabelle con RLS; nessun permesso INSERT/UPDATE/DELETE per anon sulle tabelle Cloud; nessuna scrittura diretta da utenti autenticati verso turni, rapporti e media.
6. **Security Advisor Supabase**: eliminati i 10 avvisi `authenticated_security_definer_function_executable`. Resta un avviso Auth relativo alle password compromesse.
7. **Test repository GitHub Actions**: test automatici della migrazione e dell'interfaccia inclusi nel workflow `EasyGart Cloud static checks`.

## Punto ancora aperto: password compromesse
Il progetto Supabase usa il piano **Free**. Supabase documenta che **Leaked Password Protection** è disponibile da **Pro** in poi: non possiamo abilitarla nel piano attuale tramite SQL o frontend. L'account deve poter accedere alle impostazioni in Supabase.

Misure attuate nell'interfaccia EasyGart: nuove registrazioni con password di almeno 12 caratteri; login esistenti invariati. La validazione frontend è un ausilio all'utente, **non** sostituisce l'impostazione di sicurezza del server. In `Supabase → Authentication → Providers → Email` impostare, ove disponibile, password minima di almeno 12 caratteri, requisiti appropriati e conferma email. Per il controllo automatico delle password violate occorre un piano compatibile.

Verificare inoltre che lo schema `private` non sia incluso in **Project Settings → Data API → Exposed Schemas**, e considerare MFA per gli account amministrativi.

## Limiti del collaudo
I controlli PostgreSQL su account fittizi sono riusciti, ma non equivalgono a test end-to-end su due veri account Auth con Safari/iPhone. Prima dell'impiego con dati reali occorre verificare registrazione/invito, permessi di accesso, timbrature, allegati privati, cancellazioni, rifiuto di link non autorizzati, privacy, informativa e conservazione. I test di sola struttura non attestano la sicurezza totale dell'app.

## Documentazione
- [Password security](https://supabase.com/docs/guides/auth/password-security)
- [Avviso Supabase sulle funzioni SECURITY DEFINER](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable)
