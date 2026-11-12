-- Run using the schema owner in Workbench. Preserve accounts, passwords and telemetry.
USE ziro_manufacturing;
ALTER TABLE users MODIFY COLUMN role
 ENUM('Operator','Supervisor','Manager','Maintenance','Admin','Super Admin') NOT NULL;

CREATE TABLE IF NOT EXISTS machine_change_requests (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 operator_id INT NOT NULL,
 from_machine_code VARCHAR(32) NOT NULL,
 to_machine_code VARCHAR(32) NOT NULL,
 supervisor_work_id VARCHAR(32) NOT NULL,
 team_department VARCHAR(128) NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
 created_at_utc DATETIME(6) NOT NULL,
 reviewed_at_utc DATETIME(6) NULL,
 reviewed_by_id INT NULL,
 review_note VARCHAR(1000) NULL,
 pending_operator_id INT GENERATED ALWAYS AS
   (CASE WHEN status='Pending' THEN operator_id ELSE NULL END) STORED,
 UNIQUE KEY uq_machine_change_pending_operator(pending_operator_id),
 INDEX idx_machine_change_supervisor(supervisor_work_id,status,created_at_utc),
 CONSTRAINT fk_machine_change_operator FOREIGN KEY(operator_id) REFERENCES users(id),
 CONSTRAINT fk_machine_change_reviewer FOREIGN KEY(reviewed_by_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Owner explicitly selected this existing account. Do not change its password.
START TRANSACTION;
INSERT INTO activity_log(employee_id,employee_work_id,employee_name,role_at_event,
 event_type,occurred_at_utc,details)
 SELECT id,work_id,full_name,'Super Admin','super_admin_bootstrap',UTC_TIMESTAMP(6),
 'Schema-owner bootstrap of existing Admin; password and other account fields preserved.'
 FROM users WHERE work_id='FACTORYPULSE-ADMIN-3' AND role='Admin' AND is_active=1;
UPDATE users SET role='Super Admin'
 WHERE work_id='FACTORYPULSE-ADMIN-3' AND role='Admin' AND is_active=1;
COMMIT;
SELECT work_id,role,is_active FROM users WHERE work_id='FACTORYPULSE-ADMIN-3';
SHOW TABLES LIKE 'machine_change_requests';
