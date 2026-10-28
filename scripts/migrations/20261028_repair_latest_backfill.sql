-- Repair only the failed backfill; safe to repeat. No schema changes.
USE ziro_manufacturing;
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
