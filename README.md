# FactoryPulse

FactoryPulse is a Phase 1 manufacturing monitoring and incident-response project. It provides role-based screens for Operators, Supervisors, Maintenance staff, Managers and Admins. A separate AI Simulator supplies modeled machine readings; FactoryPulse receives them through an authenticated Python API and stores operational telemetry in MySQL.

This is an internship project. Modeled readings and production estimates are not certified physical-factory measurements. The web dashboard charts are application visuals, not an embedded Microsoft Power BI connection.

## Week 1 screen and user-flow evidence

The initial experience is organized into five main screen areas. Different roles see only the navigation permitted to them.

| Screen area | Inputs and actions | Outputs and connected project data | Source files |
| --- | --- | --- | --- |
| Sign in | Employee ID, password, show/hide password and submit | Sign-in result, validation or connection error, and the authenticated user's role and employee identity | [LoginView.tsx](src/views/LoginView.tsx), [apiClient.ts](src/services/apiClient.ts) |
| Role dashboard | Select an available machine or report filter; refresh data | Assigned station or authorized fleet overview, machine state, production summaries and incident counts | [DashboardView.tsx](src/views/DashboardView.tsx), [FactoryPulseDashboard.tsx](src/components/FactoryPulseDashboard.tsx) |
| Machine Condition | Select an authorized machine and inspect its available sensor history | Timestamped readings, sensor units, recorded expected ranges, quality flags and separate sensor charts | [MachineConditionView.tsx](src/views/MachineConditionView.tsx), [RoleReportDashboard.tsx](src/components/RoleReportDashboard.tsx) |
| Incidents and Issues | Read-only assigned machine, issue category, severity, operator observations and machine-stopped checkbox; report an issue, search/filter incidents and assign a technician where permitted | Incident code, machine code, reporter, description, severity, status and assignment details | [RaiseAlertModal.tsx](src/components/RaiseAlertModal.tsx), [IncidentsView.tsx](src/views/IncidentsView.tsx) |
| Personnel and role access | Admin-only full name, employee ID, role, department, shift, machine assignment, email, active flag and new/reset password controls | User directory, assigned station and permitted role access. Existing passwords are not disclosed | [UsersView.tsx](src/views/UsersView.tsx), [UserProfileModal.tsx](src/components/UserProfileModal.tsx) |

The issue category choices are abnormal noise or vibration, excessive temperature, unusual motor load or power, and machine stopped. These choices populate structured incident descriptions and component areas rather than an unstructured chat message.

Week 1 submission evidence should explain screen planning, navigation, form fields and initial project-data mappings. Later live SQL integration, AI enhancements and end-to-end verification should be described under their actual later milestones; the existence of a feature today does not establish that it was implemented during Week 1.

## User workflow

```text
Open FactoryPulse
  -> Enter Employee ID and password
     -> Invalid sign-in: show error and allow retry
     -> Valid sign-in: retrieve trusted account role
        -> Operator: assigned station -> readings -> report concern
        -> Supervisor: permitted fleet -> review concern -> assign technician
        -> Maintenance: assigned work -> findings and progress
        -> Manager: authorized production and incident overview
        -> Admin: users and role access -> machine allocation -> audit review
  -> Log out
```

## Data mapping and integration

| Record | Important fields and use |
| --- | --- |
| Machine | Canonical machine ID/code, display name, plant, type and allocation; identifies the station shown on dashboards |
| Telemetry | Unique reading ID, machine ID, sensor name, value, unit, expected minimum/maximum, timestamp, machine status and data quality |
| Incident | Incident code, machine code, reporter, symptom description, component area, operator notes, severity, assigned technician and status |
| Work order | Linked incident/machine, assigned technician, progress and work-order status |
| User and session | Employee ID, name, role, assigned station, active status and server-managed session |

```text
Separate AI Simulator
  -> authenticated POST /api/v1/telemetry
  -> FactoryPulse FastAPI receiver
  -> MySQL stored readings
  -> authorized read APIs
  -> React dashboards and charts
```

The Simulator receiver header is `X-Simulator-API-Key`. Its secret belongs only in backend environment configuration. The Simulator's own API authentication is a separate configuration.

MySQL remains the operational source of truth for machine records, telemetry, incidents and work orders. The separate Simulator may maintain SQLite storage and a delivery outbox; it must not replace MySQL as FactoryPulse's operational database. Supabase is reserved for notification delivery, not a database-query proxy or a notebook/Power BI middleware.

App screens read through [src/services/apiClient.ts](src/services/apiClient.ts). The Python receiver and account endpoints are in [api_server/main.py](api_server/main.py), with analytics in [api_server/operational_insights.py](api_server/operational_insights.py). Data-loading or demonstration fallbacks must be distinguished from saved SQL records when presenting evidence.

## Technology

- React and TypeScript, with Vite and Tailwind CSS
- Python FastAPI and SQLAlchemy
- MySQL operational storage
- Optional Google Gemini analysis, with backend-only configuration and per-question user choice
- Python/Jupyter analysis and separate Power BI report work

## Local setup

Prerequisites: Node.js, Python and a running MySQL server. The AI Simulator is a separate project and is not included or published by these instructions.

1. Clone this repository and install frontend packages with `npm install`.
2. Create a Python virtual environment and install `api_server/requirements.txt`.
3. Copy [.env.example](.env.example) to a local `.env`, and configure the database connection, permitted web origin and backend simulator key. Never commit the populated `.env`.
4. For a new database, inspect [scripts/export_mysql_schema.sql](scripts/export_mysql_schema.sql) before applying it. For an existing database, apply only required migrations using the schema owner; do not rerun all migrations blindly or widen the runtime account's privileges.
5. Provision an authorized account using the project's account setup. Application sign-in credentials are different from MySQL server credentials.
6. Run the API and frontend in separate terminals.

From the repository folder in Windows PowerShell:

```powershell
# Frontend
npm run dev

# Backend in a second terminal after creating/installing the virtual environment
.\.venv\Scripts\python.exe -m uvicorn api_server.main:app --host 127.0.0.1 --port 8001
```

| Service | Local address |
| --- | --- |
| FactoryPulse | http://127.0.0.1:3000 |
| FactoryPulse API health | http://127.0.0.1:8001/health |
| FactoryPulse API reference | http://127.0.0.1:8001/docs |
| Separate Simulator frontend, when installed locally | http://127.0.0.1:5174 |
| Separate Simulator backend used by the local launcher | http://127.0.0.1:8002 |

These addresses work on the computer running the services. They are not public demo links. See [scripts/local_stack.py](scripts/local_stack.py) for the local four-service launcher; review its assumptions first because it expects a separate sibling Simulator folder and can start machine streams.

## Checks and demonstration

```powershell
npm run lint
npm run build
.\.venv\Scripts\python.exe -m unittest tests.test_telemetry_batch tests.test_telemetry_http_contract
```

For a demonstration, verify login, the assigned-machine view, changing saved readings, the report form and the authorized incident workflow. Clearly distinguish a training incident from a physical machine failure. A screenshot proves its captured state; use a live session or a recording to demonstrate changes over time.

## Published evidence and version limits

- [38cd961 — interface and dashboards](https://github.com/NARENDRA-504/factory-pulse/commit/38cd961264ff3664131ff70ca41d3357413a977c): dashboard components, report layouts, data-mathematics documentation and related interface work. This is a mixed project commit, not an exclusive Week 1 or Week 2 commit.
- [6649dc1 — improve telemetry batch delivery and document local startup](https://github.com/NARENDRA-504/factory-pulse/commit/6649dc19f553693644ef21a8818da11bebd582e4): delivery handling, tests, recovery guidance and startup documentation.
- [Delivery recovery notes](docs/LIVE-DELIVERY-RECOVERY.md)
- [Individual dashboard integration](docs/INDIVIDUAL-DASHBOARD-INTEGRATION.md)
- [Chart data audit](docs/CHART-DATA-AUDIT.md)

This README was added on 3 November 2026 to explain the project and its screen/data mappings. It does not backdate work or certify that every feature was built in a particular internship week.

At the time this README was prepared, newer local work—including RAG retrieval, the draggable assistant, executed notebook evidence and technician-closure enhancements—had not yet been committed and pushed. This README-only update does not publish those source changes. Local screenshots and recordings must be uploaded separately if the assessor needs access.

## Individual contribution

Vadde Narendra developed and reviewed this project with AI coding assistance. Repository commit attribution documents repository authorship, not sole unaided authorship. Each team member should describe the specific implementation, review, testing or analysis they personally performed and attach their own dated evidence; this README does not assign contributions to unnamed teammates.

## Secrets and access

Do not publish environment files, API keys, MySQL passwords, account-password lists or personnel exports. Keep access checks on the server, not only in hidden menus. Configure real factory service intervals, tariffs and approved cost rates before presenting estimates as operating decisions.
