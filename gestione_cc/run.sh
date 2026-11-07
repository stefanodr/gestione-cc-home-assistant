#!/usr/bin/with-contenv bashio
set -e
mkdir -p /data /app/www /data/tls
chmod 700 /data/tls
export DATA_DIR=/data
export WWW_DIR=/app/www
export ADDON_OPTIONS_FILE=/data/options.json
export SSL_DIR=/data/tls
LAN_HOST="$(bashio::config 'lan_host')"
if [ ! -s /data/tls/root-ca.crt ] || [ ! -s /data/tls/server.crt ] || [ ! -s /data/tls/server.key ]; then
  bashio::log.info "Creo la CA privata e il certificato HTTPS per ${LAN_HOST}"
  openssl req -x509 -newkey rsa:3072 -sha256 -days 3650 -nodes \
    -keyout /data/tls/root-ca.key -out /data/tls/root-ca.crt \
    -subj "/CN=Gestione C-C LAN Root CA"
  openssl req -new -newkey rsa:3072 -nodes \
    -keyout /data/tls/server.key -out /data/tls/server.csr \
    -subj "/CN=${LAN_HOST}"
  if echo "${LAN_HOST}" | grep -Eq '^[0-9]+(\.[0-9]+){3}$'; then
    printf "subjectAltName=IP:${LAN_HOST}\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n" > /data/tls/server.ext
  else
    printf "subjectAltName=DNS:${LAN_HOST}\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n" > /data/tls/server.ext
  fi
  openssl x509 -req -in /data/tls/server.csr -CA /data/tls/root-ca.crt \
    -CAkey /data/tls/root-ca.key -CAcreateserial -out /data/tls/server.crt \
    -days 825 -sha256 -extfile /data/tls/server.ext
  chmod 600 /data/tls/root-ca.key /data/tls/server.key
  chmod 644 /data/tls/root-ca.crt /data/tls/server.crt
  rm -f /data/tls/server.csr /data/tls/server.ext /data/tls/root-ca.srl
fi
bashio::log.info "Avvio Gestione C/C su HTTPS porta 8443"
python3 /app/server.py
