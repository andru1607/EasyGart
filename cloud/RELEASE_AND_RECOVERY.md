# EasyGart Cloud: salvataggi, recupero e rilascio operativo

**Progetto Supabase:** `xdwsqkteykjjpzogwocx`.
**Portale:** https://easygarte.vercel.app/cloud/
**Stato:** candidato al rilascio, non dichiarare uso produttivo certificato senza completare i gate finali qui sotto.

## 1. Copia aziendale tramite app

Accesso titolare > **Dati ed esportazione**:

- **Prepara JSON:** dati gestionali aziendali in formato aperto, senza file originali.
- **Prepara ZIP con foto e firme:** contiene `easygart-export.json`, un README e gli allegati originali archiviati nel bucket privato `eg-report-media`.
- Dopo la preparazione, premere **Scarica**. Il passaggio esplicito è richiesto per compatibilità con Safari/iOS.
- È consentito soltanto al titolare della specifica azienda tramite Supabase Auth, RPC e RLS. I file vengono letti con autorizzazioni Storage del titolare, senza URL pubblici.
- Limiti per dispositivo: dimensione massima del contenuto ZIP 100 MiB e massimo 350 elementi, inclusi manifest e README. Se il limite viene superato, il download è interrotto con un errore; eseguire il backup amministrativo.
- Non inviare ZIP via chat o email non protette. Contiene dati personali, fotografie, orari dei dipendenti e firme. Archiviare con cifratura e accessi limitati; eliminare le copie non necessarie.

**ATTENZIONE:** questo ZIP **non ripristina il progetto automaticamente** e non include necessariamente tutto l'ambiente Auth, i segreti, le impostazioni di rete, le estensioni o i metadati della piattaforma. Non sostituisce un backup PostgreSQL e Supabase Storage.

## 2. Backup amministrativo completo

Su piano Supabase Free i backup giornalieri gestiti **non sono disponibili**. Prima di usare dati reali, impostare una procedura documentata di copie esterne.

1. Installare Supabase CLI e i requisiti indicati dalla documentazione Supabase.
2. Recuperare dal Dashboard la stringa di connessione al database corretto. **Non salvarla nel repository** e non incollarla in chat o log pubblici.
3. Eseguire da un computer amministrativo con accessi sicuri e privilegi adeguati:

```bash
# Definire SUPABASE_DB_URL soltanto nella sessione di shell protetta.
mkdir -p easygart-backup
supabase db dump --db-url "$SUPABASE_DB_URL" -f easygart-backup/roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f easygart-backup/schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f easygart-backup/data.sql --use-copy --data-only
```

4. Scaricare **separatamente** tutti i file di Supabase Storage, almeno quelli del bucket privato `eg-report-media`. La copia del solo database conserva metadati Storage, **non i file originali**.
5. Conservare una copia cifrata **fuori** dal server Supabase e dal dispositivo usato dai dipendenti; registrare data, dimensioni, verifica di integrità, ubicazione e responsabile.
6. Impostare e verificare una frequenza di salvataggio coerente con la perdita massima di dati tollerabile (RPO). Per una piccola attività, valutare copie frequenti e almeno una prova periodica di ripristino. Il piano va approvato dall'azienda.

Documentazione ufficiale:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/storage/management/download-objects

## 3. Prova di ripristino

**Non testare il ripristino sul database EasyGart di produzione.**

- Creare un **secondo progetto Supabase di prova** separato, autorizzando prima eventuali costi.
- Seguire il flusso di ripristino Supabase CLI per ruoli, schema e dati. Configurare le credenziali e i segreti necessari **separatamente**.
- Ripristinare anche gli oggetti Storage nel bucket privato; non renderlo pubblico.
- Verificare conteggi e integrità referenziale delle tabelle, accesso del titolare, mansioni, turni, rapporti, consumi, proforma e allegati.
- Ripetere test RLS con due aziende e almeno due dipendenti: nessun accesso incrociato.
- Conservare un verbale di prova con tempi di ripristino (RTO), eventuali errori e correzioni.

Una copia JSON/ZIP non deve essere presentata come prova di ripristino fino al completamento di questo test.

## 4. Rilascio iOS e Android

- Installabile come **PWA**: Safari > Condividi > Aggiungi alla schermata Home; Chrome Android > Installa app.
- La PWA **non** è una versione nativa distribuita su App Store o Google Play.
- Online necessario per autenticazione, timbrature, foto, firme e salvataggio. Offline la cache contiene soltanto l'interfaccia, **non** dati aziendali sincronizzati.
- Verificare su un iPhone e un Android **fisici**: registrazione, accesso, installazione, cambio IT/DE, foto camera/HEIC, firma touch, esportazioni, cambio rete e riapertura dopo inattività.
- Controllare aggiornamenti alla PWA, icone, dimensioni, rotazione schermo, accessibilità (focus e leggibilità).
- Test browser automatici GitHub Actions: WebKit iOS-like e Chromium Android-like con backend simulato; **non** equivalgono a test su dispositivi reali o accessi Supabase autentici.

## 5. Gate amministrativi e privacy (obbligatori prima di dati reali)

- Identificare il titolare del trattamento, recapito per privacy, responsabili/fornitori e informativa applicabile a dipendenti/clienti.
- Definire basi giuridiche, accessi, limitazioni, tempi di conservazione di timbrature, foto, rapporti, firme e richieste di cancellazione. Non impostare scadenze automatiche senza una decisione aziendale.
- Chiarire che la firma cliente nell'app è **presa visione** e non firma elettronica qualificata.
- Verificare adempimenti di diritto del lavoro e registrazione presenze prima di considerarla un sostituto di sistemi presenze ufficiali.
- Impostare requisiti password **lato Supabase Auth**, non solo frontend. La protezione di password compromesse richiede piano compatibile.
- Eseguire il primo backup **reale**, completo di Storage, e riuscire a ripristinarlo su ambiente di prova.
- Completare test end-to-end con account separati e autorizzazioni reali. Non usare credenziali di utenti o aziende reali come fixture di test.

## 6. Distinzione tra funzionalità e limiti

- **Completato nel codice:** multi-azienda, inviti e ruoli, compiti, turni/pause, rapporti, foto, firme, catalogo, consumi, pianificazione ricorrente server, proforma stampabili, IT/DE, PWA e export JSON/ZIP.
- **Non equivale a fatturazione elettronica:** le proforma non hanno numerazione fiscale, invio SDI o gestione imposte da commercialista.
- **Non equivale a inventario di magazzino:** i consumi non gestiscono in automatico giacenze, lotti e ordini fornitori.
- **Da validare esternamente:** test fisici iPhone/Android, privacy/legale, requisiti password server e procedura di ripristino documentata.

### Criterio di via libera

Dichiarare **produzione autorizzata** solo quando tutti i gate amministrativi sono risolti e i test con due account reali, backup/ripristino e dispositivi fisici sono superati. Fino ad allora usare solo dati fittizi o beta controllata.
