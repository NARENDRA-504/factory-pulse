#!/usr/bin/env python3
"""
Test Suite: FastAPI API Contracts, Schemas & AI Diagnostic Safety Boundaries
Validates:
- Telemetry schema with separated motor_power_kw and motor_load_pct
- Incident management state transitions (Open -> In_Investigation -> Action_Required -> Closed)
- Incident creation permissions (Operator, Supervisor, Maintenance only)
- AI Investigation Assistant safety disclosures and pending model ID
- Analytics endpoints contracts for Datasets 1, 2, 3, and 4
- Dataset 3 CNC mill telemetry endpoint contract (25,286 rows, 18 experiments)
"""

import unittest
import json
import re
import datetime

class TestAPIContractsAndSafety(unittest.TestCase):
    def setUp(self):
        # Load API route definitions and stores from api_server/main.py
        with open("api_server/main.py", "r", encoding="utf-8") as f:
            self.main_py_code = f.read()

    def test_schema_separate_power_and_load_fields(self):
        """TC-API-001: Ensure motor_power_kw and motor_load_pct are distinct separate fields."""
        self.assertIn("motor_power_kw: float", self.main_py_code)
        self.assertIn("motor_load_pct: float", self.main_py_code)
        # Verify no combined or ambiguous fields exist
        self.assertNotIn("motor_power_pct", self.main_py_code)
        self.assertNotIn("motor_load_kw", self.main_py_code)

    def test_data_provenance_field_enforcement(self):
        """TC-API-002: Ensure data_provenance is strictly tracked across telemetry and incidents."""
        self.assertIn('data_provenance: str = Field(..., description="EMPIRICAL DATASET, SIMULATED, or DEMO")', self.main_py_code)
        self.assertIn('data_provenance: str = "EMPIRICAL DATASET"', self.main_py_code)

    def test_simulator_telemetry_isolation(self):
        """TC-API-003: Demo injection is not confused with persistent API ingestion."""
        self.assertIn('storage_status": "DEMO_ONLY_NOT_PERSISTED"', self.main_py_code)
        self.assertIn('@app.post("/api/v1/telemetry"', self.main_py_code)
        self.assertIn("sensor_value: float | str | None", self.main_py_code)
        self.assertIn('"data_provenance": "SIMULATED"', self.main_py_code)
        self.assertIn('require_roles(["Supervisor", "Maintenance"])', self.main_py_code)

    def test_incident_creator_roles(self):
        """TC-API-004: Only Operator, Supervisor, and Maintenance can create incidents."""
        match = re.search(r'@app\.post\("/api/v1/incidents"\).*?require_roles\(\[(.*?)\]\)', self.main_py_code, re.DOTALL)
        self.assertIsNotNone(match, "Incident creation route must enforce allowed roles")
        roles_str = match.group(1)
        self.assertIn('"Operator"', roles_str)
        self.assertIn('"Supervisor"', roles_str)
        self.assertIn('"Maintenance"', roles_str)
        self.assertNotIn('"Manager"', roles_str)
        self.assertNotIn('"Admin"', roles_str)

    def test_incident_assignment_supervisor_only(self):
        """TC-API-005: Only Supervisor can assign technicians to incidents."""
        match = re.search(r'@app\.patch\("/api/v1/incidents/\{incident_id\}/assign"\).*?require_roles\(\[(.*?)\]\)', self.main_py_code, re.DOTALL)
        self.assertIsNotNone(match)
        roles_str = match.group(1)
        self.assertIn('"Supervisor"', roles_str)
        self.assertNotIn('"Operator"', roles_str)
        self.assertNotIn('"Maintenance"', roles_str)

    def test_incident_progress_maintenance_only(self):
        """TC-API-006: Only Maintenance can update investigation progress."""
        match = re.search(r'@app\.patch\("/api/v1/incidents/\{incident_id\}/progress"\).*?require_roles\(\[(.*?)\]\)', self.main_py_code, re.DOTALL)
        self.assertIsNotNone(match)
        roles_str = match.group(1)
        self.assertIn('"Maintenance"', roles_str)
        self.assertNotIn('"Operator"', roles_str)
        self.assertNotIn('"Supervisor"', roles_str)

    def test_incident_closure_supervisor_and_maintenance(self):
        """TC-API-007: Only Supervisor and Maintenance can close incidents."""
        match = re.search(r'@app\.patch\("/api/v1/incidents/\{incident_id\}/close"\).*?require_roles\(\[(.*?)\]\)', self.main_py_code, re.DOTALL)
        self.assertIsNotNone(match)
        roles_str = match.group(1)
        self.assertIn('"Supervisor"', roles_str)
        self.assertIn('"Maintenance"', roles_str)
        self.assertNotIn('"Admin"', roles_str)
        self.assertNotIn('"Manager"', roles_str)

    def test_ai_diagnostic_model_verification_tag(self):
        """TC-API-008: Verify Gemini model ID is marked as Pending API Model Verification."""
        self.assertIn("gemini-3.8-flash (Pending API Model Verification)", self.main_py_code)

    def test_ai_diagnostic_safety_disclaimer(self):
        """TC-API-009: AI diagnosis includes mandatory industrial safety disclaimer and LOTO note."""
        self.assertIn("safety_disclaimer", self.main_py_code)
        self.assertIn("Lock-Out/Tag-Out (LOTO)", self.main_py_code)
        self.assertIn("preliminary hypotheses", self.main_py_code)

    def test_ai_diagnostic_unverified_sop_claim_absence(self):
        """TC-API-010: Ensure no false claims of manufacturer-verified SOP retrieval."""
        self.assertIn("future_sop_capability_note", self.main_py_code)
        self.assertIn("Manufacturer-verified SOP retrieval is reserved for future phases", self.main_py_code)

    def test_ai_diagnostic_unverified_metrics_exclusion(self):
        """TC-API-011: Unverified sensor metrics (Channel 14/15) are explicitly excluded from physical reasoning."""
        self.assertIn("unverified_metrics_excluded", self.main_py_code)
        self.assertIn("Unit unverified in dataset documentation", self.main_py_code)

    def test_dataset_3_telemetry_analytics_endpoint(self):
        """TC-API-012: Dataset 3 analytics endpoint /api/v1/analytics/telemetry conforms to requirements."""
        self.assertIn('@app.get("/api/v1/analytics/telemetry")', self.main_py_code)
        self.assertIn('"row_count": 25286', self.main_py_code)
        self.assertIn('"column_count": 49', self.main_py_code)
        self.assertIn('"experiment_count": 18', self.main_py_code)
        self.assertIn("Provisional statistical baseline only", self.main_py_code)

    def test_dataset_4_distinct_target_metric(self):
        """TC-API-013: Dataset 4 target is CycleToFailure, distinct from Vb flank wear."""
        self.assertIn('@app.get("/api/v1/analytics/cycle-to-failure")', self.main_py_code)
        self.assertIn('"target_metric": "CycleToFailure"', self.main_py_code)
        self.assertIn("CycleToFailure is distinct from Vb flank wear", self.main_py_code)

    def test_pipeline_health_audit_formula(self):
        """TC-API-014: Pipeline health endpoint reconciles 28,920 raw empirical rows."""
        self.assertIn('@app.get("/api/v1/analytics/pipeline-health")', self.main_py_code)
        self.assertIn('"total_empirical_rows": 28920', self.main_py_code)
        self.assertIn("2,054 (D1) + 612 (D2) + 25,286 (D3) + 968 (D4) = 28,920", self.main_py_code)

if __name__ == "__main__":
    unittest.main()
