#!/usr/bin/env python3
"""
Test Suite: MySQL Database Schema & DDL Integrity Tests
Validates scripts/export_mysql_schema.sql:
- Creation of ziro_manufacturing database
- Raw layer tables for all 4 empirical datasets:
  - raw_cnc_tool_wear (2,054 rows benchmark, Vb in mm, sensor_channel_14/15 NULLs)
  - raw_turning_roughness (612 rows benchmark, source_experiment, Ra in µm)
  - raw_mill_telemetry (25,286 rows benchmark, experiment_name, RPM, Vib, Amp)
  - raw_milling_cycles (968 rows benchmark, cycle_to_failure)
- Isolation of sim_telemetry_events table with data_provenance
- Core operational tables (users, incidents, incident_logs, work_orders)
- Analytical views (v_machine_current_status, v_incident_kpi_summary, v_dataset_pipeline_audit)
- Motor power (kW) and load (%) column separation
- Absence of unsupported arbitrary thresholds (e.g., 0.32 mm or 1.6 µm)
"""

import unittest
import re

class TestMySQLSchemaDDL(unittest.TestCase):
    def setUp(self):
        with open("scripts/export_mysql_schema.sql", "r", encoding="utf-8") as f:
            self.sql_content = f.read()

    def test_database_creation(self):
        """TC-SQL-001: Verifies CREATE DATABASE ziro_manufacturing with utf8mb4."""
        self.assertIn("CREATE DATABASE IF NOT EXISTS ziro_manufacturing", self.sql_content)
        self.assertIn("utf8mb4", self.sql_content)

    def test_raw_tables_existence(self):
        """TC-SQL-002: Verifies all four raw empirical tables are defined."""
        raw_tables = [
            "raw_cnc_tool_wear",
            "raw_turning_roughness",
            "raw_mill_telemetry",
            "raw_milling_cycles",
        ]
        for tbl in raw_tables:
            pattern = rf"CREATE TABLE IF NOT EXISTS {tbl}"
            self.assertTrue(re.search(pattern, self.sql_content, re.IGNORECASE), f"Table {tbl} must exist")

    def test_raw_cnc_tool_wear_columns(self):
        """TC-SQL-003: Verifies Dataset 1 table has Vb in mm and preserves missing channels as NULL."""
        self.assertIn("vb_flank_wear FLOAT NULL COMMENT 'Tool flank wear width in millimeters (mm)'", self.sql_content)
        self.assertIn("sensor_channel_14 FLOAT NULL", self.sql_content)
        self.assertIn("sensor_channel_15 FLOAT NULL", self.sql_content)

    def test_raw_turning_roughness_columns(self):
        """TC-SQL-004: Verifies Dataset 2 has source_experiment and Ra in µm."""
        self.assertIn("source_experiment VARCHAR(16) NOT NULL COMMENT 'Exp1 or Exp2'", self.sql_content)
        self.assertIn("ra_roughness FLOAT NOT NULL COMMENT 'Arithmetic surface roughness in micrometers (µm)'", self.sql_content)

    def test_raw_mill_telemetry_columns(self):
        """TC-SQL-005: Verifies Dataset 3 preserves experiment_name across 18 experiments."""
        self.assertIn("experiment_name VARCHAR(64) NOT NULL COMMENT 'Preserves 18 experimental source run files'", self.sql_content)
        self.assertIn("spindle_speed_rpm FLOAT NOT NULL", self.sql_content)
        self.assertIn("vib_rms FLOAT NOT NULL", self.sql_content)

    def test_raw_milling_cycles_columns(self):
        """TC-SQL-006: Verifies Dataset 4 target is cycle_to_failure (distinct from Vb)."""
        self.assertIn("cycle_to_failure INT NOT NULL COMMENT 'Remaining cut cycles to tool end-of-life (distinct from Vb)'", self.sql_content)

    def test_sim_telemetry_events_isolation(self):
        """TC-SQL-007: Verifies simulator table is isolated and tracks data_provenance."""
        self.assertIn("CREATE TABLE IF NOT EXISTS sim_telemetry_events", self.sql_content)
        self.assertIn("data_provenance VARCHAR(16) DEFAULT 'SIMULATED'", self.sql_content)
        self.assertIn("injected_anomaly_type VARCHAR(64) NULL", self.sql_content)

    def test_separated_power_and_load_columns(self):
        """TC-SQL-008: Verifies motor power (kW) and load (%) are separate columns in simulator and incidents."""
        self.assertIn("motor_power_kw FLOAT NULL COMMENT 'Spindle motor power in kW (SEPARATED)'", self.sql_content)
        self.assertIn("motor_load_pct FLOAT NOT NULL COMMENT 'Motor load percentage % (SEPARATED)'", self.sql_content)
        self.assertIn("measured_motor_power_kw FLOAT NOT NULL", self.sql_content)
        self.assertIn("measured_motor_load_pct FLOAT NOT NULL", self.sql_content)

    def test_operational_tables(self):
        """TC-SQL-009: Verifies users, incidents, incident_logs, and maintenance_work_orders tables."""
        op_tables = ["users", "incidents", "incident_logs", "maintenance_work_orders"]
        for tbl in op_tables:
            pattern = rf"CREATE TABLE IF NOT EXISTS {tbl}"
            self.assertTrue(re.search(pattern, self.sql_content, re.IGNORECASE), f"Operational table {tbl} must exist")

    def test_user_roles_enum(self):
        """TC-SQL-010: Verifies 5 approved user roles in users table."""
        self.assertIn("ENUM('Operator', 'Supervisor', 'Manager', 'Maintenance', 'Admin')", self.sql_content)

    def test_incident_status_enum(self):
        """TC-SQL-011: Verifies incident workflow status lifecycle."""
        self.assertIn("ENUM('Open', 'In_Investigation', 'Action_Required', 'Closed')", self.sql_content)

    def test_analytical_views(self):
        """TC-SQL-012: Verifies analytical views for Power BI and FastAPI."""
        views = ["v_machine_current_status", "v_incident_kpi_summary", "v_dataset_pipeline_audit"]
        for vw in views:
            pattern = rf"CREATE OR REPLACE VIEW {vw}"
            self.assertTrue(re.search(pattern, self.sql_content, re.IGNORECASE), f"View {vw} must exist")

    def test_no_unsupported_numerical_thresholds(self):
        """TC-SQL-013: Ensures no arbitrary threshold constants (e.g. 0.32mm or 1.6µm) are hardcoded as table constraints."""
        self.assertNotIn("0.32", self.sql_content)
        self.assertNotIn("0.35", self.sql_content)
        self.assertNotIn("1.6", self.sql_content)

if __name__ == "__main__":
    unittest.main()
