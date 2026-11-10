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
