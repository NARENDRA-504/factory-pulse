-- Run with the schema-owner connection in MySQL Workbench.
-- Adds the API's existing IDLE status without changing records or privileges.
USE ziro_manufacturing;
ALTER TABLE simulator_sensor_readings
  MODIFY COLUMN machine_status
  ENUM('NORMAL', 'WARNING', 'CRITICAL', 'MAINTENANCE', 'STOPPED', 'IDLE') NOT NULL;

SELECT COLUMN_TYPE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'simulator_sensor_readings'
  AND column_name = 'machine_status';
