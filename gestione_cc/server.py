#!/usr/bin/env python3
"""Minimal authenticated LAN server and SQLite persistence for Gestione C/C."""
import base64
import hashlib
import ipaddress
import hmac
import json
import os
import math
import re
import secrets
import shutil
import sqlite3
import ssl
import subprocess
import tempfile
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
MAX_BODY = 512 * 1024 * 1024  # Large JSON restores may include base64-encoded document files.
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
        c.execute("CREATE TABLE IF NOT EXISTS transaction_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, transaction_id TEXT NOT NULL, event TEXT NOT NULL, changes_json TEXT NOT NULL)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_transaction_audit_tx ON transaction_audit(transaction_id,id DESC)")
        c.execute("CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_attachments_tx ON attachments(transaction_id,created_at)")
        c.execute("""CREATE TABLE IF NOT EXISTS document_index (attachment_id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'queued', category TEXT NOT NULL DEFAULT 'altro', extracted_text TEXT NOT NULL DEFAULT '', supplier TEXT, document_date TEXT, document_number TEXT, amount TEXT, fiscal_code TEXT, tax_code TEXT, updated_at TEXT NOT NULL, error TEXT)""")
        document_columns = {row["name"] for row in c.execute("PRAGMA table_info(document_index)")}
        reindex_documents = "document_number" not in document_columns
        if reindex_documents:
            c.execute("ALTER TABLE document_index ADD COLUMN document_number TEXT")
        for column in ("supplier_manual", "document_date_manual", "document_number_manual", "amount_manual"):
            if column not in document_columns:
                c.execute(f"ALTER TABLE document_index ADD COLUMN {column} INTEGER NOT NULL DEFAULT 0")
        c.execute("CREATE INDEX IF NOT EXISTS idx_document_category ON document_index(category,document_date)")
        try: c.execute("CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(attachment_id UNINDEXED, filename, category, extracted_text, supplier, document_date, amount, fiscal_code, tax_code)")
        except sqlite3.OperationalError: pass
        c.execute("CREATE TABLE IF NOT EXISTS background_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, result_json TEXT, error TEXT)")
        c.execute("UPDATE background_jobs SET status='queued', updated_at=datetime('now') WHERE status='running'")
        if reindex_documents:
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            for attachment in c.execute("SELECT id FROM attachments").fetchall():
                attachment_id = str(attachment["id"])
                c.execute("INSERT OR IGNORE INTO document_index(attachment_id,status,category,updated_at) VALUES(?,'queued','altro',?)", (attachment_id, now))
                c.execute("UPDATE document_index SET status='queued',error=NULL,updated_at=? WHERE attachment_id=?", (now, attachment_id))
                job_id = secrets.token_urlsafe(24)
                c.execute("INSERT INTO background_jobs(id,kind,status,created_at,updated_at,result_json) VALUES(?, 'document_ocr', 'queued', ?, ?, ?)",
                          (job_id, now, now, json.dumps({"attachment_id": attachment_id})))
        # Backfill attachments created by versions before the OCR index existed.
        for attachment in c.execute("SELECT a.id FROM attachments a LEFT JOIN document_index d ON d.attachment_id=a.id WHERE d.attachment_id IS NULL").fetchall():
            attachment_id = str(attachment["id"])
            c.execute("INSERT INTO document_index(attachment_id,status,category,updated_at) VALUES(?,'queued','altro',datetime('now'))", (attachment_id,))
            job_id = secrets.token_urlsafe(24)
            c.execute("INSERT INTO background_jobs(id,kind,status,created_at,updated_at,result_json) VALUES(?, 'document_ocr', 'queued', datetime('now'), datetime('now'), ?)",
                      (job_id, json.dumps({"attachment_id": attachment_id})))
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
BACKGROUND_JOBS_LOCK = __import__("threading").Lock()
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
            raise ValueError("Token non riconosciuto. Incolla esattamente il token restituito da rclone authorize.") from error
    if isinstance(parsed, dict) and isinstance(parsed.get("token"), dict):
        parsed = parsed["token"]
    if isinstance(parsed, dict):
        # Accept both standard OAuth JSON and rclone token field names.
        parsed = {
            "access_token": parsed.get("access_token") or parsed.get("AccessToken", ""),
            "refresh_token": parsed.get("refresh_token") or parsed.get("RefreshToken", ""),
            "token_type": parsed.get("token_type") or parsed.get("TokenType", "Bearer"),
            "expiry": parsed.get("expiry") or parsed.get("Expiry", ""),
        }
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

def ensure_transaction_feature_tables():
    """Migrate feature tables after restoring an older SQLite backup."""
    with db() as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS transaction_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, transaction_id TEXT NOT NULL, event TEXT NOT NULL, changes_json TEXT NOT NULL)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_transaction_audit_tx ON transaction_audit(transaction_id,id DESC)")
        connection.execute("CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_attachments_tx ON attachments(transaction_id,created_at)")
        connection.execute("""CREATE TABLE IF NOT EXISTS document_index (attachment_id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'queued', category TEXT NOT NULL DEFAULT 'altro', extracted_text TEXT NOT NULL DEFAULT '', supplier TEXT, document_date TEXT, document_number TEXT, amount TEXT, fiscal_code TEXT, tax_code TEXT, updated_at TEXT NOT NULL, error TEXT)""")
        document_columns = {row["name"] for row in connection.execute("PRAGMA table_info(document_index)")}
        reindex_documents = "document_number" not in document_columns
        if reindex_documents:
            connection.execute("ALTER TABLE document_index ADD COLUMN document_number TEXT")
        for column in ("supplier_manual", "document_date_manual", "document_number_manual", "amount_manual"):
            if column not in document_columns:
                connection.execute(f"ALTER TABLE document_index ADD COLUMN {column} INTEGER NOT NULL DEFAULT 0")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_document_category ON document_index(category,document_date)")
        connection.execute("CREATE TABLE IF NOT EXISTS background_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, result_json TEXT, error TEXT)")
        if reindex_documents:
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            for attachment in connection.execute("SELECT id FROM attachments").fetchall():
                attachment_id = str(attachment["id"])
                connection.execute("INSERT OR IGNORE INTO document_index(attachment_id,status,category,updated_at) VALUES(?,'queued','altro',?)", (attachment_id, now))
                connection.execute("UPDATE document_index SET status='queued',error=NULL,updated_at=? WHERE attachment_id=?", (now, attachment_id))
                job_id = secrets.token_urlsafe(24)
                connection.execute("INSERT INTO background_jobs(id,kind,status,created_at,updated_at,result_json) VALUES(?, 'document_ocr', 'queued', ?, ?, ?)",
                                   (job_id, now, now, json.dumps({"attachment_id": attachment_id})))
        try: connection.execute("CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(attachment_id UNINDEXED, filename, category, extracted_text, supplier, document_date, amount, fiscal_code, tax_code)")
        except sqlite3.OperationalError: pass



def valid_attachment_signature(mime, content):
    data = bytes(content or b"")
    return (
        (mime == "application/pdf" and data.startswith(b"%PDF-")) or
        (mime == "image/jpeg" and data.startswith(b"\xff\xd8\xff")) or
        (mime == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n"))
    )


def classify_document(text, filename=""):
    sample = (str(filename) + "\n" + str(text or "")[:12000]).lower()
    if re.search(r"\b(modello\s+)?f24\b|codice tributo|erario|inps|inail", sample): return "f24"
    if re.search(r"bollettino|conto corrente postale|ccp\b|pago", sample): return "bollettino"
    if re.search(r"fattura|documento commerciale|imponibile|iva\s+(?:22|10|4)\s*%", sample): return "fattura"
    return "altro"


def extract_document_metadata(text):
    value = str(text or "")
    lines = [re.sub(r"\s+", " ", line).strip(" |\t") for line in value.splitlines() if line.strip()]
    date_match = re.search(r"(?i)(?:data\s+(?:documento|fattura|emissione)|emesso\s+il|data\s+di\s+emissione)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})", value)
    if not date_match:
        date_match = re.search(r"\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b", value)
    number_pattern = r"(?i)(?:numero\s+fattura|n(?:umero)?\.?\s*fattura|fattura\s*(?:n(?:umero)?\.?|nr\.?|n[°º]|#)|nota\s+di\s+credito\s*(?:n(?:umero)?\.?|nr\.?|#)|numero\s+documento|n\.?\s*documento|documento\s*(?:n(?:umero)?\.?|nr\.?|#))\s*[:\-]?\s*([A-Z0-9][A-Z0-9./_-]{0,39})"
    number_match = re.search(number_pattern, value)
    fiscal_match = re.search(r"\b[A-Z]{6}[A-Z0-9]{2}[A-Z][A-Z0-9]{2}[A-Z][A-Z0-9]{3}[A-Z]\b", value.upper())
    tax_match = re.search(r"(?i)cod(?:ice)?\s*tributo\s*[:\-]?\s*([A-Z0-9]{3,6})", value)
    amount_pattern = r"(?i)(?:totale\s+(?:da\s+)?pagare|importo\s+totale|totale\s+(?:del\s+)?documento|totale\s+fattura|da\s+pagare)\s*[:\-]?\s*(?:€\s*)?([0-9][0-9. ]{0,14}(?:,[0-9]{2}|\.[0-9]{2}))"
    amount_match = re.search(amount_pattern, value)
    supplier = None
    supplier_labels = re.compile(r"(?i)^(?:cedente\s*/?\s*prestatore(?:\s*\([^)]*\))?|fornitore|emittente|ragione\s+sociale|mittente)\s*[:\-]?\s*(.*)$")
    for index, line in enumerate(lines[:35]):
        match = supplier_labels.match(line)
        if match:
            candidate = match.group(1).strip(" :-")
            if len(candidate) < 3 and index + 1 < len(lines):
                candidate = lines[index + 1]
            if candidate and not re.search(r"(?i)partita\s+iva|codice\s+fiscale|indirizzo|cap\b|telefono|email", candidate):
                supplier = candidate[:160]
                break
    if not supplier:
        excluded = re.compile(r"fattura|codice fiscale|partita iva|pagina|cliente|cod\.?\s*cliente|numero cliente|destinatario|intestatario|documento|data |numero |iban|telefono|email|\b(?:p\.?iva|c\.?f\.?)\b|totale|importo|indirizzo|cap\b", re.I)
        candidates = []
        for index, line in enumerate(lines[:25]):
            if len(line) < 4 or excluded.search(line) or re.fullmatch(r"[\d\s./:-]+", line):
                continue
            digits = sum(ch.isdigit() for ch in line)
            if digits / max(1, len(line)) > 0.25:
                continue
            score = 0
            if re.search(r"(?i)\b(s\.?r\.?l\.?|srl|s\.?p\.?a\.?|spa|s\.?a\.?s\.?|sas|s\.?n\.?c\.?|snc|societ[aà]|energia|servizi|assicurazioni|telecom|bank|banca)\b", line):
                score += 5
            if re.search(r"[A-ZÀ-Ü][a-zà-ÿ]{2,}", line):
                score += 2
            if index < 6:
                score += 2
            if len(line) <= 120:
                score += 1
            candidates.append((score, index, line))
        supplier = max(candidates, default=(0, 0, None), key=lambda item: (item[0], -item[1]))[2]
    return {"supplier":supplier[:160] if supplier else None,
            "document_date":date_match.group(1) if date_match else None,
            "document_number":number_match.group(1) if number_match else None,
            "amount":amount_match.group(1).strip() if amount_match else None,
            "fiscal_code":fiscal_match.group(0) if fiscal_match else None,
            "tax_code":tax_match.group(1).upper() if tax_match else None}

def process_document_ocr(attachment_id):
    with db() as connection:
        row=connection.execute("SELECT filename,mime,content FROM attachments WHERE id=?",(attachment_id,)).fetchone()
    if not row: return {"skipped":True}
    text=""
    with tempfile.TemporaryDirectory(prefix="gestione-cc-ocr-") as folder:
        source=Path(folder)/("documento"+Path(row["filename"]).suffix.lower())
        source.write_bytes(row["content"])
        if row["mime"]=="application/pdf":
            result=subprocess.run(["pdftotext","-layout",str(source),"-"],capture_output=True,text=True,timeout=60)
            text=result.stdout if result.returncode==0 else ""
            if len(re.sub(r"\s","",text))<80:
                page_count = 30
                page_match = None
                try:
                    info = subprocess.run(["pdfinfo",str(source)],capture_output=True,text=True,timeout=30,check=True).stdout
                    page_match = re.search(r"(?m)^Pages:\s+(\d+)",info)
                    if page_match: page_count = min(30,max(1,int(page_match.group(1))))
                except Exception:
                    pass
                prefix=str(Path(folder)/"pagina")
                subprocess.run(["pdftoppm","-f","1","-l",str(page_count),"-r","160","-png",str(source),prefix],capture_output=True,timeout=180,check=True)
                text="\n".join(subprocess.run(["tesseract",str(page),"stdout","-l","ita","--psm","3"],capture_output=True,text=True,timeout=120,check=True).stdout for page in sorted(Path(folder).glob("pagina-*.png")))
                if page_match and int(page_match.group(1))>30: text += "\n[OCR interrotto dopo le prime 30 pagine]";
        else:
            text=subprocess.run(["tesseract",str(source),"stdout","-l","ita","--psm","3"],capture_output=True,text=True,timeout=120,check=True).stdout
    text=text[:1000000]
    category=classify_document(text,row["filename"])
    metadata=extract_document_metadata(text)
    now=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
    with db() as connection:
        if not connection.execute("SELECT 1 FROM attachments WHERE id=?", (attachment_id,)).fetchone():
            return {"skipped": True, "reason": "attachment_deleted"}
        connection.execute("""INSERT INTO document_index(attachment_id,status,category,extracted_text,supplier,document_date,document_number,amount,fiscal_code,tax_code,updated_at,error)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL) ON CONFLICT(attachment_id) DO UPDATE SET status=excluded.status,category=excluded.category,
            extracted_text=excluded.extracted_text,
            supplier=CASE WHEN document_index.supplier_manual=1 THEN document_index.supplier ELSE excluded.supplier END,
            document_date=CASE WHEN document_index.document_date_manual=1 THEN document_index.document_date ELSE excluded.document_date END,
            document_number=CASE WHEN document_index.document_number_manual=1 THEN document_index.document_number ELSE excluded.document_number END,
            amount=CASE WHEN document_index.amount_manual=1 THEN document_index.amount ELSE excluded.amount END,
            fiscal_code=excluded.fiscal_code,tax_code=excluded.tax_code,updated_at=excluded.updated_at,error=NULL""",
            (attachment_id,"done",category,text,metadata["supplier"],metadata["document_date"],metadata["document_number"],metadata["amount"],metadata["fiscal_code"],metadata["tax_code"],now))
        try:
            connection.execute("DELETE FROM document_fts WHERE attachment_id=?",(attachment_id,))
            connection.execute("INSERT INTO document_fts(attachment_id,filename,category,extracted_text,supplier,document_date,amount,fiscal_code,tax_code) VALUES(?,?,?,?,?,?,?,?,?)",
                (attachment_id,row["filename"],category,text,metadata["supplier"] or "",metadata["document_date"] or "",metadata["amount"] or "",metadata["fiscal_code"] or "",metadata["tax_code"] or ""))
        except sqlite3.OperationalError: pass
    return {"status":"done","category":category}


def enqueue_document_ocr(attachment_id):
    # Keep the job id independent from the attachment id; the payload carries
    # the document reference without changing a primary key after insertion.
    job_id = secrets.token_urlsafe(24)
    payload = json.dumps({"attachment_id": attachment_id})
    with db() as connection:
        connection.execute(
            "INSERT INTO background_jobs(id,kind,status,created_at,updated_at,result_json) VALUES(?, 'document_ocr', 'queued', datetime('now'), datetime('now'), ?)",
            (job_id, payload)
        )
        connection.execute(
            "UPDATE document_index SET status='queued',error=NULL WHERE attachment_id=?",
            (attachment_id,)
        )
    return job_id

def record_transaction_changes(connection, old_state, new_state, event="updated"):
    """Persist a field-level, append-only history for transaction changes."""
    old_items = {str(x.get("id")): x for x in (old_state or {}).get("transactions", []) if isinstance(x, dict) and x.get("id")}
    new_items = {str(x.get("id")): x for x in (new_state or {}).get("transactions", []) if isinstance(x, dict) and x.get("id")}
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    count = 0
    for tx_id in sorted(set(old_items) | set(new_items)):
        before, after = old_items.get(tx_id), new_items.get(tx_id)
        if before is None:
            action, changes = "created", {"_record": {"old": None, "new": after}}
        elif after is None:
            action, changes = "deleted", {"_record": {"old": before, "new": None}}
        else:
            changes = {key: {"old": before.get(key), "new": after.get(key)}
                       for key in sorted(set(before) | set(after))
                       if before.get(key) != after.get(key)}
            if not changes:
                continue
            action = event
        connection.execute(
            "INSERT INTO transaction_audit(at,transaction_id,event,changes_json) VALUES(?,?,?,?)",
            (now, tx_id, action, json.dumps(changes, ensure_ascii=False, separators=(",", ":"))))
        count += 1


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

def enqueue_session_backup_job():
    job_id = secrets.token_urlsafe(24)
    with db() as connection:
        connection.execute(
            "INSERT INTO background_jobs(id,kind,status,created_at,updated_at) VALUES(?, 'drive_session_backup', 'queued', datetime('now'), datetime('now'))",
            (job_id,)
        )
    return job_id


def background_job_worker():
    # SQLite keeps queued work across browser closure and add-on restarts.
    while True:
        with BACKGROUND_JOBS_LOCK:
            with db() as connection:
                job = connection.execute(
                    "SELECT id,kind,result_json FROM background_jobs WHERE status='queued' ORDER BY created_at LIMIT 1"
                ).fetchone()
                if job:
                    connection.execute(
                        "UPDATE background_jobs SET status='running', updated_at=datetime('now') WHERE id=?",
                        (job["id"],)
                    )
        if not job:
            time.sleep(1)
            continue
        job_id = job["id"]
        payload = {}
        try:
            payload = json.loads(job["result_json"] or "{}") if job["kind"] == "document_ocr" else {}
            result = process_document_ocr(str(payload.get("attachment_id", ""))) if job["kind"] == "document_ocr" else drive_session_backup()
            with db() as connection:
                connection.execute(
                    "UPDATE background_jobs SET status='done', result_json=?, error=NULL, updated_at=datetime('now') WHERE id=?",
                    (json.dumps(result, ensure_ascii=False), job_id)
                )
            if job["kind"] == "drive_session_backup":
                cfg = drive_read_config()
                cfg["last_session_job"] = {"status": "done", "at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()), "result": result}
                drive_write_config(cfg)
        except Exception as error:
            message = str(error)[:500]
            print("GestioneCC: job " + str(job["kind"]) + " non riuscito: " + message)
            with db() as connection:
                connection.execute(
                    "UPDATE background_jobs SET status='failed', error=?, updated_at=datetime('now') WHERE id=?",
                    (message, job_id)
                )
            if job["kind"] == "document_ocr":
                attachment_id = str(payload.get("attachment_id", ""))
                with db() as connection:
                    connection.execute("UPDATE document_index SET status='failed',error=?,updated_at=datetime('now') WHERE attachment_id=?", (message, attachment_id))
            else:
                cfg = drive_read_config()
                cfg["last_session_job"] = {"status": "failed", "at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()), "error": message}
                drive_write_config(cfg)


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
        if path == "/api/transactions/audit":
            item = self.require_auth()
            if not item: return
            from urllib.parse import parse_qs
            query = parse_qs(urlparse(self.path).query)
            tx_id = str(query.get("transaction_id", [""])[0])[:160]
            with db() as connection:
                rows = connection.execute(
                    "SELECT id,at,event,changes_json FROM transaction_audit WHERE transaction_id=? ORDER BY id DESC LIMIT 200",
                    (tx_id,)).fetchall()
            self.send_json(200, {"items":[{"id":r["id"],"at":r["at"],"event":r["event"],"changes":json.loads(r["changes_json"])} for r in rows]})
            return
        if path == "/api/attachments/counts":
            item = self.require_auth()
            if not item: return
            with db() as connection:
                rows = connection.execute("SELECT transaction_id,COUNT(*) AS count FROM attachments GROUP BY transaction_id").fetchall()
            self.send_json(200, {"counts": {str(row["transaction_id"]): int(row["count"]) for row in rows}})
            return
        if path == "/api/attachments":
            item = self.require_auth()
            if not item: return
            from urllib.parse import parse_qs
            tx_id = str(parse_qs(urlparse(self.path).query).get("transaction_id", [""])[0])[:160]
            with db() as connection:
                rows = connection.execute(
                    "SELECT id,transaction_id,filename,mime,size,created_at FROM attachments WHERE transaction_id=? ORDER BY created_at,id",
                    (tx_id,)).fetchall()
            self.send_json(200, {"items":[dict(r) for r in rows]})
            return
        if path == "/api/documents/search":
            item = self.require_auth()
            if not item: return
            from urllib.parse import parse_qs
            query=parse_qs(urlparse(self.path).query)
            term=str(query.get("q",[""])[0]).strip()[:200]
            category=str(query.get("category",[""])[0])[:24]
            try: offset=max(0,min(1000000,int(query.get("offset",["0"])[0])))
            except (TypeError,ValueError): offset=0
            with db() as connection:
                base_sql=""" FROM attachments a LEFT JOIN document_index d ON d.attachment_id=a.id"""
                clauses=[]; params=[]
                if category in ("fattura","f24","bollettino","altro"): clauses.append("d.category=?"); params.append(category)
                if term:
                    clauses.append("(a.filename LIKE ? OR d.extracted_text LIKE ? OR d.supplier LIKE ? OR d.document_date LIKE ? OR d.document_number LIKE ? OR d.amount LIKE ? OR d.fiscal_code LIKE ? OR d.tax_code LIKE ?)")
                    params.extend(["%"+term+"%"]*8)
                where=(" WHERE "+" AND ".join(clauses)) if clauses else ""
                sql="""SELECT a.id,a.transaction_id,a.filename,a.mime,a.size,a.created_at,COALESCE(d.status,'queued') AS ocr_status,COALESCE(d.category,'altro') AS category,d.supplier,d.document_date,d.document_number,d.amount,d.fiscal_code,d.tax_code,substr(COALESCE(d.extracted_text,''),1,400) AS excerpt""" + base_sql + where + " ORDER BY a.created_at DESC LIMIT 100 OFFSET ?"
                rows=connection.execute(sql,params+[offset]).fetchall()
                count=connection.execute("SELECT COUNT(*)"+base_sql+where,params).fetchone()[0]
                total=connection.execute("SELECT COALESCE(SUM(size),0) FROM attachments").fetchone()[0]
            self.send_json(200,{"items":[dict(row) for row in rows],"total_count":int(count),"offset":offset,"page_size":100,"total_bytes":int(total),"warning":int(total)>=100*1024*1024})
            return
        if path == "/api/attachments/download":
            item = self.require_auth()
            if not item: return
            from urllib.parse import parse_qs
            attachment_id = str(parse_qs(urlparse(self.path).query).get("id", [""])[0])[:160]
            with db() as connection:
                row = connection.execute("SELECT filename,mime,size,content FROM attachments WHERE id=?", (attachment_id,)).fetchone()
            if not row:
                self.send_json(404, {"error":"Allegato non trovato"}); return
            filename = row["filename"].replace('"', '').replace("\\", "_").replace("\r", "").replace("\n", "")[:180]
            self.send_response(200)
            self.send_header("Content-Type", row["mime"])
            inline = parse_qs(urlparse(self.path).query).get("inline", ["0"])[0] == "1"
            disposition = "inline" if inline and row["mime"] in ("application/pdf", "image/jpeg", "image/png") else "attachment"
            self.send_header("Content-Disposition", disposition + "; filename*=UTF-8''" + __import__("urllib.parse", fromlist=["quote"]).quote(filename))
            self.send_header("Content-Length", str(row["size"]))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(row["content"])
            return
        if path == "/api/drive/session-backup/status":
            item = self.require_auth()
            if not item: return
            from urllib.parse import parse_qs
            job_id = parse_qs(urlparse(self.path).query).get("id", [""])[0]
            with db() as connection:
                row = connection.execute("SELECT status,result_json,error FROM background_jobs WHERE id=? AND kind='drive_session_backup'", (job_id,)).fetchone()
            job = ({"status": row["status"], "result": json.loads(row["result_json"]) if row["result_json"] else None, "error": row["error"]} if row else None)
            if not job:
                self.send_json(404, {"error": "Operazione di backup non trovata"})
                return
            self.send_json(200, job)
            return
        if path == "/api/drive/status":
            item = self.require_auth()
            if not item: return
            cfg = drive_read_config()
            connected = bool(cfg.get("token", {}).get("refresh_token"))
            try:
                backups = drive_list_backups() if connected else []
                self.send_json(200, {
                    "connected": connected,
                    "last_session_backup": cfg.get("last_session_backup"),
                    "last_nightly_backup": cfg.get("last_nightly_backup"),
                    "last_session_job": cfg.get("last_session_job"),
                    "backups": backups
                })
            except Exception as error:
                self.send_json(502, {"error": "Google Drive non raggiungibile: " + str(error)})
            return
        if path == "/api/drive/download":
            item = self.require_auth()
            if not item: return
            from urllib.parse import parse_qs
            file_id = parse_qs(urlparse(self.path).query).get("id", [""])[0]
            if not file_id:
                self.send_json(400, {"error":"Backup non specificato"}); return
            raw = drive_download_file(file_id)
            if len(raw) < 100 or not raw.startswith(b"SQLite format 3\x00"):
                self.send_json(400, {"error":"Il file selezionato non è un database SQLite valido"}); return
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.sqlite3")
            self.send_header("Content-Disposition", 'attachment; filename="Gestione-CC-backup-Google-Drive.sqlite3"')
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)
            return
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
            with db() as c:
                attachment_rows = c.execute("SELECT id,transaction_id,filename,mime,size,content,created_at FROM attachments ORDER BY id").fetchall()
            total = sum(int(row["size"]) for row in attachment_rows)
            attachments = [{"id":r["id"],"transaction_id":r["transaction_id"],"filename":r["filename"],"mime":r["mime"],"size":r["size"],"created_at":r["created_at"],"content":base64.b64encode(r["content"]).decode("ascii")} for r in attachment_rows]
            with db() as c:
                history_rows = c.execute("SELECT id,at,transaction_id,event,changes_json FROM transaction_audit ORDER BY id").fetchall()
                document_rows = c.execute("SELECT attachment_id,status,category,extracted_text,supplier,document_date,document_number,amount,fiscal_code,tax_code,updated_at,error,supplier_manual,document_date_manual,document_number_manual,amount_manual FROM document_index").fetchall()
            history = [{"id":r["id"],"at":r["at"],"transaction_id":r["transaction_id"],"event":r["event"],"changes":json.loads(r["changes_json"])} for r in history_rows]
            documents = [dict(r) for r in document_rows]
            payload = {"format":"conti-chiari-local-backup","version":4,"exportedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),"state":state,"attachments":attachments,"history":history,"documents":documents}
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
        payload = {}
        raw_body = None
        if path not in ("/api/sqlite-restore", "/api/attachments/upload"):
            try: payload = json.loads(self.body() or b"{}")
            except Exception:
                self.send_json(400, {"error":"JSON non valido"})
                return
        if path == "/api/attachments/upload":
            item = self.require_auth(csrf=True)
            if not item: return
            try:
                from email.parser import BytesParser
                from email.policy import default as email_policy
                raw = self.body()
                content_type = self.headers.get("Content-Type", "")
                if not content_type.lower().startswith("multipart/form-data;"):
                    raise ValueError("Formato upload non valido.")
                message = BytesParser(policy=email_policy).parsebytes(
                    b"Content-Type: " + content_type.encode("ascii", "strict") + b"\r\nMIME-Version: 1.0\r\n\r\n" + raw)
                fields = {}
                uploaded = None
                for part in message.iter_parts():
                    name = part.get_param("name", header="content-disposition")
                    data = part.get_payload(decode=True) or b""
                    if name == "file":
                        uploaded = (part.get_filename() or "allegato", part.get_content_type().lower(), data)
                    elif name:
                        fields[name] = data.decode("utf-8", "replace")
                tx_id = str(fields.get("transaction_id", ""))[:160]
                if not tx_id or not uploaded:
                    raise ValueError("Movimento o file non specificato.")
                filename, mime, content = uploaded
                if len(content) < 1 or len(content) > 5 * 1024 * 1024:
                    raise ValueError("Ogni allegato deve avere dimensione massima di 5 MB.")
                allowed = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}
                suffix = Path(filename).suffix.lower()
                valid_signature = valid_attachment_signature(mime, content)
                if (mime not in allowed or suffix not in {allowed[mime], ".jpeg" if mime == "image/jpeg" else allowed[mime]}
                    or not valid_signature):
                    raise ValueError("Sono consentiti soltanto file PDF, JPEG e PNG validi.")
                filename = Path(filename).name.replace("\\", "_").replace("\r", "").replace("\n", "")[:180]
                with db() as connection:
                    state_row = connection.execute("SELECT state_json FROM app_state WHERE id=1").fetchone()
                    tx_ids = {str(x.get("id")) for x in json.loads(state_row["state_json"]).get("transactions", [])} if state_row else set()
                    if tx_id not in tx_ids:
                        raise ValueError("Il movimento selezionato non esiste più.")
                    per_transaction = connection.execute("SELECT COALESCE(SUM(size),0) FROM attachments WHERE transaction_id=?", (tx_id,)).fetchone()[0]
                    if int(per_transaction) + len(content) > 15 * 1024 * 1024:
                        raise ValueError("Gli allegati di questa registrazione non possono superare complessivamente 15 MB.")
                    total = connection.execute("SELECT COALESCE(SUM(size),0) FROM attachments").fetchone()[0]
                    attachment_id = secrets.token_urlsafe(18)
                    connection.execute(
                        "INSERT INTO attachments(id,transaction_id,filename,mime,size,content,created_at) VALUES(?,?,?,?,?,?,?)",
                        (attachment_id, tx_id, filename, mime, len(content), sqlite3.Binary(content), time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())))
                    connection.execute("INSERT INTO document_index(attachment_id,status,category,updated_at) VALUES(?,'queued','altro',?)", (attachment_id,time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())))
                    connection.execute("INSERT INTO transaction_audit(at,transaction_id,event,changes_json) VALUES(?,?,?,?)",
                        (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), tx_id, "attachment_added",
                         json.dumps({"attachment": {"old": None, "new": {"id": attachment_id, "filename": filename, "size": len(content)}}}, ensure_ascii=False)))
                    connection.execute("INSERT INTO audit(at,event) VALUES(datetime('now'),?)", ("transaction_attachment_added:" + tx_id,))
                enqueue_document_ocr(attachment_id)
                total_after=int(total)+len(content)
                self.send_json(201, {"ok":True,"id":attachment_id,"filename":filename,"size":len(content),"ocr_status":"queued","storage_warning":total_after>=100*1024*1024,"total_bytes":total_after})
            except Exception as error:
                self.send_json(400, {"error":str(error)})
            return
        if path == "/api/documents/update":
            item = self.require_auth(csrf=True)
            if not item: return
            attachment_id = str(payload.get("id", ""))[:160]
            category = str(payload.get("category", "altro"))
            if category not in ("fattura", "f24", "bollettino", "altro"):
                self.send_json(400, {"error":"Categoria documento non valida."}); return
            with db() as connection:
                row = connection.execute("SELECT a.transaction_id,a.filename,d.extracted_text,d.supplier,d.document_date,d.amount,d.fiscal_code,d.tax_code FROM attachments a LEFT JOIN document_index d ON d.attachment_id=a.id WHERE a.id=?", (attachment_id,)).fetchone()
                if not row:
                    self.send_json(404, {"error":"Documento non trovato."}); return
                connection.execute("UPDATE document_index SET category=?,updated_at=? WHERE attachment_id=?", (category,time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),attachment_id))
                try:
                    connection.execute("DELETE FROM document_fts WHERE attachment_id=?", (attachment_id,))
                    connection.execute("INSERT INTO document_fts(attachment_id,filename,category,extracted_text,supplier,document_date,amount,fiscal_code,tax_code) VALUES(?,?,?,?,?,?,?,?,?)", (attachment_id,row["filename"],category,row["extracted_text"] or "",row["supplier"] or "",row["document_date"] or "",row["amount"] or "",row["fiscal_code"] or "",row["tax_code"] or ""))
                except sqlite3.OperationalError: pass
                connection.execute("INSERT INTO transaction_audit(at,transaction_id,event,changes_json) VALUES(?,?,?,?)", (time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),row["transaction_id"],"attachment_category_changed",json.dumps({"attachment":{"id":attachment_id,"filename":row["filename"],"category":category}},ensure_ascii=False)))
            self.send_json(200, {"ok":True})
            return
        if path == "/api/documents/metadata":
            item = self.require_auth(csrf=True)
            if not item: return
            attachment_id = str(payload.get("id", ""))[:160]
            fields = {
                "supplier": (str(payload.get("supplier", "")).strip()[:160] or None, "supplier_manual"),
                "amount": (str(payload.get("amount", "")).strip()[:40] or None, "amount_manual"),
                "document_date": (str(payload.get("document_date", "")).strip()[:32] or None, "document_date_manual"),
                "document_number": (str(payload.get("document_number", "")).strip()[:80] or None, "document_number_manual"),
            }
            date_value = fields["document_date"][0]
            amount_value = fields["amount"][0]
            if date_value and not re.fullmatch(r"(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})", date_value):
                self.send_json(400, {"error":"Formato data non valido. Usa GG/MM/AAAA oppure AAAA-MM-GG."}); return
            if amount_value and not re.fullmatch(r"-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:[,.]\d{1,2})?", amount_value):
                self.send_json(400, {"error":"Importo non valido. Usa ad esempio 1.234,56."}); return
            with db() as connection:
                row = connection.execute("SELECT transaction_id,filename FROM attachments WHERE id=?", (attachment_id,)).fetchone()
                if not row:
                    self.send_json(404, {"error":"Documento non trovato."}); return
                assignments = ["supplier=?", "amount=?", "document_date=?", "document_number=?",
                    "supplier_manual=1", "amount_manual=1", "document_date_manual=1", "document_number_manual=1", "updated_at=?"]
                values = [fields["supplier"][0], fields["amount"][0], fields["document_date"][0], fields["document_number"][0], time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), attachment_id]
                connection.execute("UPDATE document_index SET " + ",".join(assignments) + " WHERE attachment_id=?", values)
                connection.execute("INSERT INTO transaction_audit(at,transaction_id,event,changes_json) VALUES(?,?,?,?)",
                    (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), row["transaction_id"], "attachment_metadata_corrected",
                     json.dumps({"attachment_id":attachment_id,"filename":row["filename"],"fields":{k:v[0] for k,v in fields.items()}}, ensure_ascii=False)))
            self.send_json(200, {"ok":True})
            return
        if path == "/api/attachments/delete":
            item = self.require_auth(csrf=True)
            if not item: return
            attachment_id = str(payload.get("id", ""))[:160]
            with db() as connection:
                row = connection.execute("SELECT transaction_id,filename,size FROM attachments WHERE id=?", (attachment_id,)).fetchone()
                if not row:
                    self.send_json(404, {"error":"Allegato non trovato"}); return
                connection.execute("DELETE FROM attachments WHERE id=?", (attachment_id,))
                connection.execute("DELETE FROM document_index WHERE attachment_id=?", (attachment_id,))
                try: connection.execute("DELETE FROM document_fts WHERE attachment_id=?", (attachment_id,))
                except sqlite3.OperationalError: pass
                connection.execute("INSERT INTO transaction_audit(at,transaction_id,event,changes_json) VALUES(?,?,?,?)",
                    (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), row["transaction_id"], "attachment_deleted",
                     json.dumps({"attachment": {"old": {"id": attachment_id, "filename": row["filename"], "size": row["size"]}, "new": None}}, ensure_ascii=False)))
                connection.execute("INSERT INTO audit(at,event) VALUES(datetime('now'),?)", ("transaction_attachment_deleted:" + row["transaction_id"],))
            self.send_json(200, {"ok":True})
            return
        if path == "/api/drive/connect":
            item = self.require_auth(csrf=True)
            if not item: return
            try:
                client_id = str(payload.get("client_id", "")).strip()
                client_secret = str(payload.get("client_secret", "")).strip()
                token = drive_parse_token(payload.get("token"))
                if not client_id.endswith(".apps.googleusercontent.com") or not client_secret:
                    raise ValueError("Client ID o Client Secret non validi.")
                previous_config = drive_read_config()
                drive_write_config({"client_id": client_id, "client_secret": client_secret, "token": token})
                try:
                    # Validate the grant and create the dedicated folder immediately.
                    drive_access_token(force_refresh=True)
                    drive_ensure_folder()
                except Exception:
                    if previous_config:
                        drive_write_config(previous_config)
                    elif DRIVE_CONFIG.exists():
                        DRIVE_CONFIG.unlink()
                    raise
                self.send_json(200, {"ok": True})
            except Exception as error:
                self.send_json(400, {"error": str(error)})
            return
        if path == "/api/drive/disconnect":
            item = self.require_auth(csrf=True)
            if not item: return
            try:
                if DRIVE_CONFIG.exists(): DRIVE_CONFIG.unlink()
                self.send_json(200, {"ok": True})
            except Exception as error:
                self.send_json(500, {"error": "Impossibile rimuovere la configurazione Google Drive: " + str(error)})
            return
        if path == "/api/drive/backup":
            item = self.require_auth(csrf=True)
            if not item: return
            try:
                result = drive_session_backup(force=True)
                self.send_json(200, result)
            except Exception as error:
                self.send_json(502, {"error": "Backup su Google Drive non riuscito: " + str(error)})
            return
        if path == "/api/drive/session-backup/start":
            item = self.require_auth(csrf=True)
            if not item: return
            job_id = enqueue_session_backup_job()
            self.send_json(202, {"ok": True, "job_id": job_id})
            return
        if path == "/api/drive/session-backup":
            item = self.require_auth(csrf=True)
            if not item: return
            try:
                result = drive_session_backup()
                self.send_json(200, result)
            except Exception as error:
                print("GestioneCC: backup di chiusura non riuscito: " + str(error))
                self.send_json(502, {"error": "Backup di chiusura non riuscito: " + str(error)})
            return
        if path == "/api/drive/restore":
            item = self.require_auth(csrf=True)
            if not item: return
            temp = None
            try:
                file_id = str(payload.get("file_id", ""))
                if not file_id: raise ValueError("Backup non specificato.")
                raw = drive_download_file(file_id)
                if len(raw) < 100 or not raw.startswith(b"SQLite format 3\x00"):
                    raise ValueError("Il file selezionato non è un database SQLite valido.")
                temp = BACKUP_DIR / ("drive-restore-" + secrets.token_hex(8) + ".sqlite3")
                BACKUP_DIR.mkdir(parents=True, exist_ok=True)
                temp.write_bytes(raw)
                check = sqlite3.connect("file:" + str(temp) + "?mode=ro", uri=True)
                try:
                    integrity = check.execute("PRAGMA integrity_check").fetchone()[0]
                    tables = {row[0] for row in check.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                    row = check.execute("SELECT state_json FROM app_state WHERE id=1").fetchone() if "app_state" in tables else None
                    if integrity != "ok" or not {"app_state", "users", "audit"}.issubset(tables):
                        raise ValueError("Database danneggiato o non compatibile.")
                    if row and not valid_state(json.loads(row[0])):
                        raise ValueError("Archivio contabile non valido.")
                    if not check.execute("SELECT 1 FROM users LIMIT 1").fetchone():
                        raise ValueError("Account amministratore assente.")
                finally:
                    check.close()
                create_sqlite_backup("pre-drive-restore")
                source = sqlite3.connect("file:" + str(temp) + "?mode=ro", uri=True)
                destination = sqlite3.connect(DB_PATH, timeout=30)
                try:
                    source.backup(destination)
                    destination.commit()
                finally:
                    destination.close()
                    source.close()
                ensure_transaction_feature_tables()
                sessions.clear()
                drive_cfg = drive_read_config()
                if drive_cfg.get("token"):
                    drive_cfg["last_session_revision"] = -1
                    drive_write_config(drive_cfg)
                self.send_json(200, {"ok": True}, {"Set-Cookie":"cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"})
            except Exception as error:
                self.send_json(400, {"error": "Ripristino Google Drive non riuscito: " + str(error)})
            finally:
                if temp is not None:
                    try: temp.unlink()
                    except Exception: pass
            return
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
                ensure_transaction_feature_tables()
                sessions.clear()
                drive_cfg = drive_read_config()
                if drive_cfg.get("token"):
                    drive_cfg["last_session_revision"] = -1
                    drive_write_config(drive_cfg)
                self.send_json(200, {"ok":True}, {"Set-Cookie":"cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"})
            except Exception as error:
                self.send_json(400, {"error":str(error)})
            finally:
                try: temp.unlink()
                except OSError: pass
            return
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
            try:
                job_id = enqueue_session_backup_job()
            except Exception as error:
                self.send_json(500, {"error":"Impossibile accodare il backup; la sessione resta aperta: " + str(error)})
                return
            sessions.pop(self.cookie_token(), None)
            self.send_json(202, {"ok":True,"job_id":job_id,"backup_status":"queued"},
                           {"Set-Cookie":"cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"})
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
                old_row = c.execute("SELECT state_json FROM app_state WHERE id=1").fetchone()
                old_state = json.loads(old_row["state_json"]) if old_row else None
                record_transaction_changes(c, old_state, state, "imported")
                c.execute("INSERT INTO app_state(id,state_json,updated_at,revision) VALUES(1,?,datetime('now'),?) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at, revision=excluded.revision", (json.dumps(state,ensure_ascii=False), revision))
                attachment_payload = payload.get("attachments", [])
                if not isinstance(attachment_payload, list) or len(attachment_payload) > 10000:
                    raise ValueError("Elenco allegati nel backup non valido.")
                history_payload = payload.get("history", [])
                if not isinstance(history_payload, list) or len(history_payload) > 1000000:
                    raise ValueError("Storico nel backup non valido.")
                documents_payload = payload.get("documents", [])
                if not isinstance(documents_payload, list) or len(documents_payload) > 10000:
                    raise ValueError("Indice documenti nel backup non valido.")
                c.execute("DELETE FROM transaction_audit")
                for entry in history_payload:
                    if not isinstance(entry, dict) or not entry.get("transaction_id") or not entry.get("at") or not entry.get("event") or not isinstance(entry.get("changes"), dict):
                        raise ValueError("Evento storico nel backup non valido.")
                    c.execute("INSERT INTO transaction_audit(at,transaction_id,event,changes_json) VALUES(?,?,?,?)",
                        (str(entry["at"]),str(entry["transaction_id"]),str(entry["event"]),json.dumps(entry["changes"],ensure_ascii=False,separators=(",",":"))))
                c.execute("DELETE FROM attachments")
                c.execute("DELETE FROM document_index")
                try: c.execute("DELETE FROM document_fts")
                except sqlite3.OperationalError: pass
                restored = 0
                seen_attachment_ids = set()
                for attachment in attachment_payload:
                    if not isinstance(attachment, dict): raise ValueError("Allegato nel backup non valido.")
                    data = base64.b64decode(str(attachment.get("content", "")), validate=True)
                    mime = str(attachment.get("mime", ""))
                    attachment_id = str(attachment.get("id", ""))
                    tx_id = str(attachment.get("transaction_id", ""))
                    filename = Path(str(attachment.get("filename", "allegato"))).name[:180]
                    valid_signature = valid_attachment_signature(mime, data)
                    if (mime not in ("application/pdf", "image/jpeg", "image/png") or
                        not valid_signature or len(data) < 1 or len(data) > 10 * 1024 * 1024 or
                        not attachment_id or attachment_id in seen_attachment_ids or not tx_id):
                        raise ValueError("Allegato nel backup non valido.")
                    seen_attachment_ids.add(attachment_id)
                    restored += len(data)
                    c.execute("INSERT INTO attachments(id,transaction_id,filename,mime,size,content,created_at) VALUES(?,?,?,?,?,?,?)",
                        (attachment_id,tx_id,filename,mime,len(data),sqlite3.Binary(data),str(attachment.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))))
                for document in documents_payload:
                    if not isinstance(document,dict) or str(document.get("attachment_id","")) not in seen_attachment_ids: raise ValueError("Metadati OCR non validi.")
                    attachment_id=str(document["attachment_id"]); category=str(document.get("category","altro"))
                    if category not in ("fattura","f24","bollettino","altro"): category="altro"
                    extracted=str(document.get("extracted_text",""))[:1000000]
                    c.execute("INSERT INTO document_index(attachment_id,status,category,extracted_text,supplier,document_date,document_number,amount,fiscal_code,tax_code,updated_at,error,supplier_manual,document_date_manual,document_number_manual,amount_manual) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (attachment_id,str(document.get("status","done")),category,extracted,document.get("supplier"),document.get("document_date"),document.get("document_number"),document.get("amount"),document.get("fiscal_code"),document.get("tax_code"),str(document.get("updated_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),document.get("error"),int(bool(document.get("supplier_manual",0))),int(bool(document.get("document_date_manual",0))),int(bool(document.get("document_number_manual",0))),int(bool(document.get("amount_manual",0)))))
                    arow=c.execute("SELECT filename FROM attachments WHERE id=?",(attachment_id,)).fetchone()
                    try: c.execute("INSERT INTO document_fts(attachment_id,filename,category,extracted_text,supplier,document_date,amount,fiscal_code,tax_code) VALUES(?,?,?,?,?,?,?,?,?)",(attachment_id,arow["filename"],category,extracted,document.get("supplier") or "",document.get("document_date") or "",document.get("amount") or "",document.get("fiscal_code") or "",document.get("tax_code") or ""))
                    except sqlite3.OperationalError: pass
                # Older JSON backups have attachments but no OCR index; queue them for local processing.
                indexed_ids = {str(row["attachment_id"]) for row in c.execute("SELECT attachment_id FROM document_index").fetchall()}
                for attachment_id in seen_attachment_ids - indexed_ids:
                    c.execute("INSERT INTO document_index(attachment_id,status,category,updated_at) VALUES(?,'queued','altro',datetime('now'))", (attachment_id,))
                    job_id = secrets.token_urlsafe(24)
                    c.execute("INSERT INTO background_jobs(id,kind,status,created_at,updated_at,result_json) VALUES(?, 'document_ocr', 'queued', datetime('now'), datetime('now'), ?)",
                              (job_id, json.dumps({"attachment_id": attachment_id})))
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
                old_row = c.execute("SELECT state_json FROM app_state WHERE id=1").fetchone()
                old_state = json.loads(old_row["state_json"]) if old_row else None
                record_transaction_changes(c, old_state, state, "updated")
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
    __import__("threading").Thread(target=drive_backup_scheduler, daemon=True, name="drive-backup-scheduler").start()
    __import__("threading").Thread(target=background_job_worker, daemon=True, name="background-job-worker").start()
    httpd = LANOnlyHTTPServer(("0.0.0.0", 8443), Handler, allowed_network)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print("Gestione C/C HTTPS in ascolto sulla porta 8443")
    httpd.serve_forever()
