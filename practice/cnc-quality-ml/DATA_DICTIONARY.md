# Data dictionary

Each row is one independently simulated completed CNC part, with process readings available before final inspection. Units and ranges below are synthetic teaching assumptions, not operating or safety limits.

| Column | Meaning | Modeling use |
|---|---|---|
| part_id | Unique part identifier | Exclude from features |
| recorded_at_utc | Synthetic observation timestamp in UTC | Use to preserve chronological splits; exclude from beginner features |
| machine_id | One of 20 fictional machines | Metadata; exclude from beginner model |
| material | Aluminium, Steel or Brass | Categorical input |
| spindle_speed_rpm | Spindle rotation, RPM | Numeric input |
| feed_rate_mm_min | Feed rate, mm/min | Numeric input |
| machine_temperature_c | Process temperature, degrees C | Numeric input; sometimes missing |
| vibration_mm_s | Vibration velocity, mm/s | Numeric input; sometimes missing |
| pressure_bar | Process pressure, bar | Numeric input; sometimes missing |
| coolant_flow_l_min | Coolant flow, L/min | Numeric input; sometimes missing |
| tool_usage_hours | Tool age in operating hours at observation | Numeric input |
| ambient_temperature_c | Ambient temperature, degrees C | Numeric input |
| inspection_failed | Final inspection result: 1=fail, 0=pass | Target; never a prediction input |

Machine records are independent examples, not physically consistent tool-life sequences. Timestamps establish a reproducible split, not a realistic shift calendar. Some inputs intentionally have weak or no independent relationship with the target. Labels are sampled from a noisy nonlinear probability model. Missing cells are blank, not zero. No factory data, personnel or credentials are used.
