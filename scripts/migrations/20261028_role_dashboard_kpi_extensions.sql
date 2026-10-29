-- Additive source tables for role-specific reliability, energy, and cost measures.
-- PREPARED ONLY. Do not run from the application or with its runtime account.
-- Review against a backup and the target MySQL version before applying with a schema owner.
-- No sample/estimated rows are inserted. Dashboards must remain unavailable until a real source
-- populates these tables and the site's definitions/rates are approved.

USE ziro_manufacturing;

-- OEE Performance needs a verified ideal cycle duration per asset, with effective dates.
CREATE TABLE IF NOT EXISTS machine_cycle_standards (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  machine_id VARCHAR(32) NOT NULL,
  ideal_cycle_seconds DECIMAL(12,4) NOT NULL,
  effective_from_utc DATETIME(6) NOT NULL,
  effective_to_utc DATETIME(6) NULL,
  source_name VARCHAR(64) NOT NULL,
  approved_by INT NULL,
  created_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_cycle_standard_machine_date (machine_id, effective_from_utc),
  CONSTRAINT fk_cycle_standard_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  CONSTRAINT fk_cycle_standard_user FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT chk_cycle_standard_positive CHECK (ideal_cycle_seconds > 0),
  CONSTRAINT chk_cycle_standard_dates CHECK (effective_to_utc IS NULL OR effective_to_utc > effective_from_utc)
) ENGINE=InnoDB;

-- Failure, technician acknowledgement, repair, and resolution markers for MTBF/MTTR/response.
-- Emit only real events; incident_code remains a source reference to avoid assuming its key type.
CREATE TABLE IF NOT EXISTS maintenance_lifecycle_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_event_id VARCHAR(128) NOT NULL,
  source_name VARCHAR(64) NOT NULL,
  machine_id VARCHAR(32) NOT NULL,
  incident_code VARCHAR(64) NULL,
  event_type ENUM('FAILURE_OPENED', 'TECHNICIAN_ACKNOWLEDGED', 'REPAIR_STARTED', 'RESOLVED') NOT NULL,
  actor_user_id INT NULL,
  occurred_at_utc DATETIME(6) NOT NULL,
  received_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_maintenance_source_event (source_name, source_event_id),
  KEY idx_maintenance_machine_time (machine_id, occurred_at_utc),
  KEY idx_maintenance_incident_time (incident_code, occurred_at_utc),
  CONSTRAINT fk_maintenance_event_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  CONSTRAINT fk_maintenance_event_user FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Energy meter deltas, in kWh, from an identified source. Not derived from motor load or power.
CREATE TABLE IF NOT EXISTS machine_energy_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_reading_id VARCHAR(128) NOT NULL,
  source_name VARCHAR(64) NOT NULL,
  machine_id VARCHAR(32) NOT NULL,
  energy_kwh DECIMAL(16,6) NOT NULL,
  interval_started_at_utc DATETIME(6) NOT NULL,
  interval_ended_at_utc DATETIME(6) NOT NULL,
  received_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_energy_source_reading (source_name, source_reading_id),
  KEY idx_energy_machine_interval (machine_id, interval_ended_at_utc),
  CONSTRAINT fk_energy_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  CONSTRAINT chk_energy_nonnegative CHECK (energy_kwh >= 0),
  CONSTRAINT chk_energy_interval CHECK (interval_ended_at_utc > interval_started_at_utc)
) ENGINE=InnoDB;

-- Explicit approved rates; store currency with every rate. Never seed assumed financial values.
CREATE TABLE IF NOT EXISTS operational_cost_rates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  scope_type ENUM('PLANT', 'MACHINE') NOT NULL,
  scope_id VARCHAR(64) NOT NULL,
  rate_type ENUM('SCRAP_COST_PER_PART', 'DOWNTIME_COST_PER_HOUR', 'ENERGY_COST_PER_KWH') NOT NULL,
  amount DECIMAL(16,4) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  effective_from_utc DATETIME(6) NOT NULL,
  effective_to_utc DATETIME(6) NULL,
  approved_by INT NOT NULL,
  approved_source VARCHAR(255) NOT NULL,
  created_at_utc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_cost_rate_scope_date (scope_type, scope_id, rate_type, effective_from_utc),
  CONSTRAINT fk_cost_rate_approver FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT chk_cost_rate_nonnegative CHECK (amount >= 0),
  CONSTRAINT chk_cost_rate_dates CHECK (effective_to_utc IS NULL OR effective_to_utc > effective_from_utc)
) ENGINE=InnoDB;

-- These tables do not by themselves prove data quality, refresh success, or Power BI connectivity.
