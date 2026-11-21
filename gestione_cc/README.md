# Gestione C/C — Home Assistant App

**Versione Home Assistant App: 2.1.37 · Versione applicazione inclusa: 2.1.37 · Integrazione HACS: 1.1.15**

Applicazione web self-hosted per la gestione dei conti personali, distribuita come Home Assistant App. I dati operativi sono conservati in un database SQLite persistente sul server Home Assistant.

**Italiano · English**

## Italiano

### Funzionalità principali

Gestione C/C consente di gestire conti, movimenti, categorie, budget e flussi finanziari in un'unica interfaccia web. Include:

- Panoramica di entrate, uscite, saldi e andamento, con selezione del conto liquido.
- Registro movimenti con ricerca, filtri, classificazione, ripartizioni, allegati e storico delle modifiche.
- Importazione di archivi GnuCash e di movimenti da QIF, OFX, CSV, XLSX e TXT con struttura QIF; riconciliazione dei conti e gestione dei possibili duplicati.
- Piano dei conti gerarchico, classificazione dei conti e strumenti di riconciliazione GnuCash.
- Budget, proposte di budget, previsioni e regole ricorrenti.
- Report periodici, confronti e analisi degli scostamenti, con esportazione XLSX e PDF.
- Archivio documentale con OCR locale, ricerca nel testo e gestione dei metadati.
- Interfaccia smartphone dedicata in sola lettura all'indirizzo `/mobile/`.
- Registro accessi con filtri e conservazione degli eventi per 30 giorni.
- Backup e ripristino JSON e SQLite, con copie locali e backup facoltativo su Google Drive.

### Installazione e primo accesso

1. In Home Assistant apri **Impostazioni → App → Repository**.
2. Aggiungi il repository `https://github.com/stefanodr/gestione-cc-home-assistant`.
3. Aggiorna il catalogo, installa **Gestione C/C** e configura il PIN iniziale di sei cifre.
4. Verifica `hostname` e `lan_network` in base alla tua rete locale.
5. Avvia l'App e apri l'indirizzo HTTPS LAN configurato, normalmente sulla porta **8443**.
6. Installa e considera attendibile la CA privata HTTPS sui soli dispositivi autorizzati.

Non disinstallare l'App e non cancellare il volume dati per eseguire un aggiornamento. Prima di un aggiornamento importante crea un backup indipendente.

### Interfaccia smartphone

L'interfaccia dedicata agli smartphone è disponibile su `https://<host-lan>:8443/mobile/`. È una vista in sola lettura: consente di consultare i dati riepilogativi senza inserire o modificare movimenti. La selezione del conto liquido e del periodo aggiorna i dati visualizzati. L'interfaccia desktop resta disponibile all'indirizzo principale.

### Integrazione Home Assistant tramite HACS

La custom integration HACS è **separata** dalla Home Assistant App: l'App ospita il server e il database; l'integrazione collega Home Assistant alle sole API tecniche.

- Espone sensori e informazioni tecniche: disponibilità, versioni, uptime, database, backup, spazio, allegati e stato dei processi.
- Espone indicatori per lo stato del collegamento Google Drive e per eventuali errori o ritardi del backup.
- Offre pulsanti per operazioni di manutenzione autorizzate: backup SQLite locale, backup Google Drive e controllo d'integrità.
- Richiede HTTPS con verifica della CA privata e un token dedicato.
- Non espone conti, saldi, movimenti, budget, documenti, file di backup o registro accessi.
- La versione dell'integrazione HACS è indipendente da quella dell'App: **1.1.15**.

Installazione: aggiungi lo stesso repository in **HACS → Integrazioni → Repository personalizzati**, installa Gestione C/C e riavvia Home Assistant. Genera quindi il token nell'app e configura l'integrazione da **Impostazioni → Dispositivi e servizi**. La guida completa è nel [README dell'integrazione](../custom_components/gestione_cc/README.md); esempi: [dashboard](../docs/dashboard_gestione_cc.yaml) e [automazioni](../docs/automazioni_gestione_cc.yaml).

### PWA e installazione come app desktop

Gestione C/C può essere installata come web app in una finestra dedicata, usando l'indirizzo HTTPS LAN. Non è un eseguibile Windows autonomo e non contiene una copia separata dei dati.

- **Chrome:** menu ⋮ → Trasmetti, salva e condividi → Installa pagina come app (la voce può variare con la versione).
- **Edge:** menu ⋯ → App → Installa questo sito come app.
- **Firefox per Windows:** supporto alle web app da Firefox 143; per la versione distribuita tramite Microsoft Store è richiesta la versione 150 o successiva. Se disponibile, usa il comando Web app/Aggiungi scheda alla barra delle applicazioni.
- Le icone ufficiali sono fornite in formato PNG da 192 e 512 pixel. Se Windows mostra un'icona generica nel collegamento, può essere necessario correggerla dalle proprietà del collegamento.
- Non è registrato un service worker: non è disponibile una modalità offline. La web app richiede il server Home Assistant raggiungibile.

Prima di installare la PWA, assicurati che il certificato CA privato sia attendibile sul dispositivo. Non esporre la porta dell'App su Internet.

### Sicurezza, privacy e dati

- Interfaccia HTTPS sulla porta TCP 8443, destinata all'accesso dalla rete locale.
- PIN amministratore di sei cifre e sessioni protette.
- Database SQLite nel volume persistente dell'App.
- L'integrazione HACS trasferisce solo dati tecnici e non accede all'archivio contabile.
- Google Drive è facoltativo e riguarda i backup: i file SQLite su Drive non sono cifrati dall'applicazione.
- Non configurare port forwarding, DMZ o reverse proxy pubblici.

Consulta il [manuale completo dell'App](DOCS.md), il [README principale bilingue](../README.md), il [changelog](CHANGELOG.md) e la [guida backup Google Drive](../docs/GOOGLE_DRIVE_BACKUP.md).

## English

### Main features

Gestione C/C is a self-hosted personal-finance web application distributed as a Home Assistant App. Its live data is stored in a persistent SQLite database on the Home Assistant server.

Features include:

- Income, expenses, balances and cash-flow overview, with liquid-account selection.
- Transaction register with search, filters, categorisation, splits, attachments and change history.
- GnuCash archive import and QIF, OFX, CSV, XLSX and QIF-structured TXT transaction imports, with account reconciliation and duplicate handling.
- Hierarchical chart of accounts, account classification and GnuCash reconciliation tools.
- Budgets, budget proposals, forecasts and recurring rules.
- Periodic reports, comparisons and variance analysis, with XLSX and PDF export.
- Document archive with local OCR, text search and metadata management.
- Dedicated read-only smartphone interface at `/mobile/`.
- Access log with filters and 30-day event retention.
- JSON and SQLite backup and restore, local snapshots and optional Google Drive backups.

### Installation and first access

1. In Home Assistant, open **Settings → Apps → Repositories**.
2. Add `https://github.com/stefanodr/gestione-cc-home-assistant`.
3. Refresh the catalogue, install **Gestione C/C**, and configure the initial six-digit PIN.
4. Check `hostname` and `lan_network` against your local network.
5. Start the App and open its configured LAN HTTPS address, normally on port **8443**.
6. Install and trust the private HTTPS CA only on authorised devices.

Do not uninstall the App or delete its data volume when updating. Create an independent backup before a major upgrade.

### Smartphone interface

The dedicated smartphone interface is available at `https://<lan-host>:8443/mobile/`. It is read-only: it provides summary views without allowing transactions to be added or edited. Selecting a liquid account and period updates the displayed information. The desktop interface remains available at the main address.

### Home Assistant integration through HACS

The HACS custom integration is **separate** from the Home Assistant App. The App hosts the server and database; the integration connects Home Assistant to the technical API only.

- Provides technical status and sensors for availability, versions, uptime, database, backups, storage, attachments and process status.
- Provides indicators for Google Drive connection status and backup failures or delays.
- Provides buttons for authorised maintenance operations: local SQLite backup, Google Drive backup and database integrity check.
- Requires HTTPS with private-CA verification and a dedicated token.
- Does not expose accounts, balances, transactions, budgets, documents, backup files or access logs.
- The HACS integration has an independent version: **1.1.15**.

To install it, add the same repository under **HACS → Integrations → Custom repositories**, install Gestione C/C and restart Home Assistant. Generate the token in the App, then add the integration under **Settings → Devices & services**. See the [integration README](../custom_components/gestione_cc/README.md), [dashboard example](../docs/dashboard_gestione_cc.yaml) and [automation examples](../docs/automazioni_gestione_cc.yaml).

### PWA and desktop app installation

Gestione C/C can be installed as a web app in a dedicated window using its LAN HTTPS address. It is not a standalone Windows executable and does not contain a separate copy of your data.

- **Chrome:** ⋮ → Cast, save and share → Install page as app (the wording may vary by version).
- **Edge:** ⋯ → Apps → Install this site as an app.
- **Firefox for Windows:** web app support is available from Firefox 143; the Microsoft Store build requires version 150 or later. If available, use the Web app/Add tab to taskbar command.
- Official 192 px and 512 px PNG icons are provided. If Windows displays a generic icon for a desktop shortcut, you may need to change it in the shortcut properties.
- No service worker is registered: offline mode is not available. The Home Assistant server must remain reachable.

Before installing the PWA, make sure the private CA certificate is trusted on the device. Do not expose the App port to the Internet.

### Security, privacy and data

- HTTPS web interface on TCP port 8443, intended for local-network access.
- Six-digit administrator PIN and protected sessions.
- SQLite database stored in the App's persistent volume.
- The HACS integration transfers technical information only and cannot access accounting records.
- Google Drive is optional and used for backups; SQLite files stored on Drive are not encrypted by the application.
- Do not configure public port forwarding, a DMZ or an Internet-facing reverse proxy.

See the [full App manual](DOCS.md), the [main bilingual README](../README.md), the [changelog](CHANGELOG.md) and the [Google Drive backup guide](../docs/GOOGLE_DRIVE_BACKUP.md).

---

**Versions:** Home Assistant App **2.1.37** · bundled application **2.1.37** · HACS custom integration **1.1.15** (independent).

Support: [GitHub Issues](https://github.com/stefanodr/gestione-cc-home-assistant/issues). Never publish databases, backups, PINs, private certificates, cookies or real financial data.
