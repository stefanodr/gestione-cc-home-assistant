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
