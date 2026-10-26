-- Session revocation and append-only audit events for FactoryPulse authentication.
-- Store timestamps in UTC. Configure FACTORY_TIMEZONE for UI presentation.

ALTER TABLE users
  ADD COLUMN department VARCHAR(128) NULL,
  ADD COLUMN shift ENUM('Shift A', 'Shift B', 'Night Shift') NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id CHAR(36) NOT NULL PRIMARY KEY,
  employee_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at_utc DATETIME(6) NOT NULL,
  expires_at_utc DATETIME(6) NOT NULL,
  revoked_at_utc DATETIME(6) NULL,
  revoke_reason VARCHAR(32) NULL,
  INDEX idx_auth_sessions_employee (employee_id, expires_at_utc),
  CONSTRAINT fk_auth_sessions_employee FOREIGN KEY (employee_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NULL,
  employee_work_id VARCHAR(32) NULL,
  employee_name VARCHAR(128) NULL,
  role_at_event VARCHAR(32) NULL,
  event_type VARCHAR(64) NOT NULL,
  occurred_at_utc DATETIME(6) NOT NULL,
  session_id CHAR(36) NULL,
  request_id VARCHAR(128) NULL,
  details VARCHAR(500) NULL,
  INDEX idx_activity_log_time (occurred_at_utc, id),
  INDEX idx_activity_log_employee (employee_id, occurred_at_utc),
  INDEX idx_activity_log_event (event_type, occurred_at_utc)
) ENGINE=InnoDB;
