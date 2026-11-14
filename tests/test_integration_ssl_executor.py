import ast
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1] / "custom_components" / "gestione_cc"


class SSLExecutorRegressionTest(unittest.TestCase):
    def test_config_flow_loads_ca_and_ssl_context_in_executor(self):
        tree = ast.parse((ROOT / "config_flow.py").read_text(encoding="utf-8"))
        calls = [
            node for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "async_add_executor_job"
        ]
        self.assertGreaterEqual(len(calls), 2, "CA file check and SSL context creation must run in executor")

        direct_ssl_calls = [
            node for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "create_default_context"
        ]
        self.assertEqual(len(direct_ssl_calls), 1)
        self.assertTrue(
            any(
                isinstance(arg, ast.Call)
                and isinstance(arg.func, ast.Name)
                and arg.func.id == "partial"
                and any(
                    isinstance(inner, ast.Attribute) and inner.attr == "create_default_context"
                    for inner in ast.walk(arg)
                )
                for call in calls for arg in call.args
            ),
            "SSL context creation must be passed to async_add_executor_job",
        )

    def test_coordinator_initializes_ssl_context_in_executor(self):
        tree = ast.parse((ROOT / "coordinator.py").read_text(encoding="utf-8"))
        calls = [
            node for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "async_add_executor_job"
        ]
        self.assertTrue(calls, "Coordinator SSL context creation must run in executor")


if __name__ == "__main__":
    unittest.main()
