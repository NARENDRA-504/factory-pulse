# Live telemetry delivery recovery

Verified on 30 October 2026. FactoryPulse and AI Simulator remain separate local projects.

## Changes

- Added authenticated `GET /api/v1/telemetry/capabilities` and `POST /api/v1/telemetry/batch` to FactoryPulse. A batch contains at most 100 existing per-sensor records and is limited to a 128 KiB request body.
- Batch commits are atomic. The receiver returns accepted reading IDs after the MySQL transaction commits. Identical retries do not create extra records; conflicting IDs are rejected. Sensor validation and canonical metadata rules are preserved.
- Simulator detects batch support before enabling it. Its single-reading path remains available for compatible older receivers. Requests and SQL transactions are bounded; retries retain the original reading IDs.
- Moved queue selection and acknowledgement work off the Simulator event loop. Success and retry updates use one SQLite transaction per selected delivery batch.
- Replaced the status page's full-history aggregate with counts over its latest 1,000 queue entries. The UI explicitly labels that scope. These are not all-time totals.
- Ordered receiver stream updates consistently and limited concurrent batches to reduce lock contention.
- Local API launch commands use `asyncio:SelectorEventLoop` to avoid the Windows Proactor stalls observed in this environment. Request access logging is disabled to avoid continually growing per-reading logs; application errors remain logged.

## Verification

- 40 selected machines running with five-second sampling.
- One actual source reading from each of 40 machines matched its MySQL record exactly: identity, sensor, unit and value; 40 matches, zero unmatched.
- A separate 15-reading check across three machines also passed.
- Six observations over 30 seconds found all 40 machines fresh; the oldest record was approximately two seconds old at each observation.
- Simulator status responded in 31 ms and health in 14 ms in the recovery check; local SQLite was connected and the current delivery error was empty.
- All five FactoryPulse roles subsequently loaded permitted SQL telemetry and history. Operator access to other machines and Admin-only pages remained denied.
- 25 focused receiver/sender tests passed, covering atomicity, duplicate/conflict behavior, authentication, retries, queue preservation and status-count scope. Simulator frontend build and FactoryPulse TypeScript check passed. Build output still reports a bundle-size warning.

Private verification outputs are `.local/simulator-recovery-report.json` and `.local/sql-readiness-report.json`. They contain no passwords or API keys.

## Running locally

- FactoryPulse: http://localhost:3000/
- AI Simulator: http://127.0.0.1:5174/
- Keep the existing `scripts/local_stack.py` monitor running. It manages the services and the configured fleet. Do not start duplicate copies.

MySQL remains the operational source of truth. SQLite remains the sender's local raw-history/outbox store. Historical backlog was not deleted. A five-second sampling interval and the measured recovery window do not establish a one-second delivery guarantee or long-duration uptime guarantee.
