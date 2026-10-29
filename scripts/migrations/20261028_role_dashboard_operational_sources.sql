-- FactoryPulse role dashboard source tables and admin audit context.
-- PREPARED ONLY: inspect and back up the target schema, then apply once with a schema-owner account.
-- The runtime factorypulse_app account must remain DML-only. This migration is intentionally
-- additive; it does not seed invented production, staffing, downtime or finance values.
-- Requires the machine registry migration that adds unique machines.machine_id.

USE ziro_manufacturing;

-- Attendance/device context for authenticated sessions and append-only audit events.
ALTER TABLE auth_sessions
  ADD COLUMN client_ip VARCHAR(45) NULL,
  ADD COLUMN device_info VARCHAR(255) NULL;

ALTER TABLE activity_log
  ADD COLUMN client_ip VARCHAR(45) NULL,
  ADD COLUMN device_info VARCHAR(255) NULL,
  ADD COLUMN resource_type VARCHAR(64) NULL,
  ADD COLUMN resource_id VARCHAR(64) NULL,
  ADD COLUMN changed_fields JSON NULL;

-- One target per machine/shift/date. Shift names and local schedule boundaries are supplied
-- by the site configuration; timestamps are stored in UTC.
CREATE TABLE IF NOT EXISTS production_shift_targets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  machine_id VARCHAR(32) NOT NULL,
  shift_code VARCHAR(32) NOT NULL,
  production_date DATE NOT NULL,
  target_good_parts INT UNSIGNED NOT NULL,
  planned_seconds INT UNSIGNED NULL,
  created_by INT NULL,
  created_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_production_target_machine_shift_day (machine_id, shift_code, production_date),
  KEY idx_production_target_date (production_date, shift_code),
  CONSTRAINT fk_production_target_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  CONSTRAINT fk_production_target_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_production_target_positive CHECK (target_good_parts > 0)
) ENGINE=InnoDB;

-- Idempotent event ledger from the production/PLC source. GOOD_PART, SCRAP_PART and
-- CYCLE_COMPLETE are events, not inferred from telemetry. source_event_id prevents replay duplicates.
CREATE TABLE IF NOT EXISTS production_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_event_id VARCHAR(128) NOT NULL,
  machine_id VARCHAR(32) NOT NULL,
  shift_code VARCHAR(32) NULL,
  event_type ENUM('GOOD_PART', 'SCRAP_PART', 'CYCLE_COMPLETE') NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  cycle_time_seconds DECIMAL(12,4) NULL,
  event_at_utc DATETIME(6) NOT NULL,
  source_name VARCHAR(64) NOT NULL,
  received_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_production_source_event (source_name, source_event_id),
  KEY idx_production_machine_time (machine_id, event_at_utc),
  KEY idx_production_shift_time (shift_code, event_at_utc),
  CONSTRAINT fk_production_event_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  CONSTRAINT chk_production_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_production_cycle_nonnegative CHECK (cycle_time_seconds IS NULL OR cycle_time_seconds >= 0)
) ENGINE=InnoDB;

-- Explicit machine stop/start intervals with reason codes. A telemetry communications gap
-- does not create a downtime row. Store UTC transition times and close intervals explicitly.
CREATE TABLE IF NOT EXISTS machine_downtime_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_event_id VARCHAR(128) NOT NULL,
  machine_id VARCHAR(32) NOT NULL,
  reason_code VARCHAR(64) NULL,
  reason_text VARCHAR(255) NULL,
  started_at_utc DATETIME(6) NOT NULL,
  ended_at_utc DATETIME(6) NULL,
  status ENUM('ACTIVE', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
  opened_by INT NULL,
  resolved_by INT NULL,
  source_name VARCHAR(64) NOT NULL,
  created_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_downtime_source_event (source_name, source_event_id),
  KEY idx_downtime_machine_time (machine_id, started_at_utc),
  KEY idx_downtime_status (status, started_at_utc),
  CONSTRAINT fk_downtime_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  CONSTRAINT fk_downtime_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
  CONSTRAINT fk_downtime_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id),
  CONSTRAINT chk_downtime_time_order CHECK (ended_at_utc IS NULL OR ended_at_utc >= started_at_utc)
) ENGINE=InnoDB;

-- Verified operator assignment/login windows. These rows must come from authenticated
-- shift check-in or roster integration, not from user profile creation alone.
CREATE TABLE IF NOT EXISTS operator_shift_assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  machine_id VARCHAR(32) NOT NULL,
  shift_code VARCHAR(32) NOT NULL,
  line_code VARCHAR(64) NULL,
  logged_in_at_utc DATETIME(6) NOT NULL,
  logged_out_at_utc DATETIME(6) NULL,
  auth_session_id CHAR(36) NULL,
  created_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_operator_shift_machine (machine_id, logged_in_at_utc),
  KEY idx_operator_shift_employee (employee_id, logged_in_at_utc),
  CONSTRAINT fk_operator_shift_user FOREIGN KEY (employee_id) REFERENCES users(id),
  CONSTRAINT fk_operator_shift_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  CONSTRAINT fk_operator_shift_session FOREIGN KEY (auth_session_id) REFERENCES auth_sessions(session_id),
  CONSTRAINT chk_operator_shift_time_order CHECK (logged_out_at_utc IS NULL OR logged_out_at_utc >= logged_in_at_utc)
) ENGINE=InnoDB;

-- Definitions for dashboard calculations (views can be added after confirming site shift rules):
-- Good parts / target = SUM(GOOD_PART quantity) / production_shift_targets.target_good_parts.
-- Scrap rate = SCRAP_PART / (GOOD_PART + SCRAP_PART); never estimate scrap from sensor readings.
-- OEE = availability * performance * quality, only with planned time, explicit downtime,
-- ideal cycle time and good/total part counts from an approved production source.
-- MTBF/MTTR require complete failure and repair intervals; response time needs alarm,
-- technician acknowledgement and resolution events. No energy/cost KPI is defined here.
