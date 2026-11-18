# Integrazione Home Assistant — Gestione C/C

Custom integration HACS per il monitoraggio tecnico dell'Home Assistant App Gestione C/C e l'avvio di operazioni di manutenzione autorizzate. Versione dell'integrazione: **1.1.7**. Versione dell'applicazione distribuita con Home Assistant App 2.1.8: **2.1.8**.

L'integrazione non legge né trasferisce dati contabili, movimenti, saldi, documenti, file di backup o registro accessi.

## Requisiti
- Add-on Gestione C/C con API integrazione abilitata.
- Home Assistant Core in grado di raggiungere l'add-on attraverso la rete locale.
- Certificato CA privata dell'add-on installato in un percorso leggibile da Home Assistant Core.
- Token dedicato generato da Gestione C/C → Impostazioni → Integrazione Home Assistant.

## Installazione tramite HACS
1. Aprire **HACS → Integrazioni**.
2. Aprire il menu in alto a destra e scegliere **Repository personalizzati**.
3. Inserire `https://github.com/stefanodr/gestione-cc-home-assistant` e selezionare la categoria **Integrazione**.
4. Aggiungere il repository e installare **Gestione C/C**.
5. Riavviare Home Assistant.
6. Dalla pagina Impostazioni → Sicurezza di Gestione C/C, scaricare il certificato CA. Copiarlo nella cartella `/ssl` di Home Assistant (con nome `gestione-cc-ca.crt`) e verificare che Home Assistant Core possa leggerlo.
7. Aggiungere **Gestione C/C** da Impostazioni → Dispositivi e servizi.
8. Inserire URL HTTPS locale, token (campo mascherato) e percorso `/ssl/gestione-cc-ca.crt`. L'URL può usare l'IP privato configurato come `hostname` oppure `homeassistant.local`; il certificato contiene SAN per entrambi quando `hostname` è un IPv4.

### Installazione manuale per sviluppo
In alternativa, copiare la directory `custom_components/gestione_cc` in `/config/custom_components/gestione_cc`, quindi seguire i passaggi 5–8. La distribuzione prevista per gli utenti è tramite HACS.

Il token è conservato nei dati di configurazione Home Assistant, che non costituiscono un vault cifrato: proteggi backup e accesso amministrativo. La verifica TLS è obbligatoria: l'integrazione non disabilita la verifica del certificato e non accetta HTTP o URL pubblici. Per ruotare il token in questa prima versione: generare il nuovo token nell'app (l'operazione sostituisce immediatamente il precedente), copiarlo e poi rimuovere e aggiungere nuovamente l'integrazione in Home Assistant con il nuovo token. Durante la riconfigurazione l'integrazione resterà temporaneamente non disponibile. La funzione di riconfigurazione senza rimozione verrà valutata in una fase successiva.

## Sensori e comandi
L'integrazione espone disponibilità app, versioni app/add-on, uptime, dimensione/ultima modifica DB, backup, spazio, conteggio allegati, conteggi aggregati dei processi e contatori OCR separati (coda, in elaborazione, errori). I conteggi coprono gli ultimi 7 giorni. Sono previsti tre pulsanti: backup locale, backup Google Drive e controllo integrità.

Non vengono creati sensori finanziari e non vengono trasferiti conti, saldi, movimenti, descrizioni o contenuti documentali.

## Pulsanti di manutenzione

L'integrazione crea tre pulsanti nel dispositivo **Gestione C/C** di Home Assistant. Premendoli, Home Assistant invia un comando autenticato all'API tecnica dell'App. Il server accoda il lavoro e lo esegue in background: il pulsante non trasferisce il database dentro Home Assistant e non mostra il contenuto del backup.

### Backup locale (backup totale)

Crea una copia del database SQLite operativo nella cartella privata dei backup dell'App sul server Home Assistant. La copia viene generata con l'API di backup di SQLite, così da ottenere uno snapshot coerente anche se il database è in uso. Il server conserva le **ultime 30 copie locali** ed elimina quelle più vecchie.

È una copia completa del **database SQLite**, non un'esportazione CSV/JSON e non un invio a Google Drive. Rimane sullo stesso server: è utile per recuperare una versione precedente, ma non sostituisce una copia indipendente su un altro dispositivo o supporto.

### Backup Google Drive

Richiede che Google Drive sia già collegato e autorizzato nella sezione **Impostazioni → Backup · Google Drive** dell'App. Se non è collegato, il comando viene rifiutato e non parte alcun backup.

Quando viene premuto:
1. il server crea uno snapshot temporaneo del database SQLite;
2. carica il file nel Drive configurato, nella cartella di backup dell'app;
3. aggiorna la data dell'ultimo backup notturno registrato;
4. conserva gli ultimi **3 backup notturni** ed elimina quelli precedenti della stessa serie.

Il pulsante avvia quindi una copia su Google Drive, distinta dal backup locale. Il trasferimento avviene dal server verso Google Drive; Home Assistant riceve solo lo stato tecnico, non il file. I backup SQLite su Drive **non sono cifrati dall'app**: proteggi l'account Google e l'accesso alla cartella.

### Controllo integrità database

Esegue il comando SQLite `PRAGMA integrity_check` sul database operativo. Registra data ed esito dell'ultimo controllo e aggiorna il relativo sensore binario. Non crea un backup e non modifica intenzionalmente i dati.

**Nota sul nome:** nell'integrazione l'entità è denominata *Backup locale*; per “backup totale” si intende la copia SQLite del database, non un backup dell'intero server Home Assistant o della sua configurazione.

## PWA e collegamento Home Assistant Companion

L'add-on serve un manifest PWA con apertura `standalone`. Non viene registrato un service worker e non è attivata una cache offline: dati contabili, risposte API, pagine HTML e documenti non vengono memorizzati nella cache. Le risposte HTML/API restano `no-store` per evitare la persistenza di dati contabili sul dispositivo.

Da Chrome, aprire Gestione C/C e scegliere **Installa pagina come app** dal menu del browser. Edge consente **App → Installa questo sito come app**. Firefox su Windows 143 o successivo consente di aggiungere il sito come web app dalla barra degli indirizzi; per la build Microsoft Store è richiesta la versione 150 o successiva.

Per un accesso dalla Companion App, aggiungere alla dashboard Home Assistant una scheda Pulsante con azione URL (sostituire l'host se diverso):

```yaml
type: button
name: Apri Gestione C/C
icon: mdi:bank
tap_action:
  action: url
  url_path: https://192.168.1.27:8443/
```

Il link non contiene PIN o token. L'app richiede comunque il PIN all'apertura quando la sessione non è valida.

## Funzionamento e limitazioni
- Il config flow, il coordinator, i sensori, i binary sensor e i pulsanti sono disponibili per la configurazione e l'uso.
- Polling differenziato: health ogni 60 secondi; database, backup e storage ogni 5 minuti; allegati e processi ogni 2 minuti. Dopo un comando viene forzato un aggiornamento.
- I comandi sono accodati al worker dell'add-on e restituiscono subito `queued`; un solo comando di manutenzione può essere attivo alla volta. Il sensore dei processi mostra conteggi aggregati degli ultimi 7 giorni, senza identificativi o dettagli.
- L'add-on mantiene la LAN autorizzata e aggiunge una sola eccezione /32 per Home Assistant Core (`172.30.32.1/32`, rete interna documentata di Home Assistant OS). Quel peer può chiamare esclusivamente gli endpoint tecnici e i tre comandi: non può accedere a login, interfaccia, API contabili o gestione token. Il valore /32 va comunque confermato nel collaudo reale; non viene usato `host_network` e non si apre l'accesso WAN.
- L'integrazione è progettata per una rete locale privata. Non abilita l'accesso WAN e non deve essere pubblicata tramite port forwarding o reverse proxy pubblico.
- La versione dell'integrazione è indipendente dalle versioni dell'app e dell'Home Assistant App; gli aggiornamenti HACS e dell'App si gestiscono separatamente.

## Dashboard e automazioni di esempio

Sono disponibili esempi YAML in `docs/dashboard_gestione_cc.yaml` e `docs/automazioni_gestione_cc.yaml`. Prima di importarli, verificare gli entity_id effettivi creati da Home Assistant e sostituire `notify.notify` con il servizio di notifica desiderato. Nella dashboard, usare l'IP o il nome host LAN configurato nell'add-on.


## English

# Home Assistant integration — Gestione C/C

HACS custom integration for technical monitoring of the Gestione C/C Home Assistant App and for starting explicitly authorised maintenance operations. Integration version: **1.1.7**. Application version bundled with Home Assistant App 2.1.8: **2.1.8**.

The integration does not read or transfer accounting data, transactions, balances, documents, backup files or access logs.

### Requirements and setup
- Gestione C/C Home Assistant App running on the local network, with the integration API enabled.
- Home Assistant Core able to reach the App over the Supervisor network.
- The App's private CA installed at a path readable by Home Assistant Core.
- A dedicated token generated from Gestione C/C → Settings → Home Assistant Integration.

Install through **HACS → Integrations → Custom repositories**, add `https://github.com/stefanodr/gestione-cc-home-assistant` as an **Integration**, install Gestione C/C and restart Home Assistant. Then add the integration from **Settings → Devices & services**, providing the LAN HTTPS URL, dedicated token and CA path (for example `/ssl/gestione-cc-ca.crt`).

### Entities and security
The integration provides technical status and monitoring for app availability, versions, uptime, database, backups, storage, attachments and process counters. It also provides supported binary sensors and three maintenance buttons: local backup, Google Drive backup and integrity check. Process counters are aggregated for the last seven days and do not expose identifiers or details.

No financial sensors are created. Home Assistant cannot retrieve transactions, account names, balances, descriptions, documents or backup contents through this integration. TLS verification is mandatory; HTTP and public URLs are rejected. The add-on allows the configured LAN and a narrowly scoped /32 peer for Home Assistant Core, restricted to technical endpoints and the three maintenance commands. No WAN access is opened.

The token is stored in Home Assistant configuration and is not an encrypted vault. Protect Home Assistant backups and administrative access. To rotate the token, generate a new one in the app and reconfigure the integration using the replacement token; the old token is invalidated when the new one is generated.

## Maintenance buttons

The integration creates three buttons on the **Gestione C/C** device in Home Assistant. Pressing a button sends an authenticated command to the App's technical API. The server queues the task and runs it in the background: the button does not transfer the database into Home Assistant or display backup contents.

### Local backup (full database backup)

Creates a copy of the live SQLite database in the App's private backup directory on the Home Assistant host. It uses SQLite's backup API to produce a consistent snapshot while the database is in use. The server retains the **latest 30 local copies** and removes older ones.

This is a complete copy of the **SQLite database**, not a CSV/JSON export and not an upload to Google Drive. It remains on the same server, so it is useful for recovering an earlier database state but does not replace an independent copy on another device or medium.

### Google Drive backup

Google Drive must already be connected and authorised under the App's **Settings → Backup · Google Drive** section. If Drive is not connected, the command is rejected and no backup starts.

When pressed:
1. the server creates a temporary SQLite database snapshot;
2. uploads the file to the configured Drive backup folder;
3. updates the recorded latest nightly-backup timestamp;
4. retains the latest **3 nightly backups** and deletes older files in that same backup series.

This button therefore starts a Google Drive copy, separate from the local backup. The server uploads directly to Google Drive; Home Assistant receives only technical status, not the file. SQLite backups stored in Drive are **not encrypted by the app**: protect your Google account and the backup folder.

### Database integrity check

Runs SQLite's `PRAGMA integrity_check` command against the live database. It records the time and result of the latest check and updates the corresponding binary sensor. It does not create a backup and is not intended to modify data.

**Naming note:** the integration entity is labelled *Local backup*. “Full backup” here means a SQLite database snapshot, not a backup of the entire Home Assistant server or its configuration.

### PWA and examples
The hosted web app can be installed from Chrome or Edge as a dedicated window. Firefox 143+ on Windows supports taskbar web apps (Firefox 150+ for Microsoft Store installations). The service worker does not cache accounting data, API responses, HTML or documents.

Example dashboard and automation YAML files are available at `docs/dashboard_gestione_cc.yaml` and `docs/automazioni_gestione_cc.yaml`. Check the entity IDs in your installation and replace `notify.notify` with the notification service you actually use.
