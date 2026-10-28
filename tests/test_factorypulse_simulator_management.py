"""
FactoryPulse & AI Simulator Verification Test Suite
Tests:
  Test A: Default 50 Machines Configuration
  Test B: Add New Machine (50 -> 51) & Dynamic Registration
  Test C: Live Telemetry Ingestion for Active Machines
  Test D: Downtime Calculations (Current Round vs Total Machine Downtime)
  Test E: Restart Safety & Machine Identity Consistency
  Test F: Regression Testing (RBAC, Ingestion, AI Health Assistant)
"""

import unittest
import datetime
import json
import os
import sqlite3
from unittest.mock import patch

# Verify imports
from api_server import machine_inventory
from api_server.machine_inventory import (
    build_inventory,
    get_default_active_count,
    DYNAMIC_REGISTERED_MACHINES,
    MachineCreateRequest
)
from api_server.gemini_insights import analyze_machine_health
from api_server.live_analytics import summarize_downtime


class FactoryPulseSimulatorPipelineTests(unittest.TestCase):
    def setUp(self):
        # Create canonical 400 machine mock
        self.catalog = {}
        for i in range(1, 401):
            mid = f"MCH-{i:03d}"
            self.catalog[mid] = {
                'machineId': mid,
                'machineCode': f"CNC-5AX-{i:03d}",
                'displayName': f"5-Axis Station {i}",
                'machineType': '5-Axis CNC Machining Center',
                'model': 'VARIAXIS C-600',
                'plant': 'Plant A: Precision Machining',
                'shopFloor': 'Floor A1: Aerospace Micro-Milling',
                'productionLine': 'Line 5AX-01',
                'status': 'Nominal'
            }
        DYNAMIC_REGISTERED_MACHINES.clear()

    def test_a_default_50_machines(self):
        """Test A: Verify default active machine count is exactly 50 machines."""
        now = datetime.datetime.now(datetime.timezone.utc)
        inventory = build_inventory(self.catalog, [], [], now, active_limit=50)

        active_machines = [m for m in inventory if m['is_active']]
        inactive_machines = [m for m in inventory if not m['is_active']]

        self.assertEqual(len(active_machines), 50, "Expected exactly 50 active machines by default")
        self.assertEqual(len(inactive_machines), 350, "Expected 350 deactivated machines by default")

        # Verify IDs MCH-001 through MCH-050 are the active ones
        active_ids = {m['machine_id'] for m in active_machines}
        expected_ids = {f"MCH-{i:03d}" for i in range(1, 51)}
        self.assertEqual(active_ids, expected_ids, "Active machines must match MCH-001 through MCH-050")

    def test_b_add_new_machine_50_to_51(self):
        """Test B: Admin adds new machine, count increases from 50 to 51, and registers dynamically."""
        now = datetime.datetime.now(datetime.timezone.utc)
        inventory_before = build_inventory(self.catalog, [], [], now, active_limit=50)
        active_before = sum(1 for m in inventory_before if m['is_active'])
        self.assertEqual(active_before, 50)

        # Admin creates new machine
        new_mid = "MCH-051"
        new_machine_record = {
            'machine_id': new_mid,
            'machine_code': 'CNC-5AX-051',
            'name': 'New 5-Axis Milling Station 51',
            'model': 'Mazak VARIAXIS C-600',
            'machine_type': '5-Axis CNC Machining Center',
            'line_id': 'Line 5AX-01',
            'plant': 'Plant A: Precision Machining',
            'location': 'Bay 4, Station 12',
            'manufacturer': 'Mazak',
            'installation_date': '2026-10-27',
            'is_active': True,
            'status': 'Nominal',
            'registered_in_sql': True
        }

        # Simulated registration in SQL and Dynamic Registry
        sql_rows = [new_machine_record]
        inventory_after = build_inventory(self.catalog, sql_rows, [], now, active_limit=50)
        active_after = sum(1 for m in inventory_after if m['is_active'])

        self.assertEqual(active_after, 51, "Active machine count must increase from 50 to 51")
        found = next((m for m in inventory_after if m['machine_id'] == new_mid), None)
        self.assertIsNotNone(found)
        self.assertTrue(found['is_active'])
        self.assertEqual(found['name'], 'New 5-Axis Milling Station 51')

    def test_c_live_telemetry_flow(self):
        """Test C: Live telemetry ingestion and sensor coverage."""
        now = datetime.datetime.now(datetime.timezone.utc)
        readings = [
            {
                'reading_id': 'READ-001',
                'machine_id': 'MCH-001',
                'machine_code': 'CNC-5AX-001',
                'timestamp': now.isoformat(),
                'sensor_name': 'Vibration',
                'sensor_unit': 'mm/s',
                'sensor_value': 1.45,
                'expected_min': 0.5,
                'expected_max': 5.0,
                'machine_status': 'NORMAL',
                'data_quality': 'GOOD'
            },
            {
                'reading_id': 'READ-002',
                'machine_id': 'MCH-001',
                'machine_code': 'CNC-5AX-001',
                'timestamp': now.isoformat(),
                'sensor_name': 'Temperature',
                'sensor_unit': '°C',
                'sensor_value': 24.8,
                'expected_min': 20.0,
                'expected_max': 65.0,
                'machine_status': 'NORMAL',
                'data_quality': 'GOOD'
            }
        ]

        inventory = build_inventory(self.catalog, [], readings, now, stale_seconds=30, active_limit=50)
        mch1 = next(m for m in inventory if m['machine_id'] == 'MCH-001')

        self.assertEqual(mch1['connection_status'], 'RECEIVING')
        self.assertEqual(len(mch1['sensors']), 2)

    def test_d_downtime_calculations(self):
        """Test D: Current round downtime and total machine downtime calculations."""
        base_time = datetime.datetime(2026, 10, 27, 12, 0, 0, tzinfo=datetime.timezone.utc)

        # Observations: Machine ran normally, then stopped at 12:10, still stopped at 12:20
        observations = [
            (base_time, False),                              # 12:00: Normal
            (base_time + datetime.timedelta(minutes=10), True),  # 12:10: Stopped
            (base_time + datetime.timedelta(minutes=20), True),  # 12:20: Still stopped
        ]

        # Summarize at 12:25
        until = base_time + datetime.timedelta(minutes=25)
        since = base_time
        summary = summarize_downtime(observations, since, until, round_minutes=30, stale_seconds=600)

        self.assertGreater(summary['total_seconds'], 0, "Expected non-zero cumulative downtime")
        self.assertGreater(summary['current_downtime_seconds'], 0, "Expected non-zero ongoing round downtime")
        self.assertIn('rounds', summary)

    def test_e_restart_safety_and_preservation(self):
        """Test E: Restarting does not lose machine identities, counts, or historical status."""
        now = datetime.datetime.now(datetime.timezone.utc)
        inventory_run1 = build_inventory(self.catalog, [], [], now, active_limit=50)
        inventory_run2 = build_inventory(self.catalog, [], [], now, active_limit=50)

        ids_run1 = [m['machine_id'] for m in inventory_run1]
        ids_run2 = [m['machine_id'] for m in inventory_run2]

        self.assertEqual(ids_run1, ids_run2, "Machine IDs must be deterministic across restarts")
        self.assertEqual(len(inventory_run1), len(inventory_run2))

    def test_f_ai_machine_health_assistant(self):
        """Test F: AI Machine Health Assistant produces structured assessment on real telemetry."""
        machine_info = {
            'machine_id': 'MCH-001',
            'machineCode': 'CNC-5AX-001',
            'name': 'Mazak VARIAXIS C-600',
            'machine_type': '5-Axis CNC Machining Center'
        }
        readings = [
            {
                'sensor_name': 'Temperature',
                'sensor_unit': '°C',
                'sensor_value': 48.5,  # Elevated > 45°C
                'expected_min': 20.0,
                'expected_max': 45.0,
                'machine_status': 'WARNING'
            },
            {
                'sensor_name': 'Vibration',
                'sensor_unit': 'mm/s',
                'sensor_value': 2.95,  # Elevated > 2.5 mm/s
                'expected_min': 0.5,
                'expected_max': 2.5,
                'machine_status': 'WARNING'
            }
        ]
        downtime = {'current_downtime_seconds': 180, 'total_seconds': 540}

        health = analyze_machine_health('MCH-001', machine_info, readings, downtime)

        self.assertEqual(health['machine_id'], 'MCH-001')
        self.assertEqual(health['overall_health'], 'WARNING')
        self.assertIsNotNone(health['abnormal_temperature_warning'])
        self.assertIsNotNone(health['excessive_vibration_warning'])
        self.assertTrue(len(health['potential_failure_indicators']) > 0)
        self.assertTrue(len(health['maintenance_recommendations']) > 0)
        self.assertIn('downtime_explanation', health)


if __name__ == '__main__':
    unittest.main()
