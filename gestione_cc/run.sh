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
if python3 -c 'import ipaddress,sys; ipaddress.IPv4Address(sys.argv[1])' "$HOSTNAME_CFG" >/dev/null 2>&1; then
  SAN_ENTRY="IP:$HOSTNAME_CFG"
  SAN_MARKER="IP Address:$HOSTNAME_CFG"
else
  SAN_ENTRY="DNS:$HOSTNAME_CFG"
  SAN_MARKER="DNS:$HOSTNAME_CFG"
fi
CA_CREATED=0
if [ ! -s /data/tls/root-ca.crt ] || [ ! -s /data/tls/root-ca.key ]; then
  CA_CREATED=1
elif ! openssl x509 -in /data/tls/root-ca.crt -noout -text 2>/dev/null | grep -Fq "CA:TRUE" \
  || ! openssl x509 -in /data/tls/root-ca.crt -noout -text 2>/dev/null | grep -Fq "Certificate Sign"; then
  # Home Assistant Core's Python/OpenSSL requires an explicit CA keyUsage extension.
  CA_CREATED=1
fi

if [ "$CA_CREATED" -eq 1 ]; then
  if [ -s /data/tls/root-ca.crt ] || [ -s /data/tls/root-ca.key ] || [ -s /data/tls/server.crt ] || [ -s /data/tls/server.key ]; then
    BACKUP_DIR="/data/tls/legacy-ca-$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -m 700 -p "$BACKUP_DIR"
    for file in root-ca.crt root-ca.key server.crt server.key; do
      if [ -s "/data/tls/$file" ]; then cp -p "/data/tls/$file" "$BACKUP_DIR/$file"; fi
    done
    bashio::log.warning "La vecchia CA e i certificati sono stati conservati in $BACKUP_DIR"
  fi

  bashio::log.info "Creo una nuova CA privata con estensioni X.509 per Home Assistant"
  CA_TMP="/data/tls/.ca-new"
  rm -rf "$CA_TMP"
  mkdir -m 700 -p "$CA_TMP"
  cat > "$CA_TMP/root-ca.cnf" <<'EOF'
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
CN = Gestione C-C Private Root CA

[v3_ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
EOF
  openssl req -x509 -newkey rsa:3072 -sha256 -days 3650 -nodes \
    -keyout "$CA_TMP/root-ca.key" -out "$CA_TMP/root-ca.crt" \
    -config "$CA_TMP/root-ca.cnf" -extensions v3_ca
  chmod 600 "$CA_TMP/root-ca.key"
  chmod 644 "$CA_TMP/root-ca.crt"
  mv "$CA_TMP/root-ca.key" /data/tls/root-ca.key
  mv "$CA_TMP/root-ca.crt" /data/tls/root-ca.crt
  rm -rf "$CA_TMP"
  # Keep this marker until the matching server certificate has been created successfully.
  touch /data/tls/.renew-server-cert
fi

NEED_CERT=0
if [ -e /data/tls/.renew-server-cert ] || [ ! -s /data/tls/server.crt ] || [ ! -s /data/tls/server.key ]; then NEED_CERT=1; fi
if [ "$NEED_CERT" -eq 0 ] && ! openssl x509 -in /data/tls/server.crt -noout -ext subjectAltName 2>/dev/null | grep -Fq "$SAN_MARKER"; then NEED_CERT=1; fi
if [ "$NEED_CERT" -eq 1 ]; then
  bashio::log.info "Creo/aggiorno il certificato HTTPS per $HOSTNAME_CFG"
  SERVER_TMP="/data/tls/.server-new"
  rm -rf "$SERVER_TMP"
  mkdir -m 700 -p "$SERVER_TMP"
  openssl req -new -newkey rsa:3072 -nodes \
    -keyout "$SERVER_TMP/server.key" -out "$SERVER_TMP/server.csr" \
    -subj "/CN=$HOSTNAME_CFG"
  printf "subjectAltName=$SAN_ENTRY\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n" > "$SERVER_TMP/server.ext"
  openssl x509 -req -in "$SERVER_TMP/server.csr" -CA /data/tls/root-ca.crt \
    -CAkey /data/tls/root-ca.key -CAcreateserial -out "$SERVER_TMP/server.crt" \
    -days 825 -sha256 -extfile "$SERVER_TMP/server.ext"
  openssl verify -CAfile /data/tls/root-ca.crt "$SERVER_TMP/server.crt"
  chmod 600 "$SERVER_TMP/server.key"
  chmod 644 "$SERVER_TMP/server.crt"
  mv "$SERVER_TMP/server.key" /data/tls/server.key
  mv "$SERVER_TMP/server.crt" /data/tls/server.crt
  rm -rf "$SERVER_TMP"
  rm -f /data/tls/root-ca.srl /data/tls/.renew-server-cert
  if [ "$CA_CREATED" -eq 1 ]; then
    bashio::log.warning "CA aggiornata: scaricare e installare il nuovo certificato CA da Impostazioni prima di riconfigurare Home Assistant"
  fi
fi
bashio::log.info "Avvio Gestione C/C su HTTPS porta 8443"
python3 /app/server.py
