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
