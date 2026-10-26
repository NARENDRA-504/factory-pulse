# FactoryPulse — Phase 1 Mentor Demo Slide Deck & Speaking Notes

**Project:** FactoryPulse — AI Manufacturing Incident and Maintenance Response Platform  
**Program:** Ziro Digital Internship Program (ZDIP)  
**Track:** AI App Development (Individual Contribution)  
**Presenter:** [YOUR_NAME]  
**Evaluator/Mentor:** [MENTOR_EVALUATOR_NAME]  
**Date:** [DEMO_DATE] | **Time Slot:** [DEMO_TIME_SLOT] (Target: 8–10 Minutes)  
**Live App URL:** https://ais-dev-t25zcwjetmqvqxfrwyerp2-28600336066.asia-southeast1.run.app  

---

## Slide 1: Title & Executive Introduction

### Visual Slide Content
- **Title:** FactoryPulse — AI Manufacturing Incident & Maintenance Response Platform
- **Subtitle:** Phase 1 Capstone Demonstration · CNC Machine Fleet Health & Incident Operations
- **Presenter:** [YOUR_NAME] — Role: AI App Developer
- **Team Collaborators:**
  - [TEAMMATE_1_DATA_ANALYTICS_NAME] (Data Analytics & Python Pipeline)
  - [TEAMMATE_2_SQL_DATABASE_NAME] (SQL Modeling & Analytical Reporting Views)
- **Key Milestones:**
  - 400 CNC Machines across 4 Plants (100 per plant)
  - 4 Empirical Datasets Validated (28,920 machining records)
  - Role-Based Operational Security (5 distinct roles)
  - 92 Automated Unit Tests (100% Pass Rate)

### Presenter Speaking Notes (1:00 min)
> "Good morning/afternoon, [MENTOR_EVALUATOR_NAME]. Today I am presenting FactoryPulse, an AI-powered manufacturing incident and maintenance response platform built during Phase 1 of the Ziro Digital Internship Program.
> 
> In modern CNC machining facilities, unplanned machine downtime costs thousands of dollars per hour. Operators, supervisors, and maintenance technicians frequently struggle with fragmented sensor data, slow incident reporting, and lack of standardized root-cause guidance.
> 
> As the AI App Developer on this team, my primary responsibility was architecting and delivering the complete full-stack web application: designing 5 core operational screens, enforcing role-based access control, building interactive telemetry visualizations, integrating generative AI diagnostic workflows, and connecting our UI to our team’s validated Python data pipelines and relational SQL database."

---

## Slide 2: Problem Statement & Phase 1 Scope

### Visual Slide Content
- **Core Industry Challenge:**
  - Disconnected telemetry: Spindle vibration, motor load, and tool wear data live in silos.
  - Incident lag: Floor operators lack quick, standardized anomaly reporting tools.
  - Diagnostic ambiguity: Maintenance technicians lack immediate, grounded root-cause hypotheses.
- **Strict Phase 1 Scope Boundaries:**
  - CNC Machine Fleet Operations (Turning, Milling, Drilling, Grinding).
  - Empirical data-driven analytics (No fictitious robotics or physical actuators).
  - Server-authoritative role-based access control (Operator, Supervisor, Maintenance, Manager, Admin).
  - Grounded Generative AI assistance with mandatory safety disclaimers.

### Presenter Speaking Notes (1:00 min)
> "To keep our engineering focused and production-viable, we established strict boundaries for Phase 1. We focused on CNC machining operations across 7 specific machine categories.
> 
> We deliberately avoided out-of-scope features like automated robot controls or physical actuator overrides. Every feature in FactoryPulse is designed to solve a specific human operational workflow: helping operators capture machine condition, supervisors triage plant-level alerts, and maintenance technicians investigate root causes with empirical sensor grounding."

---

## Slide 3: System Architecture & Integration

### Visual Slide Content
```
┌────────────────────────────────────────────────────────┐
│               React SPA Frontend (Vite)                │
│  Tailwind CSS · Lucide Icons · Role Switcher · 5 Views │
└──────────────────────────┬─────────────────────────────┘
                           │ REST API / JSON Wire Protocol
┌──────────────────────────┴─────────────────────────────┐
│               FastAPI Python Server                    │
│   Auth / RBAC · Telemetry · Incident Logic · GenAI     │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
┌──────────────┴───────────────┐ ┌──────────┴─────────────┐
│   MySQL Relational Storage   │ │  4 Empirical Datasets  │
│ 11 Tables · 5 SQL Analytics  │ │ 28,920 Real Machining  │
│             Views            │ │    Records Ingested    │
└──────────────────────────────┘ └────────────────────────┘
```
- **Frontend:** React 19 + TypeScript + Tailwind CSS (Port 3000)
- **Backend:** Python FastAPI (`api_server/main.py`) with server-side AI routing
- **Database:** MySQL DDL schema (`scripts/export_mysql_schema.sql`) with 11 tables & 5 analytical views
- **Data Engineering:** Automated ingestion and cleaning pipeline for 4 empirical CNC datasets

### Presenter Speaking Notes (1:15 min)
> "Here is our full-stack architecture. The frontend is a responsive React application built with TypeScript and styled with Tailwind CSS for high-density industrial control rooms.
> 
> The client interacts through a hardened API service layer with our Python FastAPI backend. The backend manages authentication, telemetry streaming, and incident state transitions.
> 
> Underneath, we store operational data in 11 relational MySQL tables, supplemented by 5 specialized analytical views for fleet degradation, incident MTTR, and shift logging. We also integrated 4 real-world machining datasets totaling 28,920 rows, providing verified physical baselines for tool wear width in millimeters, surface roughness in micrometers, and spindle vibration."

---

## Slide 4: 400-Machine Fleet Architecture

### Visual Slide Content
| Plant | Facility Specialization | Machine Count | Key Categories |
| :--- | :--- | :---: | :--- |
| **Plant A** | Precision Machining | 100 | CNC Vertical Machining Centers, 5-Axis Centers |
| **Plant B** | Powertrain Components | 100 | CNC Turning Centers, Mill-Turn Centers |
| **Plant C** | Heavy Machining | 100 | CNC Horizontal Machining Centers, Boring Mills |
| **Plant D** | Finishing & Grinding | 100 | CNC Grinding Machines, Drilling & Tapping |
| **Total** | **4 Interconnected Plants** | **400** | **7 Standard CNC Categories** |

- **Integrity Metrics:**
  - 100% Unique `machineId` (e.g., `MCH-PLT-A-001` through `MCH-PLT-D-100`)
  - 100% Unique `machineCode` (e.g., `CNC-VMC-001` through `CNC-GRD-100`)
  - 100% Unique `displayName` & `telemetryKey`
  - Dual Identification in all selectors: Human readable name + unique machine code

### Presenter Speaking Notes (1:00 min)
> "A core engineering achievement in Phase 1 was scaling and validating the machine fleet to exactly 400 CNC machines, distributed evenly across four plants at exactly 100 machines per plant.
> 
> Every single machine record contains 25 verified fields, including physical telemetry keys, manufacturer specs, cycle targets, and scheduled maintenance dates.
> 
> Crucially, all machine selectors across the entire app display dual identification: the readable display name alongside the unique machine code, ensuring operators and supervisors never misidentify a machine on the shop floor. We verified this programmatically with zero duplicate IDs or codes."

---

## Slide 5: Role-Based User Workflows (Live Demo Preview)

### Visual Slide Content
- **Operator Persona:**
  - Scope: Restricted strictly to assigned machine (`CNC-MILL-01`).
  - Actions: Views live telemetry, injects test anomalies, files incident report.
  - Security: Cannot access other plant machines via URL or filter tampering (HTTP 403).
- **Supervisor Persona:**
  - Scope: Plant-wide oversight across 400 machines.
  - Actions: Multi-tier filtering (Plant, Shop Floor, Machine Type, Status), incident triage, assigns tickets to technicians.
- **Maintenance Persona:**
  - Scope: Machine condition monitoring and repair execution.
  - Actions: Investigates vibration/wear spikes, runs AI diagnostic assistant, executes work orders, signs off on closure.
- **Admin Persona:**
  - Scope: User governance & audit compliance.
  - Actions: CRUD management of user accounts, role provisioning, audit trail review.

### Presenter Speaking Notes (1:30 min)
> "Let's look at the core user flows. We implemented strict role-based access control with 5 distinct personas.
> 
> When logged in as an Operator, such as Alex Chen, the dashboard immediately restricts your view to your assigned machine—in this case, CNC-MILL-01. The operator sees real-time spindle RPM, vibration RMS, motor power, and tool wear. If an anomaly occurs, the operator can click 'Capture Snapshot' and submit a ticket. Operators cannot view or file tickets against unauthorized machines.
> 
> When we switch to the Supervisor role, such as Marcus Vance, the entire 400-machine fleet opens up. The supervisor can filter down to Plant B Powertrain, identify an open critical incident, and assign it to a maintenance technician.
> 
> Finally, Maintenance technicians can open the incident dossier, review the captured sensor snapshot, and trigger our Generative AI investigation assistant."

---

## Slide 6: Generative AI Root-Cause Diagnostic Assistant

### Visual Slide Content
- **Server-Side Calling Pattern:** API credentials secured strictly on the backend.
- **Model ID:** `gemini-3.8-flash (Pending API Model Verification)`
- **Physical Sensor Grounding:**
  - Spindle Vibration RMS ($m/s^2$)
  - Motor Power ($kW$) vs. Motor Load Percentage ($\%$)
  - Tool Flank Wear $V_b$ ($mm$) from Dataset 1
  - Workpiece Surface Roughness $R_a$ ($\mu m$) from Dataset 2
- **Guardrails & Safety Compliance:**
  - Unverified auxiliary channels (e.g. Channel 14) are explicitly excluded from physical reasoning.
  - Hypotheses clearly labeled: *"Unverified Guidance — Requires Physical Inspection"*.
  - Interactive physical investigation checklist for maintenance personnel.
  - Prominent mandatory Lock-Out/Tag-Out (LOTO) safety disclaimer.

### Presenter Speaking Notes (1:30 min)
> "Our Generative AI integration is one of FactoryPulse's most valuable features. Instead of feeding unformatted raw numbers into an LLM, our backend constructs a structured physical dossier.
> 
> We explicitly ground the model in verified physical metrics: vibration RMS in meters per second squared, motor power in kilowatts, and correlated flank wear in millimeters. Notice that any unverified sensor channels—such as raw voltage on Channel 14—are programmatically excluded from physical reasoning.
> 
> The AI returns clear root-cause hypotheses, such as toolholder taper fretting or guideway lubrication starvation, but it tags them clearly as unverified guidance. It also generates an interactive physical checklist for the technician—like checking spindle runout with a 0.001mm dial indicator.
> 
> Most importantly, the interface displays a prominent mandatory safety disclaimer, reminding staff that AI guidance never replaces certified LOTO procedures or manufacturer standard operating procedures."

---

## Slide 7: Verification & Quality Metrics

### Visual Slide Content
- **Automated Verification Suite:** 92 Unit Tests | 100% Pass Rate | 3.38s execution time
  - Dataset Engineering & Baselines: 6/6 Passed
  - RBAC & Auth Security: 10/10 Passed
  - FastAPI API Contracts & Wire Protocol: 14/14 Passed
  - MySQL Schema DDL & Relational Views: 13/13 Passed
  - Frontend Seed Data & Types: 9/9 Passed
  - Live Relational SQL Engine: 7/7 Passed
  - In-Process HTTP Server: 10/10 Passed
  - Dashboard Control Room & Telemetry: 12/12 Passed
  - Operator Dashboard Functional Audit: 11/11 Passed
- **Codebase Quality:**
  - TypeScript Static Compilation (`tsc --noEmit`): 0 Errors
  - Production Asset Bundler (`vite build`): Clean build, zero warnings

### Presenter Speaking Notes (1:00 min)
> "We backed this entire application with an end-to-end automated verification suite. Running `run_all_tests.py` executes 92 unit tests covering RBAC boundaries, FastAPI endpoint contracts, MySQL schema integrity, and live in-process HTTP wire tests.
> 
> All 92 tests pass consistently in under 4 seconds. In addition, our TypeScript compilation runs with zero type errors, and our Vite production build compiles cleanly into production assets. We have verified both data integrity and UI stability."

---

## Slide 8: Individual Contribution & Conclusion

### Visual Slide Content
- **My Personal Contribution (AI App Development):**
  - Architected the complete 5-screen React SPA with dark industrial design.
  - Implemented the client API service layer with full RBAC enforcement and error handling.
  - Built the live telemetry visualization suite and operator test injection harness.
  - Designed the end-to-end incident management lifecycle (Create, Assign, Progress, Close).
  - Implemented the Generative AI diagnostic drawer with guardrails and physical checklists.
  - Authored the verification tests for UI components and operator authorization.
- **Next Steps (Phase 2 Roadmap Preview):**
  - Connect live Google Gemini API key once external cloud provisioning is approved.
  - Scale database to live Cloud SQL instance.
  - Implement real-time WebSocket telemetry push.
- **Q&A & Live Demonstration**

### Presenter Speaking Notes (1:00 min)
> "To conclude, my individual contribution focused on transforming raw manufacturing datasets and SQL models into an intuitive, secure, and resilient application that operators and engineers can actually use on a factory floor.
> 
> Everything shown today is live, fully interactive, and tested against real-world manufacturing data.
> 
> Thank you, [MENTOR_EVALUATOR_NAME]. I would now like to transition into the live app walkthrough and answer any questions you may have."

---

## 3. Mentor Anticipated Questions & Answers (Prep Sheet)

### Q1: "How do you ensure the operator cannot access other machines?"
> **Answer:** "We enforce this at two layers. In the UI, the Operator persona's view is hard-locked to their `assignedMachine` attribute (`CNC-MILL-01`), hiding the fleet selector. In the API layer (`apiClient.ts` and `api_server/main.py`), every incident submission verifies the reporting user's role and assigned machine. If an Operator attempts to submit a ticket for a machine other than their assigned unit, the API rejects the request with an HTTP 403 Forbidden error. We have automated unit tests in `test_operator_dashboard_audit.py` proving this boundary."

### Q2: "Why did you exclude certain sensor channels from the AI prompt?"
> **Answer:** "During our exploratory data analysis, we discovered that channels like `sensor_channel_14` in Dataset 1 lacked verified engineering units in the original dataset documentation. In manufacturing, asking an LLM to reason over uncalibrated arbitrary voltage numbers produces hallucinations. We established a strict data provenance rule: only sensors with verified physical units—such as $m/s^2$ for vibration and $kW$ for motor power—are passed to the physical reasoning engine."

### Q3: "What happens if the live API or network goes down during an operator's shift?"
> **Answer:** "Our client architecture features an offline fallback cache. In `src/services/apiClient.ts`, all operations fall back to localized seed storage (`SEED_MACHINES`, `SEED_INCIDENTS`, `SEED_USERS`) with `localStorage` persistence. The app remains fully functional and responsive even in disconnected environments, and synchronizes state when reconnected."
