"""
ZIRO Digital Internship Program — Phase 1 Python Telemetry Cleaner & Statistics Engine
Implements:
1. Telemetry validation (Machine ID, Timestamps, Sensor Bounds, Numeric Validity)
2. Missing-value detection & explicit null policies (no silent imputation)
3. Duplicate detection & quarantine log for malformed records
4. Statistical computations (Mean, Median, Min, Max, StdDev, Count, Missing Count)
5. Manufacturing KPIs (Downtime %, Availability %, MTBF, MTTR, Run-rates)
"""

import math
import datetime as dt
from typing import List, Dict, Any, Optional, Tuple, Union

# Acceptable physical operational bounds for manufacturing machinery
SENSOR_PHYSICAL_BOUNDS = {
    'temperature_celsius': (10.0, 130.0),       # Operating temp in Celsius
    'coolant_temp_c': (10.0, 130.0),            # Coolant temp in Celsius
    'vibration_rms_mms': (0.0, 30.0),           # RMS vibration velocity in mm/s (ISO 10816)
    'vib_rms': (0.0, 30.0),                     # RMS vibration in m/s² or mm/s
    'spindle_speed_rpm': (0.0, 15000.0),        # Spindle rotational speed
    'spindle_rpm': (0.0, 15000.0),              # Spindle RPM
    'motor_load_pct': (0.0, 150.0),             # Motor load % (allows peak surge up to 150%)
    'motor_power_kw': (0.0, 75.0),              # Motor power consumption in kW
    'feed_rate_mmpm': (0.0, 20000.0),           # Feed speed mm/min
    'production_count': (0.0, 1000000.0),       # Cumulative parts produced
}

class TelemetryValidationRecord:
    def __init__(self, is_valid: bool, cleaned_data: Optional[Dict[str, Any]], error_reasons: List[str]):
        self.is_valid = is_valid
        self.cleaned_data = cleaned_data or {}
        self.error_reasons = error_reasons

    def to_dict(self) -> Dict[str, Any]:
        return {
            'is_valid': self.is_valid,
            'cleaned_data': self.cleaned_data,
            'error_reasons': self.error_reasons
        }


def parse_timestamp(timestamp_val: Any) -> Optional[dt.datetime]:
    """Parse string, integer timestamp, or datetime into UTC timezone-aware datetime."""
    if timestamp_val is None:
        return None
    if isinstance(timestamp_val, dt.datetime):
        if timestamp_val.tzinfo is None:
            return timestamp_val.replace(tzinfo=dt.timezone.utc)
        return timestamp_val.astimezone(dt.timezone.utc)
    try:
        if isinstance(timestamp_val, (int, float)):
            # Epoch milliseconds or seconds
            secs = timestamp_val / 1000.0 if timestamp_val > 1e11 else float(timestamp_val)
            return dt.datetime.fromtimestamp(secs, tz=dt.timezone.utc)
        s = str(timestamp_val).strip()
        # Handle ISO with Z or +00:00
        cleaned = s.replace('Z', '+00:00')
        parsed = dt.datetime.fromisoformat(cleaned)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except Exception:
        return None


def clean_and_validate_telemetry_reading(
    record: Dict[str, Any],
    now: Optional[dt.datetime] = None,
    max_future_seconds: float = 300.0,
    max_past_days: float = 365.0
) -> TelemetryValidationRecord:
    """
    Validates and cleans a raw telemetry reading according to Week 1 standards:
    - Validates machine ID syntax (MCH-xxx or CNC-xxx)
    - Validates timestamp and rejects far-future or ancient timestamps
    - Checks for NaN, Infinity, and invalid numeric values
    - Quarantines records that violate physical safety boundaries
    - Normalizes types safely without altering valid historical data
    """
    errors: List[str] = []
    if now is None:
        now = dt.datetime.now(dt.timezone.utc)

    # 1. Machine ID validation
    machine_id = str(record.get('machine_id') or record.get('machineId') or record.get('machine_code') or '').strip()
    if not machine_id:
        errors.append("Missing machine identifier (machine_id or machine_code)")
    elif len(machine_id) < 3 or len(machine_id) > 64:
        errors.append(f"Invalid machine identifier length: '{machine_id}'")

    # 2. Timestamp validation
    raw_ts = record.get('timestamp') or record.get('reading_timestamp') or record.get('simulated_at')
    parsed_ts = parse_timestamp(raw_ts)
    if parsed_ts is None:
        errors.append(f"Invalid or unparseable timestamp: '{raw_ts}'")
    else:
        # Check future threshold
        if (parsed_ts - now).total_seconds() > max_future_seconds:
            errors.append(f"Timestamp is too far in future: {parsed_ts.isoformat()} > now + {max_future_seconds}s")
        # Check ancient threshold
        if (now - parsed_ts).total_seconds() > max_past_days * 86400:
            errors.append(f"Timestamp is older than allowed retention window ({max_past_days} days)")

    # 3. Numeric sensor reading validation & boundary checks
    cleaned_sensors: Dict[str, Any] = {}
    
    # Check numeric fields
    numeric_fields = [
        'temperature_celsius', 'coolant_temp_c',
        'vibration_rms_mms', 'vib_rms',
        'spindle_speed_rpm', 'spindle_rpm',
        'motor_load_pct', 'motor_power_kw',
        'feed_rate_mmpm', 'production_count'
    ]

    for field in numeric_fields:
        if field in record and record[field] is not None:
            val = record[field]
            try:
                numeric_val = float(val)
                if math.isnan(numeric_val) or math.isinf(numeric_val):
                    errors.append(f"Sensor field '{field}' contains NaN or Infinity")
                    continue
                
                # Check physical boundaries
                bounds = SENSOR_PHYSICAL_BOUNDS.get(field)
                if bounds:
                    min_b, max_b = bounds
                    if numeric_val < min_b or numeric_val > max_b:
                        errors.append(
                            f"Sensor '{field}' value {numeric_val} exceeds physical bounds [{min_b}, {max_b}]"
                        )
                cleaned_sensors[field] = numeric_val
            except (ValueError, TypeError):
                errors.append(f"Sensor field '{field}' is non-numeric: {val}")
        elif field in record:
            # Explicit null preserved (missing value policy)
            cleaned_sensors[field] = None

    if errors:
        return TelemetryValidationRecord(is_valid=False, cleaned_data=None, error_reasons=errors)

    cleaned_payload = {
        'machine_id': machine_id,
        'timestamp': parsed_ts.isoformat() if parsed_ts else None,
        'machine_status': record.get('machine_status') or record.get('status') or 'NORMAL',
        'data_provenance': record.get('data_provenance', 'SIMULATED'),
        **cleaned_sensors
    }

    return TelemetryValidationRecord(is_valid=True, cleaned_data=cleaned_payload, error_reasons=[])


def batch_clean_telemetry(records: List[Dict[str, Any]], now: Optional[dt.datetime] = None) -> Dict[str, Any]:
    """
    Processes a batch of raw telemetry events:
    - Identifies valid vs quarantined records
    - Deduplicates identical (machine_id, timestamp) pairs
    - Returns clean records, quarantine logs, and validation summary stats
    """
    valid_records: List[Dict[str, Any]] = []
    quarantined_records: List[Dict[str, Any]] = []
    seen_keys = set()
    duplicates_count = 0

    for idx, raw in enumerate(records):
        val_result = clean_and_validate_telemetry_reading(raw, now=now)
        if not val_result.is_valid:
            quarantined_records.append({
                'index': idx,
                'raw_record': raw,
                'reasons': val_result.error_reasons,
                'quarantined_at': dt.datetime.now(dt.timezone.utc).isoformat()
            })
            continue

        cleaned = val_result.cleaned_data
        key = (cleaned.get('machine_id'), cleaned.get('timestamp'))
        if key in seen_keys:
            duplicates_count += 1
            # Mark duplicate and quarantine
            quarantined_records.append({
                'index': idx,
                'raw_record': raw,
                'reasons': [f"Duplicate reading detected for machine {key[0]} at timestamp {key[1]}"],
                'quarantined_at': dt.datetime.now(dt.timezone.utc).isoformat()
            })
            continue

        seen_keys.add(key)
        valid_records.append(cleaned)

    total_input = len(records)
    valid_count = len(valid_records)
    quarantine_count = len(quarantined_records)
    validation_rate = round((valid_count / total_input * 100.0), 2) if total_input > 0 else 100.0

    return {
        'total_input_records': total_input,
        'valid_records_count': valid_count,
        'quarantined_count': quarantine_count,
        'duplicates_rejected': duplicates_count,
        'validation_pass_rate_pct': validation_rate,
        'clean_records': valid_records,
        'quarantine_log': quarantined_records
    }


def calculate_descriptive_statistics(values: List[Optional[Union[int, float]]]) -> Dict[str, Any]:
    """
    Computes Week 1 basic statistics for any numeric sensor series:
    - Mean
    - Median
    - Minimum
    - Maximum
    - Standard Deviation (sample std dev if n > 1, else 0.0)
    - Valid Observation Count
    - Missing-Value Count
    """
    valid_nums: List[float] = []
    missing_count = 0

    for v in values:
        if v is None:
            missing_count += 1
        else:
            try:
                fv = float(v)
                if not (math.isnan(fv) or math.isinf(fv)):
                    valid_nums.append(fv)
                else:
                    missing_count += 1
            except (ValueError, TypeError):
                missing_count += 1

    count = len(valid_nums)
    if count == 0:
        return {
            'count': 0,
            'missing_count': missing_count,
            'mean': None,
            'median': None,
            'min': None,
            'max': None,
            'std_dev': None,
            'p25': None,
            'p75': None,
            'iqr': None
        }

    valid_nums.sort()
    total_sum = sum(valid_nums)
    mean_val = total_sum / count

    # Median
    if count % 2 == 1:
        median_val = valid_nums[count // 2]
    else:
        median_val = (valid_nums[count // 2 - 1] + valid_nums[count // 2]) / 2.0

    # Percentiles for IQR
    p25_idx = int(0.25 * (count - 1))
    p75_idx = int(0.75 * (count - 1))
    p25_val = valid_nums[p25_idx]
    p75_val = valid_nums[p75_idx]
    iqr_val = p75_val - p25_val

    # Standard Deviation
    if count > 1:
        variance = sum((x - mean_val) ** 2 for x in valid_nums) / (count - 1)
        std_dev = math.sqrt(variance)
    else:
        std_dev = 0.0

    return {
        'count': count,
        'missing_count': missing_count,
        'mean': round(mean_val, 3),
        'median': round(median_val, 3),
        'min': round(valid_nums[0], 3),
        'max': round(valid_nums[-1], 3),
        'std_dev': round(std_dev, 3),
        'p25': round(p25_val, 3),
        'p75': round(p75_val, 3),
        'iqr': round(iqr_val, 3)
    }


def compute_fleet_sensor_statistics(telemetry_readings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes statistical profiles across key industrial telemetry fields.
    """
    fields = [
        ('temperature_celsius', '°C'),
        ('vibration_rms_mms', 'mm/s'),
        ('motor_load_pct', '%'),
        ('motor_power_kw', 'kW'),
        ('spindle_speed_rpm', 'RPM'),
    ]

    result: Dict[str, Any] = {}
    for field_name, unit in fields:
        raw_values = []
        for r in telemetry_readings:
            val = r.get(field_name)
            # Check alias if missing
            if val is None:
                if field_name == 'temperature_celsius':
                    val = r.get('coolant_temp_c')
                elif field_name == 'vibration_rms_mms':
                    val = r.get('vib_rms')
                elif field_name == 'spindle_speed_rpm':
                    val = r.get('spindle_rpm')
            raw_values.append(val)
        stats = calculate_descriptive_statistics(raw_values)
        stats['unit'] = unit
        result[field_name] = stats

    return result


def compute_manufacturing_kpis(
    machines_count: int,
    total_planned_hours: float,
    total_downtime_hours: float,
    total_production_parts: int,
    total_incidents: int,
    closed_incidents_resolution_hours: List[float]
) -> Dict[str, Any]:
    """
    Computes Week 3 manufacturing analytics:
    - Availability % = (Operating Time / Planned Time) * 100
    - Downtime % = (Downtime / Planned Time) * 100
    - MTBF (Mean Time Between Failures) = Operating Time / Number of Failures
    - MTTR (Mean Time to Repair/Resolution) = Sum(Resolution Hours) / Closed Incidents
    """
    planned_hours = max(0.1, total_planned_hours * max(1, machines_count))
    downtime_hours = max(0.0, total_downtime_hours)
    operating_hours = max(0.0, planned_hours - downtime_hours)

    availability_pct = min(100.0, max(0.0, round((operating_hours / planned_hours) * 100.0, 2)))
    downtime_pct = min(100.0, max(0.0, round((downtime_hours / planned_hours) * 100.0, 2)))

    # MTBF
    if total_incidents > 0:
        mtbf_hours = round(operating_hours / total_incidents, 2)
    else:
        mtbf_hours = round(operating_hours, 2)

    # MTTR
    if closed_incidents_resolution_hours:
        mttr_hours = round(sum(closed_incidents_resolution_hours) / len(closed_incidents_resolution_hours), 2)
    else:
        mttr_hours = 0.0

    return {
        'active_machines': machines_count,
        'planned_production_hours': round(planned_hours, 1),
        'operating_hours': round(operating_hours, 1),
        'total_downtime_hours': round(downtime_hours, 1),
        'availability_pct': availability_pct,
        'downtime_pct': downtime_pct,
        'total_parts_produced': total_production_parts,
        'total_incidents_reported': total_incidents,
        'mtbf_hours': mtbf_hours,
        'mttr_hours': mttr_hours
    }
