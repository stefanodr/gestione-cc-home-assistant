## [1.0.19] - 2026-11-13

### Italiano
- Aggiunti allegati ai movimenti: caricamento, elenco, download ed eliminazione di file PDF, JPEG e PNG.
- Limiti di sicurezza: 10 MB per file e 80 MB complessivi; verifica del tipo e della firma del file.
- Aggiunto lo storico dettagliato append-only per creazione, modifica e cancellazione dei movimenti, con data/ora e valori prima/dopo.
- Allegati e storico sono conservati nel database SQLite e inclusi nei backup SQLite e Google Drive.
- Il backup JSON include anche gli allegati, con limite complessivo di 80 MB.
- Aggiunta la migrazione delle nuove tabelle anche dopo il ripristino di database SQLite precedenti.
- Corretta la formattazione monetaria del saldo iniziale nell'estratto conto Excel senza modificare il valore.
- Aggiornata l'app inclusa alla versione 1.7.13.

### English
- Added transaction attachments: upload, list, download and deletion of PDF, JPEG and PNG files.
- Security limits: 10 MB per file and 80 MB total; MIME type and file-signature validation.
- Added append-only transaction history for creation, edits and deletion, including timestamps and before/after values.
- Attachments and history are stored in SQLite and included in SQLite and Google Drive backups.
- JSON backups now include attachments, with an 80 MB total attachment limit.
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
