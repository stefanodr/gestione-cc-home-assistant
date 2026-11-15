# Gestione C/C — Home Assistant App

**Versione App: 2.0.0 · Versione applicazione inclusa: 2.0.0**

Applicazione web self-hosted per la gestione dei conti personali, distribuita come Home Assistant App. I dati operativi sono conservati in un database SQLite persistente sul server Home Assistant.

**Italiano · English**

## Italiano

### Presentazione e funzionalità

Gestione C/C consente di gestire conti, movimenti, categorie, budget e flussi finanziari in un'unica interfaccia web. Include:

- Panoramica di entrate, uscite, saldi e andamento.
- Registro movimenti con ricerca, filtri, classificazione e ripartizione.
- Importazione di archivi GnuCash e di movimenti da QIF, OFX, CSV, XLSX e TXT con struttura QIF.
- Piano dei conti gerarchico, budget e previsioni.
- Report periodici, confronti e scostamenti, con esportazione XLSX e PDF.
- Allegati ai movimenti e archivio documentale con OCR e ricerca.
- Backup e ripristino JSON e SQLite, con copie locali e backup facoltativo su Google Drive.

### Installazione e primo accesso

1. In Home Assistant apri **Impostazioni → App → Repository**.
2. Aggiungi il repository `https://github.com/stefanodr/gestione-cc-home-assistant`.
3. Aggiorna il catalogo, installa **Gestione C/C** e configura il PIN iniziale di sei cifre.
4. Verifica `hostname` e `lan_network` in base alla tua rete locale.
5. Avvia l'App e apri l'indirizzo HTTPS LAN configurato, normalmente sulla porta **8443**.
6. Installa e considera attendibile la CA privata HTTPS sui soli dispositivi autorizzati.

Non disinstallare l'App e non cancellare il volume dati per eseguire un aggiornamento. Prima di un aggiornamento importante crea un backup indipendente.

### Integrazione Home Assistant tramite HACS

La custom integration HACS è **separata** dall'Home Assistant App: l'App ospita il server e il database; l'integrazione collega Home Assistant alle sole API tecniche.

- Espone sensori di stato e informazioni tecniche (disponibilità, versioni, uptime, database, backup, spazio e allegati).
- Offre pulsanti per le operazioni di manutenzione autorizzate, come backup e controllo d'integrità.
- Richiede HTTPS con verifica della CA privata e un token dedicato.
- Non espone conti, saldi, movimenti, budget, documenti, file di backup o registro accessi.
- La versione dell'integrazione HACS è indipendente da quella dell'App: **1.1.6** per questa release.

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

- Interfaccia HTTPS sulla porta TCP 8443 e accesso previsto dalla rete locale.
- PIN amministratore di sei cifre e sessioni protette.
- Database SQLite nel volume persistente dell'App.
- L'integrazione HACS trasferisce solo dati tecnici e non accede all'archivio contabile.
- Google Drive è facoltativo e riguarda i backup: i file SQLite su Drive non sono cifrati.
- Non configurare port forwarding, DMZ o reverse proxy pubblici.

Consulta il [manuale completo dell'App](DOCS.md), il [README principale bilingue](../README.md), il [changelog](CHANGELOG.md) e la [guida backup Google Drive](../docs/GOOGLE_DRIVE_BACKUP.md).

## English

### Overview and features

Gestione C/C is a self-hosted personal finance web application distributed as a Home Assistant App. Its live data is stored in a persistent SQLite database on the Home Assistant server.

Features include:

- Income, expenses, balances and cash-flow overview.
- Transaction register with search, filters, categorisation and splits.
- GnuCash archive import and QIF, OFX, CSV, XLSX and QIF-structured TXT transaction imports.
- Hierarchical chart of accounts, budgets and forecasts.
- Periodic reports, comparisons and variance analysis, with XLSX and PDF export.
- Transaction attachments and a searchable document archive with OCR.
- JSON and SQLite backup and restore, local snapshots and optional Google Drive backups.

### Installation and first access

1. In Home Assistant, open **Settings → Apps → Repositories**.
2. Add `https://github.com/stefanodr/gestione-cc-home-assistant`.
3. Refresh the catalogue, install **Gestione C/C**, and configure the initial six-digit PIN.
4. Check `hostname` and `lan_network` against your local network.
5. Start the App and open its configured LAN HTTPS address, normally on port **8443**.
6. Install and trust the private HTTPS CA only on authorised devices.

Do not uninstall the App or delete its data volume when updating. Create an independent backup before a major upgrade.

### Home Assistant integration through HACS

The HACS custom integration is **separate** from the Home Assistant App. The App hosts the server and database; the integration connects Home Assistant to the technical API only.

- Provides status and technical sensors (availability, versions, uptime, database, backups, storage and attachments).
- Provides buttons for explicitly authorised maintenance operations, such as backup and integrity checks.
- Requires HTTPS with private-CA verification and a dedicated token.
- Does not expose accounts, balances, transactions, budgets, documents, backup files or access logs.
- The HACS integration has an independent version: **1.1.6** for this release.

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
- Google Drive is optional and used for backups; SQLite files stored on Drive are not encrypted.
- Do not configure public port forwarding, a DMZ or an Internet-facing reverse proxy.

See the [full App manual](DOCS.md), the [main bilingual README](../README.md), the [changelog](CHANGELOG.md) and the [Google Drive backup guide](../docs/GOOGLE_DRIVE_BACKUP.md).

---

**Versions:** Home Assistant App **2.0.0** · bundled application **2.0.0** · HACS custom integration **1.1.6** (independent).

Support: [GitHub Issues](https://github.com/stefanodr/gestione-cc-home-assistant/issues). Never publish databases, backups, PINs, private certificates, cookies or real financial data.
