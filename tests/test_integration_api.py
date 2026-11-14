import ast
import hashlib
import ipaddress
import os
import shutil
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch


SERVER = Path(__file__).resolve().parents[1] / "gestione_cc" / "server.py"
TREE = ast.parse(SERVER.read_text(encoding="utf-8"))
TARGETS = {"integration_token_digest", "integration_setting", "integration_job_counts", "integration_status", "access_db", "record_access_event", "cleanup_access_log"}
NAMESPACE = {
    "hashlib": hashlib,
    "sqlite3": sqlite3,
    "ACCESS_LOG_RETENTION_SECONDS": 30 * 24 * 60 * 60,
    "ipaddress": ipaddress,
    "os": os,
    "time": time,
    "Path": Path,
    "shutil": shutil,
}
for node in TREE.body:
    if isinstance(node, ast.FunctionDef) and node.name in TARGETS:
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(SERVER), "exec"), NAMESPACE)


class IntegrationApiDtoTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db_path = self.root / "test.sqlite3"
        self.access_log_path = self.root / "access_log.sqlite3"
        self.backup_dir = self.root / "backups"
        self.www_dir = self.root / "www"
        self.backup_dir.mkdir()
        self.www_dir.mkdir()
        (self.www_dir / "app.js").write_text("const APP_VERSION = '1.7.14';\\nconst ADDON_VERSION = '1.0.43';", encoding="utf-8")
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.executescript("""
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE app_state (id INTEGER PRIMARY KEY, updated_at TEXT);
            INSERT INTO app_state VALUES (1, '2026-11-14T18:00:00Z');
            CREATE TABLE background_jobs (id TEXT, kind TEXT, status TEXT);
            CREATE TABLE attachments (id TEXT, filename TEXT, size INTEGER, content BLOB);
            INSERT INTO background_jobs VALUES ('secret-job-id', 'document_ocr', 'queued');
            INSERT INTO background_jobs VALUES ('secret-job-id-2', 'document_ocr', 'failed');
            INSERT INTO background_jobs VALUES ('secret-drive-job', 'drive_session_backup', 'done');
            INSERT INTO background_jobs VALUES ('unrelated-job', 'internal_task', 'failed');
            INSERT INTO attachments VALUES ('secret-document-id', 'estratto-conto.pdf', 1234, X'0102');
        """)
        connection.commit()
        connection.close()

        def open_db():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn

        NAMESPACE.update({
            "db": open_db,
            "DB_PATH": self.db_path,
            "ACCESS_LOG_DB_PATH": self.access_log_path,
            "BACKUP_DIR": self.backup_dir,
            "DATA": self.root,
            "WWW": self.www_dir,
            "SERVER_STARTED_AT": time.time() - 15,
            "drive_read_config": lambda: {
                "token": {"refresh_token": "private-refresh-token"},
                "last_nightly_backup": "2026-11-14 03:00:00",
            },
        })

    def tearDown(self):
        self.temp.cleanup()

    def test_token_digest_is_one_way_sha256(self):
        digest = NAMESPACE["integration_token_digest"]("test-secret-token")
        self.assertEqual(digest, hashlib.sha256(b"test-secret-token").hexdigest())
        self.assertNotEqual(digest, "test-secret-token")

    def test_health_dto_has_only_technical_fields(self):
        result = NAMESPACE["integration_status"]("/api/integration/v1/health")
        self.assertEqual(set(result), {"available", "app_version", "addon_version", "uptime_seconds"})
        self.assertTrue(result["available"])
        self.assertEqual(result["app_version"], "1.7.14")
        self.assertEqual(result["addon_version"], "1.0.43")
        self.assertGreaterEqual(result["uptime_seconds"], 0)

    def test_database_dto_does_not_return_paths_or_accounting_data(self):
        result = NAMESPACE["integration_status"]("/api/integration/v1/database/status")
        self.assertEqual(set(result), {"exists", "size_bytes", "last_write_at", "last_check_at", "last_check_ok"})
        self.assertNotIn("path", result)
        self.assertNotIn("filename", result)

    def test_backup_dto_does_not_return_names_ids_or_file_paths(self):
        (self.backup_dir / "private-backup-name.sqlite3").write_bytes(b"sqlite-test")
        result = NAMESPACE["integration_status"]("/api/integration/v1/backups/status")
        self.assertEqual(set(result), {"local_count", "local_last_at", "drive_connected", "drive_last_at"})
        serialized = str(result)
        self.assertNotIn("private-backup-name", serialized)
        self.assertNotIn("refresh-token", serialized)

    def test_documents_dto_is_aggregate_only(self):
        result = NAMESPACE["integration_status"]("/api/integration/v1/documents/status")
        self.assertEqual(set(result), {"count", "bytes"})
        self.assertEqual(result, {"count": 1, "bytes": 1234})

    def test_jobs_dto_contains_only_aggregate_counts(self):
        result = NAMESPACE["integration_status"]("/api/integration/v1/jobs/status")
        self.assertEqual(set(result), {"queued", "running", "done", "failed"})
        self.assertEqual(result, {"queued": 1, "running": 0, "done": 1, "failed": 1})
        self.assertNotIn("secret-job-id", str(result))
        self.assertNotIn("unrelated-job", str(result))

    def test_unknown_status_endpoint_returns_no_payload(self):
        self.assertIsNone(NAMESPACE["integration_status"]("/api/integration/v1/private/export"))

    def test_security_log_is_not_in_accounting_database(self):
        connection = sqlite3.connect(self.db_path)
        row = connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='access_log'").fetchone()
        connection.close()
        self.assertIsNone(row)

    def test_access_log_stores_ip_and_pseudonymous_session_reference(self):
        raw_session = "private-session-cookie-value"
        NAMESPACE["record_access_event"]("login", "success", "192.168.1.42", raw_session)
        connection = NAMESPACE["access_db"]()
        row = connection.execute("SELECT event,outcome,session_ref,ip_address FROM access_log").fetchone()
        connection.close()
        self.assertEqual(row[0:2], ("login", "success"))
        self.assertEqual(row[2], hashlib.sha256(raw_session.encode()).hexdigest()[:20])
        self.assertEqual(row[3], "192.168.1.42")
        self.assertNotIn(raw_session, str(row))

    def test_access_log_retention_removes_records_older_than_30_days(self):
        old = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 31 * 86400))
        recent = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        connection = NAMESPACE["access_db"]()
        connection.execute("INSERT INTO access_log(at,event,outcome,ip_address) VALUES(?,?,?,?)", (old, "login", "failed", "192.168.1.10"))
        connection.execute("INSERT INTO access_log(at,event,outcome,ip_address) VALUES(?,?,?,?)", (recent, "login", "success", "192.168.1.10"))
        connection.commit()
        connection.close()
        NAMESPACE["cleanup_access_log"]()
        connection = NAMESPACE["access_db"]()
        rows = connection.execute("SELECT at FROM access_log").fetchall()
        connection.close()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], recent)


if __name__ == "__main__":
    unittest.main()
