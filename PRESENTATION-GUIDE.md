# FactoryPulse Phase 1 presentation

## Start and open
Double-click `Start FactoryPulse.cmd`. Leave the launcher running. Keep the PC awake and MySQL running.

- FactoryPulse: http://127.0.0.1:3000/
- Separate AI Simulator: http://127.0.0.1:5174/
- Workforce credentials: ignored `.local/ROLE-ACCESS.txt` on this PC. Do not show this file during screen sharing.

## Suggested walkthrough
1. Open AI Simulator and show a transmitting machine MCH-001. Sensor values originate in this separate application.
2. Sign in to FactoryPulse as the existing Operator for CNC-5AX-001. Show LIVE / MYSQL, six meters and saved history. Select RPM or vibration to show the trend. Expected ranges are Simulator bounds, not certified safety limits.
3. Explain the path: Simulator SQLite outbox -> authenticated FactoryPulse backend -> MySQL -> authorized dashboard. Refreshing the page retrieves persisted records; browser timers do not generate readings.
4. Show Supervisor or Manager fleet view. Four transmitting machines provide plant comparison evidence; the 400-entry catalog is not 400 transmitting or SQL-registered machines.
5. Operator can report an actual concern for the assigned machine. The server attaches saved sensor readings with original units. Do not create a false incident for the presentation; any training report must be clearly described as such in its text.
6. Supervisor assigns a real active Maintenance employee. Maintenance records investigation notes. Closure requires resolution notes; work orders and audit entries persist in MySQL.
7. Admin: Machine Management -> View details. Registration requires a real recorded inspection date. Show Personnel / RBAC and Activity Log. Admin cannot recover existing plaintext passwords; password hashes remain one-way.
8. Factory Intelligence answers from authorized SQL evidence. The optional Google checkbox now has configured backend credentials and returned a real selected-machine response. Configured-model timeout falls back to a verified lightweight Gemini model; the response labels the provider model. Local SQL answers remain separately labeled.

## Verified checks
31 targeted tests passed. TypeScript and frontend build passed. Actual five-role login, scoped telemetry and protected endpoints passed. Real Simulator reading matched MySQL by ID/value; duplicate retry accepted idempotently. SQL registration and incident-to-work-order transactions exercised against MySQL then rolled back so test records do not appear as real operational events.

## Explicit Phase 1 limits
Power BI has no available report/model/refresh evidence and is not claimed connected. Gemini selected-machine generation was verified after local configuration; external provider availability may vary. Supabase notification delivery remains disabled until role/plant channel authorization is implemented; it is not in the MySQL query path. Production quantities, coolant temperature, motor load percent and power kW are unavailable from the current Simulator payload. Communication loss is not counted as physical downtime. Catalog registration does not control or stop actual equipment.

All changes remain local; no source or secrets were pushed to GitHub.
