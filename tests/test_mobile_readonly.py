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

    def test_mobile_state_endpoint_requires_readonly_role(self):
        self.assertIn('if path == "/api/mobile/state":', self.server)
        self.assertIn('item.get("role") != "readonly"', self.server)

    def test_mobile_pages_and_assets_are_session_protected(self):
        self.assertIn('if path == "/mobile":', self.server)
        self.assertIn('if path in ("/mobile.html", "/mobile.js", "/mobile.css", "/mobile.webmanifest"):', self.server)
        for filename in ("mobile.html", "mobile.js", "mobile.css", "mobile.webmanifest",
                         "mobile-login.html", "mobile-login.js", "mobile-login.css"):
            self.assertTrue((WWW / filename).is_file(), filename)

    def test_mobile_manifest_has_dedicated_start_url(self):
        manifest = json.loads((WWW / "mobile.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(manifest["start_url"], "/mobile")
        self.assertEqual(manifest["display"], "standalone")

    def test_mobile_interface_contains_no_transaction_mutation_controls(self):
        html = (WWW / "mobile.html").read_text(encoding="utf-8")
        self.assertNotIn('id="saveManualTransaction"', html)
        self.assertNotIn('id="addManualTransaction"', html)
        self.assertNotIn('id="importBankSecondary"', html)
        self.assertIn('id="logoutButton"', html)


if __name__ == "__main__":
    unittest.main()
