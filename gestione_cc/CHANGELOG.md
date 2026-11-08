# Gestione C/C Home Assistant App — Changelog

## 1.0.1 — in preparazione

- Migliorata la disposizione responsive della barra superiore e del comando Esci su smartphone in verticale.
- Aggiunti in Panoramica i pulsanti PDF ed Excel per l'estratto conto del mese selezionato.
- L'estratto conto riporta saldo iniziale, entrate, uscite in colonne separate, saldo progressivo e saldo finale.
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
