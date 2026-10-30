"""Batch delivery atomicity and retry tests using an isolated SQL database."""
import unittest
from unittest.mock import patch
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from api_server import main as api
from api_server.telemetry_batch import persist_batch


class BatchIngestionTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
        with self.engine.begin() as c:
            c.execute(text('''CREATE TABLE simulator_sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT, reading_id TEXT UNIQUE, machine_id TEXT,
                machine_code TEXT, reading_timestamp TIMESTAMP, machine_type TEXT, department TEXT,
                production_line TEXT,sensor_name TEXT,sensor_unit TEXT,sensor_value_json TEXT,
                expected_min REAL,expected_max REAL,machine_status TEXT,data_quality TEXT,fault_mode TEXT,
                data_provenance TEXT,data_source TEXT)'''))
        self.row=dict(reading_id='BATCH-1',timestamp='2026-10-30T10:00:00Z',machine_id='MCH-001',
            machine_type='type',department='floor',production_line='line',sensor_name='RPM',
            sensor_unit='RPM',sensor_value=2400,expected_min=1000,expected_max=5000,
            machine_status='NORMAL',data_quality='GOOD',fault_mode=None)

    def tearDown(self):
        self.engine.dispose()

    def test_repeat_batch_is_idempotent(self):
        rows=[api.SimulatorTelemetryIngest(**dict(self.row,reading_id=f'BATCH-{n}')) for n in range(3)]
        self.assertEqual(persist_batch(rows,api.__dict__,self.engine)['stored'],3)
        result=persist_batch(rows,api.__dict__,self.engine)
        self.assertEqual(result['stored'],0)
        self.assertEqual(result['duplicates'],3)

    def test_conflicting_retry_does_not_insert_other_rows(self):
        persist_batch([api.SimulatorTelemetryIngest(**self.row)],api.__dict__,self.engine)
        with self.assertRaises(api.HTTPException) as error:
            persist_batch([api.SimulatorTelemetryIngest(**dict(self.row,reading_id='NEW')),
                api.SimulatorTelemetryIngest(**dict(self.row,sensor_value=9999))],api.__dict__,self.engine)
        self.assertEqual(error.exception.status_code,409)
        with self.engine.connect() as c:
            self.assertEqual(c.execute(text('SELECT COUNT(*) FROM simulator_sensor_readings')).scalar(),1)

    def test_http_authentication_bounds_and_commit(self):
        with patch.dict('os.environ',{'SIMULATOR_API_KEY':'isolated-test-key'}), patch.object(api,'get_telemetry_engine',return_value=self.engine):
            with TestClient(api.app) as client:
                self.assertEqual(client.get('/api/v1/telemetry/capabilities').status_code,401)
                headers={'X-Simulator-API-Key':'isolated-test-key'}
                self.assertEqual(client.get('/api/v1/telemetry/capabilities',headers=headers).json()['max_batch_readings'],100)
                self.assertEqual(client.post('/api/v1/telemetry/batch',headers=headers,json={'readings':[self.row]*101}).status_code,422)
                response=client.post('/api/v1/telemetry/batch',headers=headers,json={'readings':[self.row]})
                self.assertEqual(response.status_code,200)
                self.assertEqual(response.json()['accepted_reading_ids'],['BATCH-1'])
                self.assertEqual(client.post('/api/v1/telemetry/batch',headers=headers,json={'readings':[dict(self.row,sensor_unit='bar')]}).status_code,422)
