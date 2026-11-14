import ast
from pathlib import Path
import unittest
from urllib.parse import urlparse
import ipaddress


FLOW = Path(__file__).resolve().parents[1] / "custom_components" / "gestione_cc" / "config_flow.py"
TREE = ast.parse(FLOW.read_text(encoding="utf-8"))
NODE = next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == "_valid_local_https_url")
NAMESPACE = {"urlparse": urlparse, "ipaddress": ipaddress}
exec(compile(ast.Module(body=[NODE], type_ignores=[]), str(FLOW), "exec"), NAMESPACE)


class LocalHttpsConfigFlowTest(unittest.TestCase):
    def test_accepts_private_lan_ip_and_local_hostnames(self):
        valid = NAMESPACE["_valid_local_https_url"]
        self.assertTrue(valid("https://192.168.1.27:8443"))
        self.assertTrue(valid("https://homeassistant.local:8443"))
        self.assertTrue(valid("https://gestione-cc.lan:8443"))

    def test_rejects_http_and_public_hosts(self):
        valid = NAMESPACE["_valid_local_https_url"]
        self.assertFalse(valid("http://192.168.1.27:8443"))
        self.assertFalse(valid("https://8.8.8.8:8443"))
        self.assertFalse(valid("https://127.0.0.1:8443"))
        self.assertFalse(valid("https://localhost:8443"))
        self.assertFalse(valid("https://169.254.1.10:8443"))
        self.assertFalse(valid("https://example.com:8443"))

    def test_rejects_urls_with_credentials_or_paths(self):
        valid = NAMESPACE["_valid_local_https_url"]
        self.assertFalse(valid("https://user:pass@homeassistant.local:8443"))
        self.assertFalse(valid("https://homeassistant.local:8443/api"))
        self.assertFalse(valid("https://homeassistant.local:8443/?token=secret"))


if __name__ == "__main__":
    unittest.main()
