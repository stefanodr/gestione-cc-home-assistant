# Changelog

Notable changes for Gestione C/C Home Assistant App.

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
