#!/usr/bin/env python3
"""
Test Suite: Role-Based Access Control (RBAC) & Authentication Security Tests
Tests the 5 user roles (Operator, Supervisor, Manager, Maintenance, Admin)
against approved authorization rules.
"""

import unittest
import json
import re

# Mock user database matching approved specifications
USERS_DB = {
    "OP-101": {"work_id": "OP-101", "name": "Marcus Vance", "role": "Operator", "password": "pass123"},
    "SUP-201": {"work_id": "SUP-201", "name": "Elena Rostova", "role": "Supervisor", "password": "pass123"},
    "MGR-301": {"work_id": "MGR-301", "name": "David Sterling", "role": "Manager", "password": "pass123"},
    "MNT-401": {"work_id": "MNT-401", "name": "Frank Kowalski", "role": "Maintenance", "password": "pass123"},
    "ADM-001": {"work_id": "ADM-001", "name": "Sarah Chen", "role": "Admin", "password": "pass123"},
}

def authenticate(work_id, password):
    user = USERS_DB.get(work_id.strip().upper())
    if not user:
        return {"status": 400, "error": "Invalid Work ID"}
    if not password or len(password) < 3:
        return {"status": 400, "error": "Password too short"}
    if password != user["password"]:
        return {"status": 401, "error": "Invalid credentials"}
    return {"status": 200, "user": user, "token": user["work_id"]}

def authorize_action(role, action):
    permissions = {
        "Operator": {"create_incident", "view_incidents", "view_telemetry"},
        "Supervisor": {"create_incident", "view_incidents", "view_telemetry", "assign_incident", "close_incident", "inject_telemetry"},
        "Manager": {"view_incidents", "view_telemetry", "view_kpis", "view_power_bi"},
        "Maintenance": {"create_incident", "view_incidents", "view_telemetry", "update_progress", "close_incident", "inject_telemetry"},
        "Admin": {"view_incidents", "view_telemetry", "manage_users", "view_system_config"},
    }
    allowed = permissions.get(role, set())
    return action in allowed

class TestAuthAndRBAC(unittest.TestCase):
    def test_auth_valid_credentials(self):
        """TC-AUTH-001: Valid credentials for all 5 roles should return status 200."""
        for work_id in USERS_DB.keys():
            res = authenticate(work_id, "pass123")
            self.assertEqual(res["status"], 200)
            self.assertEqual(res["user"]["work_id"], work_id)

    def test_auth_invalid_work_id(self):
        """TC-AUTH-002: Unknown Work ID should be rejected with 400."""
        res = authenticate("INVALID-999", "pass123")
        self.assertEqual(res["status"], 400)

    def test_auth_wrong_password(self):
        """TC-AUTH-003: Wrong password should be rejected with 401."""
        res = authenticate("OP-101", "wrongpassword")
        self.assertEqual(res["status"], 401)

    def test_auth_short_password(self):
        """TC-AUTH-004: Passwords shorter than 3 chars should be rejected."""
        res = authenticate("OP-101", "12")
        self.assertEqual(res["status"], 400)

    def test_rbac_incident_creation(self):
        """TC-RBAC-001: Only Operator, Supervisor, Maintenance can create incidents; Manager & Admin cannot."""
        self.assertTrue(authorize_action("Operator", "create_incident"))
        self.assertTrue(authorize_action("Supervisor", "create_incident"))
        self.assertTrue(authorize_action("Maintenance", "create_incident"))
        self.assertFalse(authorize_action("Manager", "create_incident"))
        self.assertFalse(authorize_action("Admin", "create_incident"))

    def test_rbac_incident_assignment(self):
        """TC-RBAC-002: Only Supervisor can assign incidents."""
        self.assertFalse(authorize_action("Operator", "assign_incident"))
        self.assertTrue(authorize_action("Supervisor", "assign_incident"))
        self.assertFalse(authorize_action("Manager", "assign_incident"))
        self.assertFalse(authorize_action("Maintenance", "assign_incident"))
        self.assertFalse(authorize_action("Admin", "assign_incident"))

    def test_rbac_maintenance_progress_update(self):
        """TC-RBAC-003: Only Maintenance can log progress notes."""
        self.assertFalse(authorize_action("Operator", "update_progress"))
        self.assertFalse(authorize_action("Supervisor", "update_progress"))
        self.assertFalse(authorize_action("Manager", "update_progress"))
        self.assertTrue(authorize_action("Maintenance", "update_progress"))
        self.assertFalse(authorize_action("Admin", "update_progress"))

    def test_rbac_incident_closure(self):
        """TC-RBAC-004: Only Supervisor and Maintenance can close incidents; Admin cannot close."""
        self.assertFalse(authorize_action("Operator", "close_incident"))
        self.assertTrue(authorize_action("Supervisor", "close_incident"))
        self.assertFalse(authorize_action("Manager", "close_incident"))
        self.assertTrue(authorize_action("Maintenance", "close_incident"))
        self.assertFalse(authorize_action("Admin", "close_incident"))

    def test_rbac_telemetry_injection(self):
        """TC-RBAC-005: Only Supervisor and Maintenance can inject simulated anomalies."""
        self.assertFalse(authorize_action("Operator", "inject_telemetry"))
        self.assertTrue(authorize_action("Supervisor", "inject_telemetry"))
        self.assertFalse(authorize_action("Manager", "inject_telemetry"))
        self.assertTrue(authorize_action("Maintenance", "inject_telemetry"))
        self.assertFalse(authorize_action("Admin", "inject_telemetry"))

    def test_rbac_user_management(self):
        """TC-RBAC-006: Only Admin can manage users."""
        self.assertFalse(authorize_action("Operator", "manage_users"))
        self.assertFalse(authorize_action("Supervisor", "manage_users"))
        self.assertFalse(authorize_action("Manager", "manage_users"))
        self.assertFalse(authorize_action("Maintenance", "manage_users"))
        self.assertTrue(authorize_action("Admin", "manage_users"))

if __name__ == "__main__":
    unittest.main()
