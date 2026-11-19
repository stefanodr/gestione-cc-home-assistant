## 2.1.32
- IT: Aggiunto nella Home smartphone `/mobile` il selettore «Seleziona conto liquido» all'interno del riquadro del saldo, subito sotto «Saldo ricostruito dai movimenti» e prima di «Aggiornato al». La scelta aggiorna saldo, entrate, uscite, grafici e movimenti del periodo senza modificare i dati contabili o le preferenze salvate.
- EN: Added the “Select liquid account” control to the `/mobile` smartphone Home balance card, directly below “Balance reconstructed from transactions” and before “Updated on”. Changing the selection refreshes the balance, income, expenses, charts and transactions for the selected period without changing accounting data or saved preferences.

## 2.1.31
- IT: Durante l'importazione dei movimenti il conto liquido viene sempre proposto nel menu: preselezione dal file quando riconoscibile, altrimenti dall'ultima importazione. La scelta dell'utente si applica a tutti i movimenti importati e viene ricordata.
- IT: Uniformata la selezione del conto liquido su smartphone: il menu della Home aggiorna anche movimenti e report per il periodo mensile, trimestrale, semestrale o annuale. La selezione resta manuale e sincronizzata.
- EN: Bank-account selection is always shown during transaction import: preselected from the file when identifiable, otherwise from the last import. The user's choice applies to all imported transactions and is remembered.
- EN: Unified liquid-account selection on smartphones: the Home selector also updates transactions and reports for monthly, quarterly, half-yearly, and yearly periods. The selection remains manual and synchronized.

## 2.1.30
- IT: Corretto il layout delle finestre di verifica e modifica dei dati documento: etichette e campi sono disposti in modo leggibile, senza sovrapposizioni, con adattamento agli schermi piccoli.
- IT: Riorganizzato il modulo «Cambia PIN amministratore» con etichette sopra ai rispettivi campi e spaziatura uniforme. Nessuna modifica alla logica PIN o ai dati.
- EN: Fixed the document review and editing dialogs: labels and fields now use a readable layout without overlap, adapting to small screens.
- EN: Reorganized the administrator PIN form with labels above their corresponding fields and consistent spacing. No changes to PIN logic or stored data.

## 2.1.29
- IT: Aggiunto nella Home uno specifico selettore «Seleziona conto liquido», visibile solo sugli smartphone touch. Il controllo desktop esistente resta invariato e nascosto solo nella vista smartphone; il saldo mobile segue il nuovo selettore.
- EN: Added a dedicated “Select liquid account” selector to Overview, visible only on touch smartphones. The existing desktop control remains unchanged and is hidden only in the smartphone view; the mobile balance follows the new selector.

## 2.1.28
- IT: Il selettore manuale del conto liquido e il relativo calcolo del saldo sono limitati agli smartphone (schermo fino a 600 px e puntatore touch). Desktop e tablet mantengono il comportamento precedente.
- EN: The manual liquid-account selector and its balance calculation are limited to smartphones (up to 600 px viewport and touch pointer). Desktop and tablets retain their previous behavior.

## 2.1.27
- IT: La Home usa il selettore esplicito del conto liquido: la scelta dell'utente non viene più sostituita dall'autoselezione automatica su smartphone e tablet. Il saldo è calcolato sul conto selezionato anche nei periodi senza movimenti, senza cambiare conto al variare del mese.
- EN: Overview now uses the explicit liquid-account selector: the user's choice is no longer overridden by automatic selection on phones and tablets. The balance is calculated for the selected account even in periods without transactions, without switching accounts when the month changes.

## 2.1.26
- IT: L'autoselezione dei conti liquidi in base ai movimenti del periodo è attiva anche sui tablet touch in orientamento orizzontale, senza dipendere soltanto dalla larghezza della finestra.
- EN: Automatic liquid-account selection based on period transactions now also works on touch tablets in landscape orientation, instead of relying only on viewport width.

## 2.1.25
- IT: I nomi dei conti nella selezione della Home e dei Report vengono mostrati secondo la cronologia valida alla data finale del periodo selezionato, invece di usare sempre la denominazione odierna.
- EN: Account names in Overview and Reports are now displayed using the name history valid at the selected period end date, rather than always using today's name.

## 2.1.24
- IT: La selezione del conto nella Home e nei Report su smartphone/tablet segue i conti liquidi effettivamente movimentati nel periodo selezionato; corretta anche la corrispondenza degli ID conto.
- EN: Account selection in Overview and Reports on phones/tablets now follows the liquid accounts actually used in the selected period; account ID matching is also hardened.

## [2.1.23] - 2026-11-18

### Selezione automatica dei conti liquidi su schermi compatti
- Estesa fino a 900 px la modalità di selezione automatica dei conti liquidi in base ai movimenti del periodo visualizzato, includendo anche i tablet.
- Su schermi più larghi resta invariata la selezione manuale del conto.
- Nessuna modifica ai movimenti, al database, alle impostazioni di backup o ai dati esistenti.

### Automatic liquid-account selection on compact screens
- Extended automatic liquid-account selection, based on transactions in the displayed period, up to 900 px to include tablets.
- Manual account selection remains unchanged on wider screens.
- No changes to transactions, database, backup settings, or existing data.

## [2.1.19] - 2026-11-18

### Riordino della schermata Impostazioni
- Ripristinata la griglia a tre colonne per le schede delle impostazioni su schermi desktop.
- Spostato il Registro accessi sotto le schede, esteso a tutta la larghezza disponibile.
- Mantenute due colonne su schermi intermedi e una colonna su smartphone.

### Settings layout refinement
- Restored a three-column grid for settings cards on desktop screens.
- Moved the Access Log below the settings cards and expanded it to the full available width.
- Kept two columns on medium screens and one column on smartphones.

## [2.1.18] - 2026-11-18

### Registro accessi: filtri e storico completo
- La schermata mostra inizialmente gli ultimi 10 eventi e consente di caricare i successivi gruppi di 10.
- Aggiunti filtri combinabili per data iniziale/finale, tipo di evento ed esito, con comando per azzerarli.
- L'API restituisce tutti gli eventi ancora presenti nella finestra di conservazione di 30 giorni, non soltanto gli ultimi 200.
- Invariata la pulizia automatica oltre i 30 giorni; nessun evento viene eliminato o alterato da filtri e paginazione.

### Access log: filters and complete history
- The screen initially displays the latest 10 events and lets users load subsequent groups of 10.
- Added combinable start/end date, event type, and outcome filters, with a reset action.
- The API now returns every event still within the 30-day retention window, instead of only the latest 200.
- Automatic cleanup after 30 days is unchanged; filtering and pagination never delete or modify log entries.

## [2.1.17] - 2026-11-18

### Avvisi backup Google Drive
- Aggiunto il rilevamento degli errori del backup notturno Google Drive e dell'assenza del backup giornaliero dopo le 04:00 (Europe/Rome).
- Esposti gli stati tecnici tramite l'integrazione Home Assistant; le automazioni di esempio inviano notifiche solo in caso di problema.
- Nessuna modifica alla sezione Backup · Google Drive, alle credenziali OAuth, al database contabile o ai dati esistenti.

## [2.1.14] - 2026-11-17

### Correzione eliminazione conto
- Risolta la ricerca del conto da eliminare confrontando gli identificativi come stringhe, poi riutilizzando l'ID originale per i controlli e il salvataggio. Corregge il caso in cui l'ID importato è numerico ma l'attributo HTML lo restituisce come stringa.
- Nessuna modifica a backend, SQLite, API o dati esistenti.

## [2.1.13] - 2026-11-17

### Correzioni Piano dei conti
- Sostituita la conferma nativa `window.confirm` con il modal di conferma già gestito dall'app, compatibile con i browser integrati di Home Assistant.
- Ripetuto il controllo dei movimenti al momento della conferma, prima della cancellazione.
- Allineato il pulsante **Elimina** a destra con larghezza fissa e senza margine sinistro aggiuntivo.
- Nessuna modifica a backend, SQLite, API, autenticazione o dati esistenti.

## [2.1.12] - 2026-11-17

### Correzioni Piano dei conti
- Corretto il comando **Elimina**: ora la conferma e la cancellazione vengono gestite direttamente dall'azione, con controllo del risultato del salvataggio e ripristino in caso di errore.
- Il comando continua a impedire l'eliminazione di conti con movimenti, sottoconti o collegamenti a regole, ricorrenze, conto bancario principale o budget.
- Allineato a destra il numero dei movimenti e la relativa intestazione.
- Nessuna modifica al backend, allo schema SQLite, alle API, all'autenticazione o ai dati esistenti.

## [2.1.11] - 2026-11-17

### Gestione dei movimenti e cancellazione sicura dei conti
- Il numero nella colonna **Movimenti** del Piano dei conti è cliccabile e apre il registro filtrato su tutte le registrazioni collegate al conto, come conto corrente, contropartita, suggerimento o ripartizione.
- Il filtro contestuale mostra chiaramente il conto selezionato e può essere rimosso per tornare all'intero registro.
- La selezione multipla e il cambio massivo della contropartita restano disponibili per riassegnare i movimenti.
- Aggiunta l'azione **Elimina** nel Piano dei conti. La cancellazione è bloccata se esistono movimenti, sottoconti, regole apprese, ricorrenze o collegamenti al conto bancario principale.
- Se il conto ha movimenti, il messaggio indica quanti sono e invita ad aprirli dal conteggio, riassegnarli e riprovare quando il conteggio è zero.
- Il salvataggio della cancellazione è verificato: in caso di errore il conto viene ripristinato in memoria.
- Nessuna modifica al backend, allo schema SQLite, alle API, all'autenticazione, ai backup o a HTTPS.

### Account movement management and safe deletion
- The **Movements** count in the chart of accounts is clickable and opens the transaction register filtered to every transaction linked to that account as bank account, counterpart, suggestion or split.
- The contextual filter identifies the selected account and can be cleared to return to the full register.
- Existing multi-selection and bulk counterpart reassignment remain available.
- Added a **Delete** action to the chart of accounts. Deletion is blocked while transactions, subaccounts, learned rules, recurring schedules or the primary bank-account setting still reference the account.
- When transactions remain, the warning shows their count and instructs the user to open them from the count, reassign them and retry when the count reaches zero.
- Deletion save is checked; if saving fails, the account is restored in memory.
- No changes to backend, SQLite schema, API, authentication, backups or HTTPS.

## [2.1.7] - 2026-11-17

### Correzione privacy nei grafici mobile
- Corretto il mascheramento degli importi nelle torte di entrate e uscite: anche il totale visualizzato al centro del grafico viene ora nascosto quando è attiva l'opzione «Nascondi importi».
- Il totale torna visibile quando si disattiva la modalità privacy.
- La correzione si applica sia alla visualizzazione mensile sia a quella annuale e non modifica dati, calcoli o grafici.

### Mobile chart privacy fix
- Fixed amount masking in the income and expense doughnut charts: the total displayed in the center of each chart is now hidden when «Hide amounts» is enabled.
- Totals become visible again when privacy mode is disabled.
- The fix applies to both monthly and annual views and does not change data, calculations or chart rendering.

## [2.1.6] - 2026-11-16

### Riconciliazione guidata del piano dei conti Excel
- L'importazione Excel/CSV propone una classificazione compatibile con la struttura contabile GnuCash e con le regole di ContiChiari.
- Riconoscimento di tipi GnuCash e denominazioni comuni; proposta di tipo per i conti privi di una tipologia esplicita.
- Anteprima guidata per correggere il tipo e confermare l'inclusione nel Budget/Report e la natura di mutuo.
- Ricostruzione dei conti mastro mancanti quando il file contiene percorsi gerarchici con sottoconti.
- I conti già presenti non vengono sovrascritti; gli ID esterni sono conservati per i nuovi conti.
- Modello Excel aggiornato con ID esterno, tipo, classificazione, inclusione nel budget e indicatore mutuo.
- Importazione GnuCash integrata e movimenti esistenti invariati.

### Guided Excel chart-of-accounts reconciliation
- Excel/CSV import proposes a classification compatible with the GnuCash accounting structure and ContiChiari rules.
- Recognizes GnuCash types and common labels, and proposes a type when the source does not provide one.
- Adds a review step to correct account types and confirm Budget/Report inclusion and mortgage classification.
- Reconstructs missing parent accounts from hierarchical account paths.
- Existing accounts are not overwritten; external IDs are retained for newly imported accounts.
- Excel template now includes external ID, type, classification, budget inclusion and mortgage fields.
- Integrated GnuCash import and existing transactions remain unchanged.

## [2.1.4] - 2026-11-16

### Correzione grafico entrate smartphone
- Eliminato il doppio conteggio delle entrate nei conti gerarchici: ogni ripartizione viene attribuita soltanto al conto di contropartita effettivo, senza sommarla nuovamente ai conti genitori.
- Mantenuto il riconoscimento degli importi con segno negativo, usando il valore assoluto come nell'interfaccia principale.
- Modifica limitata al grafico mobile e ai metadati di versione; nessuna modifica ai movimenti, al database, al PIN, ai certificati o alla rete.

### Smartphone income chart fix
- Prevented duplicate income totals in hierarchical accounts: each split is assigned only to its actual counterpart account and is not added again to parent accounts.
- Kept support for negative-signed split values by using their absolute amount, matching the main interface.
- Change limited to the mobile chart and version metadata; no changes to transactions, database, PIN, certificates or network settings.

## [2.1.1] - 2026-11-15

### Interfaccia smartphone
- Corretta la visualizzazione del riquadro «Caricamento dati…»: l'attributo `hidden` ora prevale sulle regole CSS di visualizzazione.
- Sostituita la sezione **Conti** nella navigazione smartphone con **Grafici**.
- Aggiunto il confronto mensile di entrate e uscite e la ripartizione grafica delle uscite per categoria.
- Mantenuta la consultazione in sola lettura e invariati database, PIN, certificati e configurazione di rete.

### Smartphone interface
- Fixed the persistent “Loading data…” overlay: the `hidden` attribute now takes precedence over CSS display rules.
- Replaced the **Accounts** smartphone section with **Charts**.
- Added a monthly income/expense comparison and a graphical expense breakdown by category.
- Kept read-only access; database, PIN, certificates and network settings remain unchanged.

## [2.1.0] - 2026-11-15

### Interfaccia smartphone
- Aggiunta una PWA dedicata alla consultazione da smartphone, in sola lettura.
- Accesso con PIN esistente e sessione separata dalla modalità desktop.
- API mobile con proiezione ridotta dei dati contabili, senza impostazioni, credenziali o allegati.
- Scope PWA isolato sotto `/mobile/`; interfaccia desktop e database invariati.
- Aggiunti test automatici per la modalità read-only e la proiezione dei dati.
- Superati i test di sicurezza API, validazione applicativa, test finanziari, validazione smartphone e compilazione dell'add-on Home Assistant.

### Smartphone interface
- Added a dedicated read-only smartphone PWA.
- Uses the existing PIN and a session separate from desktop mode.
- Mobile API returns a reduced projection of accounting data, excluding settings, credentials and attachments.
- PWA scope isolated under `/mobile/`; desktop interface and database remain unchanged.
- Added automated tests for read-only enforcement and data projection.
- API security, application validation, financial tests, mobile validation and Home Assistant add-on build all passed.

## [2.0.0] - 2026-11-15

### Rilascio principale
- Allineate a **2.0.0** la versione dell'Home Assistant App e quella dell'applicazione inclusa.
- Rimossa dal piè di pagina dell'interfaccia la versione tecnica del pacchetto: viene mostrata soltanto la versione dell'app.
- Consolidata la nuova interfaccia con navigazione laterale comprimibile su desktop e tablet.
- Consolidato il supporto PWA: manifest aggiornato, icone PNG ufficiali da 192 e 512 px e collegamenti di installazione per Chrome, Edge e Firefox su Windows.
- Aggiornate le istruzioni per installazione, avvio, collegamenti desktop e gestione dell'icona dell'app.
- Documentata l'integrazione HACS per Home Assistant, con sensori tecnici, stato, pulsanti di manutenzione e procedure di configurazione.
- Estesa la documentazione bilingue con procedure di installazione, sicurezza, privacy e limitazioni operative.

### Integrazione Home Assistant
- L'integrazione HACS mantiene la propria versione indipendente **1.1.6**: non coincide con la versione dell'app né con quella dell'Home Assistant App.
- L'integrazione espone esclusivamente informazioni tecniche e comandi esplicitamente autorizzati; non rende disponibili dati contabili, movimenti, saldi, documenti o backup.
- Mantenuti HTTPS con verifica della CA privata, autenticazione tramite token dedicato e accesso limitato alla rete locale.

### Dati e aggiornamento
- Nessuna modifica intenzionale al formato del database SQLite o ai dati contabili.
- Non disinstallare l'Home Assistant App e non cancellare il volume persistente per aggiornare.
- Prima dell'aggiornamento principale, eseguire e verificare un backup indipendente.

### Major release
- Aligned the Home Assistant App and bundled application versions to **2.0.0**.
- Removed the package's technical version from the application footer; only the application version is displayed.
- Consolidated the new collapsible desktop/tablet sidebar navigation.
- Consolidated PWA support: updated manifest, official 192 px and 512 px PNG icons, and installation guidance for Chrome, Edge and Firefox on Windows.
- Updated instructions for installation, launch, desktop shortcuts and app-icon handling.
- Documented the Home Assistant HACS integration, including technical sensors, status entities, maintenance buttons and setup procedures.
- Expanded the bilingual documentation with installation, security, privacy and operational-limit guidance.

### Home Assistant integration
- The HACS integration keeps its independent **1.1.6** version; it is separate from both the application and Home Assistant App versions.
- The integration exposes technical information and explicitly authorised commands only; it does not expose accounting data, transactions, balances, documents or backups.
- HTTPS certificate verification, dedicated-token authentication and LAN-only access remain mandatory.

### Data and upgrade
- No intentional change to the SQLite database format or accounting data.
- Do not uninstall the Home Assistant App or delete its persistent data volume when upgrading.
- Create and verify an independent backup before this major upgrade.

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
