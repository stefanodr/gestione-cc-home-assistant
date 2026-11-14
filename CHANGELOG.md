## [1.1.6] - 2026-11-14

### Correzioni
- Impostata esplicitamente l'unità suggerita MB per i cinque sensori di dimensione dati.
- Aggiornate al nuovo valore suggerito le opzioni iniziali già memorizzate da Home Assistant per le entità esistenti, senza sovrascrivere un'eventuale unità personalizzata scelta dall'utente.
- Mantenuta la conversione da byte a MB decimali e la precisione di due cifre.

### Fixes
- Explicitly set MB as the suggested unit for all five data-size sensors.
- Refreshed Home Assistant's stored initial options for existing entities, without overriding a custom unit explicitly selected by the user.
- Kept decimal byte-to-MB conversion and two-digit precision.

## [1.1.5] - 2026-11-14

### Miglioramenti
- I sensori Dimensione database, Dimensione allegati, Spazio totale, Spazio libero e Spazio utilizzato mostrano ora valori in MB decimali, con precisione di due cifre.
- Aggiunta la classe dispositivo Dimensione dati per consentire a Home Assistant di interpretare correttamente l'unità.

### Improvements
- Database size, attachment size, total space, free space and used space sensors now report decimal MB values with two-digit precision.
- Added the Data Size device class so Home Assistant correctly interprets the unit.

## [1.1.4] - 2026-11-14

### Correzioni
- Aggiunta l'icona locale dell'integrazione in `custom_components/gestione_cc/brand/icon.png`, riutilizzando l'immagine dell'add-on. Home Assistant 2026.3 o successivo la carica direttamente dall'integrazione.

### Fixes
- Added the integration's local brand icon at `custom_components/gestione_cc/brand/icon.png`, reusing the add-on image. Home Assistant 2026.3 or newer loads it directly from the integration.

## [1.1.3] - 2026-11-14

### Correzioni
- Aggiornata la generazione del certificato HTTPS: quando `hostname` è un IPv4, il certificato include SAN per l'indirizzo IP e per `homeassistant.local`.
- L'add-on mantiene la stessa CA privata e rinnova il solo certificato server quando cambia il nome host; non vengono modificati database, PIN o token.
- Impostato `192.168.1.27` come hostname predefinito per le nuove installazioni; le installazioni esistenti devono aggiornare il campo nelle opzioni dell'add-on.

### Fixes
- Updated HTTPS certificate generation: when `hostname` is an IPv4 address, the certificate includes SAN entries for both the IP address and `homeassistant.local`.
- The add-on keeps the existing private CA and renews only the server certificate when the hostname changes; database, PIN and token are untouched.
- Set `192.168.1.27` as the default hostname for new installations; existing installations must update the add-on option.

## [1.1.2] - 2026-11-14

### Diagnostica
- Aggiunti log per distinguere errori di CA, autenticazione, risposta HTTP, risposta API non valida e problemi di rete/TLS/timeout durante la configurazione.
- I log non includono token Bearer, intestazioni di autenticazione o dati inseriti nel modulo.
- Mantenute obbligatorie la verifica TLS e la CA privata; nessuna modifica all'autenticazione o agli endpoint.

### Diagnostics
- Added logs to distinguish CA, authentication, HTTP response, invalid API response, and network/TLS/timeout failures during setup.
- Logs never include the Bearer token, authentication headers, or form-submitted credentials.
- TLS verification and the private CA remain mandatory; authentication and API endpoints are unchanged.

## [1.1.1] - In sviluppo / In development

### Correzioni
- Spostato il controllo del file CA e il caricamento del contesto SSL fuori dall'event loop di Home Assistant, evitando chiamate bloccanti durante la configurazione.
- Inizializzazione del contesto SSL asincrona anche all'avvio dell'integrazione; gli errori di caricamento del certificato vengono segnalati come errore di configurazione/aggiornamento senza disattivare la verifica TLS.

### Fixes
- Moved CA file checks and SSL context creation out of Home Assistant's event loop to prevent blocking calls during configuration.
- SSL context is now initialized asynchronously when the integration starts; certificate-loading errors are reported without disabling TLS verification.

## [1.1.0] - 2026-11-14

### Aggiunto
- Prima versione dell'integrazione Home Assistant Gestione C/C per il monitoraggio tecnico dell'app e l'avvio delle operazioni di manutenzione.
- Aggiunti esempi di dashboard e automazioni per gli stati tecnici.

### Sicurezza
- L'integrazione riceve esclusivamente stati tecnici e non accede ai dati contabili, al registro accessi o ai file di backup.
- Accesso di Home Assistant Core limitato a percorsi API e comandi di manutenzione esplicitamente autorizzati.
- Mantenute verifica HTTPS, CA dedicata e restrizione LAN.

### Added
- First release of the Gestione C/C Home Assistant integration for technical monitoring and maintenance commands.
- Added dashboard and automation examples for technical status.

### Security
- The integration receives technical status only and cannot access accounting data, the access log or backup files.
- Home Assistant Core access is restricted to explicitly allowed API paths and maintenance commands.
- HTTPS verification, dedicated CA and LAN restrictions remain enabled.

### Versioni / Versions
- Versione add-on / Add-on version: 1.1.0.
- Versione app inclusa / Bundled application version: 1.7.14.

## [1.0.43] - 2026-11-14

### Correzioni
- Corretta la versione add-on mostrata nel piè di pagina: ora è allineata alla versione effettivamente installata.
- Centralizzata la versione dell'add-on in una costante per evitare etichette obsolete nell'interfaccia.

### Fixes
- Fixed the add-on version displayed in the application footer so it matches the installed add-on version.
- Centralized the add-on version in a constant to prevent stale version labels in the interface.

### Versioni / Versions
- Versione add-on / Add-on version: 1.0.43.
- Versione app inclusa / Bundled application version: 1.7.14.

## [1.0.42] - 2026-11-14

### Aggiunto e corretto
- Aggiunta nel Piano dei conti la casella **Mutuo** per i conti patrimoniali non liquidi.
- I movimenti associati a un conto contrassegnato come Mutuo non vengono più conteggiati tra i trasferimenti.
- I movimenti dei conti Mutuo vengono inclusi nell'analisi delle spese del Report, anche senza attivare l'inclusione Budget/Report.
- Il flag Mutuo si applica anche ai sottoconti del conto contrassegnato.
- Rinominata la colonna del Piano dei conti da **Budget** a **Budget/Report** e aggiunta la colonna **Mutuo**.
- Aggiornata l'esportazione PDF del Piano dei conti per includere il nuovo flag.

### Added and fixed
- Added a **Mortgage** checkbox to non-liquid balance-sheet accounts in the Chart of Accounts.
- Transactions assigned to an account marked as Mortgage are no longer counted as transfers.
- Mortgage-account transactions are included in Report expense analysis even when Budget/Report inclusion is not enabled.
- The Mortgage flag also applies to subaccounts of the marked account.
- Renamed the Chart of Accounts column from **Budget** to **Budget/Report** and added a **Mortgage** column.
- Updated the Chart of Accounts PDF export to include the new flag.

### Versioni / Versions
- Versione add-on / Add-on version: 1.0.42.
- Versione app inclusa / Bundled application version: 1.7.14.

## [1.0.39] - 2026-11-14

### Italiano
- Corretto il calcolo del saldo iniziale delle Previsioni: vengono sommati i flussi storici dei soli conti liquidi selezionati; i trasferimenti interni al perimetro selezionato non alterano il saldo complessivo. Il saldo di apertura configurato resta quello del conto principale; per gli altri conti il valore è ricostruito dalla cronologia disponibile e viene segnalato come potenzialmente incompleto.
- Limitate le entrate e le uscite stimate ai movimenti registrati sui conti liquidi selezionati.
- Ripartiti i budget di categoria nelle Previsioni in base alla quota storica attribuibile ai conti selezionati; i budget restano mensili e non riportano residui.
- Aggiunta l'esportazione dell'intera guida in PDF nella lingua selezionata, con copertina, indice e numerazione delle pagine.
- Aggiornata la versione dell'add-on a 1.0.39. La versione dell'app inclusa resta 1.7.13.

### English
- Fixed the Forecast opening balance calculation: historical cash flows are summed only for selected liquid accounts; transfers within the selected scope do not change the combined balance. The configured opening balance remains the one for the primary account; other accounts are reconstructed from available history and flagged as potentially incomplete.
- Restricted estimated income and expenses to transactions recorded on the selected liquid accounts.
- Allocated category budgets in Forecast according to the historical share attributable to selected accounts; budgets remain monthly with no carryover.
- Added export of the complete guide to PDF in the selected language, including a cover, contents page and page numbering.
- Updated the add-on version to 1.0.39. The bundled application version remains 1.7.13.

## [1.0.31] - 2026-11-14

### Aggiunto
- Barra di avanzamento all'accesso e durante il calcolo delle Previsioni.
- Selettore privacy globale a tre modalità.
- Versione add-on aggiornata a 1.0.31.

### Added
- Sign-in and forecast progress indicators.
- Global three-mode privacy selector.
- Add-on version updated to 1.0.31.

## [1.0.19] - 2026-11-13

### Italiano
- Aggiunti allegati ai movimenti: caricamento, elenco, download ed eliminazione di file PDF, JPEG e PNG.
- Limiti di sicurezza: 10 MB per file e 80 MB complessivi; verifica del tipo e della firma del file.
- Aggiunto lo storico dettagliato append-only per creazione, modifica e cancellazione dei movimenti, con data/ora e valori prima/dopo.
- Allegati e storico sono conservati nel database SQLite e inclusi nei backup SQLite e Google Drive.
- Il backup JSON include allegati e storico dettagliato, con limite complessivo di 80 MB per gli allegati.
- Aggiunta la migrazione delle nuove tabelle anche dopo il ripristino di database SQLite precedenti.
- Corretta la formattazione monetaria del saldo iniziale nell'estratto conto Excel senza modificare il valore.
- Aggiornata l'app inclusa alla versione 1.7.13.

### English
- Added transaction attachments: upload, list, download and deletion of PDF, JPEG and PNG files.
- Security limits: 10 MB per file and 80 MB total; MIME type and file-signature validation.
- Added append-only transaction history for creation, edits and deletion, including timestamps and before/after values.
- Attachments and history are stored in SQLite and included in SQLite and Google Drive backups.
- JSON backups now include attachments and detailed transaction history, with an 80 MB total attachment limit.
- Added migration of the new tables after restoring older SQLite databases.
- Fixed opening-balance currency formatting in Excel statements without changing the underlying value.
- Updated the bundled application to version 1.7.13.

## [1.0.18] - 2026-11-11


- Corrected report deviation consistency: when actual “Spese” and “Uscite” totals reconcile, expected average, deviation and percentage now use the same aggregated values.
- Kept “Uscite” based on cash-flow totals whenever the actual scopes do not reconcile.
- Applied the shared calculation to the on-screen report, PDF and Excel export.
- Preserved the treatment of loan principal repayments as personal costs, as well as SQLite data, PIN, HTTPS, LAN access and backups.
- Updated the bundled application to version 1.7.12.

## [1.0.17] - 2026-11-11

- Decoupled logout from Google Drive backup completion: after queued database writes finish, the server queues the backup and immediately invalidates the session.
- The backup runs in a server-side worker and continues after the browser tab or window is closed.
- The job queue and operation state are persisted in the add-on database; jobs interrupted by a service restart are re-queued on the next startup.
- The result of the latest session backup is recorded and can be checked after the next login in the Google Drive section of Settings.
- Removed the best-effort page-close backup handler; it is replaced by the explicit authenticated queue operation during logout.
- Updated the bundled application to version 1.7.11. No changes to accounting data, PIN, HTTPS configuration or LAN access.

## [1.0.16] - 2026-11-11

- Improved alignment in the cash-flow report tables: the Category column remains unchanged, while all following columns are right-aligned within their respective columns.
- Standardized amount formatting in report tables and PDF output, placing the € symbol before the amount.
- Applied the same formatting to the period comparison in the PDF and Report view. Excel export remains unchanged because it was already correctly formatted.
- Updated the bundled application to version 1.7.10. No changes to the SQLite archive, PIN, HTTPS configuration, LAN access or backups.

## [1.0.15] - 2026-11-11

- Simplified new-account creation in a single dialog, with a checkbox for economic accounts and an income/expense selector.
- Added a counterpart-account filter to the Transactions view, alongside the existing date and status filters.
- Added selective bulk counterpart editing: users can select individual transactions or all filtered results across pages, choose a replacement counterpart, review the confirmation and then save.
- Transactions split across multiple counterpart accounts are excluded from bulk editing to prevent unintended changes to their allocations.
- Updated the bundled application to version 1.7.9. No changes to the SQLite archive, PIN, HTTPS configuration, LAN access or backups.

## [1.0.14] - 2026-11-10

- Updated the examples shown when editing custom account tags: a fictitious IBAN, CLOSED ACCOUNT, MAIN ACCOUNT, SAVINGS, SALARY, SECONDARY ACCOUNT, PREPAID CARD, FAMILY ACCOUNT and DO NOT USE.
- Updated the bundled application to version 1.7.8.
- No changes to existing account tags, the SQLite archive, PIN authentication, HTTPS configuration, LAN access or backups.

## [1.0.13] - 2026-11-10

- Added multiple custom tags per account, with no predefined list: any text is accepted, including an IBAN, with one tag per line.
- Tags belonging to the selected account are displayed in the report heading immediately after the account path.
- Added account tags to PDF and Excel report headings and to PDF/XLSX transaction statements.
- Preserved the SQLite archive, PIN authentication, HTTPS configuration, LAN access and backup behavior; no migration or deletion of existing data is required.

## [1.0.12] - 2026-11-10

- Fixed the add-on version displayed in the application footer; it now matches the released 1.0.12 version.
- Preserved the SQLite archive, PIN authentication, HTTPS configuration, LAN access and backup behavior.

## [1.0.11] - 2026-11-10

- Updated the bundled Gestione C/C application to version 1.7.6.
- Fixed double counting in hierarchical expense totals: parent accounts are no longer added again alongside their child accounts.
- The report's “Outflows” row now uses total cash outflows and corresponding comparisons, allowing reconciliation with the period summary.
- The reference average now includes only completed periods preceding the selected period; subsequent months are excluded.
- Preserved the SQLite archive, PIN authentication, HTTPS configuration and backup behavior.

# Changelog

Notable changes for Gestione C/C Home Assistant App.

## [1.0.10] - 2026-11-10

- Updated the bundled Gestione C/C application to version 1.7.5.
- Reorganized the spending deviation report into a hierarchy with a bold Expenses total, regular second-level categories, italic detail accounts and a final bold Outflows total.
- Applied the same presentation to PDF and Excel reports while keeping chart source data separate.
- Preserved the SQLite archive, PIN authentication, HTTPS configuration and backup behavior.

## [1.0.9] - 2026-11-10

- Updated the Home Assistant application interface to the compatible Gestione C/C 1.7.4 feature set.
- Improved Excel header detection for bank statements with introductory rows before the transaction table.
- Improved the display of long QIF transaction details, including multi-line wrapping and the “Dettagli” label.
- Preserved the Home Assistant-specific server API, PIN authentication, HTTPS setup and persistent SQLite storage.
- No database migration or data reset is required.


## [1.0.6] - 2026-11-10

- Updated the bundled Gestione C/C application to version 1.7.2.
- Consolidated the account hierarchy, tags, transaction register, budget and forecast updates.
- Aligned the transaction date-range controls and removed the non-functional month selector.
- Bank statement PDF and XLSX exports now follow the currently selected Overview period.


## [1.0.5] - 2026-11-08

- Added optional Google Drive backup integration, with OAuth desktop authorization generated on a Windows PC and credentials stored only in the Home Assistant App data volume.
- Added automatic session backup when signing out, best-effort backup on browser page close, and independent nightly backup at 03:00 Europe/Rome.
- Kept one rolling session backup and the latest three nightly SQLite backups in a dedicated Google Drive folder.
- Added Google Drive backup listing, manual backup, integrity-checked restore and pre-restore local snapshot.
- Google Drive backup files are intentionally unencrypted; the feature is opt-in and does not expose the LAN-only web interface to the Internet.
- Added tzdata to ensure the nightly scheduler uses the Europe/Rome time zone.


## [1.0.4] - 2026-11-08

- Unified the PDF preview toolbar: both the Gestione C/C report and the bank statement now use a single “STAMPA/ESPORTA PDF” command.
- The command opens the browser's standard print dialog, where users can select a printer or “Save as PDF”.
- Improved bank-statement spreadsheet formatting with cell borders and grid lines, highlighted headers, formatted dates and amounts, tuned column widths, and aligned numeric values.
- Reorganised the Excel summary: opening balance at the top and income, expense, and closing-balance totals at the end.
- Kept summary totals outside the transaction auto-filter range.

## [1.0.3] - 2026-11-08

- Simplified the archive loading screen to the exact message “Caricamento archivio in corso.....” with an animated indicator.
- Retry remains hidden while loading and appears only after an error or timeout.
- Added a 15-second request timeout and protection against repeated retry clicks.

## [1.0.2] - 2026-11-08

- Improved multi-page A4 PDF bank-statement pagination.
- Opening balance appears once at the beginning of the statement.
- Movement-table headers repeat on subsequent pages.
- Transaction rows are kept together and are not split across pages.
- Final income/expense totals and closing balance are grouped at the end.

## [1.0.1] - 2026-11-08

- Improved responsive layout and visibility of the Exit control on portrait smartphones.
- Added PDF and XLSX bank-statement exports from Overview for the selected period.
- Statement includes opening and closing balances, separate income and expense columns, and running balance.

## [1.0.0] - 2026-11-08

- First documented distribution baseline.
- Central SQLite archive in the persistent Home Assistant App data directory.
- Six-digit PIN authentication and HTTPS interface.
- GnuCash and bank transaction import workflows.
- Account hierarchy, transaction categorisation and split transactions.
- Financial overview, historical comparisons and period-based reports.
- XLSX export and browser-based PDF print/export workflow.
- JSON and SQLite backup/restore workflows.
- Bilingual documentation and proprietary personal-use licensing.

### Notes

- Intended for local-network use only; public Internet exposure is not part of the documented setup.
- Configure and verify the actual LAN CIDR before using personal accounting data.
- Keep off-host backups and test restore procedures safely.
- No independent security audit is claimed.
- The proprietary licence applies only to original materials for which the project author holds the relevant rights. Third-party components remain subject to their own licences.
- The Windows application version and the Home Assistant App distribution version are separate version numbers.
