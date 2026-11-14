# Gestione C/C HA 1.1 — Piano tecnico di implementazione

> Versione di lavoro: **1.1**. La decisione finale tra 1.1 e 2.0 sarà presa soltanto dopo implementazione, collaudo e valutazione dell'impatto complessivo.

## Obiettivo e regola di sicurezza

Integrare l'add-on con Home Assistant per esporre esclusivamente lo stato tecnico dell'applicazione e consentire tre operazioni controllate (backup locale, backup Google Drive, controllo integrità).

**Home Assistant non deve poter conoscere il contenuto di Gestione C/C.** L'integrazione non legge il database, non esegue SQL, non accede al filesystem dell'add-on e non può scaricare database, backup o allegati.

## Stato iniziale verificato

- Il server applicativo è `gestione_cc/server.py`, basato su `ThreadingHTTPServer`, HTTPS e filtro IP `lan_network`.
- Il database SQLite e i backup sono gestiti dal server sotto `/data`.
- L'autenticazione web attuale usa PIN, session cookie HttpOnly/Secure/SameSite=Strict, CSRF e rate limiting per IP.
- Esistono già backup SQLite locali, backup Google Drive notturni, worker OCR e tabella `background_jobs`.
- Gli endpoint web esistenti per backup e restore restituiscono o scaricano dati completi: **non devono essere riutilizzati dall'integrazione**.
- Il repository corrente è quello dell'add-on. La custom integration HACS sarà aggiunta in una directory distinta `custom_components/gestione_cc`; non si deve alterare il repository Windows standalone.

## Architettura prevista

### 1. API tecnica dedicata

Prefisso versionato: `/api/integration/v1/`.

Endpoint di sola lettura:
- `health`: disponibilità, versione, uptime e latenza calcolata dal client.
- `database/status`: esito dell'ultimo controllo, data ultimo controllo, dimensione tecnica e data ultima scrittura; nessun contenuto o schema.
- `backups/status`: stato collegamento Drive, data/esito ultimo backup locale e Drive, conteggio copie locali (mai nomi o percorsi).
- `storage/status`: capacità, occupazione e spazio libero del volume dati, senza percorsi.
- `documents/status`: solo conteggio e byte aggregati degli allegati.
- `jobs/status`: conteggi aggregati OCR/background (queued/running/failed); nessun ID, payload, errore grezzo o riferimento a documenti.

Comandi POST consentiti:
- `backups/local`: avvia una copia SQLite locale.
- `backups/google-drive`: avvia backup Drive se collegato.
- `database/integrity-check`: esegue `PRAGMA integrity_check` in modo controllato.

Le risposte devono essere DTO espliciti con allowlist di campi. Non serializzare direttamente righe SQLite, eccezioni, oggetti di configurazione, risultati Drive o record dei job. Errori esterni normalizzati in codici generici. I comandi restituiscono solo stato e risultato tecnico sintetico, mai file, URL di download, percorsi, nomi, ID o contenuti.

### 2. Token di integrazione

- Credenziale dedicata, indipendente dal PIN e dalle sessioni browser.
- Generazione e revoca disponibili soltanto dopo autenticazione PIN nella UI Gestione C/C.
- Token casuale ad alta entropia, mostrato una sola volta al momento della creazione.
- Persistenza lato server del solo hash del token (con confronto a tempo costante); permessi fissi: lettura stati tecnici + avvio dei tre comandi.
- Nessun endpoint di esportazione o lettura contabile accessibile al token.
- La UI deve permettere revoca e rigenerazione. Non registrare mai il token nei log.
- L'integrazione memorizza la credenziale tramite il meccanismo di configurazione di Home Assistant; documentare che i file di configurazione HA non equivalgono a un vault cifrato.

### 3. Rete e TLS

- Mantenere HTTPS, verifica del certificato e filtro LAN.
- Nessun port forwarding, ingress pubblico, Nabu Casa o accesso WAN.
- Prima di abilitare la comunicazione HA Core → add-on, verificare la reale IP sorgente vista dal container e il comportamento della rete Supervisor. Non ampliare `lan_network`, non usare `host_network` e non indebolire TLS come scorciatoia.
- Se la topologia attuale impedisce la comunicazione, valutare una soluzione esplicita e limitata dopo test; nessuna eccezione generica o bypass.

### 4. Integrazione HACS

Directory `custom_components/gestione_cc` con:
- `manifest.json`, `config_flow.py`, `const.py`, `coordinator.py`, `sensor.py`, `binary_sensor.py`, `button.py`, `strings.json`, traduzioni e test.
- Configurazione guidata: URL HTTPS locale, token, verifica connessione.
- Polling differenziato: health 60 s; stato DB/backup/storage 5 min; OCR/jobs/documenti 2 min.
- Gestione timeout, errori TLS, token revocato, rate limiting e stato unavailable.
- Pulsanti con conferma e feedback stato; nessun comando distruttivo.

### 5. Registro accessi applicativo

Sezione protetta da PIN: **Impostazioni → Sicurezza → Registro accessi**.

Eventi: login riuscito/fallito, logout, scadenza sessione e blocco temporaneo. Campi: timestamp UTC, tipo evento, esito, identificativo sessione pseudonimo e IP di provenienza. Non registrare PIN, password, cookie, token, dati contabili o contenuto delle richieste.

- Retention confermata: **30 giorni**.
- IP: **sì**, conservato per lo stesso periodo massimo di 30 giorni, solo per sicurezza; nessuna geolocalizzazione o arricchimento esterno.
- Cancellazione automatica dei record scaduti.
- Registro consultabile solo nell'app dopo PIN; mai esposto all'API di integrazione né inviato a Home Assistant.
- Considerare proxy e indirizzi inoltrati non attendibili: usare l'IP del peer TCP effettivo, salvo futura configurazione esplicita di proxy fidato.

### 6. PWA e collegamento Companion

PWA come modalità primaria: manifest, icone, display standalone e installazione da Chrome su dispositivi compatibili. Nessun caching di API, HTML autenticato, database, documenti o risposte contabili; service worker, se presente, deve applicare una strategia conservativa e non conservare dati sensibili. PIN e scadenza sessione restano obbligatori.

Home Assistant Companion come accesso secondario tramite link LAN dedicato in dashboard o notifica. Nessun PIN/token nell'URL o nella notifica. L'URL non deve diventare pubblico. Non realizzare un'estensione Chrome.

### 7. Dashboard e automazioni

Dashboard tecnica opzionale con soli stati tecnici, sensori e pulsanti autorizzati. Esempi di automazioni per app non disponibile, database non integro, backup fallito/scaduto, spazio sotto soglia, backlog OCR e processi in errore. Notifiche generiche, senza dati finanziari, nomi di documenti o dettagli interni.

## Piano di lavoro e gate

1. **Audit e baseline** — verificare route, storage, TLS, filtro LAN, worker e test esistenti.
2. **Fondazione server sicura** — token hash/revoca, DTO allowlist, API health/status e test negativi che dimostrino l'assenza di campi sensibili.
3. **Comandi e job** — backup locale, backup Drive e integrity check; stato aggregato senza ID o output sensibili.
4. **Registro accessi** — migrazione schema non distruttiva, retention 30 giorni e IP; UI protetta e test.
5. **HACS integration** — config flow, coordinator, sensori, binary sensor, pulsanti, test e documentazione.
6. **PWA + Companion** — manifest, service worker conservativo, link LAN e istruzioni di installazione.
7. **Dashboard, automazioni, documentazione IT/EN**.
8. **Collaudo sicurezza e regressione** — solo dopo tutti i test si valuterà la versione finale e la pubblicazione.

## Criteri di accettazione obbligatori

- Token integrazione rifiutato da ogni endpoint contabile e da ogni endpoint non esplicitamente consentito.
- Nessuna risposta API contiene conti, movimenti, saldi, categorie, nomi file, percorsi, contenuti, ID documenti/job, SQL o eccezioni grezze.
- Nessun accesso diretto al DB o al filesystem dal codice custom integration.
- Test che verificano i campi esatti delle risposte (allowlist), non solo la presenza dei campi attesi.
- Test per token errato/revocato, CSRF, rate limiting, timeout, certificato non attendibile e rete non autorizzata.
- Verifica retention IP/log: 30 giorni.
- Nessuna modifica al PIN, ai dati esistenti o al comportamento di backup/restore senza test di regressione.
- Test PWA per assicurare che dati autenticati e API sensibili non siano memorizzati in cache.
- Collaudo finale nell'ambiente Home Assistant reale prima di qualsiasi aggiornamento dell'add-on.

## Vincoli operativi

- Nessuna modifica al repository Windows `stefanodr/gestione-cc`.
- Nessuna installazione, aggiornamento o modifica del database nell'istanza Home Assistant dell'utente durante lo sviluppo.
- Tutte le modifiche passano da branch e pull request; niente commit diretti su `main`.
- Nessun tag, release o scelta 1.1/2.0 prima della chiusura dei test e della valutazione finale.
