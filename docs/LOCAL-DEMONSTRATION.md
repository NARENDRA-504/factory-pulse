# FactoryPulse local demonstration

This guide covers the working local application and its separate AI Simulator. It does not certify a hosted production deployment, physical machine safety, predictive-model accuracy or a Power BI refresh.

## Start both applications

Open PowerShell in the FactoryPulse repository folder and run:

```powershell
& ".\scripts\Start-LocalDemo.ps1" -OpenBrowser
```

The launcher starts or reuses the existing monitored services. It does not reset users, change environment settings, enable delivery or generate machine readings. It checks the MySQL schema and read path. Leave MySQL running. Python virtual environments, Node packages and each project's local environment settings must already be installed/configured.

- FactoryPulse: http://localhost:3000/
- AI Simulator: http://127.0.0.1:5174/
- Main API: http://127.0.0.1:8001/
- Simulator API: http://127.0.0.1:8002/

The main API root may return Not Found; its `/health` path is the health endpoint. The launcher uses a process lock to avoid duplicate monitors. Review `.local/stack/launcher-error.log` and service logs if launch fails. No secrets are printed by the readiness script.

## Check without starting readings

```powershell
& ".\scripts\Check-Presentation.ps1"
# Optional: observe existing incoming IDs, without generating any:
.\.venv\Scripts\python.exe scripts/check_presentation.py --observe-seconds 6
```

`READY_IDLE` means the sender is paused with zero running machines. Previously saved charts becoming stale is expected. `LIVE` requires fresh readings; with an observation interval, their IDs must advance. A successful preflight proves service/configuration/schema/read readiness, not actual end-to-end delivery. The private report is `.local/local-demo-readiness.json`.

## Demonstrate an incident

1. Sign into FactoryPulse with your own existing account. Open **Pipeline Monitor** as Admin/Super Admin, or **Machine Status** in a workplace role, for the role-specific guide. Enable **Alert sound** and use **Test sound** before the demonstration; browser sound requires a user gesture and depends on PC volume.
2. Select the same authorized machine in both apps. Operators are limited to their assigned station; Supervisors are limited to assigned teams. Do not change account assignments just to bypass these restrictions.
3. In the Simulator, choose **Quick demonstration**. A fault button runs for60seconds and stops automatically. Normal sends one round. Do not start a continuous fleet for this walkthrough.
4. Check saved/delivered/queued/failed counts. Acknowledgment confirms the receiver response; it does not itself confirm an automatic ticket. Current sustained-fault policy is separately configured in FactoryPulse.
5. In FactoryPulse, inspect changing readings, thresholds, history and the authorized alert inbox. The tested policy requires30seconds and at least3distinct samples before creating an automatic incident. A pre-existing open incident for the same machine/component is deduplicated.
6. Supervisor: open the incident and assign an existing technician. Maintenance: review its evidence/SOP and save investigation/repair notes. For a rehearsal, label notes as a demonstration; do not claim a physical repair.
7. Send a normal baseline only when appropriate for the demonstration. It does not close the incident. The assigned technician explicitly closes it with verification notes. Confirm the work order is Completed and the same incident is Closed in the other authorized roles.
8. Press **STOP ALL** in the Simulator. Confirm zero machines running and background delivery paused. A request already accepted by MySQL may finish. Do not delete pending outbox data.

## Role responsibilities

| Role | Demonstration focus |
| --- | --- |
| Operator | Assigned station, production and quality counters, individual sensor charts, incident report, SOP and handover |
| Supervisor | Assigned team, production/operator coverage, priorities, technician assignment, machine-change approvals |
| Maintenance | Assigned work, diagnostics, evidence and SOP, inspection/progress notes, explicit resolution and work history |
| Manager | Output, quality, downtime, configured cost estimates and Critical escalations |
| Admin | People/roles, machine registration, incident oversight, audit and readiness |
| Super Admin | Governance plus audited delegated views, administrator access and all authorized management tools |

The original `FACTORYPULSE-ADMIN-3` account is active as Super Admin. The old private test fixture `OPS-ADMIN` no longer corresponds to a SQL user; its failed login does not mean the original administrator was deleted. No passwords were reset. Use the configured account credentials; they are not listed here.

## Verification and limits, 22 November2026

- Main application:285Python tests passed after correcting the archive-table fixture and outdated role/encoding test assumptions.
- Frontend TypeScript and production build passed. A large-bundle warning remains.
- Twelve chart, production-rate and report-data Node tests passed.
- Actual local browser and API checks passed for Operator, Supervisor, Maintenance and Manager: sign-in, dashboard, guided navigation, machine view and authorized saved readings. Admin user management returned403 for all four roles; no browser page errors were observed. No new telemetry was generated during this check.
- Six-role guide component fixture: navigation callbacks, Operator boundary and desktop/mobile layout checked.
- Prior live incident test:13frames/416readings matched MySQL, one automatic Critical ticket was assigned, investigated and explicitly resolved; linked work order Completed. Operator assignment was denied403. Four working role logins saw the result. That is historical evidence, not proof that telemetry is continuously running today.
- Trained ML remains shadow-only: synthetic Critical recall53.1%, precision42.5%; it cannot safely replace sustained threshold incidents.
- Gemini availability depends on its configured provider; network/provider errors must remain visible. Power BI connectivity/refresh needs separate verification in the actual report. Neither is certified by local preflight.
- Simulator-only data remains in its separate folder and is not published to the FactoryPulse repository. MySQL is the operational source of truth; no Supabase proxy or duplicate operational store was introduced.

## Alert acknowledgement and cleanup preview

Incident response panels now show Operator, Supervisor and Maintenance acknowledgement states, including the first recorded acknowledgement time. These come from committed `activity_log` records grouped by `role_at_event`, with the existing incident/machine authorization checks applied first. This is role-level history: one account's acknowledgement does not prove every member of that role saw the alert. It does not claim external delivery or completed repair. Reassigning or changing a user's role does not rewrite prior acknowledgements.

In the Admin dashboard's **Storage & retention** section:

1. **Refresh saved policy** reloads actual policy and worker status; it replaces unsaved form edits.
2. Adjust detailed retention days and low-disk warning level, then **Save retention policy** if you intend to change configuration.
3. **Preview saved cleanup policy** runs a read-only, bounded preview. It uses the saved policy, samples at most the first 32 registered sensor streams, caps candidates to one configured batch, and reports zero deletes. This is not a full database total or guaranteed disk-space recovery.

The preview API is `GET /api/v1/admin/storage/preview` and accepts Admin/Super Admin only. It refuses preview if hourly-summary and archived-ID protection tables are missing. It does not touch the Simulator database or advance the cleanup worker's stream cursor. Existing cleanup retains latest pointers, summarizes before deleting in one MySQL transaction, and prunes Simulator copies only if already delivered and confirmed in MySQL/archive guards. No cleanup policy was enabled or changed during this implementation.

Verification: 37 targeted backend tests passed; TypeScript/build and desktop/mobile component checks passed. A read-only check against actual MySQL found a capped sample of 500 candidates, deleted zero rows, and retrieved three role acknowledgement states for an existing incident. Four workplace roles were denied the preview. Test authentication overrides were used for the actual-SQL admin checks; no real account was created, reset or acknowledged on behalf of an employee.

## Guidance and ML evidence review

Admin and Super Admin can open **Guidance & ML Review** from supporting navigation. The protected endpoint is `GET /api/v1/admin/readiness-review`; workplace roles cannot access it. Refresh is explicit and read-only.

- The SOP register lists revision, machine mapping count, effective/review dates, approver/manual references and missing requirements. Training guidance is also marked as approval pending in the instruction panel. Approval checks require current dates, explicit equipment mapping and usable role instructions; this screen cannot approve a procedure.
- The ML panel calculates missed Critical samples, false Critical predictions, recall, precision and a labeled confusion matrix from the existing verified local evaluation artifact. It shows whether evidence gates are met and cannot activate automatic alerts.
- On 22 November 2026, the actual catalog contained nine training documents and zero usable approved procedures. The local synthetic held-out test had 15 missed Critical samples, 23 false Critical predictions, 53.1% Critical recall and 42.5% Critical precision. Real-machine validation remains absent. These figures describe test samples, not physical failures or production reliability.

Validation: 19 targeted backend tests passed, including approval validity, matrix arithmetic and four-role API rejection. TypeScript and production build passed. Headless component checks passed at 1400px and 390px. Actual catalog/model reads succeeded for Admin and Super Admin using test authentication overrides, with no account or operational-data changes.

## 23 November 2026: bounded demonstration and operational follow-up

### Run a demonstration

1. Sign in with your current Admin or Super Admin account and open **Pipeline Monitor**.
2. Select a machine, then use **One-click machine demonstration**. Choose an available fault or normal baseline, and select one sample or a bounded 60-second test.
3. Click **Run finite demonstration**. The page shows stored/delivered counts and checks the final affected sensor samples against MySQL. The Simulator must already have continuous streams stopped; the control will refuse to resume them or drain old queued history.
4. **Stop finite demo** can cancel the finite test. An in-flight request may already have committed. Closing or navigating away does not cancel the bounded server operation.
5. Use the ordinary role workflow for assignment, investigation and resolution. A fault scenario is synthetic; the receiver's sustained-fault rules, human repair records and model predictions are separate mechanisms. Sending a normal sample does not silently close an incident.

The control endpoints under `/api/v1/admin/demo/` require Admin/Super Admin and a loopback local Simulator URL. Requested and finished demonstrations are audited. No credentials reach browser code. A 60-second request has a longer client timeout than ordinary page queries; other requests keep their existing 30-second limit.

Finite scenarios now opt into the existing batch sender so an entire sensor frame uses one bounded request rather than 32 independent short-timeout posts. Stable reading IDs, duplicate acknowledgements, the emergency-stop grant and paused historical backlog are preserved. Single-record compatibility fallback remains. The change is confined to the separate Simulator source; its files were not copied into this repository or pushed.

### Review shift handover

On **Machine Status** (workplace roles) or **Pipeline Monitor** (administrators), the handover panel now includes unresolved machine incidents, unfinished repairs and next actions alongside the observed good/scrap counts, target, stopped time and saved handover history. Lists are capped at 20 current records each. Operator/Supervisor machine restrictions apply before queries; technicians see their assigned unfinished work. Existing publish/acknowledgement permissions are unchanged. A missing target is displayed as unavailable.

### Equipment SOP preparation

`knowledge/sop/site-approval-template.json` is a deliberately unapproved template outside the active catalog. A qualified site owner must supply the correct manual reference, exact machine IDs, role instructions, approval identity, effective date and review date. Run:

```powershell
.\.venv\Scripts\python.exe scripts/check_site_sop.py knowledge/sop/site-approval-template.json
```

The blank template must fail approval checks. The command is read-only; it neither imports the document nor grants approval. Once the site owner provides a reviewed procedure, validate the file and review its applicability before adding it to the active catalog. The nine current training drafts remain unapproved. No OEM procedure or sign-off was fabricated.

### Stronger ML validation

Run `scripts/audit_health_validation.py` with the project Python environment to independently recompute the deployed JSON model on the existing time holdout. It verifies original split-file hashes, duplicate packet isolation, and exact confusion-matrix reproduction; it adds per-machine counts and uncertainty intervals to `.local/health-model-v2/validation-audit.json`. It never retrains, tunes thresholds, promotes a model or accesses live SQL. Admin **Guidance & ML Review** shows matching audit evidence and recovery results.

The actual audit reproduced all 15,377 held-out samples. Critical recall remains 53.1% (approximate 95% interval 36.4–69.1%) and Critical precision 42.5% (28.5–57.8%). The synthetic holdout has been examined previously and uses the same fictional machines across time splits; correlated samples can make the intervals optimistic. Automatic model alerts remain disabled.

For new representative data, fill `practice/site-health-data-template.csv` with reviewed observations, including packet/machine/event IDs, offset-aware observation time, split, label source, quality, health priority and seven sensor features. Feature units are °C, mm/s, RPM, A, %, bar and L/min in header order. Keep complete fault events within one split, retain at least a two-hour label-horizon gap, and reserve an untouched final holdout. Then run:

```powershell
.\.venv\Scripts\python.exe scripts/validate_health_dataset.py practice/site-health-data-template.csv
```

The empty template correctly fails. The validator rejects duplicate packets, event leakage, missing labels, invalid times/values and unreviewed quality. It reports machine overlap and does not authenticate provenance or authorize release. Representative labeled data and independent site validation are still required before model-driven alert deployment.

### Verification scope

- Main app: 39 targeted backend tests, TypeScript and production build passed. Mocked component checks passed at 1440px and 390px with no automatic sending, explicit run/stop, handover queues and recovery evidence.
- Simulator: 19 targeted scenario/delivery tests passed using temporary databases and mocked receivers, including selected-ID batch delivery and paused-backlog protection.
- Live development integration: a bounded fault produced 13 frames / 416 delivered readings; every ID, sensor value, unit, quality, status and timestamp matched MySQL exactly. A normal baseline was subsequently sent. One earlier timed-out test reading was acknowledged by retrying its exact original ID; old backlog was not resumed. Test authentication overrides were used for this API acceptance, not a claimed successful Admin sign-in. The saved test Admin credentials were rejected and no passwords were reset.
- Recovery: the existing 4.7 GB backup checksum was checked. A complete previously verified isolated restore was reused for 52 successful acceptance checks against today's API image. A redundant repeat import was cancelled and its task-created container/anonymous volume removed to conserve space. The original backup and live MySQL were untouched. Historical raw counts differ due to retention since the dump; prior archive reconciliation and latest-pointer checks remain recorded. This is not a fresh point-in-time backup or full historical payload comparison.

Qualified SOP approval and representative real-machine ML validation remain external evidence requirements, not completed integrations.
