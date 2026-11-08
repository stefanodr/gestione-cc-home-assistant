# App Home Assistant — Gestione C/C

## Stato
Prototipo avanzato in sviluppo, NON ancora approvato per dati contabili reali. Frontend collegato al database SQLite server, login amministratore, HTTPS locale, backup e ripristino predisposti. Mancano il collaudo runtime su Home Assistant OS e la verifica completa di tutte le funzioni dell'app.

## Note beta.7
- Corretto il selettore di chiusura delle finestre: ora vengono chiusi tutti i dialoghi aperti, evitando che la conferma GnuCash resti in primo piano.
- L'importazione GnuCash attende il completamento del salvataggio sul database prima di mostrare l'esito.
- Aggiornata la versione visualizzata nell'interfaccia a 0.2.0-beta.7.

## Note beta.6
- Corretto un errore JavaScript durante il rendering delle Impostazioni: il frontend server non contiene il vecchio elemento di stato del backup Google Drive, quindi il relativo aggiornamento ora è facoltativo.
- Aggiornata la versione visualizzata nell'interfaccia a 0.2.0-beta.6.

## Funzioni incluse
- App Home Assistant OS per amd64 e aarch64; porta HTTPS LAN 8443, nessun Ingress e nessuna voce nel menu laterale HA.
- SQLite persistente in /data, separato da IndexedDB della versione browser.
- Accesso esclusivamente con PIN numerico di 6 cifre, verificato tramite PBKDF2-HMAC-SHA256, salt casuale e 600.000 iterazioni. PIN modificabile dalle Impostazioni.
- Sessione casuale in cookie HttpOnly, Secure e SameSite=Strict, scadenza mobile di 8 ore.
- Limitazione a cinque tentativi di login falliti per IP in cinque minuti.
- TLS 1.2 minimo e certificato server firmato da CA privata generata al primo avvio; la CA si scarica dalle Impostazioni.
- HSTS, CSP, no-store e protezione CSRF per le operazioni di modifica.
- Salvataggio server-side; il frontend server non usa IndexedDB.
- Controllo revisioni ottimistico: due browser non possono sovrascriversi silenziosamente; un salvataggio con dati non aggiornati riceve HTTP 409 e richiede ricaricare la pagina.
- Salvataggi accodati nel singolo browser per evitare conflitti tra modifiche rapide.
- Backup SQLite coerente tramite API SQLite, snapshot automatico prima delle modifiche almeno ogni 15 minuti e rotazione fino a 30 copie.
- Backup SQLite manuale scaricabile e ripristino con integrity_check, verifica delle tabelle e dell'archivio, snapshot pre-ripristino e nuova autenticazione.
- Backup JSON compatibile con la migrazione dalla versione browser 1.6.

## Prima installazione
1. Assegnare un IP fisso o una prenotazione DHCP al server Home Assistant.
2. Lasciare hostname su homeassistant.local oppure indicare il nome DNS locale effettivo di Home Assistant.
3. Impostare nelle opzioni dell'App un PIN iniziale di esattamente 6 cifre. Al primo avvio il PIN sostituisce la password dell'eventuale amministratore già presente, mantenendone username e dati.
4. Installare/avviare l'App.
5. Aprire https://homeassistant.local:8443, accettare temporaneamente l'avviso iniziale solo sulla LAN, accedere e scaricare la CA dalle Impostazioni.
6. Installare la CA sui dispositivi autorizzati seguendo docs/home-assistant-https.md.

Il PIN iniziale (`bootstrap_pin`) viene letto una sola volta: al primo avvio migra la credenziale dell'amministratore già presente, senza modificare archivio, movimenti, conti o regole. Dopo la migrazione il valore dell'opzione non viene più usato; cancellalo dalle opzioni dell'App dopo il primo avvio. Il PIN effettivo è conservato nel database solo come hash PBKDF2 con salt casuale. Il ripristino SQLite ripristina anche il PIN presente nel backup.

## Backup
Consultare docs/home-assistant-backup-restore.md. Le copie automatiche vengono attivate dalle scritture, non da un timer se il database è fermo. Conservare anche copie manuali fuori dal mini-PC.

## Sicurezza e limiti
- Non configurare port forwarding, accesso remoto pubblico o reverse proxy pubblico.
- Il servizio non espone HTTP: solo HTTPS 8443.
- La CA privata va installata esclusivamente sui dispositivi autorizzati.
- L'opzione `lan_network` è una rete CIDR da impostare sulla propria LAN. Con `host_network: false`, il container potrebbe vedere l'indirizzo del gateway Docker anziché quello del dispositivo: verificare il filtro con un client autorizzato prima di considerare la restrizione di rete collaudata. Non creare inoltri sul router.
- Non inserire dati reali finché l'installazione e i test sotto non sono stati completati.

## Collaudo ancora necessario
- Build dell'App e installazione reale su Home Assistant OS.
- Login PIN, cambio PIN, logout, scadenza sessione, cookie Secure e certificato attendibile su Android e PC.
- Salvataggio, riavvio App/host e accesso simultaneo da più browser.
- Migrazione JSON 1.6 su copia di prova e confronto di conti/movimenti.
- Import QIF/CSV/XLSX/GnuCash, inserimento manuale, ripartizioni, report, grafici, PDF, XLSX e persistenza multi-dispositivo.
- Backup SQLite, integrity_check, ripristino, copia pre-restore e login con l'account ripristinato.
- Pulsante Lovelace che apre il browser esterno.


### Accesso limitato alla rete locale

La versione beta 0.2.0-beta.5 accetta connessioni HTTPS soltanto dagli indirizzi appartenenti alla rete indicata nell'opzione `lan_network` (predefinita `192.168.1.0/24`). L'opzione `hostname` identifica il nome DNS incluso nel certificato HTTPS (predefinito `homeassistant.local`). Non configurare inoltri di porta sul router. Il pulsante Home Assistant `Apri interfaccia utente web` usa il segnaposto `[HOST]`: per aprire l'app occorre accedere a Home Assistant tramite il suo indirizzo LAN; quando Home Assistant è aperto tramite Nabu Casa il collegamento non viene trasformato automaticamente nell'IP LAN.


## Nome host e certificato
L'add-on beta.5 usa `hostname` (predefinito `homeassistant.local`) per il nome DNS nel certificato HTTPS. Il nome deve risolversi sulla LAN dai dispositivi client; se la rete usa un nome differente, configurarlo nelle opzioni dell'add-on e riavviare. Il certificato server viene rigenerato se il SAN DNS non corrisponde. Dopo la rigenerazione, scaricare e installare la CA aggiornata dalla pagina di login (`/ca.crt`) o dalle Impostazioni. Il pulsante Supervisor continua a usare `https://[HOST]:[PORT:8443]`: il nome con cui è aperto Home Assistant determina il valore di `[HOST]`.


## Funzioni beta.5
- Piano dei conti: modello Excel scaricabile e importazione XLSX/CSV con percorso gerarchico e tipo GnuCash. I conti già esistenti non vengono sovrascritti.
- Importazioni bancarie e GnuCash: controllo duplicati secondo data, importo, descrizione e causale; scelta esplicita tra escludere i duplicati e importarli comunque.
- Importazione GnuCash in modalità aggiunta: conti mappati per percorso, movimenti e regole aggiunti senza sostituire l'archivio già presente.
- Versioni visibili in basso a sinistra: versione dell'app e versione dell'add-on.
