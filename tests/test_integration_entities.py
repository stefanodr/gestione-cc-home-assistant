import ast
from pathlib import Path
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[1]


def literal_assignment(path, name):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == name for target in node.targets
        ):
            return ast.literal_eval(node.value)
    raise AssertionError(f"Assignment {name} not found in {path}")


def collect_entity_ids(value):
    found = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ("entity", "entity_id") and isinstance(item, str):
                found.add(item)
            found.update(collect_entity_ids(item))
    elif isinstance(value, list):
        for item in value:
            found.update(collect_entity_ids(item))
    return found


class IntegrationEntityExamplesTest(unittest.TestCase):
    def test_dashboard_and_automations_only_reference_defined_entities(self):
        sensor_items = literal_assignment(ROOT / "custom_components/gestione_cc/sensor.py", "SENSORS")
        binary_items = literal_assignment(ROOT / "custom_components/gestione_cc/binary_sensor.py", "ENTITIES")
        button_items = literal_assignment(ROOT / "custom_components/gestione_cc/button.py", "BUTTONS")
        defined = {f"sensor.gestione_cc_{item[0]}" for item in sensor_items}
        defined |= {f"binary_sensor.gestione_cc_{item[0]}" for item in binary_items}
        defined |= {f"button.gestione_cc_{item[0]}" for item in button_items}

        dashboard = yaml.safe_load((ROOT / "docs/dashboard_gestione_cc.yaml").read_text(encoding="utf-8"))
        automations = yaml.safe_load((ROOT / "docs/automazioni_gestione_cc.yaml").read_text(encoding="utf-8"))
        referenced = collect_entity_ids(dashboard) | collect_entity_ids(automations)
        self.assertTrue(referenced)
        self.assertEqual(referenced - defined, set())


if __name__ == "__main__":
    unittest.main()
