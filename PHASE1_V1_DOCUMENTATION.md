# FactoryPulse Phase 1 documentation

Current review: 3 November 2026. The authoritative verification record is [docs/PHASE1-VERIFICATION.md](docs/PHASE1-VERIFICATION.md).

- Main app: http://127.0.0.1:3000 ; backend: http://127.0.0.1:8001
- Separate AI Simulator: http://127.0.0.1:5174 ; backend: http://127.0.0.1:8002
- The current interface uses a light teal theme, with role-specific navigation and server-enforced machine scope.
- MySQL is the operational system of record. Simulator SQLite is a local sender outbox. Supabase delivery is disabled; it is not a database query path.
- The executed notebook calculates statistics from original CSV inputs and the MySQL latest view. Research CSV tables currently exist but contain zero rows; notebook research input is local CSV, not a verified MySQL research import.
- The saved Power BI Machine Overview report uses MySQL Import and manual Refresh. No cloud gateway, embedded report or automatic refresh is claimed.
- Demonstration telemetry and production models are not certified physical factory measurements. Cost assumptions remain estimates unless approved factory rates are supplied.

Old release claims, dark-theme descriptions, port 8000 instructions and blanket 107/109-test success statements have been superseded. Historical versions remain in docs/archive and are not evidence of today's build.

See [CONTRIBUTION_EVIDENCE.md](CONTRIBUTION_EVIDENCE.md) for named attribution and its limits.
