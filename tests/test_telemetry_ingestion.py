"""Behavioral checks for the AI Simulator's raw per-sensor record contract."""
import contextlib
import os
import sqlite3
import sys
import types
import unittest
from unittest.mock import patch

try:
    from fastapi import HTTPException
    from pydantic import ValidationError
    from api_server import main as api
except ModuleNotFoundError as exc:
    if exc.name in {"fastapi", "pydantic", "dotenv"}:
        raise unittest.SkipTest(f"API test dependencies are not installed: {exc.name}")
    raise


class _SQLiteResult:
    def __init__(self, cursor):
        self.cursor = cursor

    def mappings(self):
        return self

    def first(self):
        row = self.cursor.fetchone()
        return dict(row) if row is not None else None

    def all(self):
        return [dict(row) for row in self.cursor.fetchall()]

    def scalar_one(self):
        return self.cursor.fetchone()[0]


class _SQLiteConnection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, statement, parameters=None):
        return _SQLiteResult(self.connection.execute(str(statement), parameters or {}))


class _SQLiteEngine:
    """Isolated sqlite3 test database exposing the connection methods used by the repository."""
    def __init__(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row

    @contextlib.contextmanager
    def begin(self):
        self.connection.execute("BEGIN")
        try:
            yield _SQLiteConnection(self.connection)
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise

    @contextlib.contextmanager
    def connect(self):
        yield _SQLiteConnection(self.connection)

    def dispose(self):
        self.connection.close()


class SimulatorTelemetryIngestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # The repository's SQL is deliberately exercised against isolated sqlite3;
        # expose the tiny sqlalchemy.text/IntegrityError surface used by production code.
        cls._previous_sqlalchemy = sys.modules.get("sqlalchemy")
        cls._previous_sqlalchemy_exc = sys.modules.get("sqlalchemy.exc")
        sqlalchemy_module = types.ModuleType("sqlalchemy")
        sqlalchemy_module.text = lambda query: query
        sqlalchemy_exc_module = types.ModuleType("sqlalchemy.exc")
        sqlalchemy_exc_module.IntegrityError = type("IntegrityError", (Exception,), {})
        sys.modules["sqlalchemy"] = sqlalchemy_module
        sys.modules["sqlalchemy.exc"] = sqlalchemy_exc_module

    @classmethod
    def tearDownClass(cls):
        if cls._previous_sqlalchemy is None:
            sys.modules.pop("sqlalchemy", None)
        else:
            sys.modules["sqlalchemy"] = cls._previous_sqlalchemy
        if cls._previous_sqlalchemy_exc is None:
            sys.modules.pop("sqlalchemy.exc", None)
        else:
            sys.modules["sqlalchemy.exc"] = cls._previous_sqlalchemy_exc

    def setUp(self):
        self.engine = _SQLiteEngine()
        with self.engine.begin() as connection:
            connection.execute("""
                CREATE TABLE simulator_sensor_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reading_id VARCHAR(128) UNIQUE NOT NULL,
                    machine_id VARCHAR(32) NOT NULL,
                    machine_code VARCHAR(32) NOT NULL,
                    reading_timestamp TIMESTAMP NOT NULL,
                    machine_type VARCHAR(128) NOT NULL,
                    department VARCHAR(128) NOT NULL,
                    production_line VARCHAR(128) NOT NULL,
                    sensor_name VARCHAR(128) NOT NULL,
                    sensor_unit VARCHAR(32) NOT NULL,
                    sensor_value_json TEXT NOT NULL,
                    expected_min FLOAT NOT NULL,
                    expected_max FLOAT NOT NULL,
                    machine_status VARCHAR(16) NOT NULL,
                    data_quality VARCHAR(16) NOT NULL,
                    fault_mode VARCHAR(128),
                    data_provenance VARCHAR(16) NOT NULL,
                    data_source VARCHAR(32) NOT NULL
                )
            """)
        self.payload_data = {
            "reading_id": "READ-7D11014C997A",
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
        self.payload = api.SimulatorTelemetryIngest(**self.payload_data)
        self.machine = api.resolve_canonical_machine("MCH-001")

    def tearDown(self):
        self.engine.dispose()

    def test_valid_simulator_record_persists_with_identity_and_is_retrievable(self):
        duplicate = api.persist_simulator_reading(self.payload, self.machine, self.engine)
        self.assertFalse(duplicate)
        with patch.object(api, "get_telemetry_engine", return_value=self.engine):
            records = api.get_simulator_telemetry_readings("MCH-001", user={"work_id": "OP-101"})
        self.assertEqual(len(records), 1)
        record = records[0]
        self.assertEqual(record.machine_id, "MCH-001")
        self.assertEqual(record.machine_code, "CNC-5AX-001")
        self.assertEqual(record.display_name, self.machine["displayName"])
        self.assertEqual(record.sensor_value, 1.32)
        self.assertEqual(record.data_provenance, "SIMULATED")

    def test_retrieval_filters_are_bounded_and_ordered(self):
        api.persist_simulator_reading(self.payload, self.machine, self.engine)
        newer = api.SimulatorTelemetryIngest(**{
            **self.payload_data,
            "reading_id": "READ-7D11014C9980",
            "timestamp": "2026-10-26T10:31:00+00:00",
            "sensor_value": 1.8,
        })
        api.persist_simulator_reading(newer, self.machine, self.engine)
        with patch.object(api, "get_telemetry_engine", return_value=self.engine):
            records = api.get_simulator_telemetry_readings(
                "MCH-001", limit=1, sensor_name="Vibration", data_source="ai_simulator",
                user={"work_id": "SUP-201", "role": "Supervisor"},
            )
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].reading_id, "READ-7D11014C9980")
        with self.assertRaises(HTTPException) as error:
            api.get_simulator_telemetry_readings("MCH-001", limit=1001, user={"role": "Supervisor"})
        self.assertEqual(error.exception.status_code, 422)

    def test_database_write_failure_does_not_report_success(self):
        class FailingEngine:
            @contextlib.contextmanager
            def begin(self):
                raise OSError("private database detail")
                yield

        with self.assertRaises(HTTPException) as error:
            api.persist_simulator_reading(self.payload, self.machine, FailingEngine())
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.detail, "Telemetry database is unavailable")

    def test_server_uses_canonical_metadata_instead_of_request_labels(self):
        payload = api.SimulatorTelemetryIngest(**{
            **self.payload_data,
            "machine_type": "forged type",
            "department": "forged department",
            "production_line": "forged line",
        })
        with patch.object(api, "get_telemetry_engine", return_value=self.engine):
            result = api.ingest_simulator_telemetry(payload, None)
        self.assertEqual(result.machine_code, "CNC-5AX-001")
        with self.engine.connect() as connection:
            row = connection.execute(
                "SELECT machine_type, department, production_line FROM simulator_sensor_readings"
            ).first()
        self.assertEqual(row["machine_type"], self.machine["machineType"])
        self.assertEqual(row["department"], self.machine["shopFloor"])
        self.assertEqual(row["production_line"], self.machine["productionLine"])

    def test_identical_retry_is_idempotent_and_changed_payload_conflicts(self):
        api.persist_simulator_reading(self.payload, self.machine, self.engine)
        self.assertTrue(api.persist_simulator_reading(self.payload, self.machine, self.engine))
        changed = api.SimulatorTelemetryIngest(**{**self.payload_data, "sensor_value": 2.0})
        with self.assertRaises(HTTPException) as error:
            api.persist_simulator_reading(changed, self.machine, self.engine)
        self.assertEqual(error.exception.status_code, 409)
        with self.engine.connect() as connection:
            count = connection.execute("SELECT COUNT(*) FROM simulator_sensor_readings").scalar_one()
        self.assertEqual(count, 1)

    def test_validation_rejects_missing_bad_time_bad_status_nonfinite_and_extra_fields(self):
        missing_sensor = {key: value for key, value in self.payload_data.items() if key != "sensor_name"}
        for candidate in (
            missing_sensor,
            {**self.payload_data, "timestamp": "2026-10-26T10:30:00"},
            {**self.payload_data, "machine_status": "BROKEN"},
            {**self.payload_data, "expected_min": 5, "expected_max": 1},
            {**self.payload_data, "expected_max": float("inf")},
            {**self.payload_data, "extra_metric": 123},
        ):
            with self.subTest(candidate=candidate):
                with self.assertRaises(ValidationError):
                    api.SimulatorTelemetryIngest(**candidate)

    def test_noisy_fault_values_are_preserved_without_coercion(self):
        for raw_value in (None, "ERROR", -999.0, 999999.0):
            payload = api.SimulatorTelemetryIngest(**{
                **self.payload_data,
                "reading_id": f"READ-NOISY-{str(raw_value)}",
                "sensor_value": raw_value,
                "data_quality": "NOISY",
            })
            api.persist_simulator_reading(payload, self.machine, self.engine)
        with patch.object(api, "get_telemetry_engine", return_value=self.engine):
            records = api.get_simulator_telemetry_readings("MCH-001", user={"work_id": "OP-101"})
        values = {record.sensor_value for record in records}
        self.assertEqual(values, {None, "ERROR", -999.0, 999999.0})

    def test_unknown_machine_and_bad_key_are_rejected(self):
        with self.assertRaises(HTTPException) as error:
            api.resolve_canonical_machine("MCH-999")
        self.assertEqual(error.exception.status_code, 422)
        with patch.dict(os.environ, {"SIMULATOR_API_KEY": "test-secret"}):
            with self.assertRaises(HTTPException) as auth_error:
                api.require_simulator_api_key("wrong")
            self.assertEqual(auth_error.exception.status_code, 401)
            self.assertIsNone(api.require_simulator_api_key("test-secret"))

    def test_sensor_unit_must_match_simulator_profile(self):
        payload = api.SimulatorTelemetryIngest(**{**self.payload_data, "sensor_unit": "in/s"})
        with self.assertRaises(HTTPException) as error:
            api.validate_simulator_sensor_unit(payload)
        self.assertEqual(error.exception.status_code, 422)

    def test_operator_cannot_read_another_machines_telemetry(self):
        with self.assertRaises(HTTPException) as error:
            api.get_simulator_telemetry_readings(
                "MCH-002", user={"role": "Operator", "assigned_machine": "CNC-5AX-001"}
            )
        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
