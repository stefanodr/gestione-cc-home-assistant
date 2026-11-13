import json
import os
import sqlite3
import sys
import tempfile
import unittest

TEMP_DATA = tempfile.TemporaryDirectory(prefix="gestione-cc-audit-test-")
os.environ["DATA_DIR"] = TEMP_DATA.name
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gestione_cc"))
import server


class TransactionAuditTests(unittest.TestCase):
    def setUp(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.execute(
            "CREATE TABLE transaction_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "at TEXT NOT NULL, transaction_id TEXT NOT NULL, event TEXT NOT NULL, changes_json TEXT NOT NULL)"
        )
        self.connection.execute("CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, event TEXT NOT NULL)")

    def tearDown(self):
        self.connection.close()

    def test_creation_is_recorded(self):
        server.record_transaction_changes(self.connection, None, {
            "transactions": [{"id": "tx-1", "amount": -12.5, "payee": "Test"}]
        })
        row = self.connection.execute("SELECT event,changes_json FROM transaction_audit").fetchone()
        self.assertEqual(row["event"], "created")
        self.assertEqual(json.loads(row["changes_json"])["_record"]["new"]["amount"], -12.5)

    def test_field_change_keeps_before_and_after_values(self):
        before = {"transactions": [{"id": "tx-1", "amount": -12.5, "payee": "Prima"}]}
        after = {"transactions": [{"id": "tx-1", "amount": -15.0, "payee": "Dopo"}]}
        server.record_transaction_changes(self.connection, before, after)
        row = self.connection.execute("SELECT event,changes_json FROM transaction_audit").fetchone()
        changes = json.loads(row["changes_json"])
        self.assertEqual(row["event"], "updated")
        self.assertEqual(changes["amount"], {"old": -12.5, "new": -15.0})
        self.assertEqual(changes["payee"], {"old": "Prima", "new": "Dopo"})

    def test_deletion_is_recorded(self):
        before = {"transactions": [{"id": "tx-1", "amount": -12.5}]}
        server.record_transaction_changes(self.connection, before, {"transactions": []})
        row = self.connection.execute("SELECT event,changes_json FROM transaction_audit").fetchone()
        self.assertEqual(row["event"], "deleted")
        self.assertIsNone(json.loads(row["changes_json"])["_record"]["new"])


if __name__ == "__main__":
    unittest.main()
