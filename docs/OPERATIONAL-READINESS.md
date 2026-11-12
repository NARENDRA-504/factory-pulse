> Current evidence (3 November 2026): see [PHASE1-VERIFICATION.md](PHASE1-VERIFICATION.md). The implementation notes below include historical checks and limitations; later verified Power BI and Gemini results supersede earlier unavailable statements.

# FactoryPulse operational readiness — 2 November 2026

## Implemented

1. **Supervisor permissions.** Approved team assignments in `config/workforce-teams.json` now restrict machine lists, current readings, history, downtime, selected-machine intelligence, incidents and work orders. Operators remain assigned-machine only. Unallocated Supervisors have no machine access. Admin user management remains Admin-only.
2. **Conservative storage retention.** Admin → dashboard → Storage & retention configures the policy. This PC is enabled for 14 days of detailed MySQL readings and 2 days of confirmed-delivered Simulator copies. Every minute, at most 500 old rows are processed. Latest sensor samples, pending/failed delivery, accounts, incident/work-order records and audit events are preserved. MySQL compaction writes hourly quality-filtered statistics and immutable duplicate-protection hashes in the same transaction as deletion. Sender copies are removed only when their reading IDs are confirmed in MySQL or its archive ledger. Free-space warnings are visible. This schedule is conservative: sustained generation can exceed cleanup throughput, so it is not a hard storage-size guarantee. Freed database pages are reused; database files are not automatically shrunk.
3. **Shift tracking.** Operator and Supervisor dashboards include 06:00–18:00 and 18:00–06:00 factory-local shifts, a 120-part target per machine, good/scrap output from counter increases, reset detection, coverage labels and recorded breaks, reasons and handovers. Missing baselines are not treated as full-shift production. Events persist in MySQL audit records; raw counters are not reset. Historical shift comparison and a certified attendance/timekeeping model are not included.
4. **Machine onboarding.** Admin creates/registers machines in Machine Management, then uses Machine readiness, service & costs → Sender onboarding to select a sensor template and optional Operator/Supervisor assignments. Only existing active accounts are used; teams stay within the four-machine maximum and same plant. Registration creates a stopped sender profile, never resets existing streams. Start it explicitly in AI Simulator and confirm Fresh telemetry. Registration is retryable; a later assignment failure can leave a stopped sender profile for retry. The approved 40-machine roster is now also in MySQL; inspection and installation dates remain unknown where unrecorded.
5. **Sustained fault workflow.** Enabled on this PC: fresh GOOD physical readings outside their configured bounds must persist for 30 seconds and at least three distinct samples. One open incident per machine/sensor is created and audited after commit. Supervisors then use the existing assignment/work-order workflow. No equipment controls, automatic diagnosis or automatic closure occur. Notification delivery uses existing in-app refresh; no unverified Supabase broadcast is claimed.
6. **Preventive maintenance.** Admin sets a service due date, observed running-hour/completed-part intervals and up to eight inspection steps per registered machine. Maintenance records completed checklists and notes; incomplete checklists are rejected. History and overdue status are visible. Completing an inspection does not silently postpone the service due date. Explicit service completion restarts observed usage intervals. See SHIFT-SERVICE-COST-EXTENSIONS.md for baseline and gap limitations.
7. **Cost assumptions.** Admin can save approved per-machine scrap INR/part, downtime INR/hour and electricity INR/kWh rates. Manager estimates apply those rates to coherent observed model-window inputs. Source demonstration rates are not approved accounting rates. Unknown rates stay unavailable. Estimates do not represent booked expenses or a validated tariff/accounting integration.
8. **Power BI boundary.** Prepared Power Query files read MySQL directly, including the new hourly-summary query. They contain no credentials. These are in-app charts and prepared Power BI sources, not verified embedded Power BI reports. Actual Desktop report refresh remains unverified and requires the intended PBIX/report and credentialed refresh.

## Verification

- 48 targeted permission, shift, retention, chat and telemetry tests passed.
- Real MySQL compaction, identical archived retry, batch retry and changed-payload rejection passed inside a transaction that was rolled back.
- Real MySQL settings, service checklist/history, break sequencing and shift handover checks passed; all QA business changes were rolled back.
- Simulator onboarding authentication, idempotency and preservation of existing counters passed using a temporary SQLite database/profile file; no telemetry sent by that test.
- Live role check: Operator 1 machine / 32 streams; Supervisor 4 / 128 and 2 / 64; Maintenance and Manager 40 / 1,280. Cross-team history/downtime rejected. All 1,280 sampled current values matched MySQL; all 40 machine timestamps advanced.
- Main lint and production build passed. Existing Vite configuration and bundle-size warnings remain.

## Local URLs

- FactoryPulse: http://localhost:3000/
- AI Simulator: http://127.0.0.1:5174/
- The existing `scripts/local_stack.py` supervises both separate applications. Environment files and passwords remain private and unchanged. Simulator files remain local and separate from the FactoryPulse repository.

## Important limits

Keep Admin-configured costs and inspection dates tied to actual site information. Missing verified failure intervals mean MTBF is unavailable; creation-to-closure incident time is not measured technician labor. MySQL remains the operational source of truth; Supabase is not used for operational queries, notebooks or Power BI. No public report was published. Automatic review rejected increasing cleanup to five-second deletion batches, so the tested one-minute schedule remains in place.

Final operational browser checks passed for Operator, Supervisor, Maintenance and Manager: 10–12 refreshes each, changing timestamps, new panels visible, no page errors and no mobile overflow. Admin policy/settings handlers were exercised with a dependency override and real SQL rollback, not an actual Admin browser sign-in. Background cleanup reported completed with zero eligible deletions; the fault monitor reported monitoring with zero new incidents during the normal-data check. Those observations verify operation, not an induced live-fault lifecycle test.
