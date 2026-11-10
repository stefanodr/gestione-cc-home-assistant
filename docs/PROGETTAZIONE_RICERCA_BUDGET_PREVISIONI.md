# Progettazione tecnica — ricerca, budget, importazioni e previsioni

Stato: specifica di implementazione, non ancora codice rilasciato.
Ramo di lavoro: `feature/analisi-budget-previsioni`.
Riferimento di partenza: `main` (app web 1.6, Home Assistant App 1.0.5).

## Obiettivi e vincoli

- Conservare compatibilità con gli archivi esistenti e con i backup già prodotti.
- Non modificare in modo distruttivo lo schema SQLite né riscrivere i movimenti esistenti.
- Mantenere i dati contabili sul server locale; nessun servizio esterno per analisi o importazioni.
- Non pubblicare funzioni parziali sulla versione stabile.
- Sviluppare e verificare su un ramo dedicato e poi su un'istanza Home Assistant di prova.
- Le funzioni nuove devono distinguere sempre dati contabilizzati, impegni programmati e stime.

## Modello dati applicativo

Le nuove informazioni saranno aggiunte in modo compatibile a `state_json`, con inizializzazione difensiva delle proprietà mancanti. Non si deve assumere che gli archivi esistenti contengano già questi campi.

Proprietà previste:
- `budgets`: budget mensili per categoria, identificati da ID categoria e importo.
- `recurringRules`: regole di ricorrenza confermate dall'utente.
- `savedFilters`: filtri di ricerca salvati.
- `importProfiles`: mapping delle colonne per sorgente/formato.
- `forecastSettings`: preferenze di previsione, incluso l'orizzonte di 12 mesi e la selezione dei conti.

Ogni aggiornamento deve preservare le proprietà sconosciute e i dati già presenti. Le funzioni di lettura devono tollerare campi mancanti, null o array non validi, ripristinando solo i valori predefiniti sicuri.

## Ricerca avanzata e filtri

Filtri previsti:
- data iniziale e finale;
- testo libero su descrizione, causale, beneficiario e note;
- importo minimo e massimo;
- entrata/uscita;
- conto e una o più categorie;
- stato: confermato o da classificare;
- origine/importazione, se il movimento conserva tale informazione.

La ricerca deve operare sull'intero archivio, non soltanto sulla pagina attualmente visualizzata. Conteggio, paginazione e totali devono riferirsi allo stesso insieme filtrato. I filtri salvati memorizzano criteri, non copie dei movimenti. Deve essere possibile azzerare i criteri e rimuovere un filtro salvato.

L'esportazione dei risultati dovrà riutilizzare l'insieme filtrato, senza modificare l'esportazione generale già esistente.

## Importazione bancaria guidata

Flusso comune:
1. selezione file e formato;
2. rilevamento automatico delle colonne/campi;
3. mapping modificabile dall'utente;
4. anteprima delle righe e segnalazione di date/importi non validi;
5. verifica duplicati;
6. riepilogo di importabili, duplicati e righe scartate;
7. conferma esplicita prima di scrivere nell'archivio.

CSV/XLSX: mantenere il parser esistente e completarlo con mapping esplicito e profili riutilizzabili. QIF: preservare il supporto attuale. OFX: aggiungere lettura sia del formato SGML sia XML, validando i campi e gestendo date/importi con segno coerente. Quando presente, `FITID` è la chiave primaria di riconoscimento della transazione OFX.

Per formati senza ID stabile, usare una fingerprint normalizzata basata almeno su data, importo, descrizione e conto di destinazione/importazione. La verifica deve considerare sia i movimenti già presenti sia i duplicati interni al file selezionato. Non eliminare automaticamente movimenti simili: mostrare il motivo e lasciare all'utente la decisione nei casi ambigui.

## Budget mensili per categoria

- Budget configurato per categoria e importo mensile.
- **Nessun riporto del residuo:** ogni mese riparte dall'importo configurato.
- Un avanzo non aumenta il budget del mese successivo.
- Uno sforamento non riduce il budget del mese successivo.
- Spesa effettiva calcolata sui movimenti contabilizzati del mese.
- Le quote dei movimenti suddivisi devono essere attribuite alle rispettive categorie, senza conteggiare due volte il movimento padre.
- Trasferimenti interni esclusi dalle spese di categoria.
- Movimenti non classificati mostrati separatamente, non attribuiti arbitrariamente.
- Mostrare importo budget, speso, residuo, percentuale utilizzata e andamento nel mese.
- Il budget non deve creare movimenti contabili.

Criteri di accettazione: il budget di una categoria è identico in due mesi consecutivi anche se il primo mese termina con avanzo o sforamento; i totali delle quote suddivise coincidono con il movimento originale; i trasferimenti non gonfiano le spese.

## Ricorrenze e riconciliazione

Una regola ricorrente contiene almeno descrizione/controparte, importo fisso o variabile, conto, categoria, frequenza, data o giorno atteso, data iniziale/finale e stato attivo.

Il sistema può proporre ricorrenze individuate dallo storico, ma non deve attivarle o inserirle senza conferma. Le occorrenze sono impegni previsionali, non movimenti contabilizzati. Quando viene importato/inserito un movimento compatibile, l'interfaccia propone l'associazione e impedisce che impegno e movimento reale siano sommati entrambi nella previsione. La riconciliazione deve essere annullabile e tracciabile.

## Motore previsionale — 12 mesi

Tre livelli sempre distinti:
- **Effettivo:** movimenti contabilizzati fino alla data di aggiornamento.
- **Programmato:** occorrenze di ricorrenze e impegni confermati non ancora riconciliati.
- **Stimato:** stime statistiche ricavate dallo storico.

La selezione dei conti offre:
- tutti i conti liquidi (predefinito);
- un conto;
- più conti selezionati.

La classificazione dei conti liquidi deve essere derivata in modo coerente dal piano dei conti e verificata sui tipi effettivamente supportati dall'applicazione. Conti patrimoniali non liquidi e conti economici non devono essere inclusi automaticamente.

I trasferimenti tra conti entrambi inclusi nella selezione si annullano nel saldo aggregato e non vanno mostrati come entrata/uscita esterna. Se un trasferimento attraversa il confine della selezione, va rappresentato come flusso in uscita o in entrata rispetto al perimetro selezionato, senza duplicazioni.

Per la stima:
- usare lo storico disponibile, privilegiando gli ultimi 12 mesi completi;
- usare la stagionalità soltanto quando esistono almeno due anni sufficientemente completi;
- in assenza di storico sufficiente, ridurre l'orizzonte statistico e dichiarare l'affidabilità limitata;
- distinguere entrate e uscite;
- non includere trasferimenti interni, duplicati o movimenti non confermati;
- non assimilare automaticamente i movimenti non classificati a una categoria;
- usare statistiche robuste per limitare l'effetto di operazioni eccezionali;
- non sommare una previsione statistica a un impegno già programmato per la stessa ricorrenza.

Risultati: saldo di partenza, saldo effettivo, programmato e stimato, entrate/uscite per mese, saldo minimo previsto e relativo mese, indicatori di affidabilità e avviso di possibile tensione di liquidità. Le stime devono essere visivamente distinguibili dai valori certi.

## Verifiche, sicurezza e audit

- Verificare integrità dell'archivio prima e dopo operazioni di importazione/ripristino rilevanti.
- Verificare leggibilità e integrità dei backup, senza esporre contenuti contabili nei log.
- Notifiche di esito backup senza dati finanziari.
- Timeout di inattività configurabile, distinto dalla durata massima assoluta della sessione.
- Audit delle modifiche contabili con data, operazione e identificativo del movimento; evitare di registrare descrizioni/importi sensibili se non necessari.
- Nessun token OAuth, PIN o segreto nei log, nella UI o nei file di documentazione.

## Interfaccia e compatibilità

Le nuove viste previste sono Ricerca avanzata, Budget e Previsioni. La navigazione esistente deve restare disponibile. La ricerca avanzata può essere integrata nella vista Movimenti, evitando una voce di menu ridondante. Le nuove viste devono adattarsi a desktop e smartphone e mantenere le convenzioni visive già presenti.

Le impostazioni predefinite devono funzionare anche per l'utente con un solo conto liquido: tutti i conti selezionati equivale in tal caso al singolo conto disponibile.

## Piano di sviluppo e gate di rilascio

1. Analisi puntuale delle funzioni esistenti e test di regressione; definizione del normalizzatore compatibile di `state_json`.
2. Ricerca avanzata e filtri salvati.
3. Importazione guidata CSV/XLSX/QIF e parser OFX.
4. Budget mensili e test sulle ripartizioni.
5. Ricorrenze, suggerimenti e riconciliazione.
6. Motore previsionale e selezione dei conti.
7. Grafici, esportazioni e rifinitura responsive.
8. Verifica completa su copia di archivio fittizio, backup/restore e regressioni.

Ogni fase deve avere test ripetibili. Nessun aggiornamento di produzione prima del completamento dei test sull'istanza di prova e della verifica di un backup ripristinabile. La versione dell'app web e quella dell'Home Assistant App devono essere aggiornate in modo coerente, ma restano numerazioni distinte se così previsto dalla struttura del progetto.
