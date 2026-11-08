# Gestione C/C — Google Drive Backup Guide

**Versione app di riferimento / Reference app version: 1.0.5**

[Italiano](#italiano) · [English](#english)

> **Security note / Nota di sicurezza:** this guide never requires you to send credentials to anyone. Never publish your OAuth Client Secret, rclone token, PIN, database or backup files. / Questa guida non richiede di inviare credenziali a nessuno. Non pubblicare Client Secret OAuth, token rclone, PIN, database o file di backup.

---

# Italiano

## 1. Cosa serve

Per collegare Google Drive a Gestione C/C occorrono:

- un account Google con Google Drive;
- un PC Windows con accesso a Internet;
- Gestione C/C installata e raggiungibile nella rete locale;
- il programma **rclone** per Windows;
- un progetto Google Cloud con Google Drive API e un client OAuth di tipo **App desktop**.

Home Assistant non deve essere esposto a Internet. La procedura genera il token OAuth sul PC Windows e poi lo trasferisce manualmente nella pagina Impostazioni di Gestione C/C.

## 2. Crea un progetto Google Cloud

1. Dal PC Windows apri [Google Cloud Console](https://console.cloud.google.com/).
2. Accedi con lo stesso account Google che vuoi usare per i backup.
3. Apri il selettore dei progetti in alto e scegli **Nuovo progetto**.
4. Assegna un nome riconoscibile, per esempio `Gestione-CC-Backup`, e crea il progetto.
5. Verifica che il nuovo progetto sia selezionato.

## 3. Abilita Google Drive API

1. Nella Google Cloud Console apri **API e servizi → Libreria**.
2. Cerca **Google Drive API**.
3. Apri la scheda e premi **Abilita**.
4. Attendi che l'API risulti attiva per il progetto.

## 4. Configura la schermata di consenso OAuth

Le diciture della Console possono cambiare leggermente nel tempo.

1. Apri **Google Auth Platform** (oppure **API e servizi → Schermata consenso OAuth**, se compare la vecchia interfaccia).
2. Completa i dati richiesti dell'app:
   - nome app: `Gestione C/C Backup`;
   - email di assistenza: il tuo indirizzo Google;
   - contatto sviluppatore: il tuo indirizzo Google.
3. Se richiesto, seleziona il tipo di pubblico **Esterno** per un normale account Google personale.
4. Nella sezione **Pubblico / Audience**, se l'app è in modalità **Test**, aggiungi il tuo account Google tra gli **Utenti di prova** e salva.
5. Nella sezione **Accesso ai dati / Data access**, aggiungi esattamente questo ambito:
   
   ```text
   https://www.googleapis.com/auth/drive.file
   ```

   Questo ambito consente all'app di gestire i file creati o aperti tramite la propria integrazione, senza concedere l'accesso indiscriminato a tutto il Drive.
6. Salva le modifiche.

**Modalità Test:** è adatta per provare il collegamento. Per le applicazioni OAuth esterne lasciate in modalità Test, Google può far scadere i refresh token dopo 7 giorni. In tal caso sarà necessario ripetere l'autorizzazione.

**Uso continuativo:** puoi valutare il passaggio a **In produzione / In production** dalla sezione Pubblico, dopo aver completato i dati richiesti da Google. Per un uso personale Google può comunque mostrare una schermata di avviso per un'app non verificata. Non condividere il client OAuth con altre persone. Il passaggio in produzione non equivale a una verifica Google e non garantisce che ogni avviso scompaia.

## 5. Crea il client OAuth per App desktop

1. Nella Google Auth Platform apri **Client** (o **Client OAuth**).
2. Seleziona **Crea client**.
3. Come tipo di applicazione scegli **App desktop / Desktop app**. Non scegliere Applicazione web.
4. Assegna un nome, per esempio `Gestione C-C Windows rclone`.
5. Crea il client.
6. Copia e conserva in un luogo sicuro:
   - **Client ID**;
   - **Client Secret**.

Questi due valori servono nel passaggio successivo e nella pagina Impostazioni di Gestione C/C. Non inserirli in repository GitHub, screenshot, issue o messaggi.

## 6. Scarica rclone per Windows

1. Apri il sito ufficiale: [rclone.org/downloads](https://rclone.org/downloads/).
2. Scarica la versione Windows adatta al tuo PC (normalmente Windows 64-bit).
3. Estrai il contenuto del file ZIP in una cartella semplice, per esempio `C:\\rclone`.
4. Verifica che nella cartella sia presente `rclone.exe`.

Non occorre installare rclone su Home Assistant: il comando viene eseguito sul PC Windows.

## 7. Genera il token OAuth con rclone

1. Apri la cartella in cui si trova `rclone.exe`.
2. Nella barra degli indirizzi di Esplora file scrivi `cmd` e premi Invio: si aprirà il Prompt dei comandi già posizionato nella cartella.
3. Copia il comando seguente e sostituisci i due valori di esempio con il tuo Client ID e Client Secret, mantenendo le virgolette:

   ```text
   rclone authorize drive --drive-scope drive.file --drive-client-id "IL_TUO_CLIENT_ID" --drive-client-secret "IL_TUO_CLIENT_SECRET"
   ```

4. Premi Invio. rclone aprirà una finestra del browser.
5. Seleziona l'account Google che hai aggiunto come utente di prova e autorizza l'accesso a Google Drive.
6. Al termine, torna al Prompt dei comandi. rclone mostrerà un token (normalmente un blocco di testo in formato JSON).
7. Copia **l'intero token**, dall'inizio alla fine, senza aggiungere le righe descrittive del Prompt.

**Attenzione:** il token è una credenziale equivalente a una chiave di accesso. Non inviarlo in chat, non salvarlo in un file pubblico e non inserirlo in GitHub. Se temi che sia stato esposto, revoca l'accesso dell'app dal tuo account Google e ripeti l'autorizzazione.

## 8. Collega Google Drive in Gestione C/C

1. Apri Gestione C/C dal browser, usando il normale indirizzo locale HTTPS.
2. Accedi con il PIN amministratore.
3. Apri **Impostazioni → Backup · Google Drive**.
4. Inserisci nei rispettivi campi:
   - Client ID ottenuto da Google Cloud;
   - Client Secret ottenuto da Google Cloud;
   - token completo generato da rclone.
5. Premi **Collega Google Drive**.
6. Attendi il risultato della verifica. Se il collegamento riesce, Gestione C/C crea sul tuo Drive la cartella `Gestione C-C Backup` e mostra lo stato del collegamento.

Il Client Secret e il token vengono conservati nel file privato `/data/google_drive.json` sul volume persistente dell'App. Non cancellare o condividere quel file. Non è il database contabile e non va caricato manualmente su Google Drive.

## 9. Esegui e verifica il primo backup

1. Dalla stessa sezione **Backup · Google Drive**, usa il comando di backup manuale, se disponibile nella versione installata.
2. Attendi il messaggio di completamento.
3. Apri Google Drive dal browser e controlla che esista la cartella `Gestione C-C Backup` e che al suo interno sia comparso il file di backup.
4. Controlla che la data e l'ora del file siano quelle attese.

Quando Google Drive è collegato, Gestione C/C mantiene:
- un backup di sessione;
- gli ultimi tre backup notturni, pianificati alle **03:00 (Europe/Rome)**.

Il comando **Esci** attende il backup quando l'archivio è stato modificato. Chiudere direttamente la scheda del browser è invece un tentativo best-effort: il browser potrebbe interrompere la richiesta. Il backup notturno è indipendente dalla scheda aperta e dalla sessione utente.

## 10. Ripristino e precauzioni

Il ripristino sostituisce il database operativo con il contenuto del backup selezionato.

1. Prima di procedere, crea un backup aggiornato dello stato attuale.
2. Seleziona il file corretto nell'elenco dei backup Google Drive.
3. Avvia il ripristino e attendi che terminino i controlli.
4. L'app crea prima una copia preventiva locale e verifica integrità SQLite e struttura dell'archivio.
5. Dopo il ripristino, effettua nuovamente l'accesso: il PIN può essere quello presente nel database ripristinato.

Non provare file incerti sul database principale. Se possibile, verifica prima il backup in un'installazione di prova.

## 11. Sicurezza, limiti e risoluzione problemi

- I file SQLite caricati su Google Drive **non sono cifrati dall'app**. Chiunque possa accedere al tuo Drive e ai file può leggerne il contenuto.
- Proteggi l'account Google con una password robusta e verifica in due passaggi.
- La connessione Google Drive è in uscita: non rende l'interfaccia Gestione C/C pubblica e non richiede port forwarding o accesso Nabu Casa.
- Conserva anche una copia indipendente dei backup, fuori dal server Home Assistant.
- La modalità Test può comportare la scadenza dei refresh token dopo 7 giorni. Se il collegamento smette di funzionare, controlla lo stato del progetto OAuth e ripeti l'autorizzazione con rclone.
- Se compare un errore di autorizzazione, controlla che Google Drive API sia abilitata, che l'account sia tra gli utenti di prova (se sei in modalità Test) e che lo scope sia `drive.file`.
- Se il token è stato copiato in modo incompleto, ripeti il comando rclone e incolla il nuovo token intero.
- Non cancellare `/data/google_drive.json` per tentare una riparazione: contiene le credenziali del collegamento. Prima di modificarlo, scollega o riconfigura Google Drive dall'interfaccia quando possibile.

---

# English

## 1. What you need

To connect Google Drive to Gestione C/C, you need:

- a Google account with Google Drive;
- a Windows PC with Internet access;
- Gestione C/C installed and reachable on your local network;
- **rclone** for Windows;
- a Google Cloud project with Google Drive API enabled and an OAuth client of type **Desktop app**.

Home Assistant does not need to be exposed to the Internet. The OAuth token is generated on the Windows PC and then entered manually in Gestione C/C Settings.

## 2. Create a Google Cloud project

1. On your Windows PC, open [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with the Google account you want to use for backups.
3. Open the project selector at the top and choose **New project**.
4. Give it a recognisable name, for example `Gestione-CC-Backup`, and create it.
5. Make sure the new project is selected.

## 3. Enable Google Drive API

1. In Google Cloud Console, open **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Open it and click **Enable**.
4. Wait until the API is enabled for your project.

## 4. Configure the OAuth consent screen

Google may slightly change the Console labels over time.

1. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen** in the older interface).
2. Complete the required app information:
   - app name: `Gestione C/C Backup`;
   - user support email: your Google address;
   - developer contact: your Google address.
3. If prompted, choose **External** as the audience for a regular personal Google account.
4. Under **Audience**, if the app is in **Testing** mode, add your Google account as a **Test user** and save.
5. Under **Data access**, add this exact scope:
   
   ```text
   https://www.googleapis.com/auth/drive.file
   ```

   This scope allows the app to manage files it creates or opens through its integration, without granting unrestricted access to all files in Drive.
6. Save your changes.

**Testing mode:** this is suitable for trying the connection. For external OAuth apps left in Testing, Google may expire refresh tokens after 7 days. If that happens, authorization must be completed again.

**Long-term use:** after completing Google's required information, you can consider switching the audience status to **In production**. Google may still display an unverified-app warning for personal use. Do not share the OAuth client with other people. Moving to production is not the same as Google verification and does not guarantee that every warning will disappear.

## 5. Create a Desktop OAuth client

1. In Google Auth Platform, open **Clients** (or **OAuth clients**).
2. Select **Create client**.
3. Choose **Desktop app** as the application type. Do not choose Web application.
4. Give it a name, for example `Gestione C-C Windows rclone`.
5. Create the client.
6. Copy and store these values securely:
   - **Client ID**;
   - **Client Secret**.

You will need both values for the next step and for Gestione C/C Settings. Never put them in GitHub repositories, screenshots, issues or messages.

## 6. Download rclone for Windows

1. Open the official website: [rclone.org/downloads](https://rclone.org/downloads/).
2. Download the Windows build for your PC (normally Windows 64-bit).
3. Extract the ZIP file to a simple folder, for example `C:\\rclone`.
4. Make sure `rclone.exe` is in that folder.

You do not need to install rclone on Home Assistant. The command runs on your Windows PC.

## 7. Generate the OAuth token with rclone

1. Open the folder containing `rclone.exe`.
2. In File Explorer's address bar, type `cmd` and press Enter. Command Prompt opens in that folder.
3. Copy the command below and replace the two example values with your Client ID and Client Secret, keeping the quotation marks:

   ```text
   rclone authorize drive --drive-scope drive.file --drive-client-id "YOUR_CLIENT_ID" --drive-client-secret "YOUR_CLIENT_SECRET"
   ```

4. Press Enter. rclone opens a browser window.
5. Select the Google account you added as a test user and grant access to Google Drive.
6. When authorization finishes, return to Command Prompt. rclone displays a token (usually a JSON text block).
7. Copy the **entire token**, from beginning to end, without the explanatory Command Prompt lines.

**Important:** the token is a credential equivalent to an access key. Never send it in chat, save it in a public file or commit it to GitHub. If you think it has been exposed, revoke the app's access from your Google account and repeat authorization.

## 8. Connect Google Drive in Gestione C/C

1. Open Gestione C/C in your browser using its normal local HTTPS address.
2. Sign in with the administrator PIN.
3. Open **Settings → Backup · Google Drive**.
4. Enter the following values in their respective fields:
   - Client ID from Google Cloud;
   - Client Secret from Google Cloud;
   - the complete token generated by rclone.
5. Click **Connect Google Drive**.
6. Wait for the validation result. If the connection succeeds, Gestione C/C creates a `Gestione C-C Backup` folder in your Drive and displays the connection status.

The Client Secret and token are stored in the private `/data/google_drive.json` file on the App's persistent volume. Do not delete or share this file. It is not the accounting database and should not be manually uploaded to Google Drive.

## 9. Run and verify the first backup

1. In the same **Backup · Google Drive** section, use the manual backup command, if available in your installed version.
2. Wait for the completion message.
3. Open Google Drive in your browser and check that the `Gestione C-C Backup` folder exists and contains the backup file.
4. Check that the file's date and time are as expected.

When Google Drive is connected, Gestione C/C retains:
- one session backup;
- the latest three nightly backups, scheduled for **03:00 (Europe/Rome)**.

The **Exit** command waits for the backup when the archive has changed. Closing the browser tab directly is best-effort only: the browser may interrupt the request. The nightly backup runs independently of the open tab and user session.

## 10. Restore and precautions

Restoring replaces the live database with the contents of the selected backup.

1. Before proceeding, create an up-to-date backup of the current data.
2. Select the correct file from the Google Drive backup list.
3. Start the restore and wait for all checks to finish.
4. The app first creates a local pre-restore copy, then checks SQLite integrity and archive structure.
5. After restore, sign in again: the PIN may be the one stored in the restored database.

Do not test uncertain files on your primary database. If possible, validate the backup on a test installation first.

## 11. Security, limitations and troubleshooting

- SQLite files uploaded to Google Drive are **not encrypted by the app**. Anyone who can access your Drive and the backup files can read their contents.
- Protect your Google account with a strong password and two-step verification.
- The Google Drive connection is outbound only: it does not make the Gestione C/C interface public and does not require port forwarding or Nabu Casa access.
- Keep an independent copy of your backups outside the Home Assistant host.
- Testing mode may cause refresh tokens to expire after 7 days. If the connection stops working, check the OAuth project status and repeat authorization with rclone.
- If authorization fails, check that Google Drive API is enabled, that your account is listed as a test user (when in Testing mode), and that the scope is `drive.file`.
- If the token was copied incompletely, run the rclone command again and paste the entire new token.
- Do not delete `/data/google_drive.json` as a troubleshooting shortcut: it contains the connection credentials. When possible, disconnect or reconfigure Google Drive through the interface first.
