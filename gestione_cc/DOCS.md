# Gestione C/C — Documentation / Documentazione

**Versione / Version:** 1.0.5

[Italiano](#italiano) · [English](#english)

---

# Italiano

## 1. Che cos'è

Gestione C/C è un'app Home Assistant che esegue un'applicazione web per la gestione dei conti personali. Il frontend è servito dal container e i dati sono conservati in SQLite nella directory persistente `/data`. I browser autorizzati condividono lo stesso archivio.

Non è un'integrazione Home Assistant e non crea entità o dispositivi Home Assistant.

## 2. Requisiti

- Home Assistant OS/Supervisor con supporto alle App.
- Architettura `amd64` o `aarch64`.
- Porta TCP 8443 disponibile.
- Hostname locale risolvibile dai dispositivi client.
- Subnet LAN corretta nell'opzione `lan_network`.

## 3. Opzioni dell'App

| Opzione | Predefinito | Descrizione |
|---|---|---|
| `admin_username` | `admin` | Nome amministratore iniziale; durante la migrazione credenziali viene mantenuto l'utente esistente. |
| `bootstrap_pin` | vuoto | PIN temporaneo iniziale, obbligatorio al primo avvio/migrazione, esattamente 6 cifre. |
| `hostname` | `homeassistant.local` | Nome DNS incluso nel certificato HTTPS; deve risolversi sulla LAN. |
| `lan_network` | `192.168.1.0/24` | Rete CIDR autorizzata dal server. Sostituirla se la subnet reale è diversa. |

**Attenzione:** un valore errato di `lan_network` può impedire l'accesso o non corrispondere alla topologia vista dal container. Verifica l'accesso da un client autorizzato e controlla i log prima di usare dati reali. Non considerare il filtro LAN collaudato solo perché il servizio parte.

## 4. Primo avvio e certificato HTTPS

1. Imposta un PIN iniziale di 6 cifre e verifica hostname/subnet.
2. Avvia l'App.
3. Apri `https://<hostname>:8443` da un dispositivo della LAN.
4. La prima connessione può mostrare un avviso perché il certificato è firmato da una CA privata generata dall'App.
5. Accedi e scarica il certificato CA dalla pagina di login o dalle Impostazioni.
6. Installa la CA nel deposito certificati attendibili del dispositivo/browser seguendo le procedure del sistema operativo.
7. Riavvia il browser e verifica che il certificato sia considerato attendibile.
8. Dopo la migrazione iniziale, svuota `bootstrap_pin` dalle opzioni dell'App. Non condividere il PIN.

La chiave privata della CA e le chiavi TLS restano nella directory persistente dell'App. Non cancellare `/data/tls`: farlo rigenera la CA e richiede di installare nuovamente il certificato sui client.

## 5. Accesso e sessioni

- Autenticazione tramite PIN numerico di 6 cifre.
- Hash PBKDF2-HMAC-SHA256 con salt casuale e 600.000 iterazioni.
- Cookie di sessione HttpOnly, Secure e SameSite=Strict.
- Durata della sessione: 8 ore.
- Limitazione dei tentativi: cinque tentativi falliti per IP nella finestra di cinque minuti.
- Le operazioni di modifica richiedono un token CSRF.
- Il cambio PIN disconnette le altre sessioni secondo il comportamento dell'app.

## 6. Dati, importazione e compatibilità

Il database centrale è `/data/gestione_cc.sqlite3`. L'archivio comprende piano dei conti, movimenti, regole e impostazioni applicative.

Sono previste funzioni di importazione per backup GnuCash e file QIF, CSV e XLSX supportati dall'interfaccia. La compatibilità dipende dalla struttura concreta del file: conserva sempre una copia originale e verifica i totali dopo l'importazione.

L'importazione GnuCash in modalità aggiunta associa i conti tramite percorso e aggiunge movimenti/regole senza sostituire intenzionalmente l'archivio esistente. Il controllo duplicati aiuta a individuare possibili ripetizioni, ma non sostituisce una verifica contabile.

## 7. Backup e ripristino

### Backup JSON
Esporta lo stato applicativo in un file JSON, utile per migrazioni compatibili.

### Backup SQLite
Scarica una copia del database SQLite. Le copie automatiche vengono create prima delle scritture quando è trascorso l'intervallo previsto; vengono conservate fino a 30 copie in `/data/backups`.

### Backup facoltativo su Google Drive

Per la procedura dettagliata, con schermate e passaggi per Google Cloud, OAuth e rclone su Windows, consulta la [Guida Google Drive Backup (italiano e inglese)](../docs/GOOGLE_DRIVE_BACKUP.md).

Da **Impostazioni → Backup · Google Drive** puoi collegare il tuo account Google. L'autorizzazione viene generata sul PC Windows con un OAuth Client di tipo Desktop e rclone; Home Assistant non deve essere esposto su Internet e non richiede un URL di callback pubblico.

1. Nella Google Cloud Console crea un progetto e abilita **Google Drive API**.
2. Configura la schermata consenso OAuth per uso personale e aggiungi il tuo account Google come utente di prova.
3. In **Accesso ai dati** aggiungi lo scope `https://www.googleapis.com/auth/drive.file`.
4. Crea un ID client OAuth di tipo **App desktop** e conserva Client ID e Client Secret.
5. Scarica rclone per Windows dal sito ufficiale ed estrai `rclone.exe`.
6. Apri il Prompt dei comandi nella cartella di rclone ed esegui, sostituendo i due valori tra virgolette:

   ```text
   rclone authorize drive --drive-scope drive.file --drive-client-id "IL_TUO_CLIENT_ID" --drive-client-secret "IL_TUO_CLIENT_SECRET"
   ```

7. Accedi a Google nella finestra del browser e autorizza l'accesso. Copia il solo token restituito da rclone (non le righe descrittive) e incollalo nella sezione Google Drive dell'App insieme a Client ID e Client Secret.
8. Premi **Collega Google Drive**. L'App verifica l'autorizzazione e crea la cartella `Gestione C-C Backup`.

Per un uso continuativo, imposta la schermata consenso su **In produzione** dopo aver completato i dati richiesti: un'app esterna lasciata in modalità di test può avere token di aggiornamento con scadenza di 7 giorni. Per un uso personale limitato può comparire un avviso Google relativo all'app non verificata; non condividere l'app con altri utenti.

Il token OAuth e il Client Secret sono credenziali: non inviarli in chat, non inserirli in GitHub e non allegarli a segnalazioni. Gestione C/C li conserva nel file privato `/data/google_drive.json` sul volume dell'App. Lo scope `drive.file` limita l'accesso ai file e alla cartella creati dall'applicazione.

Se Google Drive è collegato, vengono conservati un backup di sessione e gli ultimi tre backup notturni delle 03:00 (Europe/Rome). **Esci** attende il backup quando l'archivio è cambiato; la chiusura diretta della scheda tenta un backup ma il browser non ne garantisce il completamento. Il backup notturno è indipendente dalla sessione. I file SQLite sono normali file non cifrati: proteggi l'account Google e chiunque abbia accesso al Drive può leggerli.

Puoi selezionare un backup nell'elenco e ripristinarlo. Prima della sostituzione viene creata una copia preventiva locale e il database scaricato viene sottoposto a controllo d'integrità e compatibilità. Dopo il ripristino dovrai accedere nuovamente con il PIN contenuto nel backup.

### Procedura consigliata
1. Crea un backup JSON e uno SQLite dalle Impostazioni.
2. Copia i file fuori dal server Home Assistant, su un supporto protetto.
3. Prima di un ripristino, crea una nuova copia dello stato attuale.
4. Ripristina il database SQLite usando la funzione dedicata: il file viene controllato con `PRAGMA integrity_check`, vengono verificate le tabelle attese e viene creato un backup pre-ripristino.
5. Dopo il ripristino effettua nuovamente il login: il database ripristinato può contenere credenziali diverse.

Non usare il ripristino per tentativi sul database principale. Se non sei certo del file, verifica prima una copia di test.

## 8. Aggiornamento

- Crea un backup esterno aggiornato.
- Aggiorna l'App dal pannello Home Assistant.
- Non disinstallare l'App e non cancellare i dati.
- Attendi il riavvio, poi controlla versione, movimenti, conti e report.
- Non reimportare il backup solo perché il primo caricamento impiega alcuni secondi.

## 9. Rete e sicurezza

- L'interfaccia usa HTTPS sulla porta TCP 8443.
- Il server applica un filtro IP basato su `lan_network`.
- Il container non usa `host_network`; verifica quindi la rete sorgente effettivamente vista dal server nel tuo ambiente.
- Non configurare port forwarding, DMZ o reverse proxy pubblico.
- Non esporre la porta 8443 su Internet o tramite Nabu Casa.
- Usa dispositivi aggiornati, un PIN non banale e backup protetti.
- Limita l'accesso fisico e amministrativo al server Home Assistant.

Il filtro LAN e il TLS privato devono essere collaudati nell'ambiente reale: la presenza delle opzioni non equivale a una certificazione di sicurezza. L'App non è stata sottoposta a audit indipendente.

## 10. Risoluzione problemi

| Sintomo | Controlli |
|---|---|
| App non si avvia | Controlla log, PIN iniziale, hostname e subnet CIDR. |
| Pagina non raggiungibile | Verifica stato App, porta 8443 e risoluzione DNS verso l'IP LAN di Home Assistant. |
| Avviso certificato | Installa la CA scaricata dall'App; se hostname/CA sono stati rigenerati, scarica la CA nuova. |
| Login rifiutato | Verifica PIN e stato account. Non cancellare il database. |
| Dati non aggiornati su un altro browser | Ricarica la pagina; in caso di conflitto di revisione, ricarica prima di ripetere l'operazione. |
| Import non riuscito | Conserva il file originale, controlla formato e duplicati e prova prima con una copia. |
| PDF non parte | Consenti popup/nuove finestre per l'host locale; nella finestra report usa Stampa o Esporta PDF e seleziona “Salva come PDF” nella finestra di stampa. |

## 11. Segnalazioni

Apri una issue GitHub indicando versioni, architettura, log pertinenti e passaggi di riproduzione. Rimuovi ogni informazione personale. Non caricare database, backup, PIN, cookie, chiavi private o estratti conto.

---

# English

## 1. What it is

Gestione C/C is a Home Assistant App running a personal-finance web application. The frontend is served by the App container and accounting data are stored in SQLite under the persistent `/data` directory. Authorised browsers share the same archive.

It is not a Home Assistant integration and does not create Home Assistant entities or devices.

## 2. Requirements

- Home Assistant OS/Supervisor with App support.
- `amd64` or `aarch64` architecture.
- TCP port 8443 available.
- A local hostname resolvable by client devices.
- The correct LAN subnet configured in `lan_network`.

## 3. App options

| Option | Default | Description |
|---|---|---|
| `admin_username` | `admin` | Initial administrator name; an existing user is preserved during credential migration. |
| `bootstrap_pin` | empty | Temporary initial PIN, required for first initialisation/migration, exactly 6 digits. |
| `hostname` | `homeassistant.local` | DNS name included in the HTTPS certificate; it must resolve on the LAN. |
| `lan_network` | `192.168.1.0/24` | CIDR network allowed by the server. Replace it if your actual subnet differs. |

**Important:** an incorrect `lan_network` may block access or fail to match the network topology visible inside the container. Test from an authorised client and inspect logs before entering real data. Do not assume LAN filtering is verified merely because the service starts.

## 4. First start and HTTPS certificate

1. Set a six-digit initial PIN and verify hostname/subnet.
2. Start the App.
3. Open `https://<hostname>:8443` from a device on your LAN.
4. The first connection may show a warning because the certificate is signed by a private CA generated by the App.
5. Sign in and download the CA certificate from the login page or Settings.
6. Install the CA into the trusted certificate store of the authorised device/browser, following the operating system's instructions.
7. Restart the browser and verify that the certificate is trusted.
8. After initial credential migration, clear `bootstrap_pin` from the App options. Never share your PIN.

The CA private key and TLS keys are stored in the App's persistent data directory. Do not delete `/data/tls`: doing so regenerates the CA and requires reinstalling the certificate on clients.

## 5. Authentication and sessions

- Six-digit numeric PIN authentication.
- PBKDF2-HMAC-SHA256 password verifier with a random salt and 600,000 iterations.
- HttpOnly, Secure and SameSite=Strict session cookie.
- Session lifetime: 8 hours.
- Login throttling: five failed attempts per IP within a five-minute window.
- State-changing operations require a CSRF token.
- Changing the PIN invalidates other sessions according to application behaviour.

## 6. Data and imports

The central database is `/data/gestione_cc.sqlite3`. It contains the chart of accounts, transactions, learned rules and application settings.

Import functions support GnuCash backups and transaction files in formats exposed by the interface (QIF, CSV, XLSX). Compatibility depends on the actual file structure. Keep the original file and verify totals after import.

GnuCash merge mode maps accounts by account path and adds transactions/rules without intentionally replacing the existing archive. Duplicate detection helps identify possible duplicates but does not replace accounting review.

## 7. Backup and restore

### JSON backup
Exports the application state to JSON for compatible data migration or transfer.

### SQLite backup
Downloads a copy of the SQLite database. Automatic snapshots are created before writes when the configured interval has elapsed; up to 30 local copies are retained under `/data/backups`.

### Optional Google Drive backup

For the complete step-by-step procedure covering Google Cloud, OAuth and rclone on Windows, see the [Google Drive Backup Guide (Italian and English)](../docs/GOOGLE_DRIVE_BACKUP.md).

You can connect your Google account from **Settings → Backup · Google Drive**. Authorization is generated on a Windows PC with a Desktop OAuth client and rclone; Home Assistant does not need to be exposed to the Internet and no public callback URL is required.

1. Create a project in Google Cloud Console and enable **Google Drive API**.
2. Configure the OAuth consent screen for personal use and add your Google account as a test user.
3. Under **Data access**, add the scope `https://www.googleapis.com/auth/drive.file`.
4. Create an OAuth client ID of type **Desktop app** and keep its Client ID and Client Secret.
5. Download rclone for Windows from its official website and extract `rclone.exe`.
6. Open Command Prompt in the rclone folder and run the following, replacing the two quoted values:

   ```text
   rclone authorize drive --drive-scope drive.file --drive-client-id "YOUR_CLIENT_ID" --drive-client-secret "YOUR_CLIENT_SECRET"
   ```

7. Sign in to Google in the browser window and grant access. Copy only the token returned by rclone (not the explanatory lines) and paste it into the App's Google Drive section with the Client ID and Client Secret.
8. Select **Connect Google Drive**. The App validates the authorization and creates the `Gestione C-C Backup` folder.

For long-term use, set the OAuth consent screen to **In production** after completing the required details. An external app left in testing mode may receive refresh tokens that expire after seven days. Personal-use apps may show Google's unverified-app warning; do not share the app with other users.

The OAuth token and Client Secret are credentials: never send them in chat, commit them to GitHub or attach them to issue reports. Gestione C/C stores them in the private `/data/google_drive.json` file on the App volume. The `drive.file` scope limits access to files and the folder created by the application.

When connected, the App retains one session backup and the latest three nightly backups at 03:00 (Europe/Rome). **Exit** waits for the backup if the archive changed; closing the browser tab only attempts a backup and the browser cannot guarantee completion. The nightly backup runs independently of the session. SQLite files are ordinary, unencrypted files: protect your Google account and remember that anyone with Drive access can read them.

You can select a backup from the list and restore it. Before replacing the database, the App creates a local pre-restore copy and checks the downloaded database for integrity and compatibility. You must sign in again with the PIN stored in the restored backup.

### Recommended procedure
1. Create both JSON and SQLite backups in Settings.
2. Copy them off the Home Assistant host to protected storage.
3. Before restoring, create a fresh copy of the current archive.
4. Restore SQLite using the dedicated function. The file is checked with `PRAGMA integrity_check`, expected tables are verified and a pre-restore backup is created.
5. Sign in again after restore: the restored database may contain different credentials.

Do not experiment with restore operations on your primary database. Validate uncertain backups on a test installation first.

## 8. Updates

- Create a fresh off-host backup.
- Update the App from Home Assistant.
- Do not uninstall the App or delete its data.
- Wait for restart, then check version, accounts, transactions and reports.
- Do not re-import a backup just because the first load takes a few seconds.

## 9. Network and security

- HTTPS interface on TCP port 8443.
- IP filtering based on `lan_network`.
- The container does not use `host_network`; verify the source network actually seen by the server in your environment.
- Do not configure port forwarding, a DMZ or a public reverse proxy.
- Do not expose port 8443 to the Internet or through Nabu Casa.
- Use updated devices, a non-trivial PIN and protected backups.
- Restrict physical and administrative access to the Home Assistant host.

LAN filtering and private TLS must be tested in the actual deployment environment. Configuration options are not a security certification. No independent security audit is claimed.

## 10. Troubleshooting

| Symptom | Checks |
|---|---|
| App does not start | Check logs, initial PIN, hostname and CIDR subnet. |
| Page cannot be reached | Check App status, TCP port 8443 and local DNS resolution to the Home Assistant LAN address. |
| Certificate warning | Install the CA downloaded from the App; if hostname/CA were regenerated, download the new CA. |
| Login rejected | Check the PIN and account state. Do not delete the database. |
| Data appears stale in another browser | Reload the page; if a revision conflict appears, reload before retrying. |
| Import fails | Keep the original file, check format and duplicates, and test with a copy first. |
| PDF does not open | Allow pop-ups/new windows for the local host; in the report window select Print or Export PDF and choose “Save as PDF” in the browser print dialog. |

## 11. Issues and support

Open a GitHub issue with versions, architecture, relevant logs and reproduction steps. Remove personal information. Never upload databases, backups, PINs, cookies, private keys or bank statements.
