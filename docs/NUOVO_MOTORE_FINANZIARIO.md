# Nuovo motore finanziario — specifica funzionale

## Ambito e ambiente
Questa evoluzione parte dal ramo `test/docker-desktop-standalone` e resta isolata in `feature/budget-previsioni-piano-gerarchico`. Nessuna modifica a `main`, all'App Home Assistant stabile o ai dati di produzione. I test Docker Desktop devono continuare a usare il proprio volume SQLite e non devono collegare Google Drive.

## 1. Piano dei conti gerarchico
Ogni conto deve avere:
- saldo diretto: saldo dei movimenti imputati direttamente al conto;
- saldo consolidato: saldo diretto più la somma dei saldi consolidati dei figli;
- classificazione: `Mastro`, `Mastro e conto`, `Conto`;
- origine della classificazione: automatica oppure override manuale.

Regole:
- un conto foglia è `Conto`;
- un conto con figli e movimenti diretti è proposto come `Mastro e conto`;
- un conto con figli e senza movimenti diretti è proposto come `Mastro`;
- l'assenza di movimenti diretti non dimostra che il conto non debba poterli ricevere: la classificazione automatica è una proposta e deve poter essere corretta manualmente;
- l'override manuale deve sopravvivere alle reimportazioni quando l'identità del conto è riconoscibile;
- un `Mastro` non accetta imputazioni dirette; un `Mastro e conto` sì; un `Conto` sì.

I saldi consolidati non devono essere sommati una seconda volta nei report: quando si aggrega un ramo si usa il consolidato del nodo, non il consolidato del nodo più i discendenti.

## 2. Rilevamento delle ricorrenze
Analizzare lo storico per trovare possibili entrate/uscite ricorrenti, considerando beneficiario/descrizione, conto di contropartita, segno/importo e intervalli temporali. Frequenze da supportare: settimanale, quindicinale, mensile, bimestrale, trimestrale, quadrimestrale, semestrale e annuale.

Ogni rilevamento è una proposta, non un impegno certo automatico. Mostrare frequenza, importo tipico, prossima data, conto, numero di occorrenze e affidabilità. L'utente può confermare, correggere, sospendere o rimuovere la ricorrenza. Una ricorrenza confermata genera le occorrenze future previste; le proposte non confermate non entrano nella previsione come importi certi.

## 3. Impegni manuali e prevenzione duplicati
Consentire l'inserimento manuale di entrate e uscite singole o periodiche, con data, importo, conto, descrizione e periodicità facoltativa. Gli impegni devono essere modificabili, sospendibili e cancellabili.

Una ricorrenza/occorrenza non deve essere conteggiata se il movimento corrispondente è già stato registrato. Il confronto deve usare data in finestra, importo con tolleranza configurabile e descrizione/beneficiario normalizzati; la corrispondenza deve essere tracciabile e correggibile. Gli impegni manuali e le ricorrenze confermate vanno distinti dalle stime statistiche.

## 4. Previsioni di liquidità
La previsione parte dal saldo effettivo del conto corrente (o dai conti liquidi selezionati), non dal saldo patrimoniale complessivo. Ogni mese:
saldo finale = saldo iniziale + entrate previste - uscite previste.
Il saldo finale diventa il saldo iniziale del mese successivo.

Separare in tabella:
- saldo iniziale;
- entrate certe (ricorrenze confermate e impegni manuali);
- uscite certe;
- entrate stimate;
- uscite stimate;
- saldo finale previsto.

Per il mese corrente partire dal saldo aggiornato alla data di elaborazione e non riaggiungere movimenti già contabilizzati. Le stime statistiche devono essere basate sullo storico e non ripetere meccanicamente un unico netto mensile per tutti i mesi. Rilevare periodicità reali e stagionalità quando i dati sono sufficienti. Le stime non vanno presentate come certezze.

## 5. Budget mensile con snapshot
Generare una proposta per ogni mese usando entrate e spese ricorrenti e variabili dello storico. Preferire l'anno corrente se sufficiente, altrimenti l'anno precedente. Separare entrate, spese ricorrenti e spese variabili. Escludere trasferimenti tra conti propri e movimenti patrimoniali.

Per categoria mostrare budget, effettivo, residuo (budget meno effettivo, anche negativo) e percentuale utilizzata. Non forzare il pareggio: mostrare un eventuale deficit previsto. Ogni budget mensile confermato va salvato come snapshot immutabile rispetto ai ricalcoli successivi. La rigenerazione crea una nuova versione; le modifiche manuali a mesi passati richiedono un'azione esplicita e devono lasciare traccia della versione precedente.

## 6. Integrazione e collaudo
Piano dei conti, budget, ricorrenze e previsioni devono condividere la stessa classificazione e lo stesso motore di aggregazione. Evitare doppio conteggio dei saldi consolidati e dei movimenti già registrati.

Prima del rilascio:
- test unitari del motore gerarchico, ricorrenze, duplicati e progressione del saldo;
- test di regressione su importazione GnuCash e salvataggio SQLite;
- test manuale nell'istanza Docker Desktop;
- verificare che nessun dato venga inviato a servizi cloud;
- nessun merge a `main` e nessun aggiornamento dell'App stabile fino all'accettazione del collaudo.
