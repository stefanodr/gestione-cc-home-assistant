# Gestione C/C — Home Assistant App

**Italiano · English**

> <strong>DEMO — DATI COMPLETAMENTE FITTIZI</strong>  
> Le schermate qui sotto mostrano l'interfaccia reale di Gestione C/C popolata esclusivamente con dati inventati a scopo dimostrativo. Nomi, conti, saldi, date, movimenti e importi non appartengono a utenti reali e non provengono da archivi bancari o GnuCash. Le immagini non costituiscono esempi di risultati finanziari reali.

## Guarda Gestione C/C in azione

| Panoramica | Movimenti | Report |
|---|---|---|
| ![Schermata dimostrativa della panoramica finanziaria, con dati fittizi](docs/screenshots/panoramica.png) | ![Schermata dimostrativa del registro movimenti, con dati fittizi](docs/screenshots/movimenti.png) | ![Schermata dimostrativa dei report finanziari, con dati fittizi](docs/screenshots/report.png) |
| Entrate, uscite, saldo e andamento dei conti. | Registro, classificazione e stato dei movimenti. | Analisi dei flussi e confronti tra periodi. |

Gestione C/C è un'applicazione web self-hosted per la gestione dei conti personali, distribuita come Home Assistant App (in precedenza add-on). I dati sono conservati in un database SQLite persistente sul server Home Assistant. È progettata per l'uso personale in rete locale e non richiede un servizio cloud esterno.

> **Importante:** Gestione C/C è una **Home Assistant App**, non un'integrazione, una dashboard card o un plugin del Marketplace. Si installa dal catalogo delle App di Home Assistant.

---


# Italiano

## Funzionalità

- **Panoramica finanziaria:** entrate, uscite, saldo netto, saldo del conto, andamento storico e spese per categoria.
- **Registro movimenti:** importazione, ricerca, filtri, inserimento manuale e classificazione.
- **Allegati ai movimenti:** caricamento, download ed eliminazione di documenti PDF, JPEG e PNG; massimo 10 MB per file e 80 MB complessivi.
- **Ripartizione:** suddivisione di un movimento tra più contropartite o categorie.
- **Piano dei conti:** struttura gerarchica compatibile con i conti importati da GnuCash.
- **Importazione:** backup GnuCash e file QIF, CSV e XLSX nei formati supportati.
- **Regole apprese:** suggerimenti locali basati sulle classificazioni confermate.
- **Report:** analisi mensile, trimestrale, semestrale e annuale, confronti storici e scostamenti per categoria.
- **Esportazione:** report XLSX e anteprima PDF stampabile; il browser consente di salvare il documento come PDF.
- **Storico dettagliato:** traccia append-only di creazioni, modifiche e cancellazioni dei movimenti, con data/ora e valori precedenti e nuovi.
- **Archivio centralizzato:** database SQLite persistente, condiviso tra i dispositivi autorizzati.
- **Backup e ripristino:** backup JSON e SQLite, copie automatiche locali, backup facoltativo su Google Drive e ripristino con controlli d'integrità.
- **Accesso protetto:** PIN amministratore di 6 cifre e connessione HTTPS.

## Requisiti

- Home Assistant OS con Supervisor e catalogo App.
- Architettura `amd64` oppure `aarch64`.
- Rete locale raggiungibile dai dispositivi client.
- Hostname locale risolvibile dai client e rete CIDR corretta in `lan_network`.
- Browser moderno con JavaScript abilitato.

## Installazione

1. Apri **Impostazioni → App** in Home Assistant.
2. Apri il menu in alto a destra e seleziona **Repository**.
3. Aggiungi il repository:  
   `https://github.com/stefanodr/gestione-cc-home-assistant`
4. Aggiorna l'elenco delle App, cerca **Gestione C/C** e installala.
5. Prima del primo avvio imposta un PIN iniziale di **esattamente 6 cifre**.
6. Verifica `hostname` e soprattutto `lan_network`: quest'ultima deve corrispondere alla subnet reale della tua LAN. Non copiare alla cieca il valore predefinito.
7. Avvia l'App e apri `https://<hostname-locale>:8443`, per esempio `https://homeassistant.local:8443` se quel nome è risolvibile nella tua rete.
8. Al primo accesso il browser può segnalare che il certificato è emesso da una CA privata. Accedi solo dalla LAN, scarica la CA dalla pagina di login/Impostazioni e installala sui dispositivi autorizzati seguendo `gestione_cc/DOCS.md`.
9. Dopo la migrazione iniziale, rimuovi il valore `bootstrap_pin` dalle opzioni dell'App. Il PIN effettivo è conservato nel database come verificatore derivato, non in chiaro.

**Non disinstallare l'App per aggiornarla.** Usa la funzione di aggiornamento Home Assistant. Non cancellare la cartella dati e non reimportare l'archivio durante un normale aggiornamento.

## Sicurezza e privacy

- Interfaccia HTTPS sulla porta TCP 8443.
- Filtro di rete basato sulla subnet configurata in `lan_network`: va impostata e verificata prima di inserire dati personali.
- Non è previsto accesso cloud pubblico: non configurare port forwarding, DMZ o reverse proxy esposto a Internet.
- Il PIN è elaborato con PBKDF2-HMAC-SHA256 e salt casuale.
- Cookie di sessione HttpOnly, Secure e SameSite=Strict; protezione CSRF sulle modifiche.
- Limitazione dei tentativi di accesso e controllo di revisione per ridurre le sovrascritture silenziose tra sessioni concorrenti.
- I dati contabili restano nel volume persistente dell'App. Solo se l’utente collega esplicitamente Google Drive, i backup SQLite vengono trasferiti al proprio account Google tramite HTTPS; il database operativo resta sul server Home Assistant.
- La CA privata è una credenziale di fiducia: installala solo sui dispositivi autorizzati e proteggi i backup.

Nessuna applicazione può garantire sicurezza assoluta. Verifica rete, backup e ripristino nel tuo ambiente prima di affidarle dati importanti. Non è stato eseguito un audit di sicurezza indipendente.

## Backup

- I backup automatici locali restano disponibili sul server Home Assistant.
- In **Impostazioni → Backup · Google Drive** puoi collegare facoltativamente il tuo account Google. [Guida passo-passo in italiano e inglese](docs/GOOGLE_DRIVE_BACKUP.md).
- Il collegamento usa un OAuth Client di tipo Desktop e un token generato una tantum da rclone sul PC Windows; Gestione C/C conserva il token solo nel volume dati privato dell’App.
- Se collegato, l’App mantiene un backup di sessione e gli ultimi tre backup notturni (ore 03:00, fuso Europe/Rome). Il comando **Esci** completa il salvataggio in coda, avvia il backup di sessione in background solo se l’archivio è cambiato e mostra l’esito senza bloccare l’uscita. La chiusura diretta della scheda resta un tentativo best-effort.
- I file SQLite su Google Drive **non sono cifrati**: chiunque abbia accesso al tuo Drive e ai relativi backup può leggerne il contenuto. Proteggi l’account Google e non condividere i file.
- Il ripristino da Google Drive crea prima una copia preventiva locale e poi verifica l’integrità SQLite e la struttura dell’archivio.
- Conserva comunque una copia indipendente e prova il ripristino in modo prudente.

La connessione a Google Drive è facoltativa e in uscita: non rende l’interfaccia Gestione C/C accessibile da Internet.

## Supporto

- Licenza: [licenza proprietaria d'uso personale](LICENSE). Uso gratuito consentito alle persone fisiche per finalità personali e non commerciali, nei limiti della licenza. Gli usi aziendali, professionali e commerciali richiedono un accordo scritto.
- Licenze commerciali: [condizioni e richieste](COMMERCIAL-LICENSING.md).
- Copyright © 2026 Stefano Di Ricco (`stefanodr`). Tutti i diritti riservati salvo i permessi espressamente concessi.
- Avvisi dipendenze: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

- Repository: https://github.com/stefanodr/gestione-cc-home-assistant
- Segnalazioni: https://github.com/stefanodr/gestione-cc-home-assistant/issues
- Note di rilascio: [CHANGELOG.md](CHANGELOG.md)
- Manuale: [gestione_cc/DOCS.md](gestione_cc/DOCS.md)
- Guida backup Google Drive (IT/EN): [docs/GOOGLE_DRIVE_BACKUP.md](docs/GOOGLE_DRIVE_BACKUP.md)

Quando apri una segnalazione indica versioni Home Assistant/App, architettura e passaggi per riprodurre il problema. **Non allegare database, backup, PIN, certificati privati, cookie o dati bancari reali.** Usa dati dimostrativi.

## Stato e licenza

Versione di distribuzione dichiarata: **1.0.19**. Il progetto è distribuito con licenza proprietaria d'uso personale, non con una licenza open source. L'uso personale gratuito è consentito alle persone fisiche nei limiti di `LICENSE`; l'uso professionale, aziendale, la modifica, la redistribuzione e lo sfruttamento commerciale richiedono un accordo scritto, salvo i diritti inderogabili e quelli dei componenti di terze parti. Consultare `COMMERCIAL-LICENSING.md`. La pubblicazione non sostituisce i test nel sistema dell'utente.

---

# English

## Overview

Gestione C/C is a self-hosted personal finance web application distributed as a **Home Assistant App** (formerly called an add-on). It stores accounting data in a persistent SQLite database on the Home Assistant host. It is designed for private local-network use and does not require an external cloud service.

**This project is a Home Assistant App, not a Home Assistant integration, dashboard card or Marketplace plugin.** Install it from the Home Assistant App repository catalogue.

## Features

- **Financial overview:** income, expenses, net cash flow, account balance, historical trends and spending by category.
- **Transaction register:** import, search, filters, manual entries and categorisation.
- **Transaction attachments:** upload, download and deletion of PDF, JPEG and PNG documents; 10 MB per file and 80 MB total.
- **Split transactions:** allocate transactions across multiple accounts or categories.
- **Chart of accounts:** hierarchical structure compatible with imported GnuCash accounts.
- **Import:** GnuCash backups and supported QIF, CSV and XLSX transaction files.
- **Learned rules:** local suggestions based on confirmed classifications.
- **Reports:** monthly, quarterly, half-yearly and annual analysis, historical comparisons and category variances.
- **Exports:** XLSX reports and printable PDF preview; use the browser's “Save as PDF” destination to create a PDF.
- **Detailed history:** append-only log of transaction creation, edits and deletion, including timestamps and before/after values.
- **Centralised storage:** persistent SQLite database shared by authorised devices.
- **Backup and restore:** JSON and SQLite backups, local automatic snapshots, optional Google Drive retention and integrity-checked restore.
- **Protected access:** six-digit administrator PIN and HTTPS.

## Requirements

- Home Assistant OS with Supervisor/App store.
- `amd64` or `aarch64` architecture.
- A local network reachable by client devices.
- A local hostname resolvable by clients and the correct LAN CIDR in `lan_network`.
- A modern browser with JavaScript enabled.

## Installation

1. Open **Settings → Apps** in Home Assistant.
2. Open the top-right menu and select **Repositories**.
3. Add:  
   `https://github.com/stefanodr/gestione-cc-home-assistant`
4. Refresh the App catalogue, find **Gestione C/C**, and install it.
5. Before the first start, set an initial PIN containing **exactly six digits**.
6. Check `hostname` and especially `lan_network`. Set the latter to your actual LAN subnet; do not blindly keep the example default.
7. Start the App and open `https://<local-hostname>:8443`, for example `https://homeassistant.local:8443` if that name resolves on your network.
8. The browser may warn about the private certificate authority on first use. Connect only from your LAN, download the CA from the login page/Settings and install it on authorised devices as described in `gestione_cc/DOCS.md`.
9. After initial credential migration, clear `bootstrap_pin` from the App options. The effective PIN is stored as a salted verifier, not as plaintext.

**Do not uninstall the App to update it.** Use the Home Assistant App update action. Do not delete its data directory or re-import an archive during a normal update.

## Security and privacy

- HTTPS interface on TCP port 8443.
- Network filtering based on `lan_network`; configure and verify it before entering personal data.
- Public cloud access is not intended. Do not configure port forwarding, a DMZ or an Internet-facing reverse proxy.
- The PIN is processed with PBKDF2-HMAC-SHA256 and a random salt.
- HttpOnly, Secure and SameSite=Strict session cookies; CSRF protection for state-changing requests.
- Login throttling and revision checks help reduce brute-force attempts and silent concurrent overwrites.
- Accounting data are stored in the App's persistent volume. Only when the user explicitly connects Google Drive are SQLite backup files sent to their own Google account over HTTPS; the live database remains on the Home Assistant host.
- Treat the private CA as a trust credential. Install it only on authorised devices and protect backups.

No application can guarantee absolute security. Verify networking, backup and restore in your own environment before relying on the application. No independent security audit is claimed.

## Backups

- Local automatic snapshots remain available on the Home Assistant host.
- Under **Settings → Backup · Google Drive**, you can optionally connect your Google account. [Step-by-step guide in Italian and English](docs/GOOGLE_DRIVE_BACKUP.md).
- Authorization uses a Desktop OAuth client and a one-time token generated with rclone on a Windows PC; credentials are stored only in the App's private data volume.
- When connected, the App retains one session backup and the latest three nightly backups (03:00, Europe/Rome). **Exit** flushes queued saves, starts the session backup in the background only when the archive has changed, and reports the outcome without blocking the exit. Closing the browser tab remains best-effort.
- Google Drive SQLite files are **not encrypted**. Anyone with access to your Drive and the backup files can read their contents.
- Restore from Drive creates a local pre-restore snapshot and checks SQLite integrity and archive structure.
- Keep an independent backup and test restore procedures carefully.

Google Drive is optional and uses outbound connections only; it does not make the Gestione C/C web interface accessible from the Internet.

## Support

- Licence: [proprietary personal-use licence](LICENSE). Free use is permitted to individuals for personal, non-commercial purposes, subject to its terms. Business, professional and commercial uses require a written agreement.
- Commercial licensing: [terms and enquiries](COMMERCIAL-LICENSING.md).
- Copyright © 2026 Stefano Di Ricco (`stefanodr`). All rights reserved except for permissions expressly granted.
- Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

- Repository: https://github.com/stefanodr/gestione-cc-home-assistant
- Issues: https://github.com/stefanodr/gestione-cc-home-assistant/issues
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Full manual: [gestione_cc/DOCS.md](gestione_cc/DOCS.md)
- Google Drive backup guide (IT/EN): [docs/GOOGLE_DRIVE_BACKUP.md](docs/GOOGLE_DRIVE_BACKUP.md)

When reporting an issue, include Home Assistant/App versions, architecture and reproduction steps. **Never upload databases, backups, PINs, private certificates, cookies or real banking data.** Use fictional demo data.

## Status and licence

Declared distribution version: **1.0.19**. The project is distributed under a proprietary personal-use licence, not an open-source licence. Free personal use by individuals is permitted under `LICENSE`; professional or business use, modification, redistribution and commercial exploitation require a written agreement, subject to mandatory legal rights and third-party component licences. See `COMMERCIAL-LICENSING.md`. A version number does not replace testing on the user's own system.
