# Integrazione Home Assistant — Gestione C/C

Questa è la prima versione di sviluppo della custom integration. Non è ancora pronta per l'installazione in un'istanza Home Assistant di produzione.

## Requisiti
- Add-on Gestione C/C con API integrazione abilitata.
- Home Assistant Core in grado di raggiungere l'add-on attraverso la rete locale.
- Certificato CA privata dell'add-on installato in un percorso leggibile da Home Assistant Core.
- Token dedicato generato da Gestione C/C → Impostazioni → Integrazione Home Assistant.

## Configurazione di sviluppo
1. Copiare la directory `custom_components/gestione_cc` in `/config/custom_components/gestione_cc`.
2. Copiare il certificato CA dell'add-on in `/ssl/gestione-cc-ca.crt` (o indicare il percorso effettivo nel flusso di configurazione).
3. Riavviare Home Assistant.
4. Aggiungere **Gestione C/C** da Impostazioni → Dispositivi e servizi.
5. Inserire URL HTTPS locale, token e percorso CA.

La verifica TLS è obbligatoria: l'integrazione non disabilita la verifica del certificato e non accetta HTTP o URL pubblici.

## Sensori e comandi
La prima bozza espone disponibilità app, uptime, dimensione/ultima modifica DB, backup, spazio, conteggio allegati e conteggi aggregati dei processi. Sono previsti tre pulsanti: backup locale, backup Google Drive e controllo integrità.

Non vengono creati sensori finanziari e non vengono trasferiti conti, saldi, movimenti, descrizioni o contenuti documentali.

## PWA e collegamento Home Assistant Companion

L'add-on serve un manifest PWA con apertura `standalone`. Non viene installato un service worker e non viene abilitata alcuna cache offline: le risposte HTML/API restano `no-store` per evitare la persistenza di dati contabili sul dispositivo.

Da Chrome, aprire Gestione C/C e scegliere **Installa Gestione C/C** dal menu del browser.

Per un accesso dalla Companion App, aggiungere alla dashboard Home Assistant una scheda Pulsante con azione URL (sostituire l'host se diverso):

```yaml
type: button
name: Apri Gestione C/C
icon: mdi:bank
tap_action:
  action: url
  url_path: https://homeassistant.local:8443/
```

Il link non contiene PIN o token. L'app richiede comunque il PIN all'apertura quando la sessione non è valida.

## Stato e limitazioni note
- Config flow, coordinator, sensori, binary sensor e pulsanti sono in fase iniziale.
- Polling corrente: 2 minuti per tutti gli endpoint.
- I comandi sono sincroni e hanno timeout esteso; la gestione job asincrona sarà migliorata.
- La compatibilità di rete HA Core → add-on deve essere verificata sul sistema reale. L'add-on applica un filtro LAN e non deve essere allargato o disattivato per far funzionare l'integrazione.
- L'installazione HACS e il test end-to-end saranno abilitati solo dopo il collaudo della rete e del certificato.

**Non installare questa versione di sviluppo sul sistema operativo Home Assistant principale.**
