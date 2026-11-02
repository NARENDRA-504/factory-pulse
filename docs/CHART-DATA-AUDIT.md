# Dashboard chart data audit — 2 November 2026

## Changes activated

- Added a dedicated **Coolant Temperature** modeled sensor (18–35 °C) for coolant-equipped Simulator profiles. It has its own reading ID, value and bounds. Machine or motor temperature is never relabeled as coolant temperature.
- Extended FactoryPulse's canonical receiver profile with exactly that sensor name and unit. Existing authentication, idempotency, machine validation and MySQL storage remain in place.
- Simulator production counters and quality/cycle snapshots now publish with every sensor sampling round. Repeated counter values are fresh snapshots, not new parts. Output still advances at the configured 360-second cycle / 120-parts-per-12-hour plan.
- Added a small local SQLite runtime-checkpoint table. Counter values, remaining cycle progress and sensor state checkpoint in the same transaction as local readings and their outbox entries. Runtime restarts restore progress without automatically starting machines or overriding the global delivery pause.
- Preserved all 40 machines' counter and cycle values exactly during activation, then explicitly restarted the existing fleet.
- Operator's report now has independent RPM, vibration, pressure, motor-temperature, coolant-flow, current, voltage and torque trends alongside its coolant trend and production progress. Detail history refreshes every five seconds; current readings retain their existing polling.
- Shared trend charts now place points according to elapsed timestamp distance. Duplicate timestamps are consolidated and invalid points excluded. Uneven intervals are no longer shown as equal time steps.
- Simulator API tests now isolate production state and delivery settings, distinguish physical sensor noise from modeled counters, and use the existing transactional enqueue signature. No tests use live delivery settings.

## Verified with actual data

- 1,292 fresh Simulator records across 40 machines matched MySQL exactly by ID, machine, sensor, unit and value.
- Protected APIs returned 760 latest streams across 40 machines, or 19 streams for the Operator's assigned machine.
- Per-machine live freshness in three observations was approximately 2.67–5.32 seconds at five-second sampling.
- Audited all 14 report/overview/live-telemetry role combinations. All rendered charts, loaded scoped readings, had no browser page errors and showed no NaN or Infinity values. Operator's coolant trend and independent signal charts rendered against actual MySQL readings.
- Actual browser polling continued to receive changing timestamps and RPM across 14 refreshes after the update.
- Desktop/mobile report previews passed, including Admin user-management navigation, Supervisor station filtering and Manager filter controls.
- Simulator suite: 49 tests passed. Additional checkpoint, coolant and cross-project profile tests: 3 passed. Frontend calculation/timeline tests: 9 passed. Receiver HTTP contract tests: 8 passed. TypeScript and production build passed; existing Vite warnings remain.

Private evidence files are under `.local`: `readings-audit-2026-11-02.json`, `chart-inventory-live.json`, `chart-feed-final-status.json`, `live-browser-check.json`, and `role-report-preview-results.json`.

## Honest chart behavior and remaining data requirements

Sensor trends are live; counts and target/quality charts change when their underlying counts change. Incident, work-order, account and audit charts change when those actual records change. Zero incidents or zero failed events are valid values; no fake events were inserted to animate these charts. A selected historical window is fixed until reapplied or returned to live mode.

The Simulator cannot establish a real Power BI refresh, electricity-meter energy, approved material/lost-production costs, staff attendance, complete failure/repair history, or verified plant OEE. Related unavailable information remains explicit. Those require real inputs or a separately defined, labeled training model. Simulator estimates are not calibrated physical measurements. This audit verifies the connected chart paths; it does not assert that every future service request can never fail.

Separate Simulator source changes remain on this PC. Environment secrets, passwords and existing operational records were not changed or published.

## Pause-state schema issue resolved
The live MySQL status enum lacked IDLE, despite the APIs supporting it. The user applied scripts/migrations/20261102_allow_idle_telemetry.sql through the schema-owner Workbench connection. Verified the actual column now includes IDLE. Requeued720original IDLE records; all720delivered. Recovered28NORMALrecords separately; nofailedrecords remained at finaloutboxinspection. A new controlled pause test persisted all40machines' fresh IDLE snapshots successfully, then resumed thefleet. No account privileges or passwords changed. NewinstallationDDL also includesIDLE, and crossproject/schema contracttests now total4PASS. Adminhealth exposes pause-state storage readiness.

