# Release verification — 22 November 2026

The local demonstration is running; hosted production readiness is not yet verified. Services were left idle, without generating telemetry during this check.

| Check | Actual result | Remaining work |
| --- | --- | --- |
| Local applications and MySQL | Local stack preflight passed, READY_IDLE. SQL latest-reading view returned 1,280 readings covering 40 machines. | Repeat end-to-end acceptance on the intended deployment host. |
| Gemini text | Actual provider response succeeded using the existing fallback model. | Review the configured model before deployment. |
| English, Telugu and Hindi voice | Synthetic speech generation and transcription round trips passed for all three languages. | Physical microphone, browser permission and speaker playback acceptance. |
| Power BI | Initial authentication failed. After the user supplied credentials, Refresh -> Schema and data returned without an error; 40 machines were displayed and the report was saved. | Independent refreshed-model row comparison, cloud gateway, scheduled refresh and embedding remain unverified. |
| Containers and HTTPS | All four images built; container-to-MySQL read passed (1,280 pointers/40 machines). Separate-port local staging web/API routes pass, protected endpoints reject anonymous access, sender configured and paused. Nginx and optional Caddy configuration checks passed. | Supply public deployment host/domain and verify DNS, certificate issuance and hosted acceptance. |
| Backup and recovery | Fresh 22 November full dump (4,674,670,257 bytes) passed checksum verification and restored into isolated MySQL 8 in 1,594 seconds. All 18 tables and 7 views restored; all 1,280 latest readings match after UTC normalization. History/archive totals reconcile at 15,750,486 records. | 52 isolated container API checks passed, including six-role login/logout, access boundaries, bounded ingest/deduplication and incident-to-completed-work-order resolution. Browser/hosted acceptance remains separate. Historical payloads were not compared row by row. Runtime privileges unchanged. |
| ML | Shadow-only. Both bundled and local evaluation gates report real-machine validation false and Critical precision/recall gates unmet. Automatic model alerts remain disabled. | Obtain labeled representative machine data, validate and meet release gates before enabling model-driven alerts. |

## Prepared recovery tools

See [Backup and recovery](BACKUP-AND-RECOVERY.md) and `scripts/Backup-MySQL.ps1`. The helper prompts for the password locally and writes a checksum manifest after a successful dump. The user ran the backup locally; an actual isolated restore and data reconciliation passed. Isolated API recovery acceptance passed; browser/hosted acceptance remains separate.

## Evidence and limits

Secret-free local results: `.local/release-verification-status.json` and `.local/release-provider-verification.json`. Previous deployment checks passed 292 main backend tests, 63 Simulator backend tests, 12 frontend data/chart tests, lint and both frontend builds. Follow-up Linux container checks passed: FactoryPulse health 200 and readiness 503 without a database (expected); Simulator health 200 and paused startup with 40 machines; both Nginx configurations valid. Containers had no network access or live database mounts. The Simulator Dockerfile requirements path was corrected after the real build exposed it. Large frontend bundle warnings remain. These checks do not substitute for hosted end-to-end acceptance, TLS or backup recovery.

No existing credentials, accounts, original environment files, schema privileges or production records were changed by these checks. No public deployment or Git push was performed.

Follow-up: private local staging environment files were newly generated under ignored
`.local/staging`, using the existing MySQL connection and separate staging-only keys.
Original environment files/credentials were not modified. Local staging was started
at ports18080/15175; no public deployment, operational mutations or telemetry generation
were performed. See [STAGING-ACCEPTANCE.md](STAGING-ACCEPTANCE.md). Fourteen targeted
backup/staging/deployment tests passed. Physical voice and hosted/browser
acceptance remain pending; no claim that every production release gate passed.

The user selected **keep local for now**. Public hosting is deferred. The isolated
recovery API acceptance passed 52 checks; see [release runbook](RELEASE-RUNBOOK.md).

## Latest local completion check

- Restarted both local apps using `scripts/local_stack.py`; final read-only preflight passed all eight service, sender, SQL and administrator checks. The stack is READY_IDLE: zero running machines and delivery paused, intentionally preserving the user's storage policy. This is service readiness, not a claim of newly flowing telemetry.
- Split operational pages, machine management and the assistant into on-demand production chunks. The entry JavaScript is now 432,619 bytes versus 1,270,172 before this pass (about 66% smaller). Shared/dashboard chunks still load when required; total download is not reduced by that same percentage. Build passed without the previous oversized-chunk warning.
- Added accessible workspace loading feedback and separate assistant error recovery. Navigating to another screen resets a page display error. Removed an unsupported safety-standard label from the UI error panel; an error boundary is not industrial safety certification.
- TypeScript and production build passed; 38 targeted backend tests and 13 frontend chart/calculation/voice tests passed. Actual local browser checks passed for Operator, Supervisor, Maintenance and Manager: sign-in, dashboard, Pipeline & Health guide, machine page, SQL-backed latest readings and denied administrator access. These checks create sign-in/out audit events but no telemetry.
- Remaining external acceptance: physical conversational microphone/speaker check; representative labeled machine data and ML release gates; independent Power BI model parity and any cloud refresh configuration. Public hosting remains deferred at the user's request. No credentials, operational schemas, telemetry sender code or live machine records were edited in this pass.
