"""Isolated chart-feed contract checks against the separate local Simulator."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'AI Simulator' / 'backend'))
from app.simulator.engine import Simulator
from app.database import db

class ChartFeedContract(unittest.TestCase):
    def test_independent_coolant_and_current_counter_heartbeat(self):
        simulator = Simulator()
        simulator.states['MCH-001']['running'] = True
        first = simulator.generate('MCH-001', elapsed_seconds=1, persist=False)
        second = simulator.generate('MCH-001', elapsed_seconds=5, persist=False)
        lookup = {r['sensor_name']: r for r in second}
        self.assertIn('Coolant Temperature', lookup)
        self.assertEqual(lookup['Coolant Temperature']['sensor_unit'], '°C')
        self.assertEqual((lookup['Coolant Temperature']['expected_min'], lookup['Coolant Temperature']['expected_max']), (18, 35))
        self.assertNotEqual(lookup['Coolant Temperature']['reading_id'], lookup['Temperature']['reading_id'])
        self.assertEqual(lookup['Good Parts']['sensor_value'] + lookup['Scrap Parts']['sensor_value'], 0)
        self.assertNotEqual(next(r['reading_id'] for r in first if r['sensor_name'] == 'Good Parts'), lookup['Good Parts']['reading_id'])

    def test_checkpoint_restores_counts_without_auto_start_or_losing_new_sensor(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(db, 'DB_PATH', Path(folder) / 'test.db'):
            db.initialize()
            original = Simulator()
            original.states['MCH-001'].update(good_parts=19, scrap_parts=1, cycle_remaining=123, running=True)
            with db.connect() as connection:
                db.save_runtime_checkpoint(original.states, connection)
            restored = Simulator()
            db.restore_runtime_checkpoint(restored.states)
            state = restored.states['MCH-001']
            self.assertEqual((state['good_parts'], state['scrap_parts'], state['cycle_remaining']), (19, 1, 123))
            self.assertFalse(state['running'])
            self.assertIn('Coolant Temperature', state['values'])

    def test_receiver_agrees_with_new_sensor_name_and_unit(self):
        # Fail before deploying a sender-only sensor extension.
        root = Path(__file__).resolve().parents[1]
        source = (root / 'api_server/main.py').read_text(encoding='utf-8')
        import ast
        module = ast.parse(source)
        profile = next(ast.literal_eval(node.value) for node in module.body if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'SIMULATOR_SENSOR_UNITS' for t in node.targets))
        simulator = Simulator()
        simulator.states['MCH-001']['running'] = True
        for row in simulator.generate('MCH-001', persist=False):
            self.assertEqual(profile[row['sensor_name']], row['sensor_unit'])

    def test_new_install_schema_includes_all_api_machine_statuses(self):
        root = Path(__file__).resolve().parents[1]
        import re
        for file in ['scripts/export_mysql_schema.sql', 'scripts/migrations/20261026_create_simulator_sensor_readings.sql']:
            source = (root / file).read_text(encoding='utf-8')
            enum = re.search(r'machine_status ENUM\(([^)]+)\)', source).group(1)
            for status in ['NORMAL', 'IDLE', 'WARNING', 'CRITICAL', 'MAINTENANCE', 'STOPPED']:
                self.assertIn(f"'{status}'", enum)

if __name__ == '__main__':
    unittest.main()
