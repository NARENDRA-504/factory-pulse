# Pipeline readiness, shift handover and machine-health preview

Implemented 12 November 2026. MySQL remains the operational source of truth. The separate AI Simulator, its environment, accounts and stored readings are preserved.

## Where to find the changes

- **Pipeline & Health** in the role navigation: MySQL reachability, authorized machine freshness, saved sensor counts and observation-to-storage delay. Admin and Super Admin also see safe delivery status from the local sender. Sender failure does not block MySQL diagnostics.
- **Run presentation check** compares saved reading identifiers six seconds apart. A stopped stream is reported honestly; the check does not start machinery, generate readings or alter records.
- **Shift handover** on the current shift and readiness page: publish an observed good/scrap snapshot, recorded STOPPED duration over the last 12 hours, open-incident count, note and restrictions. Operators/Supervisors publish; an authorized different employee acknowledges. Maintenance can acknowledge; Manager/Admin have read-only access. Super Admin inherits role access. Snapshots are audit events, not attendance or restart authorization.
- **Incident details → Response steps & relevant SOP**: shows report, assignment, repair/verification and resolved stages, retrieved project SOP steps and an acknowledgement note. Acknowledgement does not resolve the incident. Existing technician repair and closure actions remain authoritative.
- **Super Admin employee views** now require a reason and a server-enforced 1–30 minute limit. UI choices are 5, 15 and 30 minutes. Start, return and expiry are audited. All actions retain the real Super Admin actor. Ordinary users cannot switch accounts; employee passwords are never exposed. Restarting the backend ends delegated views.

## Data and scope limits

Readiness uses the latest-reading pointer join, bounded to 6,400 streams. It does not scan the full telemetry history. Fresh means an observation within 30 seconds; partial and stale streams remain visible. Delay statistics describe latest stored observations, not guaranteed browser end-to-end latency. Sender counters explicitly show their sampling scope (currently the latest 1,000 entries).

Handover downtime uses available RPM status observations, capped at 10,000, within a rolling 12-hour window; it is not guaranteed complete shift downtime. Production retains the existing observed-counter coverage rules. Recent handover history is limited to 300 audit events before machine filtering. Restrictions are employee notes, not approved machine-specific safety instructions.

No new database migration is required for these extensions. Existing audit tables without optional resource columns are supported using JSON references. Incident history shows linkable resource events and new acknowledgements; old events without a stored incident reference cannot be reconstructed reliably.

## Machine-health ML: research only

A JSON-only Gaussian Naive Bayes baseline was actually trained on the project's fictional practice dataset using seven features: temperature, vibration, RPM, current, motor load, pressure and coolant flow. Chronological partitions and a 120-minute purge prevent adjacent-window overlap. IDs and future outcomes are excluded from features. Only finite GOOD rows with known Normal/Suspect/Critical labels are used. Source and model checksums are recorded.

- Training rows: 46,872.
- Validation rows: 10,103; accuracy 93.77%; Critical recall 24.05%.
- Test rows: 15,377; accuracy 96.71%; Critical recall **37.5%**.
- These results do not establish a useful production fault detector. The UI also displays the majority-class baseline so accuracy is not misleading.
- Predictions require all seven exact-unit GOOD readings, no older than 30 seconds and aligned within five seconds. Missing/stale inputs produce an insufficient-data result. Values outside training ranges are flagged.
- **Shadow mode only: no ML-generated alerts, incidents, equipment commands or automatic shutdown.** Existing threshold automation remains separate and unchanged. Relative scores are not calibrated failure probabilities.

Train again from the project directory with `.venv\Scripts\python.exe scripts\train_health_baseline.py`. Local artifacts are `.local/health-model/model.json` and `.local/health-model/evaluation.json`; they are intentionally local. A fresh checkout requires training before inference becomes available.

## Verification performed

- 52 targeted backend tests passed, including authorization, audit rollback, delegated-view expiry, duplicate handover acknowledgement, legacy audit schema, SOP retrieval and invalid model inputs.
- Real MySQL handover publication and team Supervisor acknowledgement passed inside a transaction that was rolled back. No verification handover was retained.
- Read-only checks found all 40 machines with fresh persisted readings; saved IDs advanced during six seconds. Latest 1,000 sender entries showed no queued, retrying or failed entries at that check; these are not all-time totals.
- SQL-backed Operator diagnostics remained limited to its assigned machine. Actual shadow inference returned from fresh authorized readings, with alerts disabled.
- Desktop/mobile component checks passed using mocked API responses, including Super Admin switch controls. These are layout/interaction checks, not a new production account login test.
- TypeScript/lint and production build passed; existing Vite configuration and bundle-size warnings remain.

## Repeat the read-only presentation check

Open PowerShell in this project and run `& .\scripts\Check-Presentation.ps1`. It checks both web/API services, MySQL access, reading movement and freshness. It does not certify every role page, Gemini responses or a Power BI refresh.

Local URLs: FactoryPulse http://localhost:3000/ ; Simulator http://127.0.0.1:5174/ . The stack monitor preserves an existing fleet and respects the user's persistent emergency stop.
