#!/usr/bin/env python3
"""Minimal authenticated LAN server and SQLite persistence for Gestione C/C."""
import base64
import hashlib
import hmac
import json
import os
import math
import secrets
import sqlite3
import ssl
import time
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
        if path == "/api/state":
            item = self.require_auth()
            if not item: return
            with db() as c: row = c.execute("SELECT state_json,revision FROM app_state WHERE id=1").fetchone()
            self.send_json(200, {"state": json.loads(row["state_json"]) if row else None, "revision": row["revision"] if row else 0})
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

if __name__ == "__main__":
    init_db()
    cert_file = SSL_DIR / "server.crt"
    key_file = SSL_DIR / "server.key"
    if not cert_file.is_file() or not key_file.is_file():
        raise RuntimeError("Certificato HTTPS mancante: seguire docs/home-assistant-https.md")
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(certfile=str(cert_file), keyfile=str(key_file))
    httpd = ThreadingHTTPServer(("0.0.0.0", 8443), Handler)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print("Gestione C/C HTTPS in ascolto sulla porta 8443")
    httpd.serve_forever()
