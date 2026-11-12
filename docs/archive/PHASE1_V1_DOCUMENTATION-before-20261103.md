# ZIRO DIGITAL INTERNSHIP PROGRAM (ZDIP)
## AI Manufacturing Incident and Maintenance Response Platform — FactoryPulse
### Phase 1 V1 Comprehensive Engineering Documentation Package

---

## 1. Project Overview

**FactoryPulse** is an enterprise-grade AI-powered smart factory operations, telemetry monitoring, and incident response platform developed under the ZIRO Digital Internship Program (ZDIP). It bridges real-time industrial Internet of Things (IoT) sensor telemetry, transactional SQL persistence, machine learning/statistical intelligence, generative AI physical diagnostics, and Power BI analytical reporting.

The platform provides role-based situational awareness across the entire factory hierarchy—from Shop Floor Operators monitoring physical machining parameters on their assigned station, to Maintenance Engineers executing dispatched work orders, Shift Supervisors coordinating triage and assignments, Operations Managers optimizing OEE and line throughput, and System Administrators governing fleet registries and access controls.

---

## 2. Problem Statement

Modern precision manufacturing facilities operate complex CNC machine tools (5-axis mills, turning centers, horizontal machining centers, grinders) under stringent operational tolerances. Traditional factory operations suffer from four critical failure modes:
1. **Siloed Sensor Telemetry:** Telemetry data from machine PLCs and simulators is frequently disconnected from enterprise databases, leading to unobserved drift, chatter vibrations, and thermal runaways.
2. **Lagging Incident Response:** Machine anomalies are often detected only after workpiece surface defect (Ra deterioration) or tool breakage (Vb flank wear failure), resulting in unplanned downtime and high scrap rates.
3. **Disjointed Maintenance Workflows:** Operators, supervisors, and maintenance technicians communicate via ad-hoc verbal or paper-based systems lacking immutable audit trails, SLA tracking, and Mean Time to Resolution (MTTR) analytics.
4. **Superficial AI Claims:** Generic AI integrations hallucinate ungrounded failure modes or claim unverified capabilities without physical sensor constraints (e.g., ISO 10816 standards) or rigorous safety disclaimers.

---

## 3. Project Objectives

- **Unified Real-Time Pipeline:** Stream, validate, and persist high-frequency telemetry from the AI Simulator through FastAPI into MySQL/Cloud SQL without data loss or pipeline interruption.
- **Strict Role-Based Access Control (RBAC):** Provide tailored dashboards and permission boundaries across 5 industrial roles: Operator, Supervisor, Manager, Maintenance, and Admin.
- **Authoritative SQL Source of Truth:** Retain MySQL as the singular transactional ledger for machine masters, telemetry events, incident tickets, maintenance work orders, and audit logs.
- **Empirical Statistical Intelligence:** Calculate deterministic descriptive statistics (Mean, Median, Min, Max, StdDev, IQR) and manufacturing KPIs (Availability %, Downtime %, MTBF, MTTR).
- **Physical Generative AI Diagnostics:** Deploy Gemini-powered Machine Health Assistant grounded in real sensor telemetry, ISO 10816 vibration severity zones, thermal thresholds, and mandatory Lock-Out/Tag-Out (LOTO) safety protocols.
- **Executive Power BI Reporting:** Provide non-destructive analytical views for fleet utilization, downtime distributions, incident frequencies, and maintenance backlogs.

---

## 4. User Roles & Permission Matrix

| Role | Station / Scope | Permissions & Capabilities | Primary Workspace |
|---|---|---|---|
| **Operator** | Single assigned CNC machine | Live sensor monitoring, pre-shift safety checklists, raise incident ticket with telemetry snapshot, view assigned work orders | Operator Control Console (`/`) |
| **Supervisor** | Entire shift / plant lines | Fleet health overview, live alert triage, incident assignment to maintenance technicians, close tickets with sign-off | Supervisor Command Center |
| **Maintenance** | Assigned machinery & work orders | Work order execution, update investigation & repair logs, mark work orders In Progress / Completed, physical vibration analysis | Maintenance Workbench & Work Orders (`/maintenance`) |
| **Manager** | Plant-wide operations & lines | Operational OEE tracking, line throughput metrics, downtime cost analysis, Power BI analytical views | Operations Management Dashboard |
| **Admin** | System-wide root authority | Machine registry management (activate/deactivate, Add Machine), personnel directory & RBAC, system health audits | Admin Master Oversight (`/inventory`, `/users`) |

---

## 5. Technology Stack

- **Frontend Application:** React 19 SPA, TypeScript, Vite, Tailwind CSS, Lucide React icons, Responsive dark industrial theme (`#070d18`, `#0c1424`).
- **Backend Application Server:** Python 3.10, FastAPI, Uvicorn, Pydantic data validation schemas, SQLAlchemy ORM with MySQL connection pooling.
- **Database Engine:** MySQL 8.0+ / Google Cloud SQL (InnoDB Engine, UTF-8mb4 unicode, ACID transactional guarantees).
- **Statistical & Data Engineering:** Python standard math/statistics, NumPy, Pandas, deterministic downtime windowing (`live_analytics.py`), batch validation & deduplication engine (`telemetry_cleaner_and_stats.py`).
- **AI & Diagnostics:** Google GenAI TypeScript/Python SDK (`gemini-3.8-flash` with ISO 10816 physical fallback engine).
- **Business Intelligence & Reporting:** MySQL Analytical Views, Power BI semantic models (`v_factorypulse_*`).
- **Testing & Quality Assurance:** Python `unittest` test suite (107 automated tests across 11 modules), TypeScript compiler (`tsc --noEmit`), Vite production bundler.

---

## 6. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             FACTORY FLOOR LAYER                                  │
│  ┌──────────────────────┐                     ┌───────────────────────────────┐  │
│  │   AI Simulator       │                     │   Canonical Machine Catalog   │  │
│  │   (Active 50 Fleet)  │                     │   (MCH-001 ... MCH-400)       │  │
│  └──────────┬───────────┘                     └───────────────┬───────────────┘  │
└─────────────┼─────────────────────────────────────────────────┼──────────────────┘
              │ POST /api/v1/telemetry                          │ Dynamic Lookup
              ▼                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             FASTAPI BACKEND LAYER                                │
│  ┌──────────────────────────────┐            ┌────────────────────────────────┐  │
│  │ Telemetry Cleaning & Gate    │            │ Transactional Incident Engine  │  │
│  │ • Bound check [min, max]     │            │ • Report (Operator/Supervisor) │  │
│  │ • Timestamp validation       │            │ • Assign (Supervisor)          │  │
│  │ • Deduplication / Quarantine │            │ • Progress (Maintenance)       │  │
│  │ • Active state validation    │            │ • Close (Supervisor/Maint)     │  │
│  └──────────────┬───────────────┘            └────────────────┬───────────────┘  │
└─────────────────┼─────────────────────────────────────────────┼──────────────────┘
                  │ SQL INSERT                                  │ ACID Transactions
                  ▼                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             MYSQL DATABASE LAYER                                 │
│  • machines (id, machine_id, code, is_active, status, cut_hours)                 │
│  • simulator_sensor_readings (reading_id, machine_id, sensor_name, value, time)   │
│  • incidents (incident_code, machine_code, severity, symptom, status)             │
│  • maintenance_work_orders (order_code, incident_id, tech_id, priority, status)  │
│  • activity_log (audit trail, employee_id, event_type, request_id, timestamp)    │
│  • Analytical Views (v_factorypulse_active_machines, v_factorypulse_downtime...) │
└─────────────────┬─────────────────────────────────────────────┬──────────────────┘
                  │ Live Query & WebSocket/Polling              │ Analytical Query
                  ▼                                             ▼
┌──────────────────────────────────────────────┐  ┌────────────────────────────────┐
│      FACTORYPULSE REACT APPLICATION          │  │     POWER BI DASHBOARDS        │
│  • Operator Control Console                  │  │  • Plant OEE Distribution      │
│  • Supervisor Command Center                 │  │  • Fleet Utilization %         │
│  • Maintenance Management & Dispatch         │  │  • Stoppage Frequency          │
│  • Admin Machine Management (50 -> 51)       │  │  • MTTR & Maintenance Backlog  │
│  • Gemini Machine Health Assistant           │  │  • Sensor Statistical Trends   │
└──────────────────────────────────────────────┘  └────────────────────────────────┘
```

---

## 7. Data Pipeline Diagram

```
Simulated Sensors (Temp, Vib, Load, RPM, Power, Parts)
                   │
                   ▼
       [Payload Validation Gate]
      ├── Machine ID in Canonical Catalog? (Yes / No)
      ├── Machine Marked is_active = TRUE? (Yes / 422 Rejection)
      ├── Timestamp within Valid Window? (Yes / Quarantine)
      ├── Numeric Bounds [min, max] Valid? (Yes / Quarantine)
      └── Duplicate (machine_id, timestamp)? (Idempotent 200 / Insert)
                   │
                   ▼ (ACID Transaction)
        [MySQL: simulator_sensor_readings]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
[Downtime Window Engine]   [Deterministic Statistical Aggregator]
 (30-min rolling rounds)   (Mean, Median, Min, Max, StdDev, IQR)
         │                   │
         └─────────┬─────────┘
                   ▼
     [FactoryPulse Dashboard & Analytics]
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
[Gemini Health Assistant]  [Incident & Maintenance Dispatch]
 (ISO 10816 Diagnostics)   (Work Order Lifecycle: Pending -> Completed)
```

---

## 8. SQL Schema & Relational Integrity

The database architecture is partitioned into four functional layers:

1. **Raw Empirical Layer (`raw_*`):**
   - `raw_cnc_tool_wear`: 2,054 cuts × 154 features. Target is flank wear $V_b$ in mm. Preserves empirical NULLs on channels 14/15 without artificial imputation.
   - `raw_turning_roughness`: 612 cuts × 6 features. Target is arithmetic roughness $R_a$ in $\mu\text{m}$. Keeps Exp1 and Exp2 distinct from `Prep.csv`.
   - `raw_mill_telemetry`: 25,286 rows × 49 channels across 18 source experiments.
   - `raw_milling_cycles`: 968 cuts. Target is `CycleToFailure` (distinct from $V_b$).

2. **Simulator Layer:**
   - `simulator_sensor_readings`: Canonical high-frequency ledger. Stores `reading_id` (UUID), `machine_id` (`MCH-xxx`), `sensor_name`, `sensor_unit`, `sensor_value_json`, `machine_status`, `data_quality`, and `data_provenance`.
   - `sim_telemetry_events`: Aggregated telemetry snapshot containing explicit separate columns for `motor_power_kw` and `motor_load_pct`.

3. **Operational Workflow Layer:**
   - `machines`: Authoritative catalog with `is_active` boolean, `cut_hours`, `line_id`, and `operating_limits`.
   - `users`: Credentials, work IDs, roles, and shift assignments.
   - `incidents`: Foreign keys to `users(id)`, severity (`Low`, `Medium`, `High`, `Critical`), state (`Open`, `In_Investigation`, `Action_Required`, `Closed`), and sensor snapshot JSON.
   - `maintenance_work_orders`: Relational link to `incidents(id)` and `users(id)`. Tracks `priority`, `action_taken`, `status` (`Pending`, `In_Progress`, `Completed`), and completion timestamps.
   - `activity_log`: High-security immutable audit trail recording employee ID, role, session ID, request ID, event type, and UTC timestamp.

4. **Power BI & Analytics Views:**
   - `v_factorypulse_active_machines`: Filters active fleet (`is_active = TRUE`).
   - `v_factorypulse_machine_inventory`: Telemetry counts and latest timestamps.
   - `v_factorypulse_downtime_summary`: Stopped events and downtime aggregations.
   - `v_factorypulse_fleet_utilization`: Machine utilization % and operating cut hours.
   - `v_factorypulse_incident_frequency`: Severity distribution and MTTR.
   - `v_factorypulse_maintenance_backlog`: Pending and in-progress work orders by technician.
   - `v_factorypulse_sensor_trends`: Statistical min/max/avg sensor values.

---

## 9. Python Data Processing Explanation

Implemented in `api_server/telemetry_cleaner_and_stats.py`:
- **Machine Identification Validation:** Enforces regex syntax (`^MCH-[0-9A-Za-z_-]{3,16}$` and `^CNC-.*$`).
- **Timestamp Parsing & Window Enforcement:** Parses ISO-8601 strings and epoch values into UTC `datetime`. Rejects timestamps further than 300 seconds into the future or older than 365 days.
- **Physical Boundary Quarantining:** Validates each sensor reading against defined physical ranges (e.g. Temperature 10–130°C, Vibration 0–30 mm/s, Motor Load 0–150%, Motor Power 0–75 kW). Readings violating physical laws are quarantined with reason logging rather than polluting production analytics.
- **Deduplication Engine:** Computes composite keys `(machine_id, timestamp)`. Duplicates are identified, rejected from the insert batch, and recorded in duplicate audit counts.
- **Missing Value Handling:** Missing sensor channels are strictly preserved as explicit `None`/`NULL`. The system forbids auto-imputing zeros or synthetic averages.

---

## 10. Statistical Methods & Formulas

The platform computes deterministic sample statistics:
1. **Arithmetic Mean:**
   $$\bar{x} = \frac{1}{N} \sum_{i=1}^{N} x_i$$
2. **Median:** Value dividing sorted series into equal halves:
   $$\tilde{x} = \begin{cases} x_{(N+1)/2} & \text{if } N \text{ is odd} \\ \frac{1}{2}\left(x_{N/2} + x_{(N/2)+1}\right) & \text{if } N \text{ is even} \end{cases}$$
3. **Sample Standard Deviation ($s$):**
   $$s = \sqrt{\frac{1}{N-1} \sum_{i=1}^{N} (x_i - \bar{x})^2} \quad (N > 1)$$
4. **Interquartile Range (IQR):**
   $$\text{IQR} = Q_3 - Q_1$$
5. **Manufacturing Availability Percentage:**
   $$\text{Availability } (\%) = \left(\frac{\text{Operating Hours}}{\text{Planned Production Hours}}\right) \times 100$$
6. **Mean Time Between Failures (MTBF):**
   $$\text{MTBF} = \frac{\text{Total Operating Hours}}{\text{Total Incident Count}}$$
7. **Mean Time to Resolution (MTTR):**
   $$\text{MTTR} = \frac{1}{K} \sum_{j=1}^{K} (t_{\text{closed}, j} - t_{\text{created}, j})$$

---

## 11. Generative AI Feature (Machine Health Assistant)

Implemented in `api_server/gemini_insights.py`:
- **Physical Diagnostic Reasoning:** Evaluates live sensor telemetry against ISO 10816 vibration velocity thresholds (Zone A/B Good <4.5 mm/s, Zone C Warning 4.5–7.1 mm/s, Zone D Critical Danger >7.1 mm/s) and thermal load thresholds (>75°C warning, >85°C critical).
- **Distinction Between Facts & Hypotheses:** Explanations clearly state what was directly observed in telemetry versus inferred potential failure modes (e.g., spindle bearing race wear, toolholder unbalance, coolant pump cavitation).
- **Deterministic Physical Fallback:** When Gemini API keys are unconfigured or external networks are unavailable, an empirical ISO 10816 diagnostic rule engine generates structured physical health scores (0–100), condition severity, and maintenance recommendations.
- **Safety Disclaimers & LOTO Protocols:** Every diagnostic response mandates adherence to industrial Lock-Out/Tag-Out (LOTO) procedures and disclaims autonomous physical control.

---

## 12. Application Screen Descriptions

1. **Main Dashboard (`/`):**
   - **Operator Console:** Shows large analog/digital gauges for assigned machine, spindle vibration graph, active alerts, and pre-shift safety checklist.
   - **Supervisor Command Center:** Fleet status matrix, real-time alert triage stream, and direct incident assignment modal.
   - **Manager Dashboard:** Line availability %, downtime rates, and OEE performance indicators.
   - **Maintenance Dashboard:** Assigned machine list, open work orders, and quick repair status updater.
   - **Admin Dashboard:** System health gauges, database connection status, and user session monitoring.
2. **Machine Management (`/inventory`):** Admin searchable table with 6 dynamic KPI cards (Total, Active, Running, Idle, Down, Maintenance), inline activation toggles, and downtime tracking.
3. **Add New Machine Modal:** Form generating canonical IDs (`MCH-051`), department assignment, manufacturer, and live simulator synchronization.
4. **Machine Details Modal:** 4-tab inspection modal with live metrics, multi-sensor trend charts with threshold lines, downtime round intervals, and AI health assistant.
5. **Incidents & Issues (`/incidents`):** Incident ticket creation, triage filters, severity tags, supervisor technician assignment, and closure with resolution sign-off.
6. **Maintenance Management (`/maintenance`):** Dedicated work order dispatch view, status toggles (`Pending`, `In_Progress`, `Completed`), technician assignments, and MTTR metrics.
7. **Analytics & Reports (`/analytics`):** 6-tab engineering analytics suite covering empirical research datasets, data pipeline audit, and fleet-wide statistical business insights.
8. **Personnel & RBAC (`/users`):** Admin employee directory, role matrix, and machine station clearance assignments.
9. **Activity Log (`/activity`):** Immutable compliance audit log recording all logins, incident creations, assignments, and work order transitions.

---

## 13. Incident & Maintenance Lifecycle Workflows

```
[TELEMETRY ANOMALY DETECTED OR OPERATOR OBSERVATION]
                        │
                        ▼
       1. Incident Creation (Status: 'Open')
          - Operator, Supervisor, or Maintenance reports issue
          - Captures machine code, severity, component area, and sensor snapshot
          - MySQL enforces duplicate protection per machine/component
                        │
                        ▼
       2. Triage & Assignment (Status: 'In_Investigation')
          - Shift Supervisor reviews incident details and AI diagnostics
          - Supervisor selects qualified active Maintenance technician
          - Relational trigger automatically generates Work Order (WO-xxx)
                        │
                        ▼
       3. Maintenance Execution (Status: 'Action_Required' / 'In_Progress')
          - Assigned technician inspects machine under LOTO safety protocols
          - Logs physical findings and replacement parts in repair notes
          - Updates Work Order status to 'In_Progress'
                        │
                        ▼
       4. Resolution & Sign-Off (Status: 'Closed' / 'Completed')
          - Maintenance technician or Supervisor completes repair
          - Logs comprehensive closure notes and verification cut
          - Work Order status updated to 'Completed' with UTC timestamp
          - Activity log records final sign-off event
```

---

## 14. Testing Methodology & Verification Results

The automated test runner (`tests/run_all_tests.py`) executes 107 unit and integration tests across 11 modules:

| Test Module | Suite Focus | Tests Run | Pass | Fail | Execution Time |
|---|---|---|---|---|---|
| `test_dataset_validation` | Dataset Baselines & Row Counts | 6 | 6 | 0 | 0.002s |
| `test_rbac_and_auth` | 5-Tier RBAC & Auth Security | 10 | 10 | 0 | 0.002s |
| `test_api_contracts_and_models` | API Contracts, Models & LOTO | 14 | 14 | 0 | 0.008s |
| `test_mysql_schema_ddl` | DDL Constraints, PKs, FKs & Views | 13 | 13 | 0 | 0.005s |
| `test_frontend_benchmarks` | Seed Data, Types & UI Layout | 9 | 9 | 0 | 0.002s |
| `test_live_database_engine` | MySQL Engine Transactions | 7 | 7 | 0 | 0.016s |
| `test_live_http_server` | Wire HTTP Sockets & RBAC Gates | 10 | 10 | 0 | 0.573s |
| `test_dashboard_upgrade` | Visual Dashboard & KPI Integrity | 12 | 12 | 0 | 0.073s |
| `test_operator_dashboard_audit` | Operator Console Workflows | 11 | 11 | 0 | 0.549s |
| `test_telemetry_cleaner_and_stats` | Cleaning, Deduplication & Stats | 9 | 9 | 0 | 0.008s |
| `test_factorypulse_simulator_management`| Tests A–F (50 Fleet, Add MCH) | 6 | 6 | 0 | 0.046s |
| **Full Master Verification Suite** | **All System Modules** | **107** | **107** | **0** | **5.673s (100% Pass)** |

Frontend Static Analysis:
- TypeScript Compilation (`tsc --noEmit`): **PASSED (0 errors)**.
- Production Bundler (`vite build`): **PASSED (Clean production distribution)**.

---

## 15. Results and Operational Limitations

### Results Achieved
- Real-time telemetry ingestion pipeline accepting simulated multi-sensor records at sub-second latency.
- Dynamic fleet registry safely bounded to 50 active machines by default, expandable dynamically (50 → 51).
- Non-destructive historical preservation: excess machines deactivated with full telemetry history retained.
- Closed-loop incident and maintenance workflow with real database foreign keys and audit logs.
- Deterministic descriptive statistical calculations matching industrial quality engineering requirements.

### Operational Limitations
- **Rolling Round Definition:** The current round downtime algorithm operates over a rolling UTC-aligned 30-minute analysis window. It tracks physical stoppage without double counting, but does not represent scheduled 8-hour production shift changes.
- **Simulated Tool Wear vs Empirical Datasets:** Simulated CNC mill telemetry provides operational sensor streams (RPM, Vibration, Power, Load). Empirical flank wear ($V_b$) and surface roughness ($R_a$) belong to research datasets 1 and 2 and are correlated rather than directly streamed by the simulator.

---

## 16. Future Scope & Phase 2 Roadmap

1. **Edge Deployment with MQTT / OPC-UA:** Replace HTTP simulator ingestion with native industrial MQTT brokers and OPC-UA PLC connectors.
2. **Predictive Remaining Useful Life (RUL) Models:** Train supervised machine learning regressors on Dataset 4 (`raw_milling_cycles`) to predict tool failure cycles with confidence bounds.
3. **Autonomous Computer Vision Inspection:** Integrate optical camera feeds at the toolholder station for automatic flank wear measurement and chip congestion detection.
4. **Automated Manufacturer SOP RAG System:** Connect vector search to verified OEM machine manuals (Mazak, Haas, DMG Mori) for context-grounded step-by-step repair procedures.
