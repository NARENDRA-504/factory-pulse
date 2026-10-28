#!/usr/bin/env python3
"""
Test Suite: Python Telemetry Cleaning, Validation & Statistical Processing
Validates Phase 1 Week 1 & Week 3 requirements:
- Machine ID validation
- Timestamp validation & future/ancient timestamp filtering
- Missing value policies (explicit null preservation, no silent imputation)
- Sensor physical boundary validation & quarantine logging
- Deduplication and idempotency
- Descriptive statistics (Mean, Median, Min, Max, StdDev, Count, Missing Count)
- Manufacturing KPIs (Availability, Downtime %, MTBF, MTTR)
"""

import unittest
import math
import datetime as dt

from api_server.telemetry_cleaner_and_stats import (
    clean_and_validate_telemetry_reading,
    batch_clean_telemetry,
    calculate_descriptive_statistics,
    compute_fleet_sensor_statistics,
    compute_manufacturing_kpis,
    parse_timestamp
)

class TestTelemetryCleanerAndStats(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 10, 28, 12, 0, 0, tzinfo=dt.timezone.utc)

    def test_valid_reading_passes(self):
        raw = {
            'machine_id': 'MCH-001',
            'timestamp': '2026-10-28T12:00:00Z',
            'temperature_celsius': 65.4,
            'vibration_rms_mms': 2.3,
            'motor_load_pct': 74.0,
            'motor_power_kw': 19.5,
            'spindle_speed_rpm': 4500.0,
            'machine_status': 'NORMAL'
        }
        res = clean_and_validate_telemetry_reading(raw, now=self.now)
        self.assertTrue(res.is_valid)
        self.assertEqual(res.cleaned_data['machine_id'], 'MCH-001')
        self.assertEqual(res.cleaned_data['temperature_celsius'], 65.4)
        self.assertEqual(res.cleaned_data['vibration_rms_mms'], 2.3)

    def test_missing_machine_id_rejected(self):
        raw = {'timestamp': '2026-10-28T12:00:00Z', 'temperature_celsius': 65.0}
        res = clean_and_validate_telemetry_reading(raw, now=self.now)
        self.assertFalse(res.is_valid)
        self.assertTrue(any('Missing machine identifier' in err for err in res.error_reasons))

    def test_future_timestamp_rejected(self):
        future_ts = (self.now + dt.timedelta(hours=2)).isoformat()
        raw = {'machine_id': 'MCH-002', 'timestamp': future_ts, 'temperature_celsius': 60.0}
        res = clean_and_validate_telemetry_reading(raw, now=self.now)
        self.assertFalse(res.is_valid)
        self.assertTrue(any('too far in future' in err for err in res.error_reasons))

    def test_nan_and_inf_rejected(self):
        raw = {'machine_id': 'MCH-003', 'timestamp': '2026-10-28T12:00:00Z', 'temperature_celsius': float('nan')}
        res = clean_and_validate_telemetry_reading(raw, now=self.now)
        self.assertFalse(res.is_valid)
        self.assertTrue(any('NaN or Infinity' in err for err in res.error_reasons))

    def test_physical_boundary_violation_quarantined(self):
        # Vibration exceeds physical ceiling 30 mm/s
        raw = {'machine_id': 'MCH-004', 'timestamp': '2026-10-28T12:00:00Z', 'vibration_rms_mms': 85.0}
        res = clean_and_validate_telemetry_reading(raw, now=self.now)
        self.assertFalse(res.is_valid)
        self.assertTrue(any('exceeds physical bounds' in err for err in res.error_reasons))

    def test_missing_value_policy_preserves_none(self):
        # Missing values must be kept as None, not silently converted to 0
        raw = {
            'machine_id': 'MCH-005',
            'timestamp': '2026-10-28T12:00:00Z',
            'temperature_celsius': 72.0,
            'vibration_rms_mms': None
        }
        res = clean_and_validate_telemetry_reading(raw, now=self.now)
        self.assertTrue(res.is_valid)
        self.assertIsNone(res.cleaned_data['vibration_rms_mms'])

    def test_batch_deduplication(self):
        records = [
            {'machine_id': 'MCH-001', 'timestamp': '2026-10-28T12:00:00Z', 'temperature_celsius': 60.0},
            {'machine_id': 'MCH-001', 'timestamp': '2026-10-28T12:00:00Z', 'temperature_celsius': 60.0}, # duplicate
            {'machine_id': 'MCH-001', 'timestamp': '2026-10-28T12:01:00Z', 'temperature_celsius': 61.0},
        ]
        batch_out = batch_clean_telemetry(records, now=self.now + dt.timedelta(minutes=5))
        self.assertEqual(batch_out['total_input_records'], 3)
        self.assertEqual(batch_out['valid_records_count'], 2)
        self.assertEqual(batch_out['duplicates_rejected'], 1)
        self.assertEqual(batch_out['quarantined_count'], 1)

    def test_descriptive_statistics_calculations(self):
        # Series: [10, 20, 30, 40, 50, None]
        series = [10.0, 20.0, 30.0, 40.0, 50.0, None]
        stats = calculate_descriptive_statistics(series)
        self.assertEqual(stats['count'], 5)
        self.assertEqual(stats['missing_count'], 1)
        self.assertEqual(stats['mean'], 30.0)
        self.assertEqual(stats['median'], 30.0)
        self.assertEqual(stats['min'], 10.0)
        self.assertEqual(stats['max'], 50.0)
        # sample std dev of [10, 20, 30, 40, 50]: sqrt(1000/4) = sqrt(250) ≈ 15.811
        self.assertAlmostEqual(stats['std_dev'], 15.811, places=2)

    def test_manufacturing_kpis_computation(self):
        kpis = compute_manufacturing_kpis(
            machines_count=50,
            total_planned_hours=24.0,     # 50 * 24 = 1200 planned hours
            total_downtime_hours=60.0,    # 60 hrs downtime
            total_production_parts=25000,
            total_incidents=5,
            closed_incidents_resolution_hours=[2.0, 1.5, 2.5]
        )
        self.assertEqual(kpis['active_machines'], 50)
        self.assertEqual(kpis['planned_production_hours'], 1200.0)
        self.assertEqual(kpis['operating_hours'], 1140.0)
        self.assertEqual(kpis['downtime_pct'], 5.0)
        self.assertEqual(kpis['availability_pct'], 95.0)
        # MTBF = 1140 / 5 = 228.0 hrs
        self.assertEqual(kpis['mtbf_hours'], 228.0)
        # MTTR = (2.0 + 1.5 + 2.5) / 3 = 2.0 hrs
        self.assertEqual(kpis['mttr_hours'], 2.0)

if __name__ == '__main__':
    unittest.main()
