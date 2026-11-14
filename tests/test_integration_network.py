import ast
import ipaddress
from pathlib import Path
import unittest


SERVER = Path(__file__).resolve().parents[1] / "gestione_cc" / "server.py"
TREE = ast.parse(SERVER.read_text(encoding="utf-8"))
TARGETS = {"peer_is_allowed", "peer_is_integration_only", "integration_peer_can_access"}
NAMESPACE = {"ipaddress": ipaddress}
for node in TREE.body:
    if isinstance(node, ast.FunctionDef) and node.name in TARGETS:
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(SERVER), "exec"), NAMESPACE)


class IntegrationNetworkScopeTest(unittest.TestCase):
    def setUp(self):
        self.lan = ipaddress.ip_network("192.168.1.0/24")
        self.core = ipaddress.ip_network("172.30.32.1/32")

    def test_home_assistant_core_is_the_only_additional_peer(self):
        allowed = NAMESPACE["peer_is_allowed"]
        self.assertTrue(allowed("172.30.32.1", self.lan, self.core))
        self.assertFalse(allowed("172.30.32.2", self.lan, self.core))
        self.assertFalse(allowed("172.30.33.1", self.lan, self.core))

    def test_existing_lan_remains_allowed(self):
        self.assertTrue(NAMESPACE["peer_is_allowed"]("192.168.1.42", self.lan, self.core))

    def test_core_peer_is_classified_separately_from_lan(self):
        is_core = NAMESPACE["peer_is_integration_only"]
        self.assertTrue(is_core("172.30.32.1", self.lan, self.core))
        self.assertFalse(is_core("192.168.1.42", self.lan, self.core))
        self.assertFalse(is_core("172.30.32.2", self.lan, self.core))

    def test_invalid_peer_is_rejected(self):
        self.assertFalse(NAMESPACE["peer_is_allowed"]("not-an-ip", self.lan, self.core))
        self.assertFalse(NAMESPACE["peer_is_integration_only"]("not-an-ip", self.lan, self.core))
    def test_core_peer_get_is_limited_to_exact_status_allowlist(self):
        check = NAMESPACE["integration_peer_can_access"]
        self.assertTrue(check("172.30.32.1", self.lan, self.core, "GET", "/api/integration/v1/health"))
        self.assertFalse(check("172.30.32.1", self.lan, self.core, "GET", "/api/security/access-log"))
        self.assertFalse(check("172.30.32.1", self.lan, self.core, "GET", "/api/integration/v1/private/export"))
        self.assertFalse(check("172.30.32.1", self.lan, self.core, "GET", "/api/integration/v1/health/"))

    def test_core_peer_post_is_limited_to_exact_maintenance_commands(self):
        check = NAMESPACE["integration_peer_can_access"]
        self.assertTrue(check("172.30.32.1", self.lan, self.core, "POST", "/api/integration/v1/commands/local-backup"))
        self.assertFalse(check("172.30.32.1", self.lan, self.core, "POST", "/api/integration/token"))
        self.assertFalse(check("172.30.32.1", self.lan, self.core, "POST", "/api/integration/v1/commands/private-export"))

    def test_core_peer_cannot_use_other_http_methods(self):
        check = NAMESPACE["integration_peer_can_access"]
        for method in ("PUT", "PATCH", "DELETE", "OPTIONS"):
            self.assertFalse(check("172.30.32.1", self.lan, self.core, method, "/api/integration/v1/health"))

    def test_regular_lan_peer_keeps_existing_app_access(self):
        check = NAMESPACE["integration_peer_can_access"]
        self.assertTrue(check("192.168.1.42", self.lan, self.core, "GET", "/api/security/access-log"))
        self.assertTrue(check("192.168.1.42", self.lan, self.core, "POST", "/api/integration/token"))


if __name__ == "__main__":
    unittest.main()
