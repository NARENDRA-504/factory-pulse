# Administrator Pipeline Monitor

Sign in as **Admin** or **Super Admin**, then open **Pipeline Monitor** in the sidebar. Other workplace roles see **Machine Status** instead. Changing a URL or calling a diagnostic API directly does not grant access.

The monitor refreshes five seconds after each completed request, without overlapping its polling requests. Sender status is cached on the server for up to ten seconds. The page is read-only; it does not start simulation, replay the outbox, change records or delete history.

## Actual information shown

- MySQL connectivity, fresh machines / authorized registered machines and latest saved sensor stream count.
- Last saved observation timestamp, per-machine reading age, freshness and saved/fresh stream counts.
- Observation-to-storage delay (median/p95) from the latest saved readings. Negative delays are excluded and future-dated observations are counted separately.
- Database query duration and browser monitor-request duration, labeled separately. Neither is a complete Simulator-to-dashboard display measurement.
- Sender availability, paused/ready state, queued/retrying/failed/delivered counts with the sender's count scope. Counts are not claimed to be all-time totals.
- A recent delivery-error flag without forwarding raw error contents or credentials.
- A manual six-second comparison of saved reading IDs to check whether records advanced.

A machine is fresh if at least one saved stream is at most 30 seconds old; the table distinguishes fully fresh, partial, stale, missing and clock-skew states. Freshness does not prove a machine is safe or running. Paused delivery can coexist briefly with fresh saved readings; counts describe the latest saved observations.

## Server permissions

- `GET /api/v1/operations/pipeline-monitor`: Admin and Super Admin only; other authenticated roles receive 403 before diagnostics execute.
- `GET /api/v1/analytics/pipeline-health`: compatibility URL with the same admin restriction and current diagnostics. Removed its previous hardcoded totals.
- `GET /api/v1/operations/readiness`: administrators retain diagnostics; other roles receive an explicit allowlist of `status`, `checked_at` and authorized machine IDs/codes/status only. No queue counts, timing, model details, SQL diagnostics or fingerprints are returned.
- Workplace machine status values are Live, Paused or Data unavailable. Existing machine/team authorization still filters the machine list. Their handover workflow remains accessible.

The old sample pipeline tab was removed from general Analytics and its seed-backed client helper was removed. Pipeline information is centralized in the administrator monitor. Existing admin system-health diagnostics remain admin-protected.

## Verification on 22 November 2026

28 targeted backend tests passed, including rejection for all four workplace roles and redaction/scoping checks. TypeScript and production build passed. Six-role browser component checks passed, including mobile layout. Actual local logins for Operator, Supervisor, Maintenance and Manager were denied at both diagnostic endpoints and their status pages loaded. Read-only TestClient checks with administrator authentication overrides used actual MySQL: both admin roles returned 200, 40 machines and 1,280 saved streams. This last check did not use actual administrator credentials.

No new telemetry was generated. Original environments, accounts, operational schemas and Simulator source were unchanged. Local sender remains intentionally paused.
