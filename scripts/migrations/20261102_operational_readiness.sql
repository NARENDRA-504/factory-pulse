-- Run once with the schema-owner account. Does not alter accounts or delete records.
USE ziro_manufacturing;
CREATE TABLE IF NOT EXISTS telemetry_hourly_summary (
  machine_id VARCHAR(32) NOT NULL,
  sensor_name VARCHAR(128) NOT NULL,
  sensor_unit VARCHAR(32) NOT NULL,
  hour_utc DATETIME NOT NULL,
  sample_count BIGINT NOT NULL,
  good_numeric_count BIGINT NOT NULL,
  numeric_sum DOUBLE NOT NULL,
  numeric_min DOUBLE NULL,
  numeric_max DOUBLE NULL,
  PRIMARY KEY(machine_id,sensor_name,hour_utc,sensor_unit)
) ENGINE=InnoDB;

-- Compact immutable hashes preserve retry identity after raw telemetry is summarized.
CREATE TABLE IF NOT EXISTS telemetry_archived_ids (
  reading_id VARCHAR(128) NOT NULL PRIMARY KEY,
  payload_hash CHAR(64) NOT NULL
) ENGINE=InnoDB;
