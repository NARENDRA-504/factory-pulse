#!/usr/bin/env python3
"""
ZIRO Digital Internship Program — Automated Telemetry Data Processor & Statistical Report Generator
Executes Week 1 & Week 3 data cleaning, validation gate, and statistical metrics across simulated & empirical telemetry.
"""

import sys
import os
import json
import datetime as dt

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api_server.telemetry_cleaner_and_stats import (
    clean_and_validate_telemetry_reading,
    batch_clean_telemetry,
    calculate_descriptive_statistics,
    compute_fleet_sensor_statistics,
    compute_manufacturing_kpis
)

def run_telemetry_processor_demo():
    print("=" * 80)
    print("ZIRO DIGITAL INTERNSHIP PROGRAM — TELEMETRY CLEANING & STATISTICAL ENGINE")
    print(f"Timestamp: {dt.datetime.now(dt.timezone.utc).isoformat()}")
    print("=" * 80)

    # Sample batch containing valid records, duplicates, invalid ranges, and missing values
    sample_batch = [
        {
            'machine_id': 'MCH-001',
            'timestamp': '2026-10-28T06:00:00Z',
            'temperature_celsius': 64.5,
            'vibration_rms_mms': 2.15,
            'motor_load_pct': 72.0,
            'motor_power_kw': 18.4,
            'spindle_speed_rpm': 4500.0,
            'machine_status': 'NORMAL'
        },
        {
            'machine_id': 'MCH-002',
            'timestamp': '2026-10-28T06:00:01Z',
            'temperature_celsius': 88.2,
            'vibration_rms_mms': 4.85,
            'motor_load_pct': 89.5,
            'motor_power_kw': 24.1,
            'spindle_speed_rpm': 4450.0,
            'machine_status': 'WARNING'
        },
        # Duplicate of MCH-001
        {
            'machine_id': 'MCH-001',
            'timestamp': '2026-10-28T06:00:00Z',
            'temperature_celsius': 64.5,
            'vibration_rms_mms': 2.15,
            'motor_load_pct': 72.0,
            'motor_power_kw': 18.4,
            'spindle_speed_rpm': 4500.0,
            'machine_status': 'NORMAL'
        },
        # Invalid extreme vibration reading (quarantined)
        {
            'machine_id': 'MCH-003',
            'timestamp': '2026-10-28T06:00:02Z',
            'temperature_celsius': 62.0,
            'vibration_rms_mms': 145.0, # Violates bounds [0, 30]
            'motor_load_pct': 60.0,
            'motor_power_kw': 15.0,
            'spindle_speed_rpm': 4500.0,
            'machine_status': 'NORMAL'
        },
        # Missing values (preserved as None per missing value policy)
        {
            'machine_id': 'MCH-004',
            'timestamp': '2026-10-28T06:00:03Z',
            'temperature_celsius': 70.1,
            'vibration_rms_mms': None, # Explicit missing value
            'motor_load_pct': 75.0,
            'motor_power_kw': None, # Explicit missing value
            'spindle_speed_rpm': 4500.0,
            'machine_status': 'NORMAL'
        }
    ]

    print("\n[PHASE 1.B]: Running Batch Telemetry Cleaning & Deduplication...")
    batch_result = batch_clean_telemetry(sample_batch)
    print(f"  Input Records: {batch_result['total_input_records']}")
    print(f"  Valid Clean Records: {batch_result['valid_records_count']}")
    print(f"  Quarantined Records: {batch_result['quarantined_count']}")
    print(f"  Duplicates Rejected: {batch_result['duplicates_rejected']}")
    print(f"  Validation Pass Rate: {batch_result['validation_pass_rate_pct']}%")

    for q in batch_result['quarantine_log']:
        print(f"    - Quarantined record idx={q['index']}: {', '.join(q['reasons'])}")

    print("\n[PHASE 1.C]: Computing Descriptive Statistics on Valid Telemetry...")
    clean_data = batch_result['clean_records']
    fleet_stats = compute_fleet_sensor_statistics(clean_data)

    for field, s in fleet_stats.items():
        print(f"\n  Metric: {field.upper()} ({s['unit']})")
        print(f"    Count: {s['count']} | Missing: {s['missing_count']}")
        print(f"    Mean: {s['mean']} | Median: {s['median']} | StdDev: {s['std_dev']}")
        print(f"    Min: {s['min']} | Max: {s['max']} | IQR: {s['iqr']}")

    print("\n[PHASE 3.A]: Computing Manufacturing KPIs (Availability, Downtime, MTBF, MTTR)...")
    kpis = compute_manufacturing_kpis(
        machines_count=50,
        total_planned_hours=24.0,
        total_downtime_hours=38.5,
        total_production_parts=14250,
        total_incidents=4,
        closed_incidents_resolution_hours=[1.2, 0.8, 2.4]
    )
    for k, v in kpis.items():
        print(f"  {k}: {v}")

    print("\n" + "=" * 80)
    print("TELEMETRY PROCESSING COMPLETED SUCCESSFULLY")
    print("=" * 80)

if __name__ == '__main__':
    run_telemetry_processor_demo()
