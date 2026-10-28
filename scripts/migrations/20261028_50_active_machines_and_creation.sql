-- ==============================================================================
-- FACTORYPULSE MIGRATION: 50 DEFAULT ACTIVE MACHINES & DYNAMIC REGISTRATION
-- Supports:
-- 1. Default active machine population of 50 machines
-- 2. Safe deactivation of excess machines (preserving historical data)
-- 3. Dynamic machine creation (e.g., 50 -> 51)
-- 4. Power BI active machine and downtime reporting views
-- ==============================================================================

USE ziro_manufacturing;

-- Ensure schema columns exist on machines table
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS machine_id VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS machine_type VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS plant VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS location VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS installation_date DATE NULL,
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS operating_limits JSON NULL,
  ADD COLUMN IF NOT EXISTS sensor_configuration JSON NULL,
  ADD COLUMN IF NOT EXISTS simulator_machine_id VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);

-- Backfill machine_id where null
UPDATE machines
SET machine_id = CONCAT('MCH-', LPAD(id, 3, '0'))
WHERE machine_id IS NULL;

-- Configure initial active population: exactly 50 active machines (MCH-001 to MCH-050)
-- Excess machines are safely deactivated without deleting historical telemetry
UPDATE machines
SET is_active = CASE
  WHEN id <= 50 THEN TRUE
  ELSE FALSE
END;

-- Power BI View: Active Machines Fleet
CREATE OR REPLACE VIEW v_factorypulse_active_machines AS
SELECT
  id,
  machine_id,
  machine_code,
  name AS machine_name,
  model,
  machine_type,
  line_id AS production_line,
  plant,
  location,
  manufacturer,
  installation_date,
  status,
  is_active,
  cut_hours,
  updated_at
FROM machines
WHERE is_active = TRUE;

-- Power BI View: Machine Inventory with Telemetry & Active Status
CREATE OR REPLACE VIEW v_factorypulse_machine_inventory AS
SELECT
  m.id,
  m.machine_id,
  m.machine_code,
  m.name AS machine_name,
  m.model,
  m.machine_type,
  m.line_id AS production_line,
  m.plant,
  m.location,
  m.manufacturer,
  m.status,
  m.is_active,
  m.cut_hours,
  COUNT(DISTINCT r.id) AS total_telemetry_readings,
  MAX(r.reading_timestamp) AS last_telemetry_timestamp
FROM machines m
LEFT JOIN simulator_sensor_readings r ON m.machine_id = r.machine_id
GROUP BY
  m.id, m.machine_id, m.machine_code, m.name, m.model, m.machine_type,
  m.line_id, m.plant, m.location, m.manufacturer, m.status, m.is_active,
  m.cut_hours;

-- Power BI View: Machine Downtime Summary
CREATE OR REPLACE VIEW v_factorypulse_downtime_summary AS
SELECT
  m.machine_id,
  m.machine_code,
  m.name AS machine_name,
  m.line_id,
  m.is_active,
  COUNT(CASE WHEN r.machine_status = 'STOPPED' THEN 1 END) AS stopped_events_count,
  COUNT(CASE WHEN r.machine_status = 'CRITICAL' THEN 1 END) AS critical_events_count,
  MAX(CASE WHEN r.machine_status = 'STOPPED' THEN r.reading_timestamp END) AS last_stopped_timestamp
FROM machines m
LEFT JOIN simulator_sensor_readings r ON m.machine_id = r.machine_id
GROUP BY m.machine_id, m.machine_code, m.name, m.line_id, m.is_active;
