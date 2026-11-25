# Data dictionary

All identities, specifications, values and outcomes are fictional. All times represent UTC, including timestamps written without an offset in the alternative format.

## telemetry_raw.csv
| Column | Interpretation |
|---|---|
| packet_id | Observation identifier; retransmissions may reuse it |
| machine_id | Canonical identity or an alias requiring crosswalk reconciliation |
| observed_at | Observation time; mixed textual formats |
| timestamp_basis | UTC |
| machine_state | RUNNING, IDLE or DOWN |
| temperature / temperature_unit | Machine temperature in C or F; normalize to Celsius |
| vibration / vibration_unit | Vibration velocity in mm/s; some decimal commas |
| spindle_rpm | Spindle speed, revolutions/minute |
| motor_current_a | Motor current, amperes |
| motor_load_pct | Modeled motor load, percent |
| pressure / pressure_unit | Pressure in bar or kPa; 100 kPa = 1 bar |
| coolant_flow_l_min | Coolant flow, litres/minute |
| ambient_temperature_c | Ambient temperature, Celsius |
| hours_since_service | Elapsed hours since modeled completed service |
| quality_flag | GOOD, BAD or UNCERTAIN packet quality; does not certify machine health |

Missing cells, -9999 sentinels, implausible values, stuck signals, shuffled rows and conflicting duplicates are deliberate. Unit conversion: Celsius = (Fahrenheit - 32) * 5/9. A sentinel must be identified before unit conversion.

## Other tables
- machine_registry.csv: machine_id, machine_type, plant, commissioned_year, rated_rpm, nominal_pressure_bar and sampling_minutes. Specifications are illustrative, not OEM operating limits.
- machine_id_crosswalk.csv: maps aliases to canonical machine identities; use its actual headers when loading.
- training_labels.csv: packet_id, canonical machine_id, observed_at_utc, health_priority, next_failure_at_utc and next_failure_mode. Future outcome fields are prohibited model inputs.
- failure_events.csv: event_id, machine_id, failure_at_utc, returned_to_service_at_utc and failure_mode.
- maintenance_log.csv: repair actions with work_order_id, machine_id, opened/completed times and available_at_utc. These records describe outcomes; respect availability when constructing historical features.

Read each CSV header rather than assuming column order. Keep original values alongside normalized columns in the cleaning audit.

