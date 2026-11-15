# Versione smartphone — sola lettura

## Stato

La versione smartphone è stata integrata in `main` e inclusa nell'Home Assistant App **2.1.0**. I controlli automatici e la compilazione dell'add-on sono superati. È ora disponibile per il collaudo funzionale sull'istanza Home Assistant reale; l'installazione PWA e i calcoli vanno verificati con attenzione durante l'uso iniziale.

## Obiettivo

Fornire una seconda interfaccia, progettata per lo smartphone, che riutilizza l'archivio SQLite e i dati dell'applicazione principale. La versione desktop rimane separata e invariata.

## Accesso

- Percorso: `/mobile/` (indirizzo completo: `https://<host-lan>:8443/mobile/`).
- Accesso: `/mobile/login`.
- Autenticazione: PIN amministratore esistente di sei cifre.
- La sessione smartphone usa il cookie `cc_mobile_session`, distinto dalla sessione desktop `cc_session`.
- Le due modalità sono mutuamente esclusive nello stesso browser: l'accesso smartphone invalida il cookie amministrativo e un successivo accesso amministrativo invalida quello smartphone.
- La sessione mobile non abilita l'accesso alla pagina amministrativa.

## Funzioni iniziali

- Panoramica con saldo, entrate, uscite e saldo netto.
- Selettore del periodo mensile o annuale.
- Consultazione delle uscite per categoria.
- Elenco dei movimenti, con filtro entrate/uscite/da classificare.
- Consultazione dei saldi dei conti.
- Comando per nascondere gli importi e comando di uscita.

## Garanzie di sola lettura

La pagina mobile non contiene comandi di inserimento, modifica, importazione o cancellazione. Il server assegna alla sessione il ruolo `readonly` e applica una lista consentita di richieste GET. L'unica richiesta POST ammessa dopo l'accesso è la disconnessione mobile; le altre richieste POST vengono rifiutate. L'API `/api/mobile/state` restituisce lo stato contabile solo a una sessione mobile autenticata.

Le sessioni desktop e smartphone usano cookie separati e reciprocamente esclusivi nello stesso browser. L'API mobile restituisce una proiezione ridotta dei dati: conti, movimenti e campi necessari alla consultazione; esclude impostazioni, credenziali, allegati, regole ricorrenti e identificativi interni non necessari.

## Limiti della prima versione

- Non sono ancora inclusi i grafici storici dettagliati, i report completi, gli scostamenti e le medie attese.
- La consultazione dei movimenti è limitata al periodo selezionato; mese e anno correnti terminano alla data odierna.
- La PWA usa uno scope dedicato `/mobile/`, senza controllare le pagine desktop.
- La PWA mobile e l'installazione su Android devono ancora essere verificate su dispositivi reali.
- Il servizio rimane LAN-only e richiede HTTPS e il certificato CA già previsto dall'app.

## Verifiche automatiche

Il workflow `Mobile read-only validation` controlla la sintassi Python e JavaScript, il manifest PWA, la presenza degli asset, la proiezione dei dati e le protezioni strutturali della modalità di sola lettura. Anche i test del motore finanziario desktop sono eseguiti separatamente.

---

# Smartphone version — read-only

## Status

The smartphone version has been merged into `main` and included in Home Assistant App **2.1.0**. Automated checks and the add-on build have passed. It is now available for functional testing on the real Home Assistant instance; PWA installation and calculations should be checked carefully during initial use.

## Goal

Provide a separate smartphone-first interface using the existing SQLite archive and application data. The desktop interface remains separate and unchanged.

## Access

- Path: `/mobile/` (full address: `https://<lan-host>:8443/mobile/`).
- Login: `/mobile/login`.
- Authentication: the existing six-digit administrator PIN.
- The smartphone session uses the `cc_mobile_session` cookie, separate from the desktop `cc_session` cookie.
- The two modes are mutually exclusive in the same browser: mobile sign-in expires the administrator cookie, and a subsequent administrator sign-in expires the mobile cookie.
- The mobile session does not grant access to the administrative page.

## Initial features

- Overview with balance, income, expenses and net result.
- Monthly or yearly period selector.
- Expense categories.
- Transaction list with income/expense/pending filters.
- Account balance consultation.
- Hide-amounts control and sign-out.

## Read-only enforcement

The mobile page contains no transaction creation, editing, import or deletion controls. The server assigns the `readonly` role and enforces an allowlist of GET requests. After login, the only permitted POST request is mobile sign-out; all other POST requests are rejected. The `/api/mobile/state` endpoint returns accounting state only to an authenticated mobile session.

Desktop and smartphone sessions use separate, mutually exclusive cookies in the same browser. The mobile API returns a reduced data projection containing only accounts, transactions and fields required for consultation; it excludes settings, credentials, attachments, recurring rules and unnecessary internal identifiers.

## Initial limitations

- Detailed historical charts, full reports, variances and expected averages are not included yet.
- Transaction consultation is limited to the selected period; the current month and year stop at today's date.
- The PWA uses a dedicated `/mobile/` scope and does not control desktop pages.
- The mobile PWA and Android installation still need to be checked on real devices.
- The service remains LAN-only and requires HTTPS and the app's existing private CA certificate.

## Automated checks

The `Mobile read-only validation` workflow checks Python and JavaScript syntax, the PWA manifest, required assets, data projection and structural read-only protections. The desktop financial-engine tests are also run separately.
