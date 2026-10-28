-- Prepared, NOT applied. Execute once using the schema owner on a backed-up
-- development database, then validate before using in a presentation.
-- The runtime factorypulse_app account intentionally needs only DML privileges.
USE ziro_manufacturing;

-- Extend the existing registry; preserve legacy machine codes and every row.
ALTER TABLE machines
  ADD COLUMN machine_id VARCHAR(32) NULL,
  ADD COLUMN machine_type VARCHAR(128) NULL,
  ADD COLUMN plant VARCHAR(128) NULL,
  ADD COLUMN location VARCHAR(255) NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN operating_limits JSON NULL,
  ADD COLUMN sensor_configuration JSON NULL,
  ADD COLUMN simulator_machine_id VARCHAR(32) NULL,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
CREATE UNIQUE INDEX uq_factorypulse_machine_id ON machines(machine_id);

-- Current Simulator values must not be substituted for kW, load percent or
-- acceleration RMS. Null means this measurement was not supplied.
ALTER TABLE incidents
  MODIFY COLUMN measured_vib_rms FLOAT NULL COMMENT 'm/s2; unavailable when only vibration mm/s was sent',
  MODIFY COLUMN measured_motor_power_kw FLOAT NULL COMMENT 'kW; null when not measured',
  MODIFY COLUMN measured_motor_load_pct FLOAT NULL COMMENT 'percent; null when not measured',
  ADD COLUMN sensor_snapshot JSON NULL;

-- Optional SQL projection of the newest reading for each stable sensor stream.
-- This is a derived pointer into MySQL history, not another telemetry store.
CREATE TABLE IF NOT EXISTS simulator_sensor_latest (
  machine_id VARCHAR(32) NOT NULL,
  sensor_name VARCHAR(128) NOT NULL,
  reading_row_id BIGINT NOT NULL,
  reading_timestamp TIMESTAMP(6) NOT NULL,
  PRIMARY KEY(machine_id, sensor_name),
  CONSTRAINT fk_latest_sensor_reading FOREIGN KEY(reading_row_id)
    REFERENCES simulator_sensor_readings(id)
) ENGINE=InnoDB;

DELIMITER //
CREATE TRIGGER factorypulse_update_latest_sensor AFTER INSERT ON simulator_sensor_readings
FOR EACH ROW
BEGIN
  INSERT INTO simulator_sensor_latest(machine_id,sensor_name,reading_row_id,reading_timestamp)
  VALUES(NEW.machine_id,NEW.sensor_name,NEW.id,NEW.reading_timestamp)
  ON DUPLICATE KEY UPDATE
    reading_row_id=IF(NEW.reading_timestamp>reading_timestamp OR
      (NEW.reading_timestamp=reading_timestamp AND NEW.id>reading_row_id),NEW.id,reading_row_id),
    reading_timestamp=GREATEST(reading_timestamp,NEW.reading_timestamp);
END//
DELIMITER ;

INSERT INTO simulator_sensor_latest(machine_id,sensor_name,reading_row_id,reading_timestamp)
SELECT machine_id,sensor_name,id,reading_timestamp FROM (
  SELECT id,machine_id,sensor_name,reading_timestamp,
    ROW_NUMBER() OVER(PARTITION BY machine_id,sensor_name ORDER BY reading_timestamp DESC,id DESC) AS rnk
  FROM simulator_sensor_readings
) AS ranked WHERE rnk=1
ON DUPLICATE KEY UPDATE
  reading_row_id=IF(VALUES(reading_timestamp)>simulator_sensor_latest.reading_timestamp OR
    (VALUES(reading_timestamp)=simulator_sensor_latest.reading_timestamp AND VALUES(reading_row_id)>simulator_sensor_latest.reading_row_id),
    VALUES(reading_row_id),simulator_sensor_latest.reading_row_id),
  reading_timestamp=GREATEST(simulator_sensor_latest.reading_timestamp,VALUES(reading_timestamp));

CREATE OR REPLACE VIEW v_factorypulse_latest_readings AS
  SELECT r.* FROM simulator_sensor_latest latest
  JOIN simulator_sensor_readings r ON r.id=latest.reading_row_id;
CREATE OR REPLACE VIEW v_factorypulse_machine_inventory AS
  SELECT id,machine_id,machine_code,name,model,machine_type,line_id,plant,location,
         description,simulator_machine_id,is_active,updated_at FROM machines;

-- Rollback considerations: retain all added columns/data and history. If a
-- projection needs disabling, disable its reader first, then have the schema
-- owner remove ONLY this migration's trigger/view/projection after a backup.
-- Never drop operational/history tables or restore NOT NULL on unmeasured data.
