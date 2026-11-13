# Gestione C/C — Home Assistant App

<p align="center">
  <img src="gestione_cc/icon.png" alt="Logo Gestione C/C" width="112">
</p>

<p align="center">
  <strong>Gestione personale dei conti · Personal finance management</strong><br>
  <em>Edizione Home Assistant · Home Assistant edition</em>
</p>

**Italiano · English**

> [!IMPORTANT]
> **SCHERMATE DIMOSTRATIVE — DATI FITTIZI**
>
> Le immagini mostrate in questo README rappresentano l'interfaccia di Gestione C/C popolata esclusivamente con dati inventati a scopo dimostrativo. Nomi, conti, saldi, date, movimenti e importi non appartengono a utenti reali e non provengono da archivi bancari o GnuCash.

## Anteprima

| Panoramica | Movimenti | Report |
|:---:|:---:|:---:|
| ![Panoramica Gestione C/C](docs/screenshots/panoramica.png) | ![Movimenti Gestione C/C](docs/screenshots/movimenti.png) | ![Report Gestione C/C](docs/screenshots/report.png) |
| Entrate, uscite, saldi e andamento. | Consultazione e classificazione dei movimenti. | Analisi dei flussi e confronti tra periodi. |

---

## Indice / Contents

- [Italiano](#italiano)
  - [Presentazione](#presentazione)
  - [Funzionalità](#funzionalità)
  - [Requisiti](#requisiti)
  - [Installazione](#installazione)
  - [Configurazione e primo accesso](#configurazione-e-primo-accesso)
  - [Sicurezza e privacy](#sicurezza-e-privacy)
  - [Dati, backup e ripristino](#dati-backup-e-ripristino)
  - [Aggiornamenti](#aggiornamenti)
  - [Supporto e licenza](#supporto-e-licenza)
- [English](#english)
  - [Overview](#overview)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Configuration and first access](#configuration-and-first-access)
  - [Security and privacy](#security-and-privacy)
  - [Data, backup and restore](#data-backup-and-restore)
  - [Updates](#updates)
  - [Support and licence](#support-and-licence)

---

# Italiano

## Presentazione

**Gestione C/C** è un'applicazione web self-hosted per la gestione dei conti personali, la registrazione dei movimenti e l'analisi dei flussi finanziari. Questa edizione viene distribuita come **Home Assistant App** (in precedenza denominata add-on) e conserva i dati in un database SQLite persistente sul server Home Assistant.

L'applicazione permette di consultare in un unico ambiente entrate, uscite, saldi, categorie, budget e andamento nel tempo. Supporta inoltre l'importazione di archivi GnuCash e di file di movimenti nei formati previsti.

È pensata per l'uso personale in rete locale e non richiede un servizio cloud esterno.

> **Importante:** questa è una Home Assistant App, non un'integrazione, una dashboard card o un plugin del Marketplace. Si installa dal catalogo delle App di Home Assistant.

## Funzionalità

### Panoramica finanziaria
- Riepilogo di entrate, uscite e saldo netto del periodo.
- Consultazione dei saldi e dell'andamento storico.
- Grafici dei flussi finanziari e delle spese per categoria.
- Selezione del conto e del periodo di analisi.

### Registro movimenti
- Consultazione, ricerca e filtraggio dei movimenti.
- Inserimento manuale e importazione dei movimenti supportati.
- Classificazione e ripartizione di una singola operazione tra più conti o categorie.
- Allegati PDF, JPEG e PNG associabili ai movimenti: massimo 10 MB per file e 80 MB complessivi.
- Storico append-only delle creazioni, modifiche e cancellazioni, con data/ora e valori precedenti e nuovi.

### Piano dei conti e classificazione
- Struttura gerarchica di conti e sottoconti.
- Compatibilità con i conti importati da GnuCash.
- Suggerimenti e regole locali basati sulle classificazioni confermate.

### Budget, previsioni e report
- Gestione dei budget e confronto tra valori previsti ed effettivi.
- Analisi mensile, trimestrale, semestrale e annuale.
- Confronti storici e analisi degli scostamenti per categoria.
- Esportazione dei report in XLSX e anteprima PDF stampabile; il browser consente di salvare il documento come PDF.

### Archivio e protezione
- Database SQLite persistente sul server Home Assistant.
- Accesso protetto da PIN amministratore di 6 cifre.
- Connessione HTTPS.
- Backup e ripristino in formato JSON e SQLite, con copie automatiche locali e backup facoltativo su Google Drive.

> Le funzioni disponibili e il relativo comportamento dipendono dalla versione installata. Per l'elenco delle modifiche consultare il [CHANGELOG](CHANGELOG.md).

## Requisiti

- Home Assistant OS con Supervisor e catalogo App.
- Architettura `amd64` oppure `aarch64`.
- Rete locale raggiungibile dai dispositivi client.
- Hostname locale risolvibile dai client.
- Subnet LAN corretta da indicare nell'opzione `lan_network`.
- Browser moderno con JavaScript abilitato.

## Installazione

1. In Home Assistant apri **Impostazioni → App**.
2. Apri il menu in alto a destra e seleziona **Repository**.
3. Aggiungi il repository:

   `https://github.com/stefanodr/gestione-cc-home-assistant`

4. Aggiorna l'elenco delle App, cerca **Gestione C/C** e installala.
5. Prima del primo avvio, configura il PIN iniziale di **esattamente 6 cifre**.
6. Controlla le opzioni `hostname` e `lan_network`. Quest'ultima deve corrispondere alla subnet reale della tua rete locale: non mantenere un valore di esempio senza averlo verificato.
7. Avvia l'App e apri nel browser:

   `https://<hostname-locale>:8443`

   Per esempio, `https://homeassistant.local:8443`, se il nome è risolvibile nella tua rete.

8. Al primo accesso il browser può segnalare che il certificato è emesso da una CA privata. Accedi solo dalla rete locale, scarica la CA dalla pagina di login/Impostazioni e installala sui dispositivi autorizzati seguendo la [documentazione](gestione_cc/DOCS.md).

## Configurazione e primo accesso

- **PIN iniziale:** imposta un codice composto da esattamente sei cifre prima del primo avvio.
- **Hostname:** usa un nome locale raggiungibile dai dispositivi dai quali desideri accedere.
- **Rete LAN:** configura `lan_network` con la subnet effettiva della tua rete. Una configurazione errata può impedire l'accesso oppure non limitare correttamente i client.
- **Certificato HTTPS:** la CA privata deve essere installata e considerata attendibile solo sui dispositivi autorizzati.
- **PIN di bootstrap:** dopo la migrazione iniziale, rimuovi il valore `bootstrap_pin` dalle opzioni dell'App. Il PIN effettivo viene conservato nel database come verificatore derivato, non in chiaro.

Per i dettagli delle opzioni e delle procedure consulta il [manuale dell'App](gestione_cc/DOCS.md).

## Sicurezza e privacy

- Interfaccia HTTPS sulla porta TCP 8443.
- Filtro di rete basato sulla subnet configurata in `lan_network`: impostala e verificala prima di inserire dati personali.
- L'accesso cloud pubblico non è previsto. Non configurare port forwarding, DMZ o reverse proxy esposti a Internet.
- Il PIN è elaborato con PBKDF2-HMAC-SHA256 e salt casuale.
- Cookie di sessione HttpOnly, Secure e SameSite=Strict; protezione CSRF sulle operazioni che modificano i dati.
- Limitazione dei tentativi di accesso e controlli di revisione per ridurre i rischi di accessi ripetuti e sovrascritture silenziose tra sessioni concorrenti.
- I dati contabili restano nel volume persistente dell'App. Solo collegando esplicitamente Google Drive, i file di backup SQLite vengono trasferiti al proprio account Google tramite HTTPS; il database operativo resta sul server Home Assistant.
- La CA privata è una credenziale di fiducia: installala solo sui dispositivi autorizzati e proteggi i backup.

Nessuna applicazione può garantire sicurezza assoluta. Verifica rete, backup e ripristino nel tuo ambiente prima di affidare all'applicazione dati importanti. Non è stato eseguito un audit di sicurezza indipendente.

## Dati, backup e ripristino

- Il database operativo SQLite è conservato nel volume persistente dell'App sul server Home Assistant.
- L'applicazione offre backup ed esportazione in formato JSON e SQLite.
- I backup automatici locali restano disponibili sul server Home Assistant.
- In **Impostazioni → Backup · Google Drive** puoi collegare facoltativamente il tuo account Google. Consulta la [guida passo-passo in italiano e inglese](docs/GOOGLE_DRIVE_BACKUP.md).
- Il collegamento usa un OAuth Client di tipo Desktop e un token generato una tantum con rclone su PC Windows; Gestione C/C conserva il token nel volume dati privato dell'App.
- Se Google Drive è collegato, l'App mantiene un backup di sessione e gli ultimi tre backup notturni (ore 03:00, fuso Europe/Rome).
- Il comando **Esci** completa il salvataggio in coda e avvia il backup di sessione in background solo se l'archivio è cambiato. La chiusura diretta della scheda del browser resta un tentativo best-effort.
- I file SQLite su Google Drive **non sono cifrati**: chiunque abbia accesso al Drive e ai relativi backup può leggerne il contenuto. Proteggi l'account Google e non condividere i file.
- Il ripristino da Google Drive crea prima una copia preventiva locale e poi verifica l'integrità SQLite e la struttura dell'archivio.

La connessione a Google Drive è facoltativa e in uscita: non rende l'interfaccia Gestione C/C accessibile da Internet. Conserva comunque una copia indipendente e verifica periodicamente la procedura di ripristino.

## Aggiornamenti

- Aggiorna Gestione C/C tramite la funzione di aggiornamento delle App di Home Assistant.
- **Non disinstallare l'App per aggiornarla.**
- Non cancellare la cartella dati e non reimportare l'archivio durante un normale aggiornamento.
- Prima di un aggiornamento importante, crea un backup JSON e SQLite e verifica che sia disponibile una copia indipendente.

Per le novità della versione installata consulta le [note di rilascio](CHANGELOG.md).

## Supporto e licenza

- **Manuale:** [gestione_cc/DOCS.md](gestione_cc/DOCS.md)
- **Guida backup Google Drive (IT/EN):** [docs/GOOGLE_DRIVE_BACKUP.md](docs/GOOGLE_DRIVE_BACKUP.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Segnalazioni:** [GitHub Issues](https://github.com/stefanodr/gestione-cc-home-assistant/issues)
- **Avvisi sulle dipendenze:** [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- **Licenza:** [licenza proprietaria d'uso personale](LICENSE)
- **Licenze commerciali:** [condizioni e richieste](COMMERCIAL-LICENSING.md)

L'uso gratuito è consentito alle persone fisiche per finalità personali e non commerciali, nei limiti della licenza. Gli usi professionali, aziendali e commerciali richiedono un accordo scritto.

Versione di distribuzione dichiarata: **1.0.19**.

Copyright © 2026 Stefano Di Ricco (`stefanodr`). Tutti i diritti riservati salvo i permessi espressamente concessi.

Quando apri una segnalazione indica le versioni di Home Assistant e dell'App, l'architettura e i passaggi per riprodurre il problema. **Non allegare database, backup, PIN, certificati privati, cookie o dati bancari reali.** Usa dati dimostrativi.

---

# English

## Overview

**Gestione C/C** is a self-hosted personal finance web application for managing accounts, recording transactions and analysing cash flows. This edition is distributed as a **Home Assistant App** (formerly called an add-on) and stores accounting data in a persistent SQLite database on the Home Assistant host.

It brings income, expenses, balances, categories, budgets and financial trends together in one interface. It also supports importing GnuCash books and transaction files in the supported formats.

It is designed for personal use on a local network and does not require an external cloud service.

> **Important:** this is a Home Assistant App, not a Home Assistant integration, dashboard card or Marketplace plugin. Install it from the Home Assistant App repository catalogue.

## Features

### Financial overview
- Income, expenses and net balance summary for the selected period.
- Account balances and historical trends.
- Cash-flow charts and spending breakdowns by category.
- Account and reporting-period selection.

### Transaction register
- Transaction browsing, search and filters.
- Manual entry and import of supported transaction files.
- Classification and split transactions across multiple accounts or categories.
- PDF, JPEG and PNG attachments linked to transactions: 10 MB per file and 80 MB total.
- Append-only history of transaction creation, edits and deletion, including timestamps and before/after values.

### Chart of accounts and classification
- Hierarchical accounts and subaccounts.
- Compatibility with accounts imported from GnuCash.
- Local suggestions and rules based on confirmed classifications.

### Budgets, forecasts and reports
- Budget management and planned-versus-actual comparisons.
- Monthly, quarterly, half-yearly and annual analysis.
- Historical comparisons and category variance analysis.
- XLSX report exports and printable PDF preview; use the browser's print dialog to save as PDF.

### Storage and protection
- Persistent SQLite database on the Home Assistant host.
- Six-digit administrator PIN.
- HTTPS connection.
- JSON and SQLite backup and restore, local automatic snapshots and optional Google Drive backup.

> Available features and their exact behaviour depend on the installed version. See the [CHANGELOG](CHANGELOG.md) for release details.

## Requirements

- Home Assistant OS with Supervisor/App store.
- `amd64` or `aarch64` architecture.
- A local network reachable by client devices.
- A local hostname resolvable by clients.
- The correct LAN subnet configured in `lan_network`.
- A modern browser with JavaScript enabled.

## Installation

1. In Home Assistant, open **Settings → Apps**.
2. Open the top-right menu and select **Repositories**.
3. Add the repository:

   `https://github.com/stefanodr/gestione-cc-home-assistant`

4. Refresh the App catalogue, find **Gestione C/C**, and install it.
5. Before the first start, set an initial PIN containing **exactly six digits**.
6. Check the `hostname` and `lan_network` options. The latter must match your actual LAN subnet; do not keep an example value without checking it.
7. Start the App and open:

   `https://<local-hostname>:8443`

   For example, `https://homeassistant.local:8443`, if that hostname resolves on your network.

8. On first access, the browser may warn that the certificate was issued by a private CA. Connect only from your local network, download the CA from the login page/Settings and install it on authorised devices as described in the [App documentation](gestione_cc/DOCS.md).

## Configuration and first access

- **Initial PIN:** set a code containing exactly six digits before the first start.
- **Hostname:** use a local name reachable from the devices that need access.
- **LAN network:** set `lan_network` to your actual network subnet. An incorrect value may prevent access or fail to restrict clients as intended.
- **HTTPS certificate:** install and trust the private CA only on authorised devices.
- **Bootstrap PIN:** after the initial credential migration, clear `bootstrap_pin` from the App options. The effective PIN is stored in the database as a derived verifier, not in plaintext.

For option details and procedures, see the [App manual](gestione_cc/DOCS.md).

## Security and privacy

- HTTPS interface on TCP port 8443.
- Network filtering based on `lan_network`; configure and verify it before entering personal data.
- Public cloud access is not intended. Do not configure port forwarding, a DMZ or an Internet-facing reverse proxy.
- The PIN is processed with PBKDF2-HMAC-SHA256 and a random salt.
- HttpOnly, Secure and SameSite=Strict session cookies; CSRF protection for state-changing operations.
- Login throttling and revision checks help reduce repeated login attempts and silent concurrent overwrites.
- Accounting data remain in the App's persistent volume. Only when Google Drive is explicitly connected are SQLite backup files sent to the user's Google account over HTTPS; the live database remains on the Home Assistant host.
- Treat the private CA as a trust credential. Install it only on authorised devices and protect backups.

No application can guarantee absolute security. Verify networking, backup and restore in your own environment before relying on the application. No independent security audit is claimed.

## Data, backup and restore

- The live SQLite database is stored in the App's persistent volume on the Home Assistant host.
- The application provides JSON and SQLite backup/export functions.
- Local automatic snapshots remain available on the Home Assistant host.
- Under **Settings → Backup · Google Drive**, you can optionally connect your Google account. See the [step-by-step guide in Italian and English](docs/GOOGLE_DRIVE_BACKUP.md).
- Authorization uses a Desktop OAuth client and a one-time token generated with rclone on a Windows PC; Gestione C/C stores the token in the App's private data volume.
- When Google Drive is connected, the App retains one session backup and the latest three nightly backups (03:00, Europe/Rome).
- **Exit** flushes queued saves and starts the session backup in the background only if the archive has changed. Closing the browser tab remains best-effort.
- Google Drive SQLite files are **not encrypted**. Anyone with access to your Drive and the backup files can read their contents.
- Restore from Google Drive first creates a local pre-restore snapshot, then checks SQLite integrity and archive structure.

Google Drive is optional and uses outbound connections only; it does not make the Gestione C/C web interface accessible from the Internet. Keep an independent backup and periodically verify the restore procedure.

## Updates

- Update Gestione C/C using Home Assistant's App update function.
- **Do not uninstall the App to update it.**
- Do not delete the data directory or re-import the archive during a normal update.
- Before a major update, create JSON and SQLite backups and verify that an independent copy is available.

See the [release notes](CHANGELOG.md) for changes in each version.

## Support and licence

- **Manual:** [gestione_cc/DOCS.md](gestione_cc/DOCS.md)
- **Google Drive backup guide (IT/EN):** [docs/GOOGLE_DRIVE_BACKUP.md](docs/GOOGLE_DRIVE_BACKUP.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Issues:** [GitHub Issues](https://github.com/stefanodr/gestione-cc-home-assistant/issues)
- **Third-party notices:** [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- **Licence:** [proprietary personal-use licence](LICENSE)
- **Commercial licensing:** [terms and enquiries](COMMERCIAL-LICENSING.md)

Free use is permitted to individuals for personal, non-commercial purposes, subject to the licence terms. Professional, business and commercial uses require a written agreement.

Declared distribution version: **1.0.19**.

Copyright © 2026 Stefano Di Ricco (`stefanodr`). All rights reserved except where permissions are expressly granted.

When reporting an issue, include Home Assistant and App versions, architecture and reproduction steps. **Never upload databases, backups, PINs, private certificates, cookies or real banking data.** Use fictional demo data.
