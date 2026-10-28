-- ==============================================================================
-- ZIRO DIGITAL INTERNSHIP PROGRAM — PHASE 1 MYSQL DATABASE SCHEMA
-- AI Manufacturing Incident and Maintenance Response Platform
-- Target: MySQL 8.0+ (InnoDB Engine, UTF-8 Charset)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS ziro_manufacturing
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ziro_manufacturing;

-- ------------------------------------------------------------------------------
-- 1. RAW LAYER TABLES (IMMUTABLE RESEARCH DATASETS)
-- ------------------------------------------------------------------------------

-- Dataset 1: CNC Machine Tool Wear Dataset (2,054 rows × 154 columns)
-- Notice: sensor_channel_14 and sensor_channel_15 contain verified NULLs; not auto-imputed.
CREATE TABLE IF NOT EXISTS raw_cnc_tool_wear (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cut_number INT NOT NULL,
  vb_flank_wear FLOAT NULL COMMENT 'Tool flank wear width in millimeters (mm)',
  sensor_channel_01 FLOAT NULL,
  sensor_channel_02 FLOAT NULL,
  sensor_channel_14 FLOAT NULL COMMENT 'Accelerometer channel with empirical missing values',
  sensor_channel_15 FLOAT NULL COMMENT 'Accelerometer channel with empirical missing values',
  has_missing_sensor BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Dataset 2: CNC Turning Roughness Dataset (612 rows merged Exp1 & Exp2)
-- Notice: Prep.csv is kept strictly separate; source_experiment preserves identity.
CREATE TABLE IF NOT EXISTS raw_turning_roughness (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_experiment VARCHAR(16) NOT NULL COMMENT 'Exp1 or Exp2',
  cut_speed FLOAT NOT NULL COMMENT 'Cutting speed in meters per minute (m/min)',
  feed_rate FLOAT NOT NULL COMMENT 'Feed rate in mm per revolution (mm/rev)',
  depth_of_cut FLOAT NOT NULL COMMENT 'Depth of cut in millimeters (mm)',
  ra_roughness FLOAT NOT NULL COMMENT 'Arithmetic surface roughness in micrometers (µm)',
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Dataset 3: CNC Mill Tool Telemetry Dataset (25,286 rows × 49 columns, 18 experiments)
CREATE TABLE IF NOT EXISTS raw_mill_telemetry (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  experiment_name VARCHAR(64) NOT NULL COMMENT 'Preserves 18 experimental source run files',
  sample_index INT NOT NULL,
  spindle_speed_rpm FLOAT NOT NULL COMMENT 'Spindle rotational speed in RPM',
  feed_rate_mmpm FLOAT NOT NULL COMMENT 'Feed speed in mm/min',
  vib_x FLOAT NOT NULL COMMENT 'X-axis vibration in m/s²',
  vib_y FLOAT NOT NULL COMMENT 'Y-axis vibration in m/s²',
  vib_z FLOAT NOT NULL COMMENT 'Z-axis vibration in m/s²',
  vib_rms FLOAT NOT NULL COMMENT 'Calculated RMS vibration in m/s²',
  motor_current_amp FLOAT NOT NULL COMMENT 'Motor current draw in Amperes (A)',
  is_worn_cut BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Dataset 4: FeatureAndMetadata_Milling (968 rows × 131 columns)
CREATE TABLE IF NOT EXISTS raw_milling_cycles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cycle_id INT NOT NULL,
  cycle_to_failure INT NOT NULL COMMENT 'Remaining cut cycles to tool end-of-life (distinct from Vb)',
  feature_01 FLOAT NULL,
  feature_02 FLOAT NULL,
  feature_129 FLOAT NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 2. SIMULATOR LAYER (ISOLATED SIMULATED RECORDS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sim_telemetry_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  machine_code VARCHAR(32) NOT NULL,
  simulated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  spindle_rpm FLOAT NOT NULL,
  feed_rate_mmpm FLOAT NOT NULL,
  vib_rms FLOAT NOT NULL COMMENT 'm/s²',
  motor_power_kw FLOAT NULL COMMENT 'Spindle motor power in kW (SEPARATED)',
  motor_load_pct FLOAT NOT NULL COMMENT 'Motor load percentage % (SEPARATED)',
  coolant_temp_c FLOAT NOT NULL,
  injected_anomaly_type VARCHAR(64) NULL,
  data_provenance VARCHAR(16) DEFAULT 'SIMULATED',
  created_by_user_id INT NULL
) ENGINE=InnoDB;

-- Raw simulator contract: one row per sensor reading, preserving quality/noise
-- values instead of coercing them into the aggregate snapshot table above.
CREATE TABLE IF NOT EXISTS simulator_sensor_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  reading_id VARCHAR(128) NOT NULL UNIQUE,
  machine_id VARCHAR(32) NOT NULL COMMENT 'Canonical ID from public/machine-name.json, e.g. MCH-001',
  machine_code VARCHAR(32) NOT NULL,
  reading_timestamp TIMESTAMP(6) NOT NULL,
  machine_type VARCHAR(128) NOT NULL,
  department VARCHAR(128) NOT NULL,
  production_line VARCHAR(128) NOT NULL,
  sensor_name VARCHAR(128) NOT NULL,
  sensor_unit VARCHAR(32) NOT NULL,
  sensor_value_json TEXT NOT NULL COMMENT 'JSON scalar preserves numeric, string, and null simulator values',
  expected_min DOUBLE NOT NULL,
  expected_max DOUBLE NOT NULL,
  machine_status ENUM('NORMAL', 'WARNING', 'CRITICAL', 'MAINTENANCE', 'STOPPED') NOT NULL,
  data_quality ENUM('GOOD', 'NOISY') NOT NULL,
  fault_mode VARCHAR(128) NULL,
  data_provenance VARCHAR(16) NOT NULL DEFAULT 'SIMULATED',
  data_source VARCHAR(32) NOT NULL DEFAULT 'AI_SIMULATOR',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

CREATE INDEX idx_simulator_readings_machine_time
  ON simulator_sensor_readings (machine_id, reading_timestamp);
CREATE INDEX idx_simulator_readings_machine_sensor_time
  ON simulator_sensor_readings (machine_id, sensor_name, reading_timestamp);

-- ------------------------------------------------------------------------------
-- 3. PROCESSED & OPERATIONAL LAYER
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_id VARCHAR(32) UNIQUE NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Operator', 'Supervisor', 'Manager', 'Maintenance', 'Admin') NOT NULL,
  assigned_machine VARCHAR(32) NULL,
  email VARCHAR(128) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS machines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  machine_code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  model VARCHAR(128) NOT NULL,
  line_id VARCHAR(64) NOT NULL,
  status ENUM('Nominal', 'Warning', 'Critical', 'Offline') DEFAULT 'Nominal',
  last_inspection_date DATE NOT NULL,
  cut_hours FLOAT DEFAULT 0.0,
  current_tool_cuts INT DEFAULT 0,
  active_workpiece VARCHAR(128) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incidents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incident_code VARCHAR(32) UNIQUE NOT NULL,
  machine_code VARCHAR(32) NOT NULL,
  reporter_id INT NOT NULL,
  severity ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
  symptom_description TEXT NOT NULL,
  operator_notes TEXT NULL,
  component_area VARCHAR(128) NOT NULL,
  measured_vib_rms FLOAT NOT NULL COMMENT 'm/s²',
  measured_motor_power_kw FLOAT NOT NULL COMMENT 'Explicit kW field',
  measured_motor_load_pct FLOAT NOT NULL COMMENT 'Explicit % field',
  correlated_vb FLOAT NULL COMMENT 'Flank wear mm from Dataset 1',
  correlated_ra FLOAT NULL COMMENT 'Roughness µm from Dataset 2',
  data_provenance ENUM('EMPIRICAL DATASET', 'SIMULATED', 'DEMO') DEFAULT 'EMPIRICAL DATASET',
  assigned_to_id INT NULL,
  status ENUM('Open', 'In_Investigation', 'Action_Required', 'Closed') DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  closed_by_id INT NULL,
  closure_notes TEXT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (assigned_to_id) REFERENCES users(id),
  FOREIGN KEY (closed_by_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incident_ai_diagnoses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  incident_summary TEXT NOT NULL,
  data_provenance VARCHAR(32) NOT NULL,
  verified_sensor_readings JSON NOT NULL,
  unverified_metrics_excluded JSON NOT NULL,
  diagnostic_hypotheses JSON NOT NULL,
  suggested_investigation_steps JSON NOT NULL,
  safety_disclaimer TEXT NOT NULL,
  future_sop_capability_note TEXT NOT NULL,
  model_id VARCHAR(64) DEFAULT 'gemini-3.8-flash (Pending API Model Verification)',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(32) UNIQUE NOT NULL,
  incident_id INT NOT NULL,
  machine_code VARCHAR(32) NOT NULL,
  technician_id INT NOT NULL,
  priority ENUM('Low', 'Medium', 'Urgent') DEFAULT 'Medium',
  action_taken TEXT NULL,
  status ENUM('Pending', 'In_Progress', 'Completed') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id),
  FOREIGN KEY (technician_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incident_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  user_id INT NOT NULL,
  action_type VARCHAR(64) NOT NULL COMMENT 'CREATED, ASSIGNED, PROGRESS_UPDATED, CLOSED',
  action_notes TEXT NULL,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 4. POWER BI & ANALYTICAL VIEWS (EXECUTIVE & PLANT BUSINESS INTELLIGENCE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_machine_current_status AS
SELECT
  m.machine_code,
  m.name AS machine_name,
  m.line_id,
  m.status,
  m.cut_hours,
  COUNT(i.id) AS total_incidents,
  SUM(CASE WHEN i.status = 'Open' THEN 1 ELSE 0 END) AS active_open_incidents
FROM machines m
LEFT JOIN incidents i ON m.machine_code = i.machine_code
GROUP BY m.machine_code, m.name, m.line_id, m.status, m.cut_hours;

CREATE OR REPLACE VIEW v_incident_kpi_summary AS
SELECT
  status,
  severity,
  data_provenance,
  COUNT(*) AS incident_count,
  ROUND(AVG(measured_vib_rms), 2) AS avg_vib_rms,
  ROUND(AVG(measured_motor_power_kw), 2) AS avg_motor_power_kw,
  ROUND(AVG(measured_motor_load_pct), 2) AS avg_motor_load_pct
FROM incidents
GROUP BY status, severity, data_provenance;

CREATE OR REPLACE VIEW v_dataset_pipeline_audit AS
SELECT
  'raw_cnc_tool_wear' AS dataset_table,
  COUNT(*) AS recorded_rows,
  'EMPIRICAL DATASET' AS provenance
FROM raw_cnc_tool_wear
UNION ALL
SELECT
  'raw_turning_roughness' AS dataset_table,
  COUNT(*) AS recorded_rows,
  'EMPIRICAL DATASET' AS provenance
FROM raw_turning_roughness
UNION ALL
SELECT
  'raw_mill_telemetry' AS dataset_table,
  COUNT(*) AS recorded_rows,
  'EMPIRICAL DATASET' AS provenance
FROM raw_mill_telemetry
UNION ALL
SELECT
  'raw_milling_cycles' AS dataset_table,
  COUNT(*) AS recorded_rows,
  'EMPIRICAL DATASET' AS provenance
FROM raw_milling_cycles
UNION ALL
SELECT
  'sim_telemetry_events' AS dataset_table,
  COUNT(*) AS recorded_rows,
  'SIMULATED' AS provenance
FROM sim_telemetry_events;

CREATE OR REPLACE VIEW v_executive_oee_summary AS
SELECT
  line_id,
  COUNT(DISTINCT machine_code) AS total_machines,
  ROUND(AVG(CASE WHEN status = 'Nominal' THEN 100 WHEN status = 'Warning' THEN 85 ELSE 60 END), 1) AS estimated_availability_pct
FROM machines
GROUP BY line_id;

CREATE OR REPLACE VIEW v_quality_roughness_compliance AS
SELECT
  source_experiment,
  COUNT(*) AS total_cuts,
  ROUND(AVG(ra_roughness), 3) AS mean_ra_um,
  ROUND(MIN(ra_roughness), 3) AS min_ra_um,
  ROUND(MAX(ra_roughness), 3) AS max_ra_um
FROM raw_turning_roughness
GROUP BY source_experiment;

-- Phase 1 V1 Additive Reporting Views:
CREATE OR REPLACE VIEW v_factorypulse_fleet_utilization AS
SELECT
  m.machine_id,
  m.machine_code,
  m.name AS machine_name,
  m.line_id AS production_line,
  m.plant,
  m.is_active,
  m.status AS operating_status,
  m.cut_hours,
  ROUND(m.cut_hours / GREATEST(1.0, (m.cut_hours + COALESCE(d.downtime_hours, 0))) * 100, 2) AS utilization_pct,
  COALESCE(d.stopped_events_count, 0) AS total_stoppage_events
FROM machines m
LEFT JOIN (
  SELECT
    machine_id,
    COUNT(CASE WHEN machine_status = 'STOPPED' THEN 1 END) AS stopped_events_count,
    ROUND(COUNT(CASE WHEN machine_status = 'STOPPED' THEN 1 END) * 0.5, 2) AS downtime_hours
  FROM simulator_sensor_readings
  GROUP BY machine_id
) d ON m.machine_id = d.machine_id;

CREATE OR REPLACE VIEW v_factorypulse_incident_frequency AS
SELECT
  i.machine_code,
  m.name AS machine_name,
  m.line_id AS production_line,
  COUNT(i.id) AS total_incidents,
  SUM(CASE WHEN i.severity = 'Critical' THEN 1 ELSE 0 END) AS critical_incidents,
  SUM(CASE WHEN i.severity = 'High' THEN 1 ELSE 0 END) AS high_incidents,
  SUM(CASE WHEN i.severity = 'Medium' THEN 1 ELSE 0 END) AS medium_incidents,
  SUM(CASE WHEN i.severity = 'Low' THEN 1 ELSE 0 END) AS low_incidents,
  SUM(CASE WHEN i.status = 'Closed' THEN 1 ELSE 0 END) AS resolved_incidents,
  SUM(CASE WHEN i.status <> 'Closed' THEN 1 ELSE 0 END) AS open_incidents,
  ROUND(AVG(CASE WHEN i.closed_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, i.created_at, i.closed_at) / 60.0 END), 2) AS mttr_hours
FROM incidents i
LEFT JOIN machines m ON m.machine_code = i.machine_code
GROUP BY i.machine_code, m.name, m.line_id;

CREATE OR REPLACE VIEW v_factorypulse_maintenance_backlog AS
SELECT
  w.id AS work_order_id,
  w.order_code,
  w.machine_code,
  m.name AS machine_name,
  w.priority,
  w.status AS work_order_status,
  u.full_name AS assigned_technician,
  w.created_at,
  w.completed_at,
  i.severity AS incident_severity,
  i.symptom_description
FROM maintenance_work_orders w
JOIN users u ON u.id = w.technician_id
LEFT JOIN incidents i ON i.id = w.incident_id
LEFT JOIN machines m ON m.machine_code = w.machine_code
WHERE w.status IN ('Pending', 'In_Progress');

CREATE OR REPLACE VIEW v_factorypulse_sensor_trends AS
SELECT
  r.machine_id,
  r.sensor_name,
  r.sensor_unit,
  COUNT(*) AS reading_samples,
  ROUND(MIN(CAST(JSON_UNQUOTE(r.sensor_value_json) AS DECIMAL(10,3))), 2) AS min_reading,
  ROUND(MAX(CAST(JSON_UNQUOTE(r.sensor_value_json) AS DECIMAL(10,3))), 2) AS max_reading,
  ROUND(AVG(CAST(JSON_UNQUOTE(r.sensor_value_json) AS DECIMAL(10,3))), 2) AS avg_reading,
  SUM(CASE WHEN r.machine_status IN ('WARNING', 'CRITICAL') THEN 1 ELSE 0 END) AS anomaly_alerts_count,
  MAX(r.reading_timestamp) AS latest_reading_timestamp
FROM simulator_sensor_readings r
WHERE JSON_VALID(r.sensor_value_json)
GROUP BY r.machine_id, r.sensor_name, r.sensor_unit;

-- ==============================================================================
-- END OF SCHEMA DDL
-- ==============================================================================

