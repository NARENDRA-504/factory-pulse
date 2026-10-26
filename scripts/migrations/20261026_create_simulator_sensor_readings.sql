-- Add the raw, per-sensor simulator table to an existing FactoryPulse MySQL DB.
-- Existing telemetry tables and their rows are not altered or deleted.

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
