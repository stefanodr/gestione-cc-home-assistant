import ast
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "gestione_cc" / "server.py"
WWW = ROOT / "gestione_cc" / "www"


class MobileReadOnlyStructureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = SERVER.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.server)
        projection = next(node for node in cls.tree.body
                          if isinstance(node, ast.FunctionDef) and node.name == "mobile_readonly_projection")
        cls.project = {}
        exec(compile(ast.Module(body=[projection], type_ignores=[]), str(SERVER), "exec"), cls.project)

    def test_server_python_syntax_is_valid(self):
        self.assertIsInstance(self.tree, ast.Module)

    def test_mobile_and_admin_sessions_use_separate_cookies(self):
        self.assertIn('cookie_name = "cc_mobile_session" if request_path.startswith("/mobile") or request_path.startswith("/api/mobile/") else "cc_session"', self.server)
        self.assertIn('if role == "readonly":', self.server)
        self.assertIn('cookie_headers = [', self.server)
        self.assertIn('self.cookie_token("cc_mobile_session")', self.server)
        self.assertIn('cc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0', self.server)
        self.assertIn('cc_mobile_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0', self.server)
        self.assertIn('isinstance(v, (list, tuple))', self.server)

    def test_mobile_session_is_read_only_for_all_other_post_routes(self):
        self.assertIn('active_session.get("role") == "readonly" and path not in {"/api/mobile/login", "/api/mobile/logout"}', self.server)
        self.assertIn('urlparse(self.path).path != "/api/mobile/logout"', self.server)
        self.assertIn('if item.get("role") != "readonly":', self.server)

    def test_mobile_state_endpoint_requires_readonly_role_and_projects_fields(self):
        self.assertIn('if path == "/api/mobile/state":', self.server)
        self.assertIn('"state": mobile_readonly_projection(full_state)', self.server)

    def test_projection_excludes_private_and_administrative_data(self):
        source = {
            "accounts": [{"id": "bank", "name": "Conto", "path": "Attività correnti:Banca",
                          "type": "BANK", "classification": "Patrimoniale", "secret": "do-not-send"}],
            "transactions": [{"id": "private-id", "date": "2026-01-02", "amount": -10,
                              "bankAccountId": "bank", "counterpartAccountId": "food",
                              "description": "Spesa", "status": "confirmed", "source": "private-source",
                              "attachmentIds": ["private-file"], "counterpartSplits": [
                                  {"accountId": "food", "value": -10, "private": "omit"}]}],
            "bankAccountId": "bank", "openingBalance": 100, "reportAccountId": "all",
            "settings": {"pin": "123456"}, "attachments": [{"content": "secret"}],
            "recurringRules": [{"id": "private-rule"}], "users": [{"username": "admin"}]
        }
        result = self.project["mobile_readonly_projection"](source)
        self.assertEqual(result["accounts"][0]["id"], "bank")
        self.assertNotIn("secret", result["accounts"][0])
        self.assertEqual(result["transactions"][0]["counterpartSplits"], [{"accountId": "food", "value": -10}])
        for key in ("settings", "attachments", "recurringRules", "users"):
            self.assertNotIn(key, result)
        self.assertNotIn("id", result["transactions"][0])
        self.assertNotIn("source", result["transactions"][0])

    def test_mobile_projection_handles_empty_or_invalid_state(self):
        self.assertIsNone(self.project["mobile_readonly_projection"](None))
        self.assertEqual(self.project["mobile_readonly_projection"]({})["transactions"], [])

    def test_mobile_pages_and_assets_are_session_protected(self):
        self.assertIn('if path == "/mobile":', self.server)
        self.assertIn('if path in ("/mobile.html", "/mobile.js", "/mobile.css", "/mobile.webmanifest"):', self.server)
        for filename in ("mobile.html", "mobile.js", "mobile.css", "mobile.webmanifest",
                         "mobile-login.html", "mobile-login.js", "mobile-login.css",
                         "financial-engine.js", "service-worker.js"):
            self.assertTrue((WWW / filename).is_file(), filename)
        self.assertIn('"/mobile/service-worker.js"', self.server)

    def test_mobile_manifest_has_isolated_start_and_scope(self):
        manifest = json.loads((WWW / "mobile.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(manifest["start_url"], "/mobile/")
        self.assertEqual(manifest["scope"], "/mobile/")
        self.assertEqual(manifest["display"], "standalone")
        html = (WWW / "mobile.html").read_text(encoding="utf-8")
        js = (WWW / "mobile.js").read_text(encoding="utf-8")
        self.assertIn('src="/financial-engine.js"', html)
        self.assertIn("register('/mobile/service-worker.js',{scope:'/mobile/'})", js)

    def test_mobile_interface_is_read_only_and_masks_transaction_amounts(self):
        html = (WWW / "mobile.html").read_text(encoding="utf-8")
        js = (WWW / "mobile.js").read_text(encoding="utf-8")
        self.assertNotIn('id="saveManualTransaction"', html)
        self.assertNotIn('id="addManualTransaction"', html)
        self.assertNotIn('id="importBankSecondary"', html)
        self.assertIn('id="logoutButton"', html)
        self.assertIn('class="money tx-amount', js)
        self.assertIn("function isLiquid", js)
        self.assertIn("classifyHierarchy", js)
        self.assertIn("today=dateKey(new Date())", js)


if __name__ == "__main__":
    unittest.main()
