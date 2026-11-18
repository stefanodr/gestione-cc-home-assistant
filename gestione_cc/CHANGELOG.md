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

## [2.1.10] - 2026-11-17

### Modifica del tipo GnuCash nel Piano dei conti
- Il tipo GnuCash di ogni conto esistente è modificabile direttamente dalla tabella del Piano dei conti tramite un selettore con descrizione italiana e codice originale.
- La modifica aggiorna la classificazione patrimoniale/economica/tecnica e ricalcola le opzioni collegate a Budget/Report e Mutuo.
- Richiesta di conferma prima del salvataggio; gli ID dei conti e i collegamenti ai movimenti non vengono riscritti.
- Impedito di trasformare in conto non liquido il conto bancario principale o un conto usato come conto di liquidità nei movimenti.
- In caso di salvataggio server non riuscito, il tipo precedente viene ripristinato.

### Edit GnuCash account types in the Chart of Accounts
- Existing account GnuCash types can now be edited directly in the Chart of Accounts table using a selector with Italian descriptions and the original type code.
- The change updates balance-sheet/income classification and recalculates Budget/Report and Mortgage eligibility.
- Confirmation is required before saving; account IDs and transaction links are preserved.
- Prevents changing the configured main liquidity account or an account used as transaction liquidity into a non-liquid type.
- Restores the previous type if server persistence fails.

## [2.1.9] - 2026-11-17

### Importazione contabile e riconciliazione GnuCash
- Allineata l'importazione del Piano dei conti Excel/CSV alla versione Windows: controlli più espliciti su intestazioni, conti duplicati con tipi incompatibili e righe non importabili.
- Aggiunta la riconciliazione obbligatoria dei tipi GnuCash, inclusa la linea di credito, e mantenuta la classificazione separata tra natura economica e patrimoniale.
- Esteso il riconoscimento del foglio «Piano dei conti» nei file Excel con più fogli.
- Allineato l'importatore dei movimenti: conserva codici conto e contropartita, riconcilia gli ID esterni, evita l'assegnazione automatica non richiesta del conto liquido e permette la scelta esplicita solo come ripiego.
- I movimenti con contropartite non riconciliate restano da classificare; i duplicati sono gestiti prima del salvataggio.
- Se il salvataggio sul server non riesce, lo stato in memoria viene ripristinato e l'importazione non viene dichiarata completata.

### Accounting import and GnuCash reconciliation
- Aligned Excel/CSV chart-of-accounts import with the Windows version, with clearer validation for headers, duplicate accounts with incompatible types, and non-importable rows.
- Added mandatory GnuCash account-type reconciliation, including credit lines, while keeping economic and balance-sheet classification distinct.
- Added preferred selection of the “Chart of Accounts” worksheet in multi-sheet Excel files.
- Aligned movement import to preserve account and counterpart codes, resolve external IDs, avoid unrequested automatic bank-account assignment, and request an explicit account only as a fallback.
- Unresolved counterpart accounts remain pending classification; duplicates are handled before saving.
- If server persistence fails, in-memory state is restored and the import is not reported as successful.

## [2.1.8] - 2026-11-17

### Versioni applicazione e add-on rilevate correttamente
- La versione dell'applicazione è ora aggiornata a 2.1.8.
- Il server comunica all'integrazione la versione effettiva dell'add-on fornita da Home Assistant Supervisor, senza ricavarla dal file JavaScript dell'app.
- Corretto il rilevamento separato delle due versioni mostrate dai sensori Home Assistant.

### Correct application and add-on version reporting
- The application version is now 2.1.8.
- The server reports the actual add-on version supplied by Home Assistant Supervisor, instead of deriving it from the app JavaScript file.
- Fixed separate detection of the two versions displayed by Home Assistant sensors.

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

## [2.1.5] - 2026-11-16

### Correzioni grafici annuali e categorie smartphone
- Il grafico annuale mobile ora rispetta lo stesso intervallo del totale annuale: mesi passati completi, mese corrente fino a oggi e mesi futuri esclusi.
- Il grafico annuale desktop riutilizza gli stessi dati con limite temporale impiegati per PDF ed Excel, evitando differenze tra schermo ed esportazioni.
- I grafici a torta e l'elenco delle spese mobile attribuiscono ogni importo soltanto al conto di contropartita effettivo, evitando il doppio conteggio delle categorie genitrici.
- Nessuna modifica ai movimenti, al database, al PIN, ai certificati, all'accesso LAN o all'integrazione HACS.

### Annual charts and smartphone categories fixes
- The mobile annual chart now follows the annual total's date range: completed past months, current month through today, and no future months.
- The desktop annual chart reuses the same date-clipped rows as PDF and Excel, keeping on-screen and exported charts consistent.
- Mobile expense charts and category lists assign each amount only to its actual counterpart account, avoiding duplicate parent-category totals.
- No changes to transactions, database, PIN, certificates, LAN access or the HACS integration.

## [2.1.4] - 2026-11-16

### Correzione grafico entrate smartphone
- Eliminato il doppio conteggio delle entrate nei conti gerarchici: ogni ripartizione viene attribuita soltanto al conto di contropartita effettivo, senza sommarla nuovamente ai conti genitori.
- Mantenuto il riconoscimento degli importi con segno negativo, usando il valore assoluto come nell'interfaccia principale.
- Modifica limitata al grafico mobile e ai metadati di versione; nessuna modifica ai movimenti, al database, al PIN, ai certificati o alla rete.

### Smartphone income chart fix
- Prevented duplicate income totals in hierarchical accounts: each split is assigned only to its actual counterpart account and is not added again to parent accounts.
- Kept support for negative-signed split values by using their absolute amount, matching the main interface.
- Change limited to the mobile chart and version metadata; no changes to transactions, database, PIN, certificates or network settings.

## [2.1.3] - 2026-11-16

### Correzioni smartphone e sensori versione
- Corretto il grafico delle entrate per categoria: ora considera anche le ripartizioni con importi di segno negativo, coerentemente con il calcolo delle entrate dell'interfaccia principale.
- Aggiornati i valori di versione esposti dall'API tecnica: versione applicazione e versione Home Assistant App sono ora valorizzate esplicitamente e allineate alla release 2.1.3.
- Nessuna modifica alla versione HACS dell'integrazione (1.1.6), al database, al PIN, ai certificati o alla configurazione di rete.

### Smartphone and version sensor fixes
- Fixed the income-by-category chart to include split entries with negative signed values, matching the main interface's income calculation.
- Updated the version values exposed by the technical API: application and Home Assistant App versions are now explicitly set to release 2.1.3.
- No changes to the HACS integration version (1.1.6), database, PIN, certificates or network configuration.

## [2.1.2] - 2026-11-16

### Interfaccia smartphone
- Resa esplicita e uniforme la formattazione italiana degli importi, con separatore delle migliaia, virgola decimale e simbolo euro (es. 12.345,67 €).
- Ampliata la sezione Grafici con grafici ad anello per le spese e le entrate per categoria.
- Aggiunto il grafico dell'andamento mensile del saldo netto, mantenendo il confronto di entrate e uscite.
- Conservati consultazione in sola lettura, mascheramento importi e perimetro dei dati mobile; nessuna modifica a database, PIN, certificati o rete.

### Smartphone interface
- Made Italian amount formatting explicit and consistent, with thousands separators, decimal comma and euro symbol (e.g. 12.345,67 €).
- Expanded Charts with doughnut charts for expenses and income by category.
- Added a monthly net-balance trend while retaining the income/expense comparison.
- Preserved read-only access, amount masking and the mobile data scope; no changes to the database, PIN, certificates or network settings.

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

### Smartphone interface
- Added a dedicated read-only smartphone PWA.
- Uses the existing PIN and a session separate from desktop mode.
- Mobile API returns a reduced projection of accounting data, excluding settings, credentials and attachments.
- PWA scope isolated under `/mobile/`; desktop interface and database remain unchanged.
- Added automated tests for read-only enforcement and data projection.

## [2.0.0] - 2026-11-15

### Rilascio principale
- Allineate a **2.0.0** la versione dell'Home Assistant App e quella dell'applicazione inclusa.
- Rimossa dal piè di pagina dell'interfaccia la versione tecnica del pacchetto: viene mostrata soltanto la versione dell'app.
- Consolidata la nuova interfaccia con navigazione laterale comprimibile su desktop e tablet.
- Consolidato il supporto PWA: manifest aggiornato, icone PNG ufficiali da 192 e 512 px e istruzioni per Chrome, Edge e Firefox su Windows.
- Aggiornata la documentazione per installazione PWA, collegamenti desktop e gestione dell'icona.
- Documentata la custom integration HACS, distinta dall'App, con sensori tecnici, pulsanti di manutenzione e configurazione tramite token e CA privata.
- Estesa la documentazione in italiano e inglese per installazione, sicurezza, privacy, backup e limitazioni operative.

### Integrazione Home Assistant
- La custom integration HACS mantiene la propria versione indipendente **1.1.6**.
- L'integrazione espone esclusivamente informazioni tecniche e comandi autorizzati; non rende disponibili dati contabili, movimenti, saldi, documenti o backup.
- Restano obbligatori HTTPS con verifica della CA privata, token dedicato e accesso limitato alla rete locale.

### Dati e aggiornamento
- Nessuna modifica intenzionale al formato del database SQLite o ai dati contabili.
- Non disinstallare l'Home Assistant App e non cancellare il volume persistente per aggiornare.
- Prima dell'aggiornamento principale, eseguire e verificare un backup indipendente.

### Major release
- Aligned the Home Assistant App and bundled application versions to **2.0.0**.
- Removed the package's technical version from the application footer; only the application version is displayed.
- Consolidated the new collapsible desktop/tablet sidebar navigation.
- Consolidated PWA support: updated manifest, official 192 px and 512 px PNG icons, and installation guidance for Chrome, Edge and Firefox on Windows.
- Updated PWA installation, desktop shortcut and app-icon documentation.
- Documented the HACS custom integration as a component separate from the App, including technical sensors, maintenance buttons and setup using a dedicated token and private CA.
- Expanded the Italian and English documentation for installation, security, privacy, backups and operational limitations.

### Home Assistant integration
- The HACS custom integration keeps its independent **1.1.6** version.
- It exposes technical information and explicitly authorised commands only; it does not expose accounting data, transactions, balances, documents or backups.
- HTTPS certificate verification, dedicated-token authentication and LAN-only access remain mandatory.

### Data and upgrade
- No intentional change to the SQLite database format or accounting data.
- Do not uninstall the Home Assistant App or delete its persistent data volume when upgrading.
- Create and verify an independent backup before this major upgrade.

## [1.0.44] - 2026-11-14

### Correzione certificati HTTPS
- Corretta la generazione della CA privata: ora include le estensioni X.509 obbligatorie `basicConstraints` e `keyUsage`, oltre agli identificatori della chiave.
- All'avvio viene verificata anche la CA già presente. Se non è conforme, viene creata una nuova CA e i vecchi certificati sono conservati in una cartella di backup protetta in `/data/tls`.
- Il certificato HTTPS del server viene rigenerato e verificato rispetto alla nuova CA. Dopo l'aggiornamento è necessario scaricare e installare nuovamente il certificato CA in Home Assistant.
- Nessuna modifica al database contabile, al PIN, al token dell'integrazione, all'hostname, alla porta HTTPS o alle regole di accesso LAN.

### HTTPS certificate fix
- Fixed private CA generation: it now includes the required X.509 `basicConstraints` and `keyUsage` extensions, together with key identifiers.
- Startup now validates the existing CA. If it is not compliant, a new CA is generated and the previous certificates are retained in a protected backup folder under `/data/tls`.
- The HTTPS server certificate is regenerated and verified against the new CA. After updating, download and install the new CA certificate in Home Assistant.
- No changes to the accounting database, PIN, integration token, hostname, HTTPS port or LAN access rules.

### Versioni / Versions
- Versione app / App version: 1.7.14.
- Versione add-on Home Assistant / Home Assistant add-on version: 1.1.1.
- Versione backend visualizzata dall'API / Backend version reported by the API: 1.0.44.

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

## [1.0.41] - 2026-11-14

### Corretto
- Corretto il footer dell'interfaccia: ora mostra la versione add-on 1.0.41, coerente con la versione installabile.

### Fixed
- Fixed the application footer to display add-on version 1.0.41, matching the installable add-on version.

## [1.0.40] - 2026-11-14

### Corretto e migliorato
- Allineato il saldo iniziale delle Previsioni alla regola di calcolo della Panoramica, usando il saldo alla fine dell'ultimo mese chiuso e il perimetro dei conti selezionati.
- Spostato a sinistra il comando STAMPA/ESPORTA PDF nelle anteprime dei report e aggiunto CHIUDI SCHEDA.
- Aggiunta l'esportazione PDF completa del Piano dei conti, con classificazione, gerarchia, conto padre, conteggio movimenti, inclusione nel budget, tag e storico delle denominazioni.
- Reso dinamico il modello Excel del Piano dei conti: include tutti i conti presenti nell'archivio anziché cinque righe di esempio.

### Fixed and improved
- Aligned the Forecast opening balance with the Overview calculation rule, using the balance at the end of the latest closed month and the selected account scope.
- Moved the PRINT/EXPORT PDF action to the left in report previews and added a CLOSE TAB button.
- Added a complete Chart of Accounts PDF export, including classification, hierarchy, parent account, transaction count, budget inclusion, tags and account-name history.
- Made the Chart of Accounts Excel template dynamic: it now includes every account in the archive instead of only five sample rows.

## [1.0.38] - 2026-11-14

### Migliorato
- Riscritta e ampliata la Guida all'utilizzo con 12 capitoli operativi in italiano e inglese.
- Separati Budget e Previsioni in due capitoli distinti.
- Aggiunte procedure passo-passo, esempi, controlli e indicazioni per interpretare i risultati.
- Mantenuti i collegamenti alle sezioni dell'applicazione soltanto alla fine di ciascun capitolo.
- Aggiornata la versione dell'add-on a 1.0.38 nel menu e nei metadati.

### Improved
- Rewrote and expanded the User Guide with 12 operational chapters in Italian and English.
- Split Budget and Forecasts into separate chapters.
- Added step-by-step procedures, examples, checks and guidance for interpreting results.
- Kept links to application sections at the end of each chapter only.
- Updated the add-on version to 1.0.38 in the sidebar and metadata.

## [1.0.35] - 2026-11-14

### Corretto
- Spostata la Guida all’utilizzo in una sezione autonoma nel menu laterale, subito sotto Impostazioni.
- Aggiunta la visualizzazione completa della guida con apertura/chiusura di tutti i capitoli.
- Corretta e ampliata la ricerca: ricerca su titoli, contenuti e parole chiave; supporto al tasto Invio e pulsante Cerca.

### Fixed
- Moved the User Guide to its own sidebar section, directly below Settings.
- Added full-guide view with expand/collapse for all chapters.
- Fixed and expanded search across titles, content and keywords; added Enter-key and Search-button support.

## [1.0.34] - 2026-11-14

### Aggiunto
- Integrata in Impostazioni una guida operativa consultabile per argomenti, con ricerca, sezioni espandibili e contenuti in italiano e inglese.
- Aggiunti collegamenti rapidi dalla guida alle schermate principali dell'app.

### Added
- Added an in-app user guide under Settings, organized into expandable topics with search and Italian/English content.
- Added quick links from the guide to the main application sections.

## [1.0.33] - 2026-11-14

### Corretto
- Ripristinate al pulsante Allegati dimensioni coerenti con i pulsanti Ripartisci e Storico; il contatore è collocato sotto il pulsante in uno spazio dedicato.
- Aggiornata l'etichetta dell'interruttore privacy in "Nascondi importi per privacy".
- Rimossa dalla documentazione dell'add-on la dicitura statica "Versione / Version: 1.0.19", non aggiornata automaticamente.

### Fixed
- Restored the Attachments button dimensions to match the Split and History buttons; the attachment count now appears below the button in a dedicated space.
- Updated the privacy switch label to "Hide amounts for privacy".
- Removed the static "Version / Version: 1.0.19" line from the add-on documentation because it was not updated automatically.

## [1.0.32] - 2026-11-14

### Corretto
- Sostituito il selettore privacy a tre modalità con un solo interruttore OFF/ON. OFF mostra tutti i valori; ON oscura gli importi in euro, inclusi i contenuti caricati dinamicamente, lasciando leggibili date, codici e campi di modifica.
- Migliorato l'avanzamento del caricamento del database: la barra viene aggiornata dopo le fasi effettive di connessione, ricezione, preparazione e salvataggio, con ridisegno tra una fase e l'altra.
- Allineato il pulsante Allegati alle altre azioni dei movimenti e spostato il contatore sotto il pulsante.
- Aggiornata la versione dell'add-on a 1.0.32.

### Fixed
- Replaced the three-mode privacy selector with a single OFF/ON switch. OFF shows all values; ON masks euro amounts, including dynamically loaded content, while keeping dates, codes and editable fields readable.
- Improved database-loading progress updates after actual connection, retrieval, preparation and save stages, allowing the progress bar to repaint between stages.
- Aligned the Attachments button with the other transaction actions and moved its count below the button.
- Updated the add-on version to 1.0.32.

## [1.0.31] - 2026-11-14

### Aggiunto
- Barra di avanzamento con fasi di caricamento dell'archivio dopo l'accesso.
- Selettore privacy comune a tutte le pagine: visualizzazione normale, saldi oscurati e cifre oscurate.
- Barra di avanzamento del calcolo Previsioni, aggiornata durante l'elaborazione dei 12 mesi.

### Corretto
- La versione dell'add-on è aggiornata a 1.0.31 nei metadati Home Assistant e nel piè di pagina dell'applicazione.

### Added
- Staged archive-loading progress bar after sign-in.
- Global privacy selector: normal display, account balances hidden, and numeric values hidden.
- Forecast calculation progress bar updated while the 12-month projection is processed.

### Fixed
- Updated the Home Assistant add-on metadata and application footer to version 1.0.31.

## [1.0.30] - 2026-11-13

### Corretto
- Aggiornata la versione dell'add-on mostrata nel piè di pagina: ora corrisponde alla 1.0.30.
- Corretto il grafico dello spazio allegati: i settori colorati rappresentano la quota effettiva dei 100 MB disponibili; la parte restante mostra lo spazio libero.
- La legenda mostra sempre tutte le categorie documentali con il rispettivo colore, anche quando il relativo spazio occupato è zero.
- Oltre il limite di 100 MB, l'anello mostra la ripartizione percentuale delle categorie senza rappresentare spazio libero.

## [1.0.30] - 2026-11-13

### Fixed
- Updated the add-on version displayed in the footer to 1.0.30.
- Fixed the attachment storage chart: colored segments now represent the actual share of the 100 MB capacity, while the remaining arc represents free space.
- The legend always displays every document category with its color, including categories with zero stored data.
- Above the 100 MB limit, the ring displays the percentage distribution by category and no free-space segment.

## [1.0.29] - 2026-11-13

### Aggiunto
- Caricamento diretto nell'Archivio documenti di PDF e immagini non collegati a un movimento.
- Grafico ad anello dello spazio occupato, suddiviso per categoria, con legenda e spazio residuo rispetto a 100 MB.
- Riepilogo delle dimensioni occupate da ogni categoria documentale.

### Corretto
- Eliminato il messaggio di conferma superfluo dopo la generazione dei file Excel: il download parte direttamente. Restano gli avvisi di errore e le conferme operative.
- I documenti autonomi sono inclusi nei backup e non mostrano un collegamento a un movimento inesistente.

## [1.0.29] - 2026-11-13

### Added
- Direct upload of PDFs and images into the document archive without linking them to a transaction.
- Doughnut chart of storage usage by document category, with legend and remaining capacity against 100 MB.
- Per-category document storage totals.

### Fixed
- Removed the redundant success dialog after Excel generation; downloads now start directly. Error alerts and operational confirmations remain.
- Standalone documents are included in backups and do not show a link to a non-existent transaction.

## [1.0.28] - 2026-11-13

### Aggiunto
- Ampliate le categorie dell'archivio documenti con Contabile, Estratto conto e Documento, disponibili nella classificazione automatica, nella modifica manuale e nel filtro dell'archivio.
- Migliorata la classificazione automatica per riconoscere estratti conto, contabili di pagamento e documentazione generica.

### Corretto
- Il piè di pagina mostra la versione corretta dell'add-on (1.0.28).
- Evitato il ricalcolo di Budget e Previsioni durante la navigazione nelle pagine che non li visualizzano; gli aggiornamenti vengono eseguiti quando si apre la relativa pagina.

### Added
- Expanded the document archive categories with Accounting receipt, Bank statement and Document, available in automatic classification, manual editing and archive filtering.
- Improved automatic classification to identify bank statements, payment receipts and generic documents.

### Fixed
- The footer now displays the correct add-on version (1.0.28).
- Prevented Budget and Forecast recalculations while navigating pages that do not display them; updates run when the corresponding page is opened.

## [1.0.27] - 2026-11-13

### Italiano
- Ripristinata nell'Archivio documenti la visualizzazione delle date nel formato italiano GG/MM/AAAA (ad esempio 04/09/2026), mantenendo il formato ISO nei dati interni e nei campi di modifica.
- Rivista la previsione storica per calcolare le stime in base al mese di calendario previsto, confrontandolo con gli stessi mesi dello storico disponibile. In questo modo le proiezioni possono riflettere la stagionalità invece di ripetere una mediana annuale identica.
- Il budget viene applicato soltanto al mese per cui è stato salvato, evitando di propagare automaticamente lo stesso importo a tutti i mesi futuri privi di un budget specifico.

### English
- Restored Italian DD/MM/YYYY date display in the Document Archive (for example, 04/09/2026), while retaining ISO dates internally and in edit controls.
- Updated historical forecasting to estimate each projected calendar month from the corresponding months in the available history, allowing seasonal patterns instead of repeating one annual median.
- Budgets are now applied only to the month for which they were saved, rather than automatically carrying the same amount into every future month without a specific budget.

## [1.0.26] - 2026-11-13

### Italiano
- Riordinato il modulo di modifica dei documenti: ogni descrizione è ora associata direttamente al proprio campo e usa le stesse denominazioni dell'Archivio documenti.
- In Movimenti, dopo il caricamento di un allegato, l'interfaccia attende il completamento del riconoscimento OCR e apre automaticamente il modulo per verificare o correggere fornitore/ente, importo, data e numero documento. Se l'OCR fallisce o richiede più tempo, è comunque possibile inserire i dati manualmente.
- Riallineato il pulsante Allegati con Ripartisci e Storico; il numero degli allegati è spostato sotto il pulsante senza alterarne l'allineamento.
- Semplificata la tabella Previsioni: rimossi i valori effettivi, mostrando soltanto entrate e uscite programmate, stimate e i saldi proiettati. Il saldo di partenza resta quello dell'ultimo mese chiuso.
- Reso più robusto il riconoscimento delle ricorrenze nelle previsioni, con normalizzazione delle frequenze e compatibilità con le varianti dei dati salvati. Aggiunto un riepilogo del numero di impegni attivi e delle occorrenze programmate nei 12 mesi.
- Aggiornati l'icona e il logo dell'add-on Home Assistant usando lo stesso marchio presente nel README.

### English
- Reworked the document editing form: each description is now directly associated with its input and uses the same labels as the Document Archive.
- In Transactions, after an attachment is uploaded, the interface waits for OCR to finish and automatically opens the form to review or correct supplier/entity, amount, date and document number. If OCR fails or takes longer, the fields can still be completed manually.
- Realigned the Attachments button with Split and History; the attachment count now appears below the button without affecting button alignment.
- Simplified the Forecast table by removing actual figures and showing only scheduled and estimated income/expenses and projected balances. The opening balance remains based on the latest closed month.
- Made scheduled recurrence handling more robust by normalizing frequency values and supporting saved-data variants. Added a summary of active commitments and scheduled occurrences over the next 12 months.
- Updated the Home Assistant add-on icon and logo to use the same brand mark shown in the README.

## [1.0.25] - 2026-11-13

### Italiano
- Corretto il footer: ora riporta la versione add-on 1.0.25 invece del valore statico 1.0.20.
- Allineato verticalmente il pulsante Allegati con il relativo contatore nella tabella Movimenti.
- Ridisegnati i grafici della Ricerca avanzata in PDF con colonne verticali, legenda, scala e valori più leggibili; riorganizzati anche gli andamenti delle contropartite.
- Migliorata l'estrazione OCR di fornitore/ente, numero fattura/documento e importo totale, dando priorità alle etichette esplicite del documento.
- Aggiunta la modifica manuale di fornitore/ente, importo, data e numero documento nell'Archivio documenti. Le correzioni sono persistenti e protette dalle successive scansioni OCR; viene bloccato soltanto il singolo campo effettivamente modificato.
- Rafforzata la previsione storica: una categoria entra nella stima soltanto se presenta movimenti in almeno il 40% dei mesi osservati (minimo tre). Le spese sporadiche restano escluse, mentre gli impegni espliciti, comprese le ricorrenze annuali, continuano a essere conteggiati. Chiarita nell'interfaccia la voce del saldo riferito all'ultimo mese chiuso.
- Aggiunta una migrazione SQLite esclusivamente additiva per i quattro indicatori di correzione manuale; mantenuta la compatibilità con i database precedenti.
- Inclusi gli indicatori di correzione manuale nei backup JSON e nel relativo ripristino.
- Conservati PIN, HTTPS, accesso LAN, dati contabili, allegati, certificati e configurazione di rete.

### English
- Fixed the footer so it displays add-on version 1.0.25 instead of the stale hard-coded 1.0.20 value.
- Vertically aligned the Attachments button and its count badge in the Transactions table.
- Redesigned Advanced Search PDF charts as vertical column charts with clearer legends, scales and value labels; reorganized counterpart trends as well.
- Improved OCR extraction of supplier/entity, invoice/document number and total amount, prioritizing explicit document labels.
- Added manual editing of supplier/entity, detected amount, document date and document number in the Document Archive. Manual corrections are persisted and protected from subsequent OCR scans; only fields actually changed by the user are locked.
- Tightened historical forecasting: a category is estimated only when it has activity in at least 40% of observed months (minimum three). Sporadic expenses remain excluded, while explicitly scheduled commitments, including annual recurrences, continue to be forecast. Clarified that the opening balance refers to the latest closed month.
- Added an additive SQLite migration for the four manual-override flags, preserving compatibility with existing databases.
- Included manual-override flags in JSON backups and restores.
- Preserved PIN, HTTPS, LAN-only access, accounting data, attachments, certificates and network configuration.

## [1.0.24] - 2026-11-13

- Corretta anche la registrazione del pulsante Allegati nella tabella Movimenti: il codice usava il selettore singolo con `forEach`. Ora utilizza una raccolta esplicita di elementi.
- Verificata la correzione precedente dell'editor di suddivisione dei movimenti.

## [1.0.23] - 2026-11-13

- Corretto definitivamente l'errore JavaScript `forEach is not a function` nell'editor di suddivisione dei movimenti: ora le raccolte di campi sono ottenute esplicitamente con `querySelectorAll`, senza usare il selettore singolo.

## [1.0.22] - 2026-11-13

- Corretto l'editor di suddivisione dei movimenti: i selettori multipli ora restituiscono correttamente una raccolta di elementi, evitando l'errore JavaScript `forEach is not a function` quando si apre la finestra.

## [1.0.21] - 2026-11-13

- Aggiunta l'anteprima inline dei PDF e delle immagini nell'Archivio documenti, senza passare dal download.
- Migliorata l'estrazione OCR del fornitore/ente, escludendo riferimenti come numero cliente e codice cliente; aggiunti data e numero documento. La migrazione SQLite è additiva e mantiene i documenti già archiviati.
- Aggiunto nei Movimenti un indicatore circolare con il numero degli allegati associati.
- Aggiunte alla Ricerca avanzata le esportazioni PDF ed Excel con totali, grafici del periodo e andamento mensile e annuale delle contropartite.
- Rivista la previsione di liquidità: saldo iniziale alla chiusura dell'ultimo mese completo, entrate e uscite effettive del mese corrente, impegni ricorrenti programmati, budget come fonte prioritaria e storico precedente solo per categorie effettivamente ricorrenti. Le categorie sporadiche senza ricorrenze programmate sono escluse.
- Mantenuti invariati PIN, HTTPS, accesso LAN, database esistente, backup e funzioni contabili già presenti.

## 1.0.20 — 13 novembre 2026

- Sostituita la gestione testuale degli allegati con una finestra dedicata per ogni movimento: il pulsante UPLOAD apre direttamente il selettore file; ogni allegato può essere scaricato o eliminato dall'elenco.
- Aggiornati i limiti: 5 MB per file e 15 MB complessivi per movimento. Rimosso il limite fisso complessivo dell'archivio; al raggiungimento di 100 MB viene mostrato un avviso non bloccante.
- Aggiunta l'estrazione locale del testo dai PDF e l'OCR in italiano per PDF scannerizzati (fino a 30 pagine) e immagini JPEG/PNG. Nessun invio a servizi esterni.
- Aggiunta la classificazione automatica Fattura/F24/Bollettino/Altro e il riconoscimento indicativo di data, importo, fornitore/ente, codice fiscale e codice tributo; la categoria è modificabile.
- Aggiunto il menu Archivio documenti con ricerca nel testo OCR e nei metadati, filtro per categoria, download e collegamento al movimento originale.
- Inclusi indice OCR e metadati nei backup JSON; i backup SQLite e Google Drive continuano a includere l'intero database. Gli allegati preesistenti vengono messi in coda per l'indicizzazione dopo l'aggiornamento.
- Preservati storico, allegati e documenti anche quando il movimento originario non è più presente. Nessuna modifica alle funzioni contabili esistenti, al PIN, a HTTPS o all'accesso LAN.

## 1.0.18 — 11 novembre 2026

- Corretta la coerenza del report degli scostamenti: quando il totale effettivo di «Spese» coincide con quello di «Uscite», media attesa, scostamento e variazione percentuale di «Uscite» riprendono gli stessi valori aggregati di «Spese».
- Mantenuto il totale «Uscite» basato sui flussi di cassa quando i due perimetri effettivi non coincidono.
- Applicata la correzione al report a video, al PDF e all'esportazione Excel tramite la funzione condivisa.
- Mantenuti invariati i criteri di inclusione dei rimborsi del capitale dei finanziamenti, l'archivio SQLite, il PIN, HTTPS, l'accesso LAN e i backup.
- Aggiornata l'applicazione inclusa alla versione 1.7.12.

## 1.0.17 — 11 novembre 2026

- Reso il logout indipendente dal completamento del backup Google Drive: dopo il salvataggio delle modifiche in coda, il server accoda l'operazione e invalida immediatamente la sessione.
- Il backup viene eseguito da un worker lato server e continua anche dopo la chiusura della scheda o della finestra del browser.
- La coda e lo stato delle operazioni sono persistiti nel database dell'add-on; le attività interrotte da un riavvio del servizio vengono rimesse in coda all'avvio successivo.
- Registrato l'esito dell'ultimo backup di sessione, consultabile dopo il nuovo accesso nella sezione Google Drive delle Impostazioni.
- Rimosso il backup best-effort all'evento di chiusura della pagina, ora sostituito dall'accodamento esplicito e autenticato durante il logout.
- Aggiornata l'applicazione inclusa alla versione 1.7.11. Nessuna modifica ai dati contabili, al PIN, alla configurazione HTTPS o all'accesso LAN.

## 1.0.16 — 11 novembre 2026

- Migliorato l'allineamento delle tabelle del report dei flussi: la colonna Categoria resta invariata, mentre tutte le colonne successive sono allineate a destra nella rispettiva colonna.
- Uniformata la visualizzazione degli importi nelle tabelle del report e nel PDF, con il simbolo € prima della cifra.
- Applicata la stessa formattazione al confronto dei periodi nel PDF e nella schermata Report. L'esportazione Excel resta invariata perché già correttamente formattata.
- Aggiornata l'applicazione inclusa alla versione 1.7.10. Nessuna modifica all'archivio SQLite, al PIN, alla configurazione HTTPS, all'accesso LAN o ai backup.

## 1.0.15 — 11 novembre 2026

- Semplificata la creazione di un nuovo conto: tutti i dati sono inseriti in un'unica schermata, con casella di spunta per indicare un conto economico e scelta del tipo (entrata o uscita).
- Aggiunto nei Movimenti il filtro per contropartita, oltre ai filtri per data e stato.
- Introdotta la modifica massiva selettiva della contropartita: è possibile spuntare singoli movimenti oppure selezionare tutti i risultati filtrati, anche su più pagine, scegliere la nuova contropartita e confermare prima del salvataggio.
- I movimenti ripartiti su più contropartite restano esclusi dalla modifica massiva, per evitare di alterare involontariamente le ripartizioni.
- Aggiornata l'applicazione inclusa alla versione 1.7.9. Nessuna modifica all'archivio SQLite, al PIN, alla configurazione HTTPS, all'accesso LAN o ai backup.

## 1.0.14 — 10 novembre 2026

- Aggiornati gli esempi mostrati durante la modifica dei tag personalizzati: IBAN fittizio, CONTO CHIUSO, CONTO PRINCIPALE, RISPARMI, STIPENDIO, CONTO SECONDARIO, CARTA PREPAGATA, CONTO FAMILIARE e DA NON UTILIZZARE.
- Aggiornata la versione dell'app inclusa a 1.7.8.
- Nessuna modifica ai tag già assegnati, all'archivio SQLite, all'autenticazione PIN, alla configurazione HTTPS, all'accesso LAN o ai backup.

## 1.0.13 — 10 novembre 2026

- Introdotti tag personalizzati multipli per ciascun conto, senza un elenco predefinito: è possibile inserire qualsiasi testo, incluso un IBAN, con un tag per riga.
- I tag del conto selezionato sono riportati nell'intestazione del report, subito dopo il percorso del conto.
- Aggiunti i tag alle intestazioni dei report PDF ed Excel e dei prospetti PDF/XLSX dei movimenti.
- Mantenuti invariati archivio SQLite, autenticazione PIN, configurazione HTTPS, accesso LAN e backup; nessuna migrazione o cancellazione dei dati esistenti.

## 1.0.12 — 10 novembre 2026

- Corretta la versione dell'add-on mostrata nel piè di pagina dell'interfaccia: ora è allineata alla versione distribuita 1.0.12.
- Mantenuti invariati archivio SQLite, autenticazione PIN, configurazione HTTPS, accesso LAN e backup.

## 1.0.11 — 10 novembre 2026

- Aggiornata l'applicazione inclusa alla versione Gestione C/C 1.7.6.
- Corretto il doppio conteggio nei totali gerarchici delle spese: i conti padre non vengono sommati una seconda volta insieme ai rispettivi sottoconti.
- La riga «Uscite» del report usa il totale dei flussi di cassa in uscita e i relativi confronti, in modo da poter essere riconciliata con il riepilogo del periodo.
- La media di riferimento considera esclusivamente i periodi completi precedenti al periodo selezionato; i mesi successivi non entrano più nel calcolo.
- Mantenuti invariati archivio SQLite, autenticazione PIN, configurazione HTTPS e backup.

# Gestione C/C Home Assistant App — Changelog

## 1.0.10 — 10 novembre 2026

- Aggiornata l'applicazione inclusa alla versione Gestione C/C 1.7.5.
- Riorganizzato il report degli scostamenti con totale Spese, categorie di secondo livello, conti di dettaglio in corsivo e totale Uscite in fondo.
- Applicata la gerarchia anche ai report PDF e alle esportazioni Excel, mantenendo separati i dati di origine dei grafici.
- Mantenuti invariati archivio SQLite, autenticazione PIN, configurazione HTTPS e backup.

## 1.0.8 — 10 novembre 2026

- Corretta la versione dell'add-on mostrata nel piè di pagina dell'interfaccia: ora corrisponde alla versione 1.0.8 distribuita.

## 1.0.7 — 10 novembre 2026

- Aggiornata l'applicazione inclusa alla versione 1.7.3, mantenendo gli adattamenti specifici per Home Assistant.
- Uniformati altezza e allineamento dei campi data «Dal» e «Al» nella sezione Movimenti.
- Aumentata la dimensione dei nomi dei conti nel Piano dei conti.
- Ottimizzata la chiusura: il salvataggio in coda viene completato senza riscrivere inutilmente l'archivio.
- Il backup Google Drive di sessione viene avviato in background solo se la revisione dell'archivio è cambiata dall'ultimo backup; l'uscita dall'interfaccia non arresta il servizio dell'add-on.
- In caso di errore del backup, l'interfaccia mostra un avviso senza impedire l'uscita.

## 1.0.6 — 10 novembre 2026

- Aggiornata l'applicazione Gestione C/C inclusa alla versione 1.7.2.
- Consolidate le modifiche del piano dei conti, dei tag, dei movimenti, del budget e delle previsioni.
- Nei Movimenti, allineati i campi Data inizio e Data fine e rimosso il selettore del mese non funzionale.
- Gli estratti conto PDF e XLSX utilizzano il periodo corrente selezionato nella Panoramica.


## 1.0.4 — 8 novembre 2026

- Uniformata la finestra di anteprima dei PDF: Report Gestione C/C ed estratto conto utilizzano un unico comando «STAMPA/ESPORTA PDF».
- Il comando apre la normale finestra di stampa del browser, da cui scegliere una stampante oppure «Salva come PDF».
- Migliorata la formattazione Excel dell'estratto conto con bordi e griglie, intestazioni evidenziate, date e importi formattati, colonne dimensionate e valori numerici allineati.
- Riordinato il riepilogo Excel: saldo iniziale in apertura e totali di entrate, uscite e saldo finale in chiusura.
- Esclusi i totali dal filtro automatico dei movimenti.

## 1.0.3 — 8 novembre 2026

- Semplificata la schermata di caricamento dell'archivio con il messaggio «Caricamento archivio in corso.....» e un indicatore animato.
- Il comando Riprova resta nascosto durante il caricamento e compare solo in caso di errore o timeout.
- Aggiunto un timeout di 15 secondi e impediti clic ripetuti sul comando Riprova.

## 1.0.2 — 8 novembre 2026

- Migliorata l'impaginazione dell'estratto conto PDF per la stampa su più pagine A4.
- Il saldo iniziale compare una sola volta, in apertura del documento.
- Le intestazioni della tabella dei movimenti vengono ripetute sulle pagine successive.
- Le righe dei movimenti non vengono spezzate tra due pagine.
- Il riepilogo finale mantiene insieme totali entrate, uscite e saldo finale, in chiusura del documento.

## 1.0.1 — 8 novembre 2026

- Migliorata la disposizione responsive della barra superiore e del comando Esci su smartphone in verticale.
- Aggiunti in Panoramica i pulsanti PDF ed Excel per l'estratto conto del periodo selezionato.
- L'estratto conto riporta saldo iniziale, entrate e uscite in colonne separate, saldo progressivo e saldo finale.
- Gli export rispettano il conto selezionato ed escludono i movimenti duplicati.

## 1.0.0 — 8 novembre 2026

- Prima versione di distribuzione documentata.
- Archivio SQLite centralizzato e persistente nella directory dati dell'App Home Assistant.
- Accesso amministratore tramite PIN di sei cifre e interfaccia HTTPS.
- Importazione di archivi GnuCash e movimenti bancari nei formati supportati.
- Piano dei conti gerarchico, classificazione e movimenti suddivisi.
- Panoramica finanziaria, confronti storici e report per periodo.
- Esportazione XLSX e flusso di stampa/esportazione PDF tramite browser.
- Backup e ripristino JSON e SQLite.
- Documentazione italiana/inglese e licenza proprietaria d'uso personale.

### Note importanti per l'installazione

- Progettata per l'utilizzo in rete locale; non configurare esposizione pubblica su Internet.
- Configurare e verificare la subnet LAN effettiva prima di inserire dati contabili personali.
- Conservare backup protetti anche fuori dal server Home Assistant.
- Non è stato eseguito un audit di sicurezza indipendente.
- La licenza proprietaria si applica esclusivamente ai materiali originali per i quali l'autore detiene i diritti pertinenti. I componenti di terze parti restano soggetti alle rispettive licenze.
- La versione dell'applicazione Windows e quella della distribuzione Home Assistant sono numerazioni distinte.
- Le schermate dimostrative del README saranno aggiunte dopo la cattura dall'interfaccia effettiva con dati fittizi; non vengono usate immagini illustrative o simulate.
