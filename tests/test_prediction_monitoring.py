import datetime as dt
import unittest
from unittest.mock import patch
from api_server import health_model


class PredictionMonitoringTests(unittest.TestCase):
    def test_unavailable_prediction_has_monitoring_and_cannot_enable_alerts(self):
        now = dt.datetime.now(dt.timezone.utc)
        with patch.object(health_model, 'model_status', return_value={'status': 'unavailable'}):
            result = health_model.predict_machine([], now)
        self.assertEqual(result['checked_at'], now.isoformat())
        self.assertEqual(result['max_reading_age_seconds'], 30)
        self.assertTrue(result['advisory_only'])
        self.assertFalse(result['alerts_enabled'])

    def test_insufficient_prediction_keeps_version(self):
        with patch.object(health_model, 'model_status', return_value={'status': 'shadow_only', 'version': 2, 'model': 'fixture'}):
            result = health_model.predict_machine([], dt.datetime.now(dt.timezone.utc))
        self.assertEqual(result['status'], 'insufficient_data')
        self.assertEqual(result['version'], 2)
        self.assertEqual(len(result['missing_or_invalid_sensors']), 7)
        self.assertFalse(result['alerts_enabled'])
