#!/usr/bin/env python3
"""Minimal authenticated LAN server and SQLite persistence for Gestione C/C."""
import base64
import hashlib
import ipaddress
import hmac
import json
import os
import math
import secrets
import sqlite3
import ssl
import time
import urllib.error
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

DATA = Path(os.environ.get("DATA_DIR", "/data"))
WWW = Path(os.environ.get("WWW_DIR", "/app/www"))
DB_PATH = DATA / "gestione_cc.sqlite3"
OPTIONS_FILE = Path(os.environ.get("ADDON_OPTIONS_FILE", "/data/options.json"))
SSL_DIR = Path(os.environ.get("SSL_DIR", "/data/tls"))
BACKUP_DIR = DATA / "backups"
MAX_BODY = 96 * 1024 * 1024
SESSION_SECONDS = 8 * 60 * 60
sessions = {}
login_failures = {}
last_auto_backup = 0.0
LOGIN_WINDOW = 300
LOGIN_MAX = 5
DATA.mkdir(parents=True, exist_ok=True)

def read_options():
    try:
        return json.loads(OPTIONS_FILE.read_text())
    except Exception:
        return {}

def db():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        c.execute("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), state_json TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)")
        columns = {row["name"] for row in c.execute("PRAGMA table_info(app_state)")}
        if "revision" not in columns:
            c.execute("ALTER TABLE app_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 1")
        c.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, salt BLOB NOT NULL, password_hash BLOB NOT NULL, iterations INTEGER NOT NULL)")
        c.execute("CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, event TEXT NOT NULL)")
        opts = read_options()
        username = str(opts.get("admin_username", "admin")).strip() or "admin"
        pin = str(opts.get("bootstrap_pin", ""))
        existing = c.execute("SELECT username FROM users ORDER BY rowid LIMIT 1").fetchone()
        migrated = c.execute("SELECT value FROM settings WHERE key='pin_auth_migrated'").fetchone()
        if not migrated:
            if not valid_pin(pin):
                raise RuntimeError("Impostare bootstrap_pin composto da esattamente 6 cifre nelle opzioni dell'App.")
            salt = secrets.token_bytes(16)
            iterations = 600_000
            digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, iterations)
            if existing:
                # Preserve the existing administrator and all accounting data;
                # only replace the stored credential verifier.
                c.execute("UPDATE users SET salt=?,password_hash=?,iterations=? WHERE username=?",
                          (salt, digest, iterations, existing["username"]))
                c.execute("INSERT INTO audit(at,event) VALUES(datetime('now'),?)", ("admin_pin_migrated",))
            else:
                c.execute("INSERT INTO users(username,salt,password_hash,iterations) VALUES(?,?,?,?)",
                          (username, salt, digest, iterations))
                c.execute("INSERT INTO audit(at,event) VALUES(datetime('now'),?)", ("admin_initialized_with_pin",))
            c.execute("INSERT INTO settings(key,value) VALUES('pin_auth_migrated','1')")

def create_sqlite_backup(label="auto"):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    target = BACKUP_DIR / ("gestione-cc-" + label + "-" + stamp + ".sqlite3")
    temporary = target.with_suffix(".sqlite3.tmp")
    source = sqlite3.connect(DB_PATH, timeout=30)
    destination = sqlite3.connect(temporary, timeout=30)
    try:
        source.backup(destination)
        destination.commit()
    finally:
        destination.close()
        source.close()
    os.replace(temporary, target)
    backups = sorted(BACKUP_DIR.glob("gestione-cc-*.sqlite3"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in backups[30:]:
        try: old.unlink()
        except OSError: pass
    return target

def maybe_auto_backup():
    global last_auto_backup
    now = time.time()
    if now - last_auto_backup >= 900:
        create_sqlite_backup("auto")
        last_auto_backup = now


# Google Drive backup configuration is stored only in the persistent /data volume.
DRIVE_CONFIG = DATA / "google_drive.json"
DRIVE_LOCK = __import__("threading").RLock()
DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

def drive_read_config():
    try:
        value = json.loads(DRIVE_CONFIG.read_text())
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}

def drive_write_config(value):
    temporary = DRIVE_CONFIG.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False))
    os.chmod(temporary, 0o600)
    os.replace(temporary, DRIVE_CONFIG)
    os.chmod(DRIVE_CONFIG, 0o600)

def drive_parse_token(value):
    if isinstance(value, dict):
        return value
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Token Google mancante.")
    try:
        parsed = json.loads(raw)
    except Exception:
        try:
            decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8")
            parsed = json.loads(decoded)
        except Exception as error:
            raise ValueError("Token non riconosciuto. Incolla il blocco JSON completo prodotto da rclone authorize.") from error
    if not isinstance(parsed, dict) or not parsed.get("refresh_token"):
        raise ValueError("Il token non contiene un refresh_token valido. Ripeti l'autorizzazione Google.")
    return parsed

def drive_access_token(force_refresh=False):
    cfg = drive_read_config()
    token = cfg.get("token") or {}
    if not cfg.get("client_id") or not cfg.get("client_secret") or not token.get("refresh_token"):
        raise RuntimeError("Google Drive non è collegato. Completa prima l'autorizzazione.")
    expiry = 0
    try:
        from datetime import datetime
        expiry = datetime.fromisoformat(str(token.get("expiry", "")).replace("Z", "+00:00")).timestamp()
    except Exception:
        pass
    if not force_refresh and token.get("access_token") and expiry > time.time() + 90:
        return token["access_token"]
    from urllib.parse import urlencode
    body = urlencode({
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "refresh_token": token["refresh_token"],
        "grant_type": "refresh_token",
    }).encode()
    request = __import__("urllib.request", fromlist=["Request"]).Request(
        GOOGLE_TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    try:
        with __import__("urllib.request", fromlist=["urlopen"]).urlopen(request, timeout=30) as response:
            renewed = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Google non ha rinnovato l'autorizzazione. Ricollega Google Drive dalle Impostazioni.") from error
    token["access_token"] = renewed.get("access_token", "")
    token["token_type"] = renewed.get("token_type", "Bearer")
    token["expiry"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + int(renewed.get("expires_in", 3600))))
    cfg["token"] = token
    drive_write_config(cfg)
    return token["access_token"]

def drive_http(method, url, data=None, headers=None, retry=True):
    import urllib.request
    token = drive_access_token()
    request_headers = {"Authorization": "Bearer " + token}
    request_headers.update(headers or {})
    request = urllib.request.Request(url, data=data, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as error:
        if error.code == 401 and retry:
            drive_access_token(force_refresh=True)
            return drive_http(method, url, data, headers, False)
        detail = error.read().decode("utf-8", "replace")[:500]
        raise RuntimeError("Google Drive ha restituito un errore HTTP " + str(error.code) + (": " + detail if detail else "")) from error

def drive_api_url(path, params=None, upload=False):
    from urllib.parse import urlencode
    base = DRIVE_UPLOAD_API if upload else DRIVE_API
    return base + path + (("?" + urlencode(params)) if params else "")

def drive_ensure_folder():
    cfg = drive_read_config()
    if cfg.get("folder_id"):
        return cfg["folder_id"]
    query = "mimeType='application/vnd.google-apps.folder' and name='Gestione C-C Backup' and trashed=false"
    result = drive_http("GET", drive_api_url("/files", {"q": query, "fields": "files(id,name)", "pageSize": "10"}))
    files = result.get("files", [])
    if files:
        folder_id = files[0]["id"]
    else:
        created = drive_http("POST", drive_api_url("/files", {"fields": "id,name"}), json.dumps({
            "name": "Gestione C-C Backup", "mimeType": "application/vnd.google-apps.folder"
        }).encode(), {"Content-Type": "application/json"})
        folder_id = created["id"]
    cfg["folder_id"] = folder_id
    drive_write_config(cfg)
    return folder_id

def drive_list_backups():
    folder_id = drive_ensure_folder()
    query = "'" + folder_id + "' in parents and trashed=false"
    result = drive_http("GET", drive_api_url("/files", {
        "q": query, "fields": "files(id,name,size,mimeType,modifiedTime,createdTime)", "pageSize": "100",
        "orderBy": "modifiedTime desc"
    }))
    return result.get("files", [])

def drive_upload_file(local_path, remote_name, replace_existing=False):
    folder_id = drive_ensure_folder()
    content = Path(local_path).read_bytes()
    existing = []
    if replace_existing:
        existing = [item for item in drive_list_backups() if item.get("name") == remote_name]
    metadata = {"name": remote_name, "mimeType": "application/vnd.sqlite3"}
    if not existing:
        metadata["parents"] = [folder_id]
    boundary = "gestionecc" + secrets.token_hex(12)
    body = (("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").encode()
            + json.dumps(metadata).encode()
            + ("\r\n--" + boundary + "\r\nContent-Type: application/vnd.sqlite3\r\n\r\n").encode()
            + content + ("\r\n--" + boundary + "--").encode())
    if existing:
        url = drive_api_url("/files/" + existing[0]["id"], {"uploadType": "multipart", "fields": "id,name,modifiedTime"}, upload=True)
        result = drive_http("PATCH", url, body, {"Content-Type": "multipart/related; boundary=" + boundary})
        for duplicate in existing[1:]:
            drive_http("DELETE", drive_api_url("/files/" + duplicate["id"]))
    else:
        url = drive_api_url("/files", {"uploadType": "multipart", "fields": "id,name,modifiedTime"}, upload=True)
        result = drive_http("POST", url, body, {"Content-Type": "multipart/related; boundary=" + boundary})
    return result

def drive_delete_file(file_id):
    drive_http("DELETE", drive_api_url("/files/" + file_id))

def drive_download_file(file_id):
    import urllib.request
    url = drive_api_url("/files/" + file_id, {"alt": "media"})
    token = drive_access_token()
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        if error.code == 401:
            drive_access_token(force_refresh=True)
            return drive_download_file(file_id)
        raise RuntimeError("Impossibile scaricare il backup da Google Drive (HTTP " + str(error.code) + ").") from error

def current_db_revision():
    with db() as connection:
        row = connection.execute("SELECT revision FROM app_state WHERE id=1").fetchone()
    return int(row["revision"]) if row else 0

def drive_session_backup(force=False):
    with DRIVE_LOCK:
        cfg = drive_read_config()
        if not cfg.get("token"):
            return {"ok": False, "skipped": True, "reason": "Google Drive non collegato"}
        revision = current_db_revision()
        if not force and revision <= int(cfg.get("last_session_revision", -1)):
            return {"ok": True, "skipped": True, "reason": "Nessuna modifica dall'ultimo backup di sessione"}
        local = create_sqlite_backup("drive-session")
        try:
            drive_upload_file(local, "GestioneCC_sessione.sqlite3", True)
            cfg = drive_read_config()
            cfg["last_session_revision"] = revision
            cfg["last_session_backup"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            drive_write_config(cfg)
            return {"ok": True, "skipped": False, "revision": revision}
        finally:
            try: local.unlink()
            except OSError: pass

def drive_nightly_backup():
    with DRIVE_LOCK:
        cfg = drive_read_config()
        if not cfg.get("token"):
            return
        local = create_sqlite_backup("drive-nightly")
        stamp = time.strftime("%Y%m%d-%H%M%S", time.localtime())
        try:
            drive_upload_file(local, "GestioneCC_notturno_" + stamp + ".sqlite3")
            backups = [item for item in drive_list_backups() if item.get("name", "").startswith("GestioneCC_notturno_")]
            backups.sort(key=lambda item: item.get("modifiedTime", ""), reverse=True)
            for old in backups[3:]:
                drive_delete_file(old["id"])
            cfg = drive_read_config()
            cfg["last_nightly_backup"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            drive_write_config(cfg)
        finally:
            try: local.unlink()
            except OSError: pass

def drive_backup_scheduler():
    from datetime import datetime, timedelta
    try:
        from zoneinfo import ZoneInfo
        zone = ZoneInfo("Europe/Rome")
    except Exception:
        zone = None
    while True:
        now = datetime.now(zone) if zone else datetime.now()
        next_run = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        time.sleep(max(1, (next_run - now).total_seconds()))
        try:
            drive_nightly_backup()
            print("GestioneCC: backup notturno Google Drive completato")
        except Exception as error:
            print("GestioneCC: backup notturno Google Drive non riuscito: " + str(error))


def valid_state(state):
    if not isinstance(state, dict): return False
    accounts, transactions, rules = state.get('accounts'), state.get('transactions'), state.get('rules', [])
    if not isinstance(accounts, list) or not isinstance(transactions, list) or not isinstance(rules, list): return False
    if len(accounts) > 10000 or len(transactions) > 250000 or len(rules) > 100000: return False
    account_ids = set()
    for account in accounts:
        if not isinstance(account, dict) or not isinstance(account.get('id'), str) or not account['id'] or account['id'] in account_ids: return False
        account_ids.add(account['id'])
    transaction_ids = set()
    for tx in transactions:
        if not isinstance(tx, dict) or not isinstance(tx.get('id'), str) or not tx['id'] or tx['id'] in transaction_ids: return False
        transaction_ids.add(tx['id'])
        amount = tx.get('amount')
        if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount): return False
        if not isinstance(tx.get('date'), str): return False
    return True

def verify_pin(pin):
    with db() as c:
        row = c.execute("SELECT username,salt,password_hash,iterations FROM users ORDER BY rowid LIMIT 1").fetchone()
    if not row:
        hashlib.pbkdf2_hmac("sha256", str(pin).encode(), b"gestione-cc-dummy", 600_000)
        return None
    candidate = hashlib.pbkdf2_hmac("sha256", str(pin).encode(), row["salt"], row["iterations"])
    return row["username"] if hmac.compare_digest(candidate, row["password_hash"]) else None

def valid_pin(value):
    return isinstance(value, str) and len(value) == 6 and value.isascii() and value.isdigit()

class Handler(BaseHTTPRequestHandler):
    server_version = "GestioneCC"
    def log_message(self, fmt, *args):
        # Avoid logging URLs, credentials, cookies or request bodies.
        print("GestioneCC:", fmt % args)

    def send_json(self, status, obj, headers=None):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Strict-Transport-Security", "max-age=31536000")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        for k,v in (headers or {}).items(): self.send_header(k,v)
        self.end_headers()
        self.wfile.write(raw)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > MAX_BODY: raise ValueError("Richiesta troppo grande")
        return self.rfile.read(length)

    def cookie_token(self):
        cookie = SimpleCookie()
        try: cookie.load(self.headers.get("Cookie", ""))
        except Exception: return None
        morsel = cookie.get("cc_session")
        return morsel.value if morsel else None

    def session(self):
        token = self.cookie_token()
        item = sessions.get(token) if token else None
        if not item: return None
        if item["expires"] < time.time():
            sessions.pop(token, None); return None
        item["expires"] = time.time() + SESSION_SECONDS
        return item

    def require_auth(self, csrf=False):
        item = self.session()
        if not item:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error":"Autenticazione richiesta"})
            return None
        if csrf and not hmac.compare_digest(str(self.headers.get("X-CSRF-Token","")), item["csrf"]):
            self.send_json(HTTPStatus.FORBIDDEN, {"error":"Token CSRF non valido"})
            return None
        return item

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/status":
            item = self.session()
            self.send_json(200, {"authenticated": bool(item), "csrf": item["csrf"] if item else None})
            return
        if path == "/login":
            path = "/login.html"
        if path == "/" and not self.session():
            self.send_response(303)
            self.send_header("Location", "/login")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/" and self.session():
            path = "/index.html"
        if path == "/api/storage-info":
            item = self.require_auth()
            if not item: return
            try:
                info = DB_PATH.stat()
                # SQLite runs in WAL mode: include the live write-ahead log
                # so the displayed size reflects the complete active database.
                wal_path = Path(str(DB_PATH) + "-wal")
                wal_size = wal_path.stat().st_size if wal_path.is_file() else 0
                self.send_json(200, {"path": str(DB_PATH), "size_bytes": info.st_size + wal_size, "exists": True, "includes_wal": True})
            except FileNotFoundError:
                self.send_json(200, {"path": str(DB_PATH), "size_bytes": 0, "exists": False, "includes_wal": True})
            return
        if path == "/api/state":
            item = self.require_auth()
            if not item: return
            with db() as c: row = c.execute("SELECT state_json,revision FROM app_state WHERE id=1").fetchone()
            self.send_json(200, {"state": json.loads(row["state_json"]) if row else None, "revision": row["revision"] if row else 0, "csrf": item["csrf"]})
            return
        if path == "/ca.crt":
            ca_file = SSL_DIR / "root-ca.crt"
            if not ca_file.is_file():
                self.send_error(404)
                return
            raw = ca_file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/x-x509-ca-cert")
            self.send_header("Content-Disposition", 'attachment; filename="Gestione-CC-LAN-CA.crt"')
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Strict-Transport-Security", "max-age=31536000")
            self.end_headers()
            self.wfile.write(raw)
            return
        if path == "/api/export":
            item = self.require_auth()
            if not item: return
            with db() as c: row = c.execute("SELECT state_json FROM app_state WHERE id=1").fetchone()
            state = json.loads(row["state_json"]) if row else None
            payload = {"format":"conti-chiari-local-backup","version":1,"exportedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),"state":state}
            self.send_json(200, payload, {"Content-Disposition": 'attachment; filename="Conti-Chiari-backup.json"'})
            return
        if path == "/api/sqlite-backup":
            item = self.require_auth()
            if not item: return
            backup = create_sqlite_backup("manual")
            raw = backup.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.sqlite3")
            self.send_header("Content-Disposition", 'attachment; filename="Gestione-CC-database.sqlite3"')
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error":"Endpoint non trovato"}); return
        if path == "/index.html" and not self.session():
            self.send_response(303)
            self.send_header("Location", "/login")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/": path = "/index.html"
        candidate = (WWW / unquote(path.lstrip("/"))).resolve()
        if not str(candidate).startswith(str(WWW.resolve()) + os.sep) or not candidate.is_file():
            self.send_error(404); return
        data = candidate.read_bytes()
        mime = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8" ,".svg":"image/svg+xml",".json":"application/json"}.get(candidate.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Strict-Transport-Security", "max-age=31536000")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        self.end_headers(); self.wfile.write(data)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/sqlite-restore":
            item = self.require_auth(csrf=True)
            if not item: return
            raw = self.body()
            if len(raw) < 100 or not raw.startswith(b"SQLite format 3\x00"):
                self.send_json(400, {"error":"File SQLite non valido"}); return
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            temp = BACKUP_DIR / ("restore-" + secrets.token_hex(8) + ".sqlite3")
            temp.write_bytes(raw)
            try:
                check = sqlite3.connect("file:" + str(temp) + "?mode=ro", uri=True)
                integrity = check.execute("PRAGMA integrity_check").fetchone()[0]
                tables = {row[0] for row in check.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                row = check.execute("SELECT state_json FROM app_state WHERE id=1").fetchone() if "app_state" in tables else None
                if integrity != "ok" or not {"app_state", "users", "audit"}.issubset(tables): raise ValueError("Database danneggiato o non compatibile")
                if row and not valid_state(json.loads(row[0])): raise ValueError("Archivio contabile non valido")
                if not check.execute("SELECT 1 FROM users LIMIT 1").fetchone(): raise ValueError("Account amministratore assente")
                check.close()
                create_sqlite_backup("pre-restore")
                source = sqlite3.connect("file:" + str(temp) + "?mode=ro", uri=True)
                destination = sqlite3.connect(DB_PATH, timeout=30)
                source.backup(destination)
                destination.commit()
                destination.close()
                source.close()
                sessions.clear()
                self.send_json(200, {"ok":True}, {"Set-Cookie":"cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"})
            except Exception as error:
                self.send_json(400, {"error":str(error)})
            finally:
                try: temp.unlink()
                except OSError: pass
            return
        try: payload = json.loads(self.body() or b"{}")
        except Exception: self.send_json(400, {"error":"JSON non valido"}); return
        if path == "/api/login":
            pin = str(payload.get("pin", ""))
            peer = self.client_address[0]
            now = time.time()
            recent = [stamp for stamp in login_failures.get(peer, []) if now - stamp < LOGIN_WINDOW]
            login_failures[peer] = recent
            if len(recent) >= LOGIN_MAX:
                self.send_json(429, {"error":"Troppi tentativi. Riprova tra alcuni minuti."}); return
            username = verify_pin(pin) if valid_pin(pin) else None
            if not username:
                recent.append(now); login_failures[peer] = recent
                self.send_json(401, {"error":"PIN non corretto"}); return
            login_failures.pop(peer, None)
            token = secrets.token_urlsafe(32); csrf = secrets.token_urlsafe(24)
            sessions[token] = {"username":username,"csrf":csrf,"expires":time.time()+SESSION_SECONDS}
            self.send_json(200, {"ok":True,"csrf":csrf}, {"Set-Cookie":f"cc_session={token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age={SESSION_SECONDS}"})
            return
        if path == "/api/change-pin":
            item = self.require_auth(csrf=True)
            if not item: return
            current_pin = payload.get("current_pin", "")
            new_pin = payload.get("new_pin", "")
            if not valid_pin(current_pin) or not valid_pin(new_pin):
                self.send_json(400, {"error":"Il PIN deve contenere esattamente 6 cifre."}); return
            username = verify_pin(current_pin)
            if username != item["username"]:
                self.send_json(401, {"error":"PIN attuale non corretto."}); return
            salt = secrets.token_bytes(16)
            iterations = 600_000
            digest = hashlib.pbkdf2_hmac("sha256", new_pin.encode(), salt, iterations)
            with db() as c:
                c.execute("UPDATE users SET salt=?,password_hash=?,iterations=? WHERE username=?",
                          (salt, digest, iterations, item["username"]))
                c.execute("INSERT INTO audit(at,event) VALUES(datetime('now'),?)", ("admin_pin_changed",))
            self.send_json(200, {"ok":True})
            return
        if path == "/api/logout":
            item = self.require_auth(csrf=True)
            if not item: return
            sessions.pop(self.cookie_token(), None)
            self.send_json(200, {"ok":True}, {"Set-Cookie":"cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"})
            return
        if path == "/api/import":
            item = self.require_auth(csrf=True)
            if not item: return
            state = payload.get("state") if payload.get("format") == "conti-chiari-local-backup" else None
            if not valid_state(state):
                self.send_json(400, {"error":"Backup non valido: struttura, identificativi o importi non coerenti"}); return
            expected = payload.get("revision")
            maybe_auto_backup()
            with db() as c:
                c.execute("BEGIN IMMEDIATE")
                row = c.execute("SELECT revision FROM app_state WHERE id=1").fetchone()
                current = row["revision"] if row else 0
                if isinstance(expected, bool) or not isinstance(expected, int) or expected != current:
                    c.rollback()
                    self.send_json(409, {"error":"L'archivio è stato modificato da un altro dispositivo. Ricarica la pagina prima di riprovare."})
                    return
                revision = current + 1
                c.execute("INSERT INTO app_state(id,state_json,updated_at,revision) VALUES(1,?,datetime('now'),?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at, revision=excluded.revision", (json.dumps(state,ensure_ascii=False), revision))
                c.execute("INSERT INTO audit(at,event) VALUES(datetime('now'),?)", ("state_imported",))
            self.send_json(200, {"ok":True,"revision":revision,"accounts":len(state["accounts"]),"transactions":len(state["transactions"])})
            return
        if path == "/api/state":
            item = self.require_auth(csrf=True)
            if not item: return
            state = payload.get("state")
            if not valid_state(state):
                self.send_json(400, {"error":"Archivio non valido: struttura, identificativi o importi non coerenti"}); return
            expected = payload.get("revision")
            maybe_auto_backup()
            with db() as c:
                c.execute("BEGIN IMMEDIATE")
                row = c.execute("SELECT revision FROM app_state WHERE id=1").fetchone()
                current = row["revision"] if row else 0
                if isinstance(expected, bool) or not isinstance(expected, int) or expected != current:
                    c.rollback()
                    self.send_json(409, {"error":"L'archivio è stato modificato da un altro dispositivo. Ricarica la pagina prima di riprovare."})
                    return
                revision = current + 1
                c.execute("INSERT INTO app_state(id,state_json,updated_at,revision) VALUES(1,?,datetime('now'),?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at, revision=excluded.revision", (json.dumps(state,ensure_ascii=False), revision))
                c.execute("INSERT INTO audit(at,event) VALUES(datetime('now'),?)", ("state_saved",))
            self.send_json(200, {"ok":True,"revision":revision})
            return
        self.send_json(404, {"error":"Endpoint non trovato"})

    def do_OPTIONS(self):
        self.send_json(405, {"error":"Metodo non consentito"})

class LANOnlyHTTPServer(ThreadingHTTPServer):
    """Accept connections only from the configured home LAN subnet."""
    def __init__(self, server_address, RequestHandlerClass, allowed_network):
        self.allowed_network = allowed_network
        super().__init__(server_address, RequestHandlerClass)

    def verify_request(self, request, client_address):
        try:
            return ipaddress.ip_address(client_address[0]) in self.allowed_network
        except ValueError:
            return False


if __name__ == "__main__":
    init_db()
    cert_file = SSL_DIR / "server.crt"
    key_file = SSL_DIR / "server.key"
    if not cert_file.is_file() or not key_file.is_file():
        raise RuntimeError("Certificato HTTPS mancante: seguire docs/home-assistant-https.md")
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(certfile=str(cert_file), keyfile=str(key_file))
    options = read_options()
    try:
        allowed_network = ipaddress.ip_network(str(options.get("lan_network", "192.168.1.0/24")), strict=False)
    except ValueError as error:
        raise RuntimeError("lan_network non valida: usare una rete IPv4/IPv6 in formato CIDR.") from error
    httpd = LANOnlyHTTPServer(("0.0.0.0", 8443), Handler, allowed_network)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print("Gestione C/C HTTPS in ascolto sulla porta 8443")
    httpd.serve_forever()
