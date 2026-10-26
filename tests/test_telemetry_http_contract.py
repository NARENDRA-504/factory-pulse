"""FastAPI request/validation checks that do not require a configured database."""
import os
import unittest
from unittest.mock import patch

try:
    from fastapi.testclient import TestClient
    from api_server import main as api
except ModuleNotFoundError as exc:
    if exc.name in {"fastapi", "pydantic", "dotenv", "httpx"}:
        raise unittest.SkipTest(f"API HTTP test dependencies are not installed: {exc.name}")
    raise


class TelemetryHttpContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._previous_key = os.environ.get("SIMULATOR_API_KEY")
        os.environ["SIMULATOR_API_KEY"] = "http-test-secret"
        cls.client = TestClient(api.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        if cls._previous_key is None:
            os.environ.pop("SIMULATOR_API_KEY", None)
        else:
            os.environ["SIMULATOR_API_KEY"] = cls._previous_key

    def setUp(self):
        self.payload = {
            "reading_id": "READ-HTTP-001",
            "timestamp": "2026-10-26T10:30:00+00:00",
            "machine_id": "MCH-001",
            "machine_type": "5-Axis CNC Machining Center",
            "department": "Floor A1: Aerospace Micro-Milling",
            "production_line": "Line 5AX-01",
            "sensor_name": "Vibration",
            "sensor_unit": "mm/s",
            "sensor_value": 1.32,
            "expected_min": 0.5,
            "expected_max": 5,
            "machine_status": "NORMAL",
            "data_quality": "GOOD",
            "fault_mode": None,
        }
        self.headers = {"X-Simulator-API-Key": "http-test-secret"}

    def test_matching_simulator_payload_is_accepted_with_canonical_identity(self):
        with patch.object(api, "persist_simulator_reading", return_value=False):
            response = self.client.post("/api/v1/telemetry", json=self.payload, headers=self.headers)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["machine_id"], "MCH-001")
        self.assertEqual(response.json()["machine_code"], "CNC-5AX-001")
        self.assertEqual(response.json()["data_provenance"], "SIMULATED")

    def test_auth_unknown_machine_schema_and_unit_errors_are_rejected(self):
        with patch.object(api, "persist_simulator_reading", return_value=False):
            self.assertEqual(self.client.post("/api/v1/telemetry", json=self.payload).status_code, 401)
            bad_key = self.client.post("/api/v1/telemetry", json=self.payload,
                                       headers={"X-Simulator-API-Key": "wrong"})
            self.assertEqual(bad_key.status_code, 401)
            unknown = self.client.post("/api/v1/telemetry",
                json={**self.payload, "machine_id": "MCH-999"}, headers=self.headers)
            self.assertEqual(unknown.status_code, 422)
            bad_unit = self.client.post("/api/v1/telemetry",
                json={**self.payload, "sensor_unit": "in/s"}, headers=self.headers)
            self.assertEqual(bad_unit.status_code, 422)
            bad_status = self.client.post("/api/v1/telemetry",
                json={**self.payload, "machine_status": "BROKEN"}, headers=self.headers)
            self.assertEqual(bad_status.status_code, 422)

    def test_idempotent_retry_returns_success_without_a_second_write(self):
        with patch.object(api, "persist_simulator_reading", return_value=True):
            response = self.client.post("/api/v1/telemetry", json=self.payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stored"], 0)
        self.assertTrue(response.json()["duplicate"])

    def test_request_size_limit_rejects_oversized_payload(self):
        oversized = {**self.payload, "padding": "x" * (17 * 1024)}
        response = self.client.post("/api/v1/telemetry", json=oversized, headers=self.headers)
        self.assertEqual(response.status_code, 413)

    def test_retrieval_requires_user_auth_and_limits_operator_to_assignment(self):
        self.assertEqual(self.client.get("/api/v1/telemetry/latest/MCH-001").status_code, 401)
        headers = {"Authorization": "Bearer OP-101"}
        forbidden = self.client.get("/api/v1/telemetry/latest/MCH-002", headers=headers)
        self.assertEqual(forbidden.status_code, 403)
        bad_range = self.client.get(
            "/api/v1/telemetry/latest/MCH-001?since=2026-10-26T10:30:00&until=2026-10-26T10:00:00Z",
            headers=headers,
        )
        self.assertEqual(bad_range.status_code, 422)


if __name__ == "__main__":
    unittest.main()
