# FactoryPulse — Team V1 Showcase Checklist & Coordination Guide

**Project:** FactoryPulse — AI Manufacturing Incident and Maintenance Response Platform  
**Program:** Ziro Digital Internship Program (ZDIP)  
**Phase 1 Milestone:** Team V1 Capstone Showcase & Deliverables Handoff  
**Document Status:** Ready for Team Review & Scheduling  
**Created:** October 26, 2026  

---

## 1. Team Roster & Role Allocations

Fill in team member names and verified tracks before the rehearsal session:

| Team Role | Team Member Name | Core Phase 1 Responsibility | Key Deliverables & Files |
| :--- | :--- | :--- | :--- |
| **Track 1: AI App Development** | **[YOUR_NAME]** (Presenter & Lead App Developer) | Full-stack React app, UI/UX, RBAC security, live telemetry, incident lifecycle, Generative AI assistant | `src/App.tsx`, `src/services/apiClient.ts`, `src/views/*`, `tests/test_operator_dashboard_audit.py` |
| **Track 2: Data Analytics & Python** | **[TEAMMATE_1_DATA_ANALYTICS_NAME]** | Empirical dataset ingestion, statistical validation gates, EDA, outlier/missing-value handling | `scripts/validate_and_import_datasets.py`, `notebooks/eda_manufacturing_datasets.ipynb`, Datasets 1–4 |
| **Track 3: SQL & Database Engineering** | **[TEAMMATE_2_SQL_DATABASE_NAME]** | Relational schema modeling, table normalization, DDL export, 5 analytical reporting views | `scripts/export_mysql_schema.sql`, `sql/mysql_schema_ddl.sql`, `tests/test_live_database_engine.py` |

---

## 2. Pre-Showcase Technical Verification Checklist (Pre-Flight)

Execute this technical checklist at least **30 minutes prior** to the live demonstration:

- [ ] **Development Server Operational:**
  - Verify server is running on port 3000: `npm run dev`
  - Verify live application URL opens cleanly in browser:  
    `https://ais-dev-t25zcwjetmqvqxfrwyerp2-28600336066.asia-southeast1.run.app`
- [ ] **Automated Test Suite Verification:**
  - Run the full verification suite in terminal: `python3 tests/run_all_tests.py`
  - Expected output: `OVERALL VERIFICATION RESULT: ALL SYSTEMS VERIFIED SUCCESSFULLY (PASSED)`
  - Confirm: 92/92 unit tests passing in < 4.0 seconds.
- [ ] **Static Analysis & Build Verification:**
  - Verify TypeScript compilation: `npm run typecheck` (or `tsc --noEmit`) -> 0 errors.
  - Verify production build bundle: `npm run build` -> Clean bundle generation.
- [ ] **Fleet Master List Verification:**
  - Verify that `machine-name.json` exists in project root and contains exactly 400 machine records (100 per plant across Plants A, B, C, D).
- [ ] **Browser Demo Clean State:**
  - Clear test incidents or reset localStorage if needed using the UI button or private browsing session.
  - Ensure browser zoom is set to 100% (or 90% for high-density 1080p projectors).
  - Verify audio/microphone check on [MEETING_PLATFORM_NAME] (Zoom / Google Meet / Teams).

---

## 3. Team Showcase Agenda & Speaker Transitions (15-Minute Target)

| Time (Min) | Stage / Agenda Item | Primary Speaker | Visual Screen / Activity |
| :---: | :--- | :--- | :--- |
| **0:00 – 2:00** | **Project Overview & Problem Statement** | [YOUR_NAME] | Slide Deck Slides 1 & 2: Introduction to FactoryPulse, CNC downtime challenge, Phase 1 boundaries. |
| **2:00 – 5:00** | **Data Engineering & Empirical Datasets** | [TEAMMATE_1_DATA_ANALYTICS_NAME] | Slide Deck Slide 3 & Live App: Walkthrough of 4 empirical datasets (28,920 rows), $V_b$ flank wear (mm), $R_a$ roughness (µm), missing value policy. |
| **5:00 – 7:30** | **SQL Relational Modeling & Analytics Views** | [TEAMMATE_2_SQL_DATABASE_NAME] | Slide Deck Slide 4 & Live App: 11 MySQL tables, foreign keys, 5 analytical views (`v_machine_active_degradation`, `v_incident_resolution_metrics`, etc.). |
| **7:30 – 12:00** | **Full Application Live Demo** | [YOUR_NAME] | Live App Walkthrough: 5 role-based flows (Operator restriction -> Anomaly injection -> Incident creation -> Supervisor triage -> Maintenance AI root-cause diagnosis). |
| **12:00 – 15:00** | **Q&A & Mentor Evaluation** | All Team Members | Open floor for evaluator questions, code inspection, and feedback. |

---

## 4. Live Demonstration Step-by-Step Script

During minutes 7:30 to 12:00, the App Developer executes this exact sequence:

1. **Header & Persona Switcher:**
   - Demonstrate the role switcher in the top bar. Point out the live shift clock and active facility banner.
2. **Operator Flow (Alex Chen):**
   - Switch to **Alex Chen (Operator)**.
   - Show that the machine view is hard-restricted to **`CNC-MILL-01`**.
   - Inject simulated vibration anomaly (spindle vibration jumps to >4.5 m/s²).
   - Click **"+ New Incident Report"**, click **"Capture Fresh Telemetry Snapshot"**, and submit ticket.
3. **Supervisor Flow (Marcus Vance):**
   - Switch to **Marcus Vance (Supervisor)**.
   - Show the 400-machine fleet view. Filter to **Plant A** and machine type **CNC Vertical Machining Center**.
   - Open **Incidents & Maintenance**, find the newly submitted ticket, and assign it to **Frank Kowalski (Maintenance)**.
4. **Maintenance Flow (Frank Kowalski):**
   - Switch to **Frank Kowalski (Maintenance)**.
   - Open the incident dossier. Highlight physical units ($m/s^2, kW, \%$, $mm$).
   - Click **"Run AI Investigation Analysis"**.
   - Show the generated hypotheses (toolholder fretting / lubrication binding).
   - Point out the **Mandatory Safety Disclaimer** and the excluded auxiliary channels note.
   - Check off physical inspection steps (0.001 mm dial indicator check).
   - Log progress note and close the ticket with operational resolution.
5. **Analytics & Admin Flow:**
   - Briefly show **AnalyticsView** (5 dataset tabs) and **UsersView** (user roster CRUD).

---

## 5. Phase 1 Handoff & Deliverables Verification Table

Verify that all required Phase 1 artifacts are packaged and accessible to evaluators:

| Deliverable Name | File Location / Path | Status in Project | Verified Content |
| :--- | :--- | :---: | :--- |
| **400-Machine Master List** | `machine-name.json` (Root) | **Verified** | 400 CNC machines, 100 per plant, 25 fields per machine, 100% unique IDs/codes. |
| **Project Status Documentation** | `.aistudio/artifacts/brain/.../project status.md` | **Verified** | Comprehensive project report detailing architecture, datasets, SQL, RBAC, and tests. |
| **Automated Test Report** | `tests/test_execution_report.json` | **Verified** | Machine-readable report of 92 passing unit tests across 9 test suites. |
| **FastAPI Backend Server** | `api_server/main.py` | **Verified** | 14 REST endpoints covering auth, machines, incidents, analytics, and AI diagnose. |
| **MySQL Relational DDL** | `scripts/export_mysql_schema.sql` | **Verified** | 11 relational tables + 5 reporting views with sample data inserts. |
| **EDA Jupyter Notebook** | `notebooks/eda_manufacturing_datasets.ipynb` | **Verified** | Complete exploratory data analysis across all 4 empirical manufacturing datasets. |
| **Mentor Demo Slide Deck** | `.aistudio/artifacts/brain/.../demo slide deck and speaking notes` | **Verified** | 8-slide presentation outline with timed speaking scripts and anticipated Q&A. |
| **App Walkthrough Guide** | `.aistudio/artifacts/brain/.../application walkthrough guide` | **Verified** | Beginner-friendly, step-by-step navigation guide for all 5 personas. |
| **Team Showcase Checklist** | This Artifact (`team v1 showcase checklist`) | **Verified** | Pre-flight technical checks, agenda, live script, and coordination tracker. |

---

## 6. Teammate Coordination & Evidence Gathering Tracker

*Important Note: The items below track collaborative team coordination. In accordance with Phase 1 standards, do not mark an item as complete unless direct proof (e.g. meeting notes, pull request links, or email confirmations) is provided.*

| Coordination Item | Required Evidence | Responsible Teammates | Verification Status | Notes / Action Needed |
| :--- | :--- | :--- | :---: | :--- |
| **1. API Contract Alignment** | Confirmation that FastAPI schemas match Data Analytics scripts | [YOUR_NAME] & [TEAMMATE_1_DATA_ANALYTICS_NAME] | **Code Verified / Meeting Pending** | Code contracts verified via tests; joint sign-off meeting: `[DATE / TIME]` |
| **2. SQL Views Alignment** | Confirmation that the 5 MySQL views match the Database Engineer's DDL | [YOUR_NAME] & [TEAMMATE_2_SQL_DATABASE_NAME] | **Code Verified / Meeting Pending** | Schema verified in `export_mysql_schema.sql`; joint review: `[DATE / TIME]` |
| **3. Joint Rehearsal Dry-Run** | Conducted full 15-minute dry run of presentation and live app demo | All Team Members | **Pending Rehearsal** | Target Rehearsal Date: `[REHEARSAL_DATE]`, Meeting Link: `[MEETING_LINK]` |
| **4. Slide Deck Consolidation** | Merged team slides into unified slide deck (Google Slides / PowerPoint) | Lead Presenter | **Template Ready / Final Merge Pending** | Slide Deck URL: `[SHARED_SLIDE_DECK_URL]` |
| **5. Shared Code Repository** | Pushed verified codebase and artifacts to team Git repository | All Team Members | **Local Build Ready / Remote Sync Pending** | Remote Git Repository URL: `[SHARED_GIT_REPO_URL]` |
| **6. Final Evaluator Sign-Off** | Formal presentation delivered and evaluation rubric scored | All Team Members & [MENTOR_EVALUATOR_NAME] | **Pending Final Showcase** | Showcase Date: `[FINAL_SHOWCASE_DATE]` |

---

## 7. Emergency Demonstration Fallback Procedures

In case of unexpected technical issues during the live showcase, follow these immediate contingencies:

1. **If the Internet / Cloud URL Disconnects:**
   - Immediately switch screen share to local dev server: `http://localhost:3000`.
   - Explain to the mentor: *"FactoryPulse includes full offline local caching in `apiClient.ts` with `localStorage` persistence, allowing continuous operation during network dropouts."*
2. **If an API Endpoint Times Out:**
   - The application automatically falls back to verified seed data (`src/data/seedData.ts` and `src/data/machinesData.ts`). The UI will display clear error banners without crashing or freezing.
3. **If a Teammate Experiences Audio / Connection Loss:**
   - [YOUR_NAME] is prepared to cover the Data Analytics slides (using Slide 3 and the Analytics tab) or the SQL slides (using Slide 4 and the Relational Schema documentation) to maintain a seamless presentation flow.
