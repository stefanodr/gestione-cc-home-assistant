# Versione smartphone — sola lettura

## Stato

La prima implementazione è disponibile nel ramo di sviluppo `feature/mobile-readonly`. Non è ancora una release e non deve essere installata sull'istanza Home Assistant in uso finché non sono completate le verifiche funzionali su un ambiente di prova.

## Obiettivo

Fornire una seconda interfaccia, progettata per lo smartphone, che riutilizza l'archivio SQLite e i dati dell'applicazione principale. La versione desktop rimane separata e invariata.

## Accesso

- Percorso: `/mobile`.
- Accesso: `/mobile/login`.
- Autenticazione: PIN amministratore esistente di sei cifre.
- La sessione smartphone usa il cookie `cc_mobile_session`, distinto dalla sessione desktop `cc_session`.
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

Le sessioni desktop e smartphone usano cookie separati, così l'accesso mobile non sostituisce la sessione amministrativa del browser.

## Limiti della prima versione

- Non sono ancora inclusi i grafici storici dettagliati, i report completi, gli scostamenti e le medie attese.
- La consultazione dei movimenti è limitata al periodo selezionato.
- La PWA mobile e l'installazione su Android devono ancora essere verificate su dispositivi reali.
- Il servizio rimane LAN-only e richiede HTTPS e il certificato CA già previsto dall'app.

## Verifiche automatiche

Il workflow `Mobile read-only validation` controlla la sintassi Python e JavaScript, il manifest PWA, la presenza degli asset e le protezioni strutturali della modalità di sola lettura.

---

# Smartphone version — read-only

## Status

The first implementation is available on the development branch `feature/mobile-readonly`. It is not a release and must not be installed on the active Home Assistant instance until functional checks have been completed in a test environment.

## Goal

Provide a separate smartphone-first interface using the existing SQLite archive and application data. The desktop interface remains separate and unchanged.

## Access

- Path: `/mobile`.
- Login: `/mobile/login`.
- Authentication: the existing six-digit administrator PIN.
- The smartphone session uses the `cc_mobile_session` cookie, separate from the desktop `cc_session` cookie.
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

Desktop and smartphone sessions use separate cookies, so mobile sign-in does not replace the browser's administrator session.

## Initial limitations

- Detailed historical charts, full reports, variances and expected averages are not included yet.
- Transaction consultation is limited to the selected period.
- The mobile PWA and Android installation still need to be checked on real devices.
- The service remains LAN-only and requires HTTPS and the app's existing private CA certificate.

## Automated checks

The `Mobile read-only validation` workflow checks Python and JavaScript syntax, the PWA manifest, required assets and structural read-only protections.
