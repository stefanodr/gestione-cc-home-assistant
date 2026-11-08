# Gestione C/C — Home Assistant App


**Italiano · English**

Gestione C/C è un'applicazione web self-hosted per la gestione dei conti personali, distribuita come Home Assistant App (in precedenza add-on). I dati sono conservati in un database SQLite persistente sul server Home Assistant. È progettata per l'uso personale in rete locale e non richiede un servizio cloud esterno.

> **Importante:** Gestione C/C è una **Home Assistant App**, non un'integrazione, una dashboard card o un plugin del Marketplace. Si installa dal catalogo delle App di Home Assistant.


### Panoramica / Overview

### Movimenti / Transactions

### Report / Reports

### Anteprima PDF / PDF preview

---

# Italiano

## Funzionalità

- **Panoramica finanziaria:** entrate, uscite, saldo netto, saldo del conto, andamento storico e spese per categoria.
- **Registro movimenti:** importazione, ricerca, filtri, inserimento manuale e classificazione.
- **Ripartizione:** suddivisione di un movimento tra più contropartite o categorie.
- **Piano dei conti:** struttura gerarchica compatibile con i conti importati da GnuCash.
- **Importazione:** backup GnuCash e file QIF, CSV e XLSX nei formati supportati.
- **Regole apprese:** suggerimenti locali basati sulle classificazioni confermate.
- **Report:** analisi mensile, trimestrale, semestrale e annuale, confronti storici e scostamenti per categoria.
- **Esportazione:** report XLSX e anteprima PDF stampabile; il browser consente di salvare il documento come PDF.
- **Archivio centralizzato:** database SQLite persistente, condiviso tra i dispositivi autorizzati.
- **Backup e ripristino:** backup JSON e SQLite, copie automatiche locali e ripristino con controlli d'integrità.
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
- I dati contabili restano nel volume persistente dell'App; l'applicazione non è progettata per inviarli a servizi cloud esterni.
- La CA privata è una credenziale di fiducia: installala solo sui dispositivi autorizzati e proteggi i backup.

Nessuna applicazione può garantire sicurezza assoluta. Verifica rete, backup e ripristino nel tuo ambiente prima di affidarle dati importanti. Non è stato eseguito un audit di sicurezza indipendente.

## Backup

1. Usa periodicamente **Esporta backup JSON** e/o **Scarica database SQLite** dalle Impostazioni.
2. Conserva almeno una copia fuori dal server Home Assistant, in un luogo protetto.
3. Prima degli aggiornamenti importanti crea una copia manuale.
4. Prova il ripristino solo su un'installazione di test o dopo aver salvato una copia aggiornata.

Le copie automatiche locali non sostituiscono un backup esterno: un guasto del disco può coinvolgere sia il database sia le copie sullo stesso host.

## Supporto

- Repository: https://github.com/stefanodr/gestione-cc-home-assistant
- Segnalazioni: https://github.com/stefanodr/gestione-cc-home-assistant/issues
- Note di rilascio: [CHANGELOG.md](CHANGELOG.md)
- Manuale: [gestione_cc/DOCS.md](gestione_cc/DOCS.md)

Quando apri una segnalazione indica versioni Home Assistant/App, architettura e passaggi per riprodurre il problema. **Non allegare database, backup, PIN, certificati privati, cookie o dati bancari reali.** Usa dati dimostrativi.

## Stato e licenza

Versione di distribuzione dichiarata: **1.0.0**. Il numero di versione non sostituisce i test nel sistema dell'utente. Il titolare del repository deve scegliere e aggiungere una licenza open-source prima della redistribuzione pubblica del codice: questo README non attribuisce automaticamente alcuna licenza.

---

# English

## Overview

Gestione C/C is a self-hosted personal finance web application distributed as a **Home Assistant App** (formerly called an add-on). It stores accounting data in a persistent SQLite database on the Home Assistant host. It is designed for private local-network use and does not require an external cloud service.

**This project is a Home Assistant App, not a Home Assistant integration, dashboard card or Marketplace plugin.** Install it from the Home Assistant App repository catalogue.

## Features

- **Financial overview:** income, expenses, net cash flow, account balance, historical trends and spending by category.
- **Transaction register:** import, search, filters, manual entries and categorisation.
- **Split transactions:** allocate transactions across multiple accounts or categories.
- **Chart of accounts:** hierarchical structure compatible with imported GnuCash accounts.
- **Import:** GnuCash backups and supported QIF, CSV and XLSX transaction files.
- **Learned rules:** local suggestions based on confirmed classifications.
- **Reports:** monthly, quarterly, half-yearly and annual analysis, historical comparisons and category variances.
- **Exports:** XLSX reports and printable PDF preview; use the browser's “Save as PDF” destination to create a PDF.
- **Centralised storage:** persistent SQLite database shared by authorised devices.
- **Backup and restore:** JSON and SQLite backups, local automatic snapshots and integrity-checked restore.
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
- Accounting data are stored in the App's persistent volume; the application is not designed to send them to external cloud services.
- Treat the private CA as a trust credential. Install it only on authorised devices and protect backups.

No application can guarantee absolute security. Verify networking, backup and restore in your own environment before relying on the application. No independent security audit is claimed.

## Backups

1. Periodically use **Export JSON backup** and/or **Download SQLite database** in Settings.
2. Keep at least one protected copy outside the Home Assistant host.
3. Create a manual backup before major updates.
4. Test restore only on a test installation or after creating a fresh backup of the current archive.

Local automatic snapshots are not a substitute for off-host backups. A disk or host failure may affect both the database and snapshots stored on the same machine.

## Support

- Repository: https://github.com/stefanodr/gestione-cc-home-assistant
- Issues: https://github.com/stefanodr/gestione-cc-home-assistant/issues
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Full manual: [gestione_cc/DOCS.md](gestione_cc/DOCS.md)

When reporting an issue, include Home Assistant/App versions, architecture and reproduction steps. **Never upload databases, backups, PINs, private certificates, cookies or real banking data.** Use fictional demo data.

## Status and licence

Declared distribution version: **1.0.0**. A version number does not replace testing on the user's own system. The repository owner must choose and add an open-source licence before public redistribution; no licence is automatically granted by this README.
