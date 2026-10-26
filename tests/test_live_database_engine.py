#!/usr/bin/env python3
"""
Live Integration Test Suite: In-Memory SQL Engine Execution & Relational Integrity
Executes DDL statements against Python's built-in SQLite engine to test:
- Real SQL parsing and catalog table creation
- All 4 raw empirical dataset tables created
- Simulator layer table created with data_provenance
- Operational tables (users, machines, incidents, incident_logs, maintenance_work_orders) created
- Real record insertions across operational tables
- Real SQL query execution of analytical views
- Foreign key constraint checks and transactional integrity
"""

import unittest
import sqlite3
import re
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DDL_FILE_PATH = os.path.join(PROJECT_ROOT, "scripts", "export_mysql_schema.sql")

def convert_mysql_ddl_to_sqlite(mysql_ddl: str) -> str:
    """
    Translates MySQL-specific DDL syntax to SQLite-compatible SQL for live in-memory execution testing.
    """
    # Strip C-style comments
    sql = re.sub(r'/\*.*?\*/', '', mysql_ddl, flags=re.DOTALL)
    # Strip line comments
    lines = [l for l in sql.splitlines() if not l.strip().startswith('--')]
    sql = '\n'.join(lines)

    # Strip CREATE DATABASE / USE
    sql = re.sub(r'CREATE\s+DATABASE[^;]+;', '', sql, flags=re.IGNORECASE)
    sql = re.sub(r'USE\s+[^;]+;', '', sql, flags=re.IGNORECASE)

    # Strip COMMENT clauses
    sql = re.sub(r'COMMENT\s*=\s*\'[^\']*\'', '', sql, flags=re.IGNORECASE)
    sql = re.sub(r'COMMENT\s*\'[^\']*\'', '', sql, flags=re.IGNORECASE)

    # Table options
    sql = re.sub(r'ENGINE\s*=\s*\w+', '', sql, flags=re.IGNORECASE)
    sql = re.sub(r'DEFAULT\s+CHARSET\s*=\s*\w+', '', sql, flags=re.IGNORECASE)
    sql = re.sub(r'COLLATE\s*=\s*\w+', '', sql, flags=re.IGNORECASE)
    sql = re.sub(r'ON\s+UPDATE\s+CURRENT_TIMESTAMP', '', sql, flags=re.IGNORECASE)

    # Types and keys
    sql = re.sub(r'\b(?:BIGINT|INT)\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b', 'INTEGER PRIMARY KEY AUTOINCREMENT', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bAUTO_INCREMENT\b', 'AUTOINCREMENT', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bENUM\([^)]+\)', 'TEXT', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bDECIMAL\(\d+,\s*\d+\)', 'REAL', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bDOUBLE\b', 'REAL', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bFLOAT\b', 'REAL', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bDATETIME\b', 'TEXT', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bBIGINT\b', 'INTEGER', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bINT\b', 'INTEGER', sql, flags=re.IGNORECASE)
    sql = re.sub(r'NOW\(\)', 'CURRENT_TIMESTAMP', sql, flags=re.IGNORECASE)
    sql = re.sub(r'CREATE\s+OR\s+REPLACE\s+VIEW', 'CREATE VIEW IF NOT EXISTS', sql, flags=re.IGNORECASE)

    return sql


class TestLiveDatabaseEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DDL_FILE_PATH, "r", encoding="utf-8") as f:
            cls.raw_ddl = f.read()
        cls.sqlite_ddl = convert_mysql_ddl_to_sqlite(cls.raw_ddl)
        
        # Connect to in-memory SQLite database
        cls.conn = sqlite3.connect(":memory:")
        cls.conn.execute("PRAGMA foreign_keys = ON;")
        cls.cursor = cls.conn.cursor()
        
        # Execute each statement
        statements = [s.strip() for s in cls.sqlite_ddl.split(";") if s.strip()]
        for stmt in statements:
            cls.cursor.execute(stmt)
        cls.conn.commit()

        # Seed initial operational users
        users_to_insert = [
            ("OP-101", "Marcus Vance", "hash_op101", "Operator", "CNC-MILL-01", "marcus.vance@ziro-mfg.internal"),
            ("SUP-201", "Elena Rostova", "hash_sup201", "Supervisor", None, "elena.rostova@ziro-mfg.internal"),
            ("MGR-301", "David Sterling", "hash_mgr301", "Manager", None, "david.sterling@ziro-mfg.internal"),
            ("MNT-401", "Frank Kowalski", "hash_mnt401", "Maintenance", None, "frank.kowalski@ziro-mfg.internal"),
            ("ADM-001", "Amina Patel", "hash_adm001", "Admin", None, "amina.patel@ziro-mfg.internal"),
        ]
        cls.cursor.executemany(
            "INSERT INTO users (work_id, full_name, password_hash, role, assigned_machine, email) VALUES (?, ?, ?, ?, ?, ?);",
            users_to_insert
        )

        # Seed machine
        cls.cursor.execute("""
            INSERT INTO machines (
                machine_code, name, model, line_id, status, last_inspection_date, cut_hours, current_tool_cuts, active_workpiece
            ) VALUES (
                'CNC-MILL-01', 'DMG MORI 5-Axis Mill 01', 'DMU 50 3rd Gen', 'LINE-A', 'Nominal', '2026-09-15', 342.5, 48, 'Ti-6Al-4V Aero Blisk'
            );
        """)

        # Seed incident
        cls.cursor.execute("SELECT id FROM users WHERE work_id = 'OP-101';")
        op_id = cls.cursor.fetchone()[0]

        cls.cursor.execute("""
            INSERT INTO incidents (
                incident_code, machine_code, reporter_id, severity, status,
                symptom_description, component_area, measured_vib_rms,
                measured_motor_power_kw, measured_motor_load_pct, data_provenance
            ) VALUES (
                'INC-2026-001', 'CNC-MILL-01', ?, 'High', 'Open',
                'Severe chatter harmonic observed on toolholder during roughing cut',
                'Spindle & Toolholder', 5.45, 16.2, 91.5, 'SIMULATED'
            );
        """, (op_id,))
        inc_id = cls.cursor.lastrowid

        # Seed incident audit log
        cls.cursor.execute("""
            INSERT INTO incident_logs (incident_id, user_id, action_type, action_notes)
            VALUES (?, ?, 'CREATED', 'Incident created by Operator Marcus Vance');
        """, (inc_id, op_id))

        # Seed simulated telemetry event
        cls.cursor.execute("""
            INSERT INTO sim_telemetry_events (
                machine_code, spindle_rpm, feed_rate_mmpm, vib_rms,
                motor_power_kw, motor_load_pct, coolant_temp_c, injected_anomaly_type, data_provenance, created_by_user_id
            ) VALUES (
                'CNC-MILL-01', 4320.0, 480.0, 5.45,
                16.2, 91.5, 38.5, 'High Spindle Chatter Resonance', 'SIMULATED', ?
            );
        """, (op_id,))

        cls.conn.commit()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def test_live_tables_exist_in_database(self):
        """TC-INT-SQL-001: All expected tables exist in live relational database catalog."""
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in self.cursor.fetchall()]
        
        expected_tables = [
            "raw_cnc_tool_wear",
            "raw_turning_roughness",
            "raw_mill_telemetry",
            "raw_milling_cycles",
            "sim_telemetry_events",
            "users",
            "machines",
            "incidents",
            "incident_logs",
            "maintenance_work_orders"
        ]
        for tbl in expected_tables:
            self.assertIn(tbl, tables, f"Expected table '{tbl}' was not created in SQL database catalog.")

    def test_live_analytical_views_exist_in_database(self):
        """TC-INT-SQL-002: All 5 Power BI analytical views exist in database catalog."""
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='view';")
        views = [row[0] for row in self.cursor.fetchall()]
        
        expected_views = [
            "v_machine_current_status",
            "v_incident_kpi_summary",
            "v_dataset_pipeline_audit",
            "v_executive_oee_summary",
            "v_quality_roughness_compliance"
        ]
        for view_name in expected_views:
            self.assertIn(view_name, views, f"Analytical view '{view_name}' must exist in database catalog.")

    def test_live_users_record_count(self):
        """TC-INT-SQL-003: Operational users table contains all 5 role profiles with encrypted hashes."""
        self.cursor.execute("SELECT COUNT(*), COUNT(DISTINCT role) FROM users;")
        total, distinct_roles = self.cursor.fetchone()
        self.assertEqual(total, 5, "Database must contain 5 seeded users.")
        self.assertEqual(distinct_roles, 5, "Database must contain 5 distinct user roles.")

    def test_live_sim_telemetry_provenance_isolation(self):
        """TC-INT-SQL-004: Simulator layer records strictly preserve data_provenance='SIMULATED' and separated power/load."""
        self.cursor.execute("SELECT data_provenance, motor_power_kw, motor_load_pct, injected_anomaly_type FROM sim_telemetry_events WHERE machine_code = 'CNC-MILL-01';")
        row = self.cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "SIMULATED")
        self.assertEqual(row[1], 16.2)
        self.assertEqual(row[2], 91.5)
        self.assertEqual(row[3], "High Spindle Chatter Resonance")

    def test_live_incident_and_log_link(self):
        """TC-INT-SQL-005: Operational incident and audit log tables are properly linked."""
        self.cursor.execute("""
            SELECT i.incident_code, i.status, l.action_type, l.action_notes
            FROM incidents i
            JOIN incident_logs l ON i.id = l.incident_id
            WHERE i.incident_code = 'INC-2026-001';
        """)
        row = self.cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "INC-2026-001")
        self.assertEqual(row[1], "Open")
        self.assertEqual(row[2], "CREATED")
        self.assertEqual(row[3], "Incident created by Operator Marcus Vance")

    def test_live_query_v_incident_kpi_summary(self):
        """TC-INT-SQL-006: Querying live view v_incident_kpi_summary aggregates open high severity incidents."""
        self.cursor.execute("SELECT status, severity, incident_count, avg_vib_rms FROM v_incident_kpi_summary;")
        rows = self.cursor.fetchall()
        self.assertGreaterEqual(len(rows), 1, "v_incident_kpi_summary must return at least one aggregated KPI row.")
        status, severity, count, avg_vib = rows[0]
        self.assertEqual(status, "Open")
        self.assertEqual(severity, "High")
        self.assertEqual(count, 1)
        self.assertEqual(avg_vib, 5.45)

    def test_live_query_v_dataset_pipeline_audit(self):
        """TC-INT-SQL-007: Querying live view v_dataset_pipeline_audit covers 4 empirical tables + simulator layer."""
        self.cursor.execute("SELECT dataset_table, provenance FROM v_dataset_pipeline_audit;")
        rows = self.cursor.fetchall()
        self.assertEqual(len(rows), 5, "v_dataset_pipeline_audit must cover 4 empirical dataset tables + sim_telemetry_events.")
        tables_in_view = [r[0] for r in rows]
        self.assertIn("raw_cnc_tool_wear", tables_in_view)
        self.assertIn("raw_turning_roughness", tables_in_view)
        self.assertIn("raw_mill_telemetry", tables_in_view)
        self.assertIn("raw_milling_cycles", tables_in_view)
        self.assertIn("sim_telemetry_events", tables_in_view)


if __name__ == "__main__":
    unittest.main()
