import ast
import ipaddress
from http.server import ThreadingHTTPServer
from pathlib import Path
import unittest


SERVER = Path(__file__).resolve().parents[1] / "gestione_cc" / "server.py"
TREE = ast.parse(SERVER.read_text(encoding="utf-8"))
NODE = next(node for node in TREE.body if isinstance(node, ast.ClassDef) and node.name == "LANOnlyHTTPServer")
NAMESPACE = {"ipaddress": ipaddress, "ThreadingHTTPServer": ThreadingHTTPServer}
exec(compile(ast.Module(body=[NODE], type_ignores=[]), str(SERVER), "exec"), NAMESPACE)
ServerClass = NAMESPACE["LANOnlyHTTPServer"]


class IntegrationNetworkScopeTest(unittest.TestCase):
    def setUp(self):
        self.server = ServerClass.__new__(ServerClass)
        self.server.allowed_network = ipaddress.ip_network("192.168.1.0/24")
        self.server.integration_network = ipaddress.ip_network("172.30.32.1/32")

    def test_home_assistant_core_is_the_only_additional_peer(self):
        self.assertTrue(self.server.verify_request(None, ("172.30.32.1", 12345)))
        self.assertFalse(self.server.verify_request(None, ("172.30.32.2", 12345)))
        self.assertFalse(self.server.verify_request(None, ("172.30.33.1", 12345)))

    def test_existing_lan_remains_allowed(self):
        self.assertTrue(self.server.verify_request(None, ("192.168.1.42", 12345)))

    def test_core_peer_is_classified_separately_from_lan(self):
        self.assertTrue(self.server.is_integration_only_peer("172.30.32.1"))
        self.assertFalse(self.server.is_integration_only_peer("192.168.1.42"))
        self.assertFalse(self.server.is_integration_only_peer("172.30.32.2"))


if __name__ == "__main__":
    unittest.main()
