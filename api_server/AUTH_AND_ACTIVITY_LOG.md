# FactoryPulse authentication and audit setup

FactoryPulse no longer accepts a role or employee selection from the browser. The production login reads `users` from MySQL, verifies `password_hash`, creates an opaque random token, stores only its SHA-256 digest in `auth_sessions`, and loads the employee role and assignment from MySQL on every authenticated API request. Sessions expire after eight hours. Admin user changes revoke sessions when an account is deactivated; role changes take effect on the next request.

## Required configuration

1. Apply `scripts/export_mysql_schema.sql`, then `scripts/migrations/20261026_create_simulator_sensor_readings.sql` if needed, and `scripts/migrations/20261026_add_auth_sessions_activity_log.sql`.
2. Configure the backend's `DATABASE_URL`, `APP_ENV=production`, `DEMO_AUTH_ENABLED=false`, `FACTORY_TIMEZONE` (an IANA zone such as `Asia/Kolkata`), and `CORS_ORIGINS` with the exact deployed frontend origins. `CORS_ORIGINS` defaults to local development origins only.
3. Configure frontend `VITE_API_BASE_URL` to this FastAPI service. Do not place database, simulator, or other server secrets in `VITE_*` values.
4. Provision employee rows in `users` with a PBKDF2 hash. Generate one interactively using `python scripts/hash_factorypulse_password.py`; the password is not echoed. Do not send passwords through chat, source control, SQL logs, or Power BI.

Demo accounts exist only when both `APP_ENV=development` (or `test`) and `DEMO_AUTH_ENABLED=true` are explicitly set in the backend environment. The user interface has no demo role switcher. Demo sessions and Admin user changes are in-memory and disappear when the backend restarts; they cannot be enabled when `APP_ENV=production`. Production user creation, updates, password resets, and deactivation are transactionally written to MySQL. Password reset stores a one-way PBKDF2 hash and revokes the employee's existing sessions; plaintext passwords are never returned or readable.

## Audit coverage and limits

The MySQL activity log stores timestamps in UTC and the Admin-only log page displays the configured factory timezone. It records sign-in, sign-out, failed sign-in, observed session expiry, personnel create/update/role-change/deactivation, incident create/assignment/progress/closure API actions, and simulated anomaly injection. Requests receive an `X-Request-ID`; authenticated events also include the server session ID. Failed attempts with unknown badge IDs retain the attempted badge ID but no fabricated employee name or role.

The existing incident routes still use an in-memory incident store, and work-order status and alert acknowledgement are currently browser-local; those actions are not presented as durable MySQL audit events. This audit layer does not convert those demo workflows into transactional production records. Persisting and auditing them as one operation requires implementing their MySQL write paths before treating this build as production-ready.
