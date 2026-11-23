# EasyGart Cloud: importazione da screenshot (titolare)

**Funzione:** importa informazioni di orari e clienti da screenshot delle Note, con lettura OCR locale sul dispositivo e revisione obbligatoria.

## Come funziona

1. Accedi con l'account **titolare**.
2. Dalla Home, dal Menu, dal Calendario oppure da Clienti e cantieri scegli **Importa screenshot**.
3. Seleziona **Orari e rapporti** oppure **Clienti**.
4. Scegli lo screenshot dalla galleria iPhone. Se il riconoscimento non parte, puoi copiare il testo dalle Note e incollarlo nell'app.
5. Correggi il testo riconosciuto, premi **Analizza testo**, quindi controlla tutte le righe della tabella. Ogni riga si può correggere, disattivare oppure aggiungere manualmente.
6. Premi **Conferma e importa**. Nessuna riga viene salvata automaticamente solo per aver caricato un'immagine.

### Orari

L'importatore cerca date, nominativi, ora di inizio, fine, pausa e cantiere nelle note. Esempio:

```
15/11/2026 Marco Rossi 08:00-16:30 pausa 30 Giardino Rossi
15/11/2026 Luca Bianchi 09:00-17:00 pausa 45 Villa Arco
```

Se il nome del dipendente o il cantiere non corrisponde con certezza ai dati già presenti in EasyGart, occorre selezionarlo manualmente. Se manca l'anno, il sistema lo propone ma lo segnala come **da verificare**.

Per ogni riga confermata viene creato un **rapporto giornaliero in bozza con orari dichiarati**, usando l'RPC esistente `eg_save_daily_report_v5`. I dati appaiono nel Calendario **Solo orari**, nel Calendario **Orari e rapporti** e nei riepiloghi. **Non sono timbrature reali**, non cambiano gli eventi server di ingresso e uscita e non dimostrano che quelle ore siano state effettivamente lavorate. Il rapporto rimane una bozza da completare con il lavoro svolto. I duplicati rilevati vengono bloccati.

### Clienti

Esempio:

```
Nome: Mario Rossi
Telefono: +39 349 123 4567
Email: mario@example.it
Indirizzo: Via Roma 12
```

È possibile importare anche un elenco di nominativi separati per riga. I nomi vengono confrontati con quelli già presenti per prevenire i duplicati. I contatti vengono salvati nelle colonne opzionali `phone`, `email`, `address` di `eg_clients`.

**Prima di importare clienti con recapiti**, il titolare deve applicare esclusivamente nel progetto Supabase EasyGart `xdwsqkteykjjpzogwocx` questa migrazione: [easygart_client_contacts_v1.sql](../supabase/easygart_client_contacts_v1.sql). Senza questa migrazione si possono importare i soli nominativi, ma se un elemento contiene telefono/email/indirizzo il salvataggio della riga viene bloccato per evitare perdite silenziose.

## Privacy e limiti

- L'immagine selezionata non viene caricata sul server EasyGart né salvata su Supabase. La libreria OCR, il motore WebAssembly e i pacchetti linguistici vengono **scaricati** da servizi esterni; il riconoscimento avviene sul dispositivo. Verificare le politiche aziendali prima di usare screenshot con dati sensibili.
- OCR basato su Tesseract.js 6.0.1. Gli screenshot di **testo digitato e ben leggibile** danno risultati migliori; la grafia a mano, le righe tagliate e le immagini sfocate possono causare errori.
- Non è garantita la precisione dei risultati OCR. Tutti gli orari e dati cliente devono essere ricontrollati prima di premere **Conferma e importa**.
- L'analisi è limitata a 60 righe per sessione e immagini di massimo 10 MB. I testi dell'immagine e le bozze di importazione restano nella sessione UI, non sono conservati in un archivio di screenshot.
- Possono importare soltanto gli utenti con ruolo **titolare**. Ogni salvataggio rispetta RLS e le funzioni SQL del progetto EasyGart.
- Richiesti: connessione Internet per scaricare inizialmente il motore OCR e salvare i dati, verifica su Safari/iPhone e almeno due account aziendali.
- La nuova migrazione dei contatti non risulta ancora applicabile tramite il collegamento Supabase disponibile a questa sessione: l'attivazione va verificata nel progetto corretto, non negli altri progetti.
