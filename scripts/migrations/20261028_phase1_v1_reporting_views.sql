-- ==============================================================================
-- FACTORYPULSE PHASE 1 V1 REPORTING VIEWS & ANALYTICS EXTENSION
-- Non-destructive additive views for MySQL / Cloud SQL and Power BI
-- ==============================================================================

USE ziro_manufacturing;

-- 1. Fleet Machine Utilization View
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

-- 2. Incident Frequency and Resolution Time (MTTR) Summary
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

-- 3. Maintenance Backlog & Dispatch Summary
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

-- 4. Sensor Statistical Trends & Anomaly Counts
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
