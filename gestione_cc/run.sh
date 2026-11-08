#!/usr/bin/with-contenv bashio
set -e
mkdir -p /data /app/www /data/tls
chmod 700 /data/tls
export DATA_DIR=/data
export WWW_DIR=/app/www
export ADDON_OPTIONS_FILE=/data/options.json
export SSL_DIR=/data/tls
HOSTNAME_CFG="$(bashio::config 'hostname')"
HOSTNAME_CFG="${HOSTNAME_CFG:-homeassistant.local}"
if ! echo "$HOSTNAME_CFG" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'; then
  bashio::log.error "hostname non valido: usare un nome DNS semplice, ad esempio homeassistant.local"
  exit 1
fi
if [ ! -s /data/tls/root-ca.crt ] || [ ! -s /data/tls/root-ca.key ]; then
  bashio::log.info "Creo la CA privata per Gestione C/C"
  openssl req -x509 -newkey rsa:3072 -sha256 -days 3650 -nodes \
    -keyout /data/tls/root-ca.key -out /data/tls/root-ca.crt \
    -subj "/CN=Gestione C-C Private Root CA"
  chmod 600 /data/tls/root-ca.key
  chmod 644 /data/tls/root-ca.crt
fi
NEED_CERT=0
if [ ! -s /data/tls/server.crt ] || [ ! -s /data/tls/server.key ]; then NEED_CERT=1; fi
if [ "$NEED_CERT" -eq 0 ] && ! openssl x509 -in /data/tls/server.crt -noout -ext subjectAltName 2>/dev/null | grep -Fq "DNS:$HOSTNAME_CFG"; then NEED_CERT=1; fi
if [ "$NEED_CERT" -eq 1 ]; then
  bashio::log.info "Creo/aggiorno il certificato HTTPS per $HOSTNAME_CFG"
  openssl req -new -newkey rsa:3072 -nodes \
    -keyout /data/tls/server.key -out /data/tls/server.csr \
    -subj "/CN=$HOSTNAME_CFG"
  printf "subjectAltName=DNS:$HOSTNAME_CFG\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n" > /data/tls/server.ext
  openssl x509 -req -in /data/tls/server.csr -CA /data/tls/root-ca.crt \
    -CAkey /data/tls/root-ca.key -CAcreateserial -out /data/tls/server.crt \
    -days 825 -sha256 -extfile /data/tls/server.ext
  chmod 600 /data/tls/server.key
  chmod 644 /data/tls/server.crt
  rm -f /data/tls/server.csr /data/tls/server.ext /data/tls/root-ca.srl
fi
bashio::log.info "Avvio Gestione C/C su HTTPS porta 8443"
python3 /app/server.py
