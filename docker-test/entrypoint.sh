#!/bin/sh
set -eu

: "${BOOTSTRAP_PIN:?Impostare BOOTSTRAP_PIN nel file .env}"
case "$BOOTSTRAP_PIN" in
  [0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "ERRORE: BOOTSTRAP_PIN deve contenere esattamente 6 cifre." >&2; exit 1 ;;
esac

mkdir -p "$DATA_DIR/tls" "$DATA_DIR/backups"
chmod 700 "$DATA_DIR/tls"

# Crea un certificato autofirmato valido per l'accesso locale da questo PC.
if [ ! -s "$SSL_DIR/server.crt" ] || [ ! -s "$SSL_DIR/server.key" ]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout "$SSL_DIR/server.key" \
    -out "$SSL_DIR/server.crt" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    -addext "extendedKeyUsage=serverAuth"
  chmod 600 "$SSL_DIR/server.key"
  chmod 644 "$SSL_DIR/server.crt"
fi

# In Docker Desktop la connessione arriva dal gateway Docker:
# l'esposizione della porta è comunque limitata a 127.0.0.1 sul PC host.
python3 - <<'PY'
import json, os
options = {
    "admin_username": "admin",
    "bootstrap_pin": os.environ["BOOTSTRAP_PIN"],
    "hostname": "localhost",
    "lan_network": "0.0.0.0/0"
}
path = os.environ["ADDON_OPTIONS_FILE"]
temporary = path + ".tmp"
with open(temporary, "w", encoding="utf-8") as handle:
    json.dump(options, handle)
os.chmod(temporary, 0o600)
os.replace(temporary, path)
PY

exec python3 /app/server.py
