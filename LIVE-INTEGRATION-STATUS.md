# Live integration checkpoint

The full requested scope is still in progress. This checkpoint distinguishes executed checks from pending features.

## Verified

- AI Simulator SQLite outbox → authenticated `POST /api/v1/telemetry` → MySQL `simulator_sensor_readings` → protected FactoryPulse APIs → updating Operator dashboard.
- A real emitted reading was matched by reading ID, machine ID and sensor value in MySQL; an identical delivery returned 200 with `duplicate: true`.
- Five role accounts successfully signed in. Operator received six readings for its assigned MCH-001; fleet roles received 24 sensor readings across four transmitting machines.
- Non-Admins received 403 from Admin health. Operator requests about another machine received 403.
- Admin health, local SQL evidence answers and recorded downtime endpoints passed live API checks.
- Admin Machine Management inventory/details now reads SQL registration and live telemetry with explicit provenance. Actual API returned 400 catalog references, zero SQL-registered machines and four receiving streams. Operator access returned 403. Registration editing still requires the pending migration.
- Both frontend builds and FactoryPulse TypeScript checks passed. Current targeted checks: 31 tests passed (ingestion, downtime, optional AI boundaries and machine inventory). No live Gemini response was tested.
- The actual Operator browser displayed live MySQL readings, correct assignment, six meters and saved history. Every role's browser workflow has not yet been fully previewed.

## Running locally

- FactoryPulse: http://localhost:3000
- Simulator: http://127.0.0.1:5174
- FactoryPulse API: 127.0.0.1:8001; Simulator API: 127.0.0.1:8002.
- Double-click `Start FactoryPulse.cmd`, or run `.\.venv\Scripts\python.exe scripts\local_stack.py` from this project. The monitor starts missing services and keeps one stream per plant active.
- Private workforce credentials are in ignored `.local/ROLE-ACCESS.txt`. Existing account passwords were preserved. Never commit `.env` or `.local`.

## Definitions

Downtime counts explicit STOPPED source states, clips intervals to the selected window, and excludes unobserved communication gaps. Ongoing stop time extends only while stopped evidence remains fresh. Analysis rounds are configurable UTC-aligned 30-minute windows, not manufacturing production cycles. Production quantities and unsupported physical measurements remain unavailable.

## Still blocked or incomplete

- The owner applied the schema migration after backup. The failed backfill was corrected and executed successfully. Admin machine registration/edit and transactional audit passed a rollback-only MySQL test. Registration requires an actual inspection date; runtime privileges remain unchanged.
- Incident/work-order screens now use MySQL APIs. Create, assign, work-order creation, maintenance notes, closure and transactional audit passed a real MySQL rollback-only workflow test. No fictitious incident was retained. Full browser submission workflow remains to be checked.
- The owner subsequently approved sending selected telemetry and questions to Google Gemini. The optional, per-question path is implemented with role checks and a bounded telemetry field list. Backend Gemini settings are now present and a real authorized selected-machine response was verified. A 504-only lightweight-model fallback handles configured-model timeouts; SQL answers continue independently.
- No Power BI report/model/gateway or refresh evidence is available. Power BI refresh remains unverified.
- Complete role browser previews, failure/recovery scenarios beyond the tested API restart, and presentation documentation remain in progress.

No secrets, env files, or operational records were committed or pushed.
