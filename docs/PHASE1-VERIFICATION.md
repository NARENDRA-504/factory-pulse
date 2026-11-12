# FactoryPulse Phase 1: verified evidence and remaining gaps

Review date: **3 November 2026**. This is the current evidence index. Earlier October reports are historical; they do not certify the current app. Original versions of replaced reports are preserved in `docs/archive`.

## 1. Jupyter: calculations from actual sources

Open `notebooks/eda_manufacturing_datasets.ipynb`. All **nine code cells executed successfully with saved tables and plots**. No manually entered statistical summaries remain. `scripts/phase1_evidence.py` reads 22 original CSV files, records their SHA-256 hashes, parses missing tokens and the milling file's extra header/decimal commas, and preserves every row.

| Source group | Rows | Original columns | Missing cells | Duplicate-valued rows |
| --- | ---: | ---: | ---: | ---: |
| Tool wear | 2,054 | 154 | 1,142 | 0 |
| Turning roughness (two experiments) | 612 | 27 | 900 | 0 |
| Mill telemetry (18 experiments) | 25,286 | 48 | 0 | 331 |
| Milling life metadata | 968 | 131 | 0 | 0 |

`_source_file` is added as provenance, not counted as an original column. Turning Exp1 has 324 rows and Exp2 has 288, correcting the previous 306+306 claim. Missing values and duplicate-valued rows are counted, not automatically imputed or deleted. Matching numeric values alone do not establish an erroneous duplicated observation.

Statistics include count, minimum, mean, median, sample standard deviation (ddof=1), quartiles, 95th percentile and maximum. Vb mean is approximately 151.104 **raw source units**; its physical unit is not confirmed, so it is not silently labeled millimetres or divided by 1,000. Ra mean is approximately 0.682680 in the source's target scale. `CycleToFailureNormalized` is excluded from predictors for CycleToFailure because it leaks the target. No trained predictive model is claimed.

The notebook also reads the actual MySQL `v_factorypulse_latest_readings` view in one read-only transaction: **1,280 latest readings / 40 machines**, no duplicate machine/sensor keys or missing reading IDs at execution. Statistics group by sensor AND unit and use GOOD numeric values only. Independent Python standard-library calculations match pandas means, medians and sample deviations. See `reports/phase1/notebook_evidence.json`, the saved snapshot CSV, numeric-statistics CSV and source manifest.

**Important gap:** all four MySQL research tables exist but contain zero rows. The research analysis is verified from the original CSV files; it is not a completed CSV-to-MySQL research import. Operational telemetry is independently stored in MySQL. No database writes were made by the notebook or validator.

### Reproduce

From the FactoryPulse project folder in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-notebook.txt
$env:FACTORYPULSE_DATASET_ROOT = "C:\Downloads\datasets oct 5"
.\.venv\Scripts\python.exe scripts\validate_and_import_datasets.py
.\.venv\Scripts\python.exe scripts\run_phase1_notebook.py
```

The historical validator filename is retained for compatibility; it validates files and **does not import data**. The notebook also needs the existing backend dependencies and local backend database configuration. Missing inputs or a failed connection produce a failure, never replacement sample values. Do not regenerate the notebook with the builder after execution unless you intend to execute it again.

## 2. Named contribution proof

`CONTRIBUTION_EVIDENCE.md` now names Vadde Narendra with actual commit identifiers and explains the limits of Git attribution and AI assistance. The prior anonymous engineering-role list has been archived. Other team members' names, personal work and dated evidence are still needed; these cannot honestly be inferred or invented.

## 3. Current application and data path

- FactoryPulse frontend: http://127.0.0.1:3000 ; API: http://127.0.0.1:8001
- Separate AI Simulator frontend: http://127.0.0.1:5174 ; API: http://127.0.0.1:8002
- Simulator -> local SQLite/outbox -> authenticated FactoryPulse ingestion -> MySQL -> authorized role dashboards.
- Current UI is light teal. Operator access is restricted to the assigned station. Supervisor access follows the configured team; maintenance closure requires assignment. There is no public role switcher granting permissions.
- Manage the existing services using `scripts/local_stack.py`; do not start duplicate processes. Secrets remain in ignored local environment files.
- Supabase is disabled and does not replace or intercept MySQL queries. No live notification delivery success is claimed.
- The Power BI `FactoryPulse Machine Overview.pbix` report was imported and manually refreshed from MySQL locally. See `powerbi/README.md`. It is an Import snapshot, not a one-second live embedded report; cloud gateway/scheduled refresh/security/embedding remain unverified.

## 4. Recorded end-to-end training demonstration

Play `reports/phase1/FactoryPulse-workflow.webm`. It records **actual browser forms and authenticated live APIs**, with no mocked responses:

1. Operator OP-A002 reports a training vibration concern for CNC-5AX-002.
2. Supervisor SUP-A01 assigns an active maintenance technician.
3. The assigned Maintenance user saves investigation/repair notes.
4. Maintenance signs off and resolves the incident.
5. Manager opens the same resolved ticket; the linked work order is Completed.

Recorded incident: `INC-7A531874DF4746809536`, ID 7. Four persisted states are Open -> In_Investigation -> Action_Required -> Closed (displayed as Resolved). Detailed results and timestamps are in `workflow_verification.json`, with seven screenshots beside the video. SQL confirmation is separately recorded in `workflow_sql_verification.json`.

This is a **manually reported training fault**. No sensor fault was injected, no physical repair was performed, and no equipment readiness is certified. It demonstrates software workflow completion, not automatic fault detection or a real factory repair. The labeled resolved ticket remains in MySQL as audit evidence. No machine reset or production-counter change was used to record it.

## 5. Actual optional Gemini verification

The selected-machine question was sent with explicit `use_ai=true` and existing role authorization. The configured model failed; a single bounded fallback to **gemini-3.5-flash**, verified to respond with this account, produced an actual answer through FactoryPulse. The answer correctly cited the supplied MCH-001 temperature **47.71 degrees C**, expected 25â€“70 degrees C, NORMAL state and GOOD quality, then separated tentative recommendations. This is a saved historical response, not today's current temperature.

Evidence: `reports/phase1/gemini_verification.json` includes model, fallback flag, exact source reading ID/time, answer and grounding checks. Credentials and personnel records were not sent. A provider outage still returns SQL evidence without pretending AI succeeded. The local environment key/model were preserved; code reports the model actually used. This verifies one question only, not universal diagnostic accuracy or provider availability.

## 6. Checks and limitations

The current targeted suite ran **18 tests successfully**: source parsing/statistics/unit separation, Gemini privacy/opt-in/fallback/authorization, and incident closure notes. These are fixture/unit checks, not a certification of all application functionality. Notebook execution and live browser/SQL/provider checks are separate evidence. The workflow browser reported zero page errors. The follow-up read-only check confirmed all four incident audit events and resolution visibility for Operator, Supervisor, Maintenance and Manager. The saved local Admin credentials did not authenticate, so an actual Admin login check remains unavailable; no account or password was changed. A six-second sampling check observed 37 machines advancing (1,184 streams); this is not a one-second end-to-end latency guarantee.

Outstanding: named contributions from the rest of the team; research CSV ingestion to the empty MySQL research tables if required by the mentor; documented units for research target fields; an induced-sensor automatic fault lifecycle if required; cloud Power BI deployment/refresh/security if required. Production counters and cost figures remain modeled/assumption-based rather than verified physical factory accounting. Full 12-hour one-second reconstruction still needs a durable shift rollup where bounded history is insufficient.
