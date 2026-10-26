# AI Manufacturing Incident and Maintenance Response Platform
*ZIRO Digital Internship Program — Phase 1 Final Approved Architecture & Implementation Plan*

An industrial manufacturing incident response and maintenance intelligence platform built for discrete and continuous manufacturing operations. The platform connects shop-floor telemetry, machine condition monitoring, surface-quality analysis, multi-role incident workflows, and server-side Generative AI assistance to accelerate root cause investigation without inventing unverified operational limits, safety claims, or sensor units.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> This final revised plan incorporates all precision corrections:
> - **Gemini Model Designation:** The model identifier `gemini-3.8-flash` is designated as **Pending API Model Verification**. It will be explicitly verified and confirmed against the active runtime environment prior to backend deployment. The Gemini API key and all SDK invocations remain strictly on the FastAPI backend.
> - **Dataset 3 Analytics & Endpoint Added:** A dedicated endpoint `GET /api/v1/analytics/telemetry` is added to analyze the CNC Mill Tool Telemetry Dataset (25,286 rows, 18 experiments, `experiment_name` preserved). A corresponding Telemetry Analytics module is integrated into the existing Screen 5 (Analytics & Maintenance Intelligence) without creating a sixth screen. Statistical anomaly boundaries are strictly labeled as provisional statistical baselines, not physical failure limits.
> - **Standardized Measurement Units:** Motor power in kW (`motor_power_kw`) and motor load percentage (`motor_load_pct`) are defined and stored as separate database fields. Units are verified against original documentation; any uncertain or unconfirmed sensor units are explicitly flagged as `Unit unverified` and excluded from unit-dependent AI diagnostic reasoning.
> - **Tri-Category Data Provenance Labeling:** Throughout the API and UI, all data is explicitly classified and tagged as:
>   - `EMPIRICAL DATASET`: Records from the four approved historical research datasets.
>   - `SIMULATED`: Records generated or injected by the manufacturing simulator (`sim_telemetry_events`).
>   - `DEMO`: Mock fixtures or placeholder records used strictly for frontend preview mode.
> - **Unified Incident Permissions Policy:** Enforced consistently across API endpoints, database operations, UI controls, and test suites. Operators create reports; Supervisors review, assign, prioritize, and close; Managers view reports only; Maintenance investigates, updates progress, and closes upon completion of maintenance sign-off; Admins manage system access and cannot close operational tickets without an operational role qualification.
> - **No Unverified SOP or Predictive ML Claims:** The AI feature is designated strictly as the **AI Incident Investigation Assistant**, producing unverified diagnostic hypotheses and general investigation steps with prominent safety disclaimers.

### Confirmed Architectural Decisions

| Item | Approved Specification |
| :--- | :--- |
| **Frontend Framework** | Google AI Studio generated React 19 SPA (Tailwind CSS, Lucide icons, configurable API base URL `VITE_API_BASE_URL`). |
| **Backend Engine** | Python FastAPI (`uvicorn`, `pydantic`, `sqlalchemy` / `aiomysql`). Handles authentication, RBAC, calculations, and GenAI calls. |
| **Primary Database** | MySQL 8.x relational database. Houses separate raw schema tables, processed analytical tables, simulator logs, and incident records. |
| **Data Analytics Layer** | Python (Pandas, NumPy, SciPy) and Jupyter Notebooks for data validation, descriptive statistics, and reproducible EDA. |
| **BI Reporting** | Microsoft Power BI connected to MySQL views/tables, strictly differentiated from the 5 operational web app screens. |
| **GenAI Feature** | AI Incident Investigation Assistant via Python `google-genai` SDK on FastAPI backend. Model ID: `gemini-3.8-flash` (**Pending API Model Verification**). |
| **Data Provenance** | Strict tagging of `EMPIRICAL DATASET`, `SIMULATED`, and `DEMO` on all UI views and API payloads. |
| **Threshold Policy** | Measured values with confirmed units; alert lines are strictly labeled as provisional statistical baselines (e.g., observed dataset distribution percentiles). |

---

## 1. Project Overview & Workflow

### 1.1 Purpose and Manufacturing Scope
The platform provides a unified response and monitoring system for discrete machining (milling, turning, CNC operations) applicable to general precision manufacturing. It addresses the disconnect between raw high-frequency sensor streams, physical tool wear, machined part finish quality, and frontline maintenance ticketing.

### 1.2 Core Operational Workflow
```
┌─────────────────────────────────────────────────────────────┐
│ 1. DATA SOURCES: 4 Empirical Datasets + AI Simulator        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. MYSQL RAW LAYER: Immutable Tables (Separate Raw & Sim)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PYTHON / JUPYTER EDA: Validation, Stats & Prep Scripts   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. MYSQL PROCESSED LAYER: Summaries, Baselines, Work Orders │
└───────────────────────┬──────────────────────┬──────────────┘
                        │                      │
                        ▼                      ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ 5. POWER BI: Executive & BI  │ │ 6. PYTHON FASTAPI BACKEND: │
│    Plant Analytics Reports   │ │    RBAC, Business Logic    │
└──────────────────────────────┘ └─────────────┬──────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. GOOGLE AI STUDIO FRONTEND (5 Operational Screens)        │
│    With Server-Side Gemini Incident Assistant               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Five User Roles & Consistent Authorization Matrix

The application enforces a strictly defined permission policy across all layers (database, FastAPI endpoints, and UI state). A development role-selector in the frontend only aids demonstration by requesting corresponding test user tokens from `/api/v1/auth/login`. Actual authorization is enforced server-side.

```
┌──────────────────────────────────┬──────────┬────────────┬─────────┬─────────────┬────────┐
│ Permission / Feature             │ Operator │ Supervisor │ Manager │ Maintenance │ Admin  │
├──────────────────────────────────┼──────────┼────────────┼─────────┼─────────────┼────────┤
│ Login & View Profile             │    ✅    │     ✅     │    ✅   │      ✅     │   ✅   │
│ Assigned Machine Telemetry       │    ✅    │     ✅     │    ✅   │      ✅     │   ✅   │
│ All Machines Floor Overview      │    ❌    │     ✅     │    ✅   │      ✅     │   ✅   │
│ Simulator Telemetry Inject       │    ❌    │     ✅     │    ❌   │      ✅     │   ❌   │
│ Create Incident Report           │    ✅    │     ✅     │    ❌   │      ✅     │   ❌   │
│ View Permitted Incident Details  │    ✅    │     ✅     │    ✅   │      ✅     │   ✅   │
│ Review, Assign & Prioritize Inc. │    ❌    │     ✅     │    ❌   │      ❌     │   ❌   │
│ Investigate & Update Maint. Prog │    ❌    │     ❌     │    ❌   │      ✅     │   ❌   │
│ Close Incident (Sign-off)        │    ❌    │     ✅     │    ❌   │      ✅     │   ❌*  │
│ Trigger GenAI Investigation Asst │    ✅    │     ✅     │    ✅   │      ✅     │   ✅   │
│ Engineering Tool Wear & RUL View │    ❌    │     ✅     │    ✅   │      ✅     │   ✅   │
│ Executive Financial & Scrap View │    ❌    │     ❌     │    ✅   │      ❌     │   ✅   │
│ Power BI Dashboard Link          │    ❌    │     ✅     │    ✅   │      ✅     │   ✅   │
│ User Management & Access Control │    ❌    │     ❌     │    ❌   │      ❌     │   ✅   │
│ System Database & Pipeline Admin │    ❌    │     ❌     │    ❌   │      ❌     │   ✅   │
└──────────────────────────────────┴──────────┴────────────┴─────────┴─────────────┴────────┘
```
*\*Note on Admin Incident Closure Policy: Admin users manage system accounts and infrastructure. Incident closure is strictly restricted to operational roles (Supervisor or certified Maintenance personnel) who can sign off on physical machine readiness. Admin users cannot close incidents unless explicitly granted an operational role.*

### Detailed Role Responsibilities
1. **Operator (`OP-*`)**:
   - **Scope**: Single assigned workstation (e.g., CNC Mill-01).
   - **Actions**: Monitors live spindle speed, feed rate, and vibration RMS; accesses daily machine check sheets; submits incident reports with pre-filled sensor snapshots. Cannot assign, update progress, or close incidents.
2. **Supervisor (`SUP-*`)**:
   - **Scope**: Production cell / shop floor (Lines 1–3).
   - **Actions**: Reviews incoming incident reports, assigns priority, delegates to Maintenance engineers, tracks shift downtime, and verifies/closes incidents after operational sign-off.
3. **Manager (`MGR-*`)**:
   - **Scope**: Plant-wide operational and financial KPIs.
   - **Actions**: Evaluates estimated OEE, scrap rate trends, and downtime summaries; reviews incident reports and accesses plant-level Power BI reporting. Cannot assign or close incidents.
4. **Maintenance Department (`MNT-*`)**:
   - **Scope**: Equipment health, degradation analysis, and work orders.
   - **Actions**: Investigates assigned incidents, updates maintenance repair progress, runs the AI Incident Investigation Assistant, and completes maintenance sign-off to close incidents.
5. **Admin (`ADM-*`)**:
   - **Scope**: System security, access control, and pipeline monitoring.
   - **Actions**: Manages user accounts and roles; verifies MySQL raw-to-processed ETL jobs; monitors FastAPI health and API error logs.

---

## 3. Four Manufacturing Datasets & Analytical Roles

The four approved datasets originate from separate experimental setups and are kept analytically distinct. They must not be conflated as describing the same physical machines or sharing identical failure targets.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DATASET 1: CNC Machine Tool Wear Dataset                                     │
│ • Structure: 2,054 rows × 154 columns                                        │
│ • Target: Vb (Flank Wear, measured in mm)                                    │
│ • Analytical Role: Tool-wear progression and flank-wear degradation curves.  │
│ • Data Integrity Notice: Missing values exist in two specific sensor columns │
│   (e.g., accelerometer channels). They remain NULL in MySQL raw tables.      │
│   No automatic imputation during initial load or EDA.                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ DATASET 2: CNC Turning Roughness Dataset                                     │
│ • Structure: 612 rows merged (Exp1 & Exp2)                                   │
│ • Target: Ra (Surface Roughness, measured in µm)                             │
│ • Analytical Role: Machining surface-quality analysis.                       │
│ • Data Integrity Notice: source_experiment column preserves origin.          │
│   Prep.csv is strictly kept separate and not merged as an Experiment 3.      │
├──────────────────────────────────────────────────────────────────────────────┤
│ DATASET 3: CNC Mill Tool Telemetry Dataset                                   │
│ • Structure: 25,286 rows × 49 columns (18 experiment files merged)           │
│ • Target: Machine-condition telemetry and potential anomaly analysis.        │
│ • Key Features: Spindle current, feed rate, acoustic emission, vibration.    │
│ • Data Integrity Notice: experiment_name explicitly identifies each run.     │
│   Preserves high-frequency machining cuts under nominal and worn states.     │
│   Endpoint: GET /api/v1/analytics/telemetry returns experiment summaries.    │
├──────────────────────────────────────────────────────────────────────────────┤
│ DATASET 4: FeatureAndMetadata_Milling                                        │
│ • Structure: 968 rows × 131 columns                                          │
│ • Target: CycleToFailure (Run-to-failure cycle life metric)                  │
│ • Analytical Role: Tool-life and failure-cycle distribution analysis.        │
│ • Distinction Notice: CycleToFailure is NOT the same target as Vb.           │
│   Vb measures physical wear width (mm); CycleToFailure measures discrete cut │
│   cycles until end-of-life. These are modeled and visualized separately.     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Dataset Import & Validation Protocol (Source CSV $\rightarrow$ MySQL Raw)
Before marking data as ready for use, the Python script `scripts/validate_and_import_datasets.py` executes a 5-step validation gate:
1. **Row Count Audit**: Validates that raw MySQL table row counts match CSV counts exactly (2,054; 612; 25,286; 968).
2. **Column & Schema Audit**: Verifies all 154, 49, 131 columns map to correct SQL types (`FLOAT`, `DOUBLE`, `VARCHAR`).
3. **Missing Value Verification**: Confirms that missing values in Dataset 1 match the known CSV null profile and are represented as SQL `NULL`, not coerced to `0.0`.
4. **Identifier Integrity**: Ensures `source_experiment` in Dataset 2 contains only Exp1/Exp2, and `experiment_name` in Dataset 3 accurately reflects the 18 experimental sources.
5. **Distribution & Boundary Check**: Calculates min, max, median, and quartile distributions for $V_b$, $R_a$, and $CycleToFailure$ in Python, verifying imported SQL data matches source files within floating-point precision ($10^{-5}$).

---

## 4. End-to-End Manufacturing Data Pipeline & Data Provenance

The pipeline enforces strict separation between raw data, analytical outputs, and simulated events.

### 4.1 Tri-Category Data Classification
All data across the system is assigned a strict provenance tag:
1. `EMPIRICAL DATASET`: Sourced from one of the 4 validated CSV research datasets.
2. `SIMULATED`: Generated or injected via the AI Manufacturing Simulator (`sim_telemetry_events`).
3. `DEMO`: Mock fixtures or placeholder records used for offline development or UI preview mode.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: DATA SOURCES                                                               │
│ • 4 Empirical CSV Datasets [EMPIRICAL DATASET]                                      │
│ • AI Manufacturing Simulator [SIMULATED] (Streaming telemetry generator)          │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │ Python Loader Scripts
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: MYSQL RAW LAYER                                                            │
│ • raw_cnc_tool_wear (2,054 rows) [EMPIRICAL DATASET]                                │
│ • raw_turning_roughness (612 rows) [EMPIRICAL DATASET]                              │
│ • raw_mill_telemetry (25,286 rows) [EMPIRICAL DATASET]                              │
│ • raw_milling_cycles (968 rows) [EMPIRICAL DATASET]                                 │
│ • sim_telemetry_events [SIMULATED] (Separate table for injected machine records)   │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │ SQLAlchemy / PyMySQL
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: PYTHON & JUPYTER NOTEBOOK (EDA & STATISTICAL ENGINE)                       │
│ • Connects to MySQL raw tables via read-only credentials                            │
│ • Performs distribution analysis, IQR/percentiles, correlation matrices             │
│ • Preserves raw records: No automatic imputation or outlier deletion               │
│ • Exports validated statistical summary benchmarks into MySQL Processed tables     │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │ Intentional Preprocessing & Aggregations
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: MYSQL PROCESSED / ANALYTICS LAYER                                          │
│ • processed_tool_wear_metrics (Aggregated wear curves, descriptive percentiles)     │
│ • processed_roughness_summary (Ra distributions by feed/speed parameters)          │
│ • processed_telemetry_baselines (Statistical baseline bounds derived from data)    │
│ • incidents & maintenance_work_orders (Operational tracking)                        │
└───────────────────────┬──────────────────────────────────────────────┬──────────────┘
                        │ SQL Views                                    │ SQL Queries
                        ▼                                              ▼
┌──────────────────────────────────────────────┐ ┌────────────────────────────────────┐
│ STAGE 5: POWER BI VISUAL REPORTING           │ │ STAGE 6: PYTHON FASTAPI BACKEND    │
│ • Direct Query / Import from MySQL Views     │ │ • REST API (/api/v1/...)           │
│ • Plant-level executive quality & downtime   │ │ • JWT Auth & Consistent RBAC       │
│ • Distinct from operational app screens      │ │ • Google Gemini Proxy              │
└──────────────────────────────────────────────┘ └─────────────────┬──────────────────┘
                                                                   │ HTTP / JSON
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 7: GOOGLE AI STUDIO FRONTEND (5 MAIN SCREENS)                                 │
│ 1. Login  2. Dashboard  3. Machine Condition  4. Incidents  5. Analytics           │
│ (All metrics and records display provenance badges: EMPIRICAL, SIMULATED, or DEMO)  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. MySQL Schema & Standardized Measurement Units

All tables use standard MySQL 8.x InnoDB engines with UTF-8 character encoding.

### 5.1 Unit Standardization & Field Separation Rules
- **Motor Power** is measured and stored in kilowatts: `motor_power_kw FLOAT NULL` (Unit: `kW`).
- **Motor Load** is measured and stored as a percentage of rated capacity: `motor_load_pct FLOAT NULL` (Unit: `%`).
- **Tool Wear** is measured and stored in millimeters: `vb_flank_wear FLOAT NULL` (Unit: `mm`).
- **Surface Roughness** is measured and stored in micrometers: `ra_roughness FLOAT NULL` (Unit: `µm`).
- **3-Axis Vibration** is measured in meters per second squared: `vib_x FLOAT`, `vib_y FLOAT`, `vib_z FLOAT` (Unit: `m/s²`).
- **Unverified Sensor Channels**: Any sensor channel from the 154 or 49 raw columns whose physical engineering units cannot be confirmed from primary dataset documentation is labeled as `Unit unverified` and excluded from unit-dependent AI diagnostic prompts.

### 5.2 Raw Layer Tables (Immutable)
- `raw_cnc_tool_wear`: `id BIGINT AUTO_INCREMENT PRIMARY KEY`, `cut_number INT`, `vb_flank_wear FLOAT NULL`, sensor channels 1–152 `FLOAT NULL`, `has_missing_sensor BOOLEAN`.
- `raw_turning_roughness`: `id INT AUTO_INCREMENT PRIMARY KEY`, `source_experiment VARCHAR(16)`, `cut_speed FLOAT`, `feed_rate FLOAT`, `depth_of_cut FLOAT`, `ra_roughness FLOAT`.
- `raw_mill_telemetry`: `id BIGINT AUTO_INCREMENT PRIMARY KEY`, `experiment_name VARCHAR(64)`, `sample_index INT`, `spindle_speed_rpm FLOAT`, `feed_rate_mmpm FLOAT`, `vib_x FLOAT`, `vib_y FLOAT`, `vib_z FLOAT`, `motor_current_amp FLOAT`.
- `raw_milling_cycles`: `id INT AUTO_INCREMENT PRIMARY KEY`, `cycle_id INT`, `cycle_to_failure INT`, feature_columns 1–129 `FLOAT`.
- `sim_telemetry_events`: `id BIGINT AUTO_INCREMENT PRIMARY KEY`, `machine_code VARCHAR(32)`, `simulated_at TIMESTAMP`, `spindle_rpm FLOAT`, `feed_rate_mmpm FLOAT`, `vib_rms FLOAT`, `motor_load_pct FLOAT`, `motor_power_kw FLOAT NULL`, `injected_anomaly_type VARCHAR(64) NULL`, `data_provenance VARCHAR(16) DEFAULT 'SIMULATED'`.

### 5.3 Processed & Operational Layer Tables
- `users`: `id INT AUTO_INCREMENT PRIMARY KEY`, `work_id VARCHAR(32) UNIQUE`, `full_name VARCHAR(128)`, `password_hash VARCHAR(255)`, `role ENUM('Operator','Supervisor','Manager','Maintenance','Admin')`, `assigned_machine VARCHAR(32) NULL`, `is_active BOOLEAN DEFAULT TRUE`.
- `machines`: `id INT AUTO_INCREMENT PRIMARY KEY`, `machine_code VARCHAR(32) UNIQUE`, `name VARCHAR(128)`, `line_id VARCHAR(32)`, `status ENUM('Nominal','Warning','Critical','Offline')`, `last_inspection_date DATE`.
- `incidents`: `id INT AUTO_INCREMENT PRIMARY KEY`, `incident_code VARCHAR(32) UNIQUE`, `machine_code VARCHAR(32)`, `reporter_id INT`, `severity ENUM('Low','Medium','High','Critical')`, `symptom_description TEXT`, `measured_vib_rms FLOAT`, `measured_motor_load_pct FLOAT NULL`, `measured_motor_power_kw FLOAT NULL`, `correlated_vb FLOAT NULL`, `correlated_ra FLOAT NULL`, `data_provenance ENUM('EMPIRICAL DATASET','SIMULATED','DEMO') DEFAULT 'EMPIRICAL DATASET'`, `assigned_to_id INT NULL`, `status ENUM('Open','In_Investigation','Action_Required','Closed')`, `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `closed_at TIMESTAMP NULL`, FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`).
- `incident_ai_diagnoses`: `id INT AUTO_INCREMENT PRIMARY KEY`, `incident_id INT`, `hypotheses_json JSON`, `suggested_investigation_steps JSON`, `disclaimer_acknowledged BOOLEAN DEFAULT TRUE`, `model_id VARCHAR(64) DEFAULT 'gemini-3.8-flash (Pending Verification)'`, `generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`).
- `maintenance_work_orders`: `id INT AUTO_INCREMENT PRIMARY KEY`, `order_code VARCHAR(32) UNIQUE`, `incident_id INT`, `machine_code VARCHAR(32)`, `technician_id INT`, `priority ENUM('Low','Medium','Urgent')`, `action_taken TEXT NULL`, `status ENUM('Pending','In_Progress','Completed')`, `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`).

---

## 6. Python FastAPI Backend Specification

### 6.1 Backend Architecture
The backend is a Python FastAPI service (`api_server/main.py`).
- **Configuration**: Loaded from `.env` (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `GEMINI_API_KEY`, `JWT_SECRET_KEY`).
- **ORM / Query Engine**: SQLAlchemy 2.0 with async engine (`aiomysql`) for transaction management, plus raw SQL execution for analytics.
- **Data Serialization**: Pydantic v2 schemas validating request/response models.
- **Security**: Password hashing via `bcrypt` / `passlib`; JWT token issuance; role verification dependency (`Depends(require_role([...]))`). Database credentials and Gemini keys remain strictly server-side.

### 6.2 Key API Endpoints & Consistent Permissions
```
Authentication & Users:
  POST   /api/v1/auth/login                  -> Verifies Work ID & password; returns JWT token + user profile
  GET    /api/v1/auth/me                     -> Returns current authenticated user & role permissions
  GET    /api/v1/admin/users                 -> [Admin] Lists users & assigned machines

Dashboard & Telemetry:
  GET    /api/v1/dashboard/summary           -> Returns role-tailored KPIs from MySQL processed tables (with data_provenance)
  GET    /api/v1/machines                    -> Lists floor machines and current operational status
  GET    /api/v1/machines/{code}/telemetry   -> Retrieves sliding sensor buffer + dataset baseline comparison
  POST   /api/v1/machines/inject-telemetry   -> [Supervisor, Maintenance] Injects simulated telemetry into sim_telemetry_events

Incidents & Workflows:
  GET    /api/v1/incidents                   -> [All Auth Roles] Lists incident records with status, severity, machine filters
  POST   /api/v1/incidents                   -> [Operator, Supervisor, Maintenance] Creates incident with sensor snapshot
  GET    /api/v1/incidents/{id}              -> [All Auth Roles] Retrieves incident detail, sensor snapshot, and AI diagnoses
  PATCH  /api/v1/incidents/{id}/assign       -> [Supervisor Only] Assigns technician and sets severity priority
  PATCH  /api/v1/incidents/{id}/progress     -> [Maintenance Only] Updates investigation findings and repair status
  PATCH  /api/v1/incidents/{id}/close        -> [Supervisor, Maintenance] Closes incident with operational/maintenance sign-off
  POST   /api/v1/incidents/{id}/ai-diagnose  -> [All Auth Roles] Invokes Gemini Assistant for structured RCA hypotheses

Analytics & Dataset Insights:
  GET    /api/v1/analytics/tool-wear         -> Returns Dataset 1 Vb progression and descriptive statistics (Unit: mm)
  GET    /api/v1/analytics/surface-quality   -> Returns Dataset 2 Ra distribution (Exp1 vs Exp2) & correlations (Unit: µm)
  GET    /api/v1/analytics/telemetry         -> [NEW] Returns Dataset 3 CNC Mill Telemetry summaries & baselines grouped by experiment_name
  GET    /api/v1/analytics/cycle-to-failure  -> Returns Dataset 4 CycleToFailure historical distribution and percentiles
  GET    /api/v1/analytics/eda-summary       -> Returns descriptive statistics (mean, median, IQR) computed by Python
  GET    /api/v1/analytics/pipeline-health   -> Returns raw-to-processed row counts and validation checks
```

---

## 7. Five-Screen Frontend Application Specification

The frontend is a high-density, professional industrial SaaS application generated in Google AI Studio, running React 19, Tailwind CSS, and Lucide icons. Every screen displays data provenance labels (`EMPIRICAL DATASET`, `SIMULATED`, or `DEMO`).

### Screen 1: Login & Authentication
- **Purpose**: Authenticates personnel, establishes session, and routes to role-specific views.
- **Layout**: Two-column layout. Left: Industrial CNC manufacturing photographic backdrop (`generate_image`), ZIRO program accreditation, and shift sign-in notice. Right: Clean Work ID and password form.
- **Features**:
  - Secure Work ID input (`OP-101`, `SUP-201`, `MGR-301`, `MNT-401`, `ADM-001`).
  - Development Demo Role Selector (strictly communicates with `/api/v1/auth/login` to obtain real backend JWT credentials for rapid mentor demonstration). Tagged as `[DEMO AUTH FIXTURE]`.
  - Inline error feedback on invalid credentials.
- **States**: Default, submitting (button spinner), invalid credentials error banner, network unreachable banner.

### Screen 2: Role-Adaptive Dashboard
- **Purpose**: Operational overview customized for the active role.
- **Layout & Role Views**:
  - *Operator View*: Assigned machine focus card (e.g. CNC Mill-01), live motor load gauge (`motor_load_pct` in %), motor power (`motor_power_kw` in kW), current cut count, rapid "Report Issue" action button, daily shift check sheet.
  - *Supervisor View*: Multi-machine cell status matrix (Nominal, Warning, Critical), active shift incidents ticker, line comparison overview, quick telemetry injector button.
  - *Manager View*: High-level plant summary: Estimated OEE %, surface roughness compliance rate based on part tolerance, total downtime hours, link to Power BI Executive Report.
  - *Maintenance View*: Equipment health overview, machines flagged for wear inspection, open work orders sorted by urgency.
  - *Admin View*: User directory overview, raw vs processed row count audit, database connection status, pipeline validation indicators.
- **Provenance Badges**: Displays `EMPIRICAL DATASET` on benchmark cards and `SIMULATED` on active injector views.
- **States**: Skeleton grid loading state, empty state when zero active incidents exist, backend connection error state.

### Screen 3: Machine Condition & Telemetry Monitoring
- **Purpose**: High-frequency telemetry tracking and baseline threshold comparison.
- **Layout**:
  - Machine selector (CNC Mill Alpha-01, CNC Mill Beta-02, CNC Lathe Gamma-03, Heavy Milling Station-04).
  - Telemetry gauge row: Spindle Speed (RPM), Feed Rate (mm/min), 3-Axis Vibration RMS ($\text{m/s}^2$), Motor Power Load (`motor_power_kw` in kW), Motor Load (`motor_load_pct` in %).
  - Time-series sliding sensor chart displaying live readings against clearly labeled **Provisional Statistical Baselines** (e.g., observed 90th percentile bounds derived from Dataset 3 nominal cut records).
  - **Interactive AI Telemetry Injector (Demonstration Feature)**:
    - Allows authorized users (Supervisor, Maintenance) to inject simulated sensor anomalies (e.g., Spindle Imbalance, Bearing Chatter, Feed Rate Spike).
    - Writes strictly to `sim_telemetry_events` with provenance tag `SIMULATED`.
    - Updates the telemetry chart with an explicit `[SIMULATED DATA]` badge and offers a 1-click "Create Incident from Anomaly" action pre-populating sensor readings.
- **States**: Streaming active, stream paused, anomaly breach warning, sensor offline state.

### Screen 4: Incidents & Issue Reporting
- **Purpose**: End-to-end incident lifecycle management from floor filing to maintenance sign-off.
- **Layout**:
  - Incident list with multi-column filters (Status: Open/Investigating/Closed, Severity: Low/Med/High/Critical, Machine Code).
  - Provenance column indicating whether the incident was filed from `EMPIRICAL DATASET`, `SIMULATED`, or `DEMO`.
  - "New Incident Report" modal: Available to Operator, Supervisor, Maintenance. Machine selection, component area, symptoms, operator notes, and "Attach Live Sensor Snapshot" button.
  - **Incident Detail & Investigation View**:
    - Timeline of status changes and technician assignments.
    - Attached sensor snapshot table with explicit, separate fields for `motor_power_kw` (kW) and `motor_load_pct` (%). Any unconfirmed sensor channels display `Unit unverified`.
    - Consistent action buttons:
      - Supervisor: "Assign Technician" & "Close Incident" (operational sign-off).
      - Maintenance: "Update Investigation Progress" & "Close Incident" (maintenance sign-off).
      - Operator & Manager: Read-only access to status and investigation timeline.
    - **Integrated AI Incident Investigation Assistant Panel** (see Section 8).
- **States**: Empty state with "No open incidents reported", validation error state on required form fields, AI diagnosis loading indicator.

### Screen 5: Analytics & Maintenance Intelligence
- **Purpose**: Deep statistical and quality insights derived from the 4 manufacturing datasets and Python calculations. Contains 5 distinct modules/tabs without adding a sixth screen.
- **Layout & Modules**:
  - *Tab 1: Tool Wear Analysis (Dataset 1)*: Flank wear $V_b$ progression curve across cut cycles; descriptive statistics (mean, median, IQR, 90th percentile) with explicit millimeter (`mm`) units. Provenance: `[EMPIRICAL DATASET]`.
  - *Tab 2: Surface Roughness & Quality (Dataset 2)*: $R_a$ distribution in micrometers (`µm`) comparing Exp1 vs. Exp2; correlation scatter plot of cutting speed and feed rate against resulting $R_a$; workshop tolerance zone based on part drawing specifications. Provenance: `[EMPIRICAL DATASET]`.
  - *Tab 3: CNC Mill Telemetry Analytics (Dataset 3)*: **[NEW MODULE]** Consumes `GET /api/v1/analytics/telemetry`. Visualizes telemetry summaries across the 18 merged experiments grouped by `experiment_name`. Shows vibration RMS and spindle speed distributions, nominal vs. worn cut baselines, and provisional statistical anomaly bands. Explicitly labeled: *"Statistical Baseline Only — No Trained ML Anomaly Model Implemented"*. Provenance: `[EMPIRICAL DATASET]`.
  - *Tab 4: Tool-Life Distribution (Dataset 4)*: Empirical `CycleToFailure` historical distribution and cycle percentiles. Explicitly kept distinct from Dataset 1 $V_b$ flank wear. Provenance: `[EMPIRICAL DATASET]`.
  - *Tab 5: Data Pipeline & Power BI Bridge*: Displays row count verification, null value profile of Dataset 1 sensor columns, and link to view Power BI executive reports.
- **States**: Data calculating skeleton, dataset filter toggles, export failure banner.

---

## 8. Generative AI Feature: AI Incident Investigation Assistant

### 8.1 Model Designation & API Security
- **Model Identifier**: `gemini-3.8-flash`
- **Verification Status**: **Pending API Model Verification**. The model identifier must be confirmed against the active API environment prior to backend deployment.
- **Security Constraint**: The Gemini API key (`GEMINI_API_KEY`) is stored exclusively in server-side environment variables on the FastAPI backend. It is never exposed to the frontend or browser network traffic.

### 8.2 Execution Workflow
1. Frontend makes request: `POST /api/v1/incidents/{id}/ai-diagnose` (with JWT token).
2. FastAPI validates session, verifies permissions, and loads the incident details + attached sensor snapshot from MySQL.
3. FastAPI filters the snapshot: only verified sensor measurements with confirmed units (e.g., vibration in $\text{m/s}^2$, motor load in %, motor power in kW) are passed to the prompt. Any channel marked `Unit unverified` is explicitly flagged or excluded from unit-dependent physical reasoning.
4. FastAPI invokes the Gemini model via the server-side Python `google-genai` SDK.
5. Prompt structure injects:
   - Machine metadata and data provenance (`EMPIRICAL DATASET`, `SIMULATED`, or `DEMO`).
   - Reported symptoms and operator observations.
   - Verified physical sensor snapshot with explicit units.
   - Explicit system instruction: Treat all mechanical causes strictly as unverified diagnostic hypotheses. Do not cite or invent official manufacturer SOP documents. Always include safety disclaimers.

### 8.3 Response Schema & Safety Boundaries
The model outputs strict JSON:
```json
{
  "incident_summary": "Concise 2-sentence synopsis of observed machine condition.",
  "data_provenance": "EMPIRICAL DATASET",
  "verified_sensor_readings": [
    { "metric": "Vibration RMS (X-axis)", "measured_value": 4.8, "unit": "m/s²" },
    { "metric": "Motor Load", "measured_value": 88.0, "unit": "% of rated capacity" },
    { "metric": "Motor Power", "measured_value": 11.2, "unit": "kW" }
  ],
  "unverified_metrics_excluded": [
    { "metric": "Raw Accelerometer Channel 12", "reason": "Unit unverified in dataset documentation" }
  ],
  "diagnostic_hypotheses": [
    {
      "hypothesis": "Possible spindle bearing degradation or mechanical looseness",
      "rationale": "Elevated radial vibration peak under nominal cutting feed rate",
      "verification_status": "Unverified hypothesis — physical inspection required"
    }
  ],
  "suggested_investigation_steps": [
    "Check spindle runout with a calibrated dial indicator",
    "Inspect collet and tool holder taper for foreign debris or fretting wear",
    "Verify tool insert clamping torque against toolholder specification"
  ],
  "safety_disclaimer": "AI-generated diagnostic guidance. Suggestions are preliminary hypotheses and do NOT replace official manufacturer standard operating procedures or certified maintenance personnel. Follow all facility Lock-Out/Tag-Out (LOTO) procedures before touching machinery.",
  "future_sop_capability_note": "Manufacturer-verified SOP retrieval is reserved for future phases pending integration of validated technical manuals."
}
```

### 8.4 UI Visual Differentiation
In Screen 4:
- **Verified Sensor Readings Section**: Rendered in a clean slate container titled: *"Verified Machine Sensor Snapshot (Measured Values)"*.
- **AI Diagnostic Hypotheses Section**: Rendered in an amber-accented container titled: *"AI Diagnostic Hypotheses (Unverified Guidance — Requires Physical Inspection)"*.
- Prominent safety banner displaying the mandatory disclaimer.
- Interactive checkboxes allowing maintenance technicians to log physical verification results against suggestions.

---

## 9. Threshold Rules & Statistical Treatment

To eliminate unsupported numerical claims:

1. **Tool Wear ($V_b$)**:
   - Reported strictly in millimeters (mm) with actual measured values.
   - Distribution metrics (median, IQR, 90th percentile) are computed empirically from Dataset 1.
   - Any alert boundary is labeled: *"Provisional Statistical Baseline: Observed 90th percentile of Dataset 1 cuts ($V_b = [value]\text{ mm}$)"*.
   - Explicitly documented: A statistical percentile is an observed distribution marker, not a physical failure limit.
2. **Surface Roughness ($R_a$)**:
   - Reported strictly in micrometers ($\mu\text{m}$).
   - Visualizations present the actual distribution of Exp1 alongside Exp2.
   - Quality alert boundaries are derived from part drawing tolerances (e.g. specified drawing limit) and labeled: *"Provisional Workshop Tolerance: Specified part tolerance ($R_a = [spec]\text{ }\mu\text{m}$)"*.
3. **Telemetry Anomaly Baselines (Dataset 3)**:
   - Baselines are computed per experiment from nominal cutting segments.
   - Boundaries are labeled: *"Provisional Statistical Baseline: Nominal cut 95th percentile buffer"*.
   - Explicitly disclaimed: No predictive or neural anomaly-detection model is claimed or implied.
4. **No Hallucinated Predictive Claims**:
   - Remaining tool life is presented as *"Empirical CycleToFailure Distribution (from Dataset 4 historical cut cycles)"* rather than claiming an unverified neural network has predicted exact failure time.

---

## 10. Technical Implementation & Development Integration

### 10.1 Dual-Environment Reality
- **Google AI Studio Environment**: Hosts and runs the interactive React/TypeScript frontend on port 3000. In development mode without a live local backend, the frontend includes a robust mock-service/local adapter layer (`[DEMO]` data provenance) to allow complete UI/UX interaction and review.
- **Local / Internship Server Environment**:
  - Python 3.11+ running FastAPI on `http://localhost:8000`.
  - MySQL 8.0 running on `localhost:3306`.
  - Jupyter Notebook for data exploration in `notebooks/eda_manufacturing.ipynb`.
  - The frontend environment variable `VITE_API_BASE_URL` allows 1-click toggling between local FastAPI server and development preview mode.

### 10.2 Directory Structure
```
ziro-manufacturing-platform/
├── api_server/                     # Python FastAPI Backend
│   ├── main.py                     # FastAPI application entry point
│   ├── database.py                 # SQLAlchemy MySQL async connection pool
│   ├── models.py                   # MySQL table definitions (with motor_power_kw & motor_load_pct)
│   ├── schemas.py                  # Pydantic request/response models with provenance tags
│   ├── routers/
│   │   ├── auth.py                 # JWT login & user endpoints
│   │   ├── dashboard.py            # Role-tailored summary metrics
│   │   ├── machines.py             # Telemetry & simulator injection
│   │   ├── incidents.py            # Incidents CRUD & GenAI investigation endpoint
│   │   └── analytics.py            # Includes /telemetry, /tool-wear, /surface-quality, /cycle-to-failure
│   └── services/
│       └── gemini_service.py       # Google Gemini SDK integration (Server-side only)
├── scripts/                        # Python Data Processing & DB Loaders
│   ├── validate_and_import_datasets.py # Source CSV -> MySQL raw loader & auditor
│   ├── process_analytics_layers.py     # MySQL raw -> processed tables ETL
│   └── export_mysql_schema.sql         # Clean MySQL DDL and DML dump
├── notebooks/                      # Jupyter Notebooks
│   └── eda_manufacturing_datasets.ipynb # Complete EDA, IQR, distribution stats
├── src/                            # Google AI Studio React Frontend
│   ├── components/                 # Modular UI components (Zero-Pill styling)
│   ├── contexts/                   # Auth & Machine state contexts
│   ├── views/                      # 5 Main Application Screens
│   │   ├── LoginView.tsx
│   │   ├── DashboardView.tsx
│   │   ├── MachineConditionView.tsx
│   │   ├── IncidentsView.tsx
│   │   └── AnalyticsView.tsx       # 5 modules: Tool Wear, Surface Quality, Telemetry, RUL, Power BI
│   └── services/apiClient.ts       # Typed HTTP client to FastAPI with fallback
├── metadata.json
└── package.json
```

---

## 11. Three-Week Internship Implementation Roadmap

```
Week 1: Foundations, Schemas & Data Pipeline
├─ Set up MySQL raw and processed database schemas (DDL script with separated power/load fields)
├─ Create Python validation script; load 4 datasets into MySQL raw tables
├─ Build Jupyter Notebook for EDA, missing value audit, and statistical baselines
├─ Build FastAPI authentication, JWT token issuance, and consistent RBAC middleware
└─ Build Screen 1 (Login) and Screen 2 (Role-Adaptive Dashboard) in AI Studio

Week 2: Machine Telemetry, Incidents & Generative AI Integration
├─ Connect FastAPI to MySQL for machine telemetry and simulator tables (sim_telemetry_events)
├─ Build Screen 3 (Machine Condition & Interactive Telemetry Injector with SIMULATED tag)
├─ Implement Incident CRUD endpoints with consistent role permissions and unit validation
├─ Build Screen 4 (Incidents & Issue Reporting with status workflows and unit-checked snapshots)
└─ Confirm Gemini model ID and integrate server-side AI Incident Investigation Assistant

Week 3: Analytics, Power BI Bridge, Testing & Showcase
├─ Build Screen 5 (Tool Wear Vb, Roughness Ra, Telemetry Analytics Tab, and CycleToFailure)
├─ Connect GET /api/v1/analytics/telemetry for Dataset 3 experiment summaries
├─ Create Power BI connection views in MySQL and prototype executive dashboard
├─ Conduct end-to-end integration testing across all 5 roles, error states, and provenance tags
├─ Document individual team contributions and assemble mentor presentation
└─ Package V1 working demonstration with reproducible start scripts
```

---

## 12. Testing Strategy & V1 Acceptance Checklist

### 12.1 Testing Strategy
1. **Data Pipeline Testing**: Verify that `validate_and_import_datasets.py` passes all 5 verification gates before any frontend interaction.
2. **Backend API Testing**: FastAPI test suite (`pytest`) testing auth endpoints, role rejection (403 Forbidden for unauthorized actions like Operators attempting to close incidents), and incident creation.
3. **Provenance & Unit Audit**: Ensure API responses and frontend badges explicitly identify `EMPIRICAL DATASET`, `SIMULATED`, and `DEMO`, and that `motor_power_kw` and `motor_load_pct` are never conflated.
4. **Frontend E2E Flow Testing**: Complete user journey: Operator creates incident $\rightarrow$ Supervisor reviews and assigns $\rightarrow$ Maintenance investigates and updates progress $\rightarrow$ Maintenance or Supervisor closes with operational sign-off.

### 12.2 V1 Demonstration Acceptance Checklist
- [ ] **Working End-to-End Pipeline**: At least one complete verified flow from Source Dataset $\rightarrow$ MySQL Raw $\rightarrow$ Python Analytics $\rightarrow$ Application / Power BI display.
- [ ] **5 User Roles**: Distinct login credentials for Operator, Supervisor, Manager, Maintenance, and Admin, with server-side authorization enforcement.
- [ ] **Consistent Incident Permissions**: Operators create; Supervisors assign and close; Managers view only; Maintenance updates and closes; Admins manage access without closing operational tickets.
- [ ] **5 Application Screens**: Login, Dashboard, Machine Condition, Incidents, and Analytics all fully interactive with loading and error states.
- [ ] **Dataset 3 Telemetry Endpoint**: `GET /api/v1/analytics/telemetry` operational, returning summaries grouped by `experiment_name`, visualized in Screen 5 Tab 3.
- [ ] **Data Integrity**: Datasets 1, 2, 3, and 4 preserved in MySQL raw tables with missing values and experiment identifiers intact.
- [ ] **Dataset Distinctness**: $V_b$ (Dataset 1) and $CycleToFailure$ (Dataset 4) modeled as distinct targets; Exp1/Exp2 in Dataset 2 distinct from Prep.csv; telemetry experiments preserved.
- [ ] **Standardized Measurement Units**: `motor_power_kw` (kW) and `motor_load_pct` (%) kept distinct; unverified sensor units flagged as `Unit unverified` and excluded from AI diagnostic prompts.
- [ ] **Provenance Badging**: UI and API explicitly display `EMPIRICAL DATASET`, `SIMULATED`, and `DEMO`.
- [ ] **Threshold Accuracy**: All thresholds labeled as provisional statistical baselines with explicit units; no false claims of universal limits or unverified ML models.
- [ ] **AI Incident Investigation Assistant**: Gemini model ID verified before deployment; delivers structured diagnostic hypotheses and investigation steps with distinct visual labeling, explicit safety disclaimers, and zero unverified SOP claims.
- [ ] **Power BI Distinction**: Clear architectural separation between the 5 operational web screens and executive Power BI reporting.
- [ ] **Code Quality & Anti-Slop**: Zero-Pill typography, high-density industrial design, and responsive 1440px viewport presence.

---

## 13. Unresolved Items Requiring Human Verification & Risks

### 13.1 Unresolved Items Requiring Human Verification Prior to Implementation
1. **Gemini Model ID Verification**:
   - `gemini-3.8-flash` is designated as **Pending API Model Verification**.
   - Prior to writing backend integration code, the model ID must be verified against the active Google Gemini API environment/tier. If the environment requires an alias (e.g., `gemini-flash-latest`), this must be confirmed.
2. **Unverified Sensor Channel Units in Datasets 1 and 3**:
   - While primary targets ($V_b$ in mm, $R_a$ in $\mu\text{m}$, spindle speed in RPM, feed rate in mm/min, vibration in $\text{m/s}^2$) are verified, auxiliary high-index sensor columns (e.g., specific accelerometer channels in Dataset 1 and acoustic emission voltages in Dataset 3) require cross-referencing with primary benchmark documentation.
   - Any column with unconfirmed scaling or physical units will remain labeled as `Unit unverified` and excluded from unit-dependent physical reasoning in the AI prompt.
3. **Power BI MySQL Connection Method**:
   - Whether the internship team will connect Power BI via direct MySQL ODBC/Connector or via intermediate scheduled CSV export must be confirmed based on the local IT environment.

### 13.2 Dependencies & Mitigations
- **Python 3.11+ Runtime**: `fastapi`, `uvicorn`, `sqlalchemy`, `aiomysql`, `pydantic`, `pandas`, `numpy`, `google-genai`, `python-jose`, `passlib`.
- **MySQL Server 8.0+**.
- **Gemini Network Fallback**: FastAPI catches Gemini errors gracefully and returns fallback structured investigation checklists with standard safety reminders.

---
*Please review this final revised Stage 1 Implementation Plan. Once you review and approve, we will be ready to begin implementation according to this plan.*
