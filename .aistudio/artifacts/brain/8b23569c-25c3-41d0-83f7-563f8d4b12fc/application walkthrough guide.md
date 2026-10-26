# FactoryPulse — Application Walkthrough & User Flow Guide

**Project:** FactoryPulse — AI Manufacturing Incident and Maintenance Response Platform  
**Program:** Ziro Digital Internship Program (ZDIP)  
**Track:** AI App Development (Individual Engineering Guide)  
**Application URL:** https://ais-dev-t25zcwjetmqvqxfrwyerp2-28600336066.asia-southeast1.run.app  
**Target Audience:** Evaluators, Mentors, New Users, and Cross-Functional Teammates  
**Last Verified:** October 26, 2026  

---

## 1. Quick Start & Application Overview

FactoryPulse is an industrial web application designed for CNC manufacturing plants. It connects floor operators, plant supervisors, and maintenance engineers into a single, cohesive response system when machine anomalies occur.

### Key Highlights
- **400 Real CNC Machines:** Divided across 4 specialized plants (100 machines per plant) in 7 CNC machine categories.
- **5 Role-Based Personas:** Operator, Supervisor, Maintenance, Manager, and Admin with server-enforced access boundaries.
- **Empirical Data Foundation:** Built upon 4 verified manufacturing datasets totaling 28,920 rows of actual machining telemetry.
- **Generative AI Root Cause Assistant:** Translates raw vibration and motor load anomalies into actionable physical hypotheses with mandatory safety disclaimers.

---

## 2. Global Navigation & Persona Switcher

When you open FactoryPulse, look at the **Top Bar** and **Left Sidebar**:

1. **Role Switcher Dropdown (Top Right):**
   - Located in the top header. Allows you to instantly switch personas during testing and demonstrations without re-authenticating.
   - Available Personas:
     - **Alex Chen (Operator)** — Work ID: `OP-7741`, Assigned Machine: `CNC-MILL-01`
     - **Marcus Vance (Supervisor)** — Work ID: `SV-2041`, Assigned Plant: `Plant A`
     - **Frank Kowalski (Maintenance)** — Work ID: `MT-4092`, Specialization: Mechanical/Vibration
     - **Elena Rostova (Manager)** — Work ID: `MG-1002`, Operations Management
     - **Sarah Connor (Admin)** — Work ID: `AD-0001`, System Administration
2. **Left Sidebar Navigation:**
   - **Dashboard:** Fleet-wide overview and real-time control room metrics.
   - **Machine Condition:** Live telemetry feeds, RPM, vibration, and motor load gauges.
   - **Incidents & Maintenance:** Incident ticketing, assignment, AI investigation, and work orders.
   - **Analytics & Datasets:** Statistical deep-dives into tool wear, surface roughness, and cycle-to-failure.
   - **User Administration:** Roster management and role assignments (Admin only).

---

## 3. Step-by-Step Persona Walkthroughs

### Flow 1: Operator Persona (Shop Floor Simplicity & Reporting)

**Goal:** Monitor your assigned CNC milling machine, observe telemetry, inject a simulated anomaly, and file a formal incident report.

1. **Switch to Operator:**
   - In the top-right header, select **Alex Chen (Operator)**.
2. **Observe Assigned Machine Restriction:**
   - Navigate to the **Machine Condition** screen.
   - Notice that the machine selector is locked to **CNC-MILL-01 (Precision Mill - Spindle A)**.
   - *Security Check:* The operator cannot view or toggle to any of the other 399 machines. The UI displays the current spindle RPM (approx. 5,400 RPM), vibration RMS (approx. 1.85 m/s²), motor power (approx. 6.2 kW), and motor load percentage.
3. **Simulate a Shop Floor Anomaly:**
   - In the **Simulate Anomaly Stream** panel on the right, click the button labeled **"Inject Vibration Spike (Bearings Wear)"** or **"Inject Motor Overload"**.
   - Watch the live telemetry gauge update immediately: Vibration RMS surges to >4.5 m/s² and turns red.
4. **File an Incident Ticket:**
   - Navigate to **Incidents & Maintenance** in the sidebar.
   - Click the green button **"+ New Incident Report"** (top right).
   - Notice the form auto-selects `CNC-MILL-01` (operators cannot change this to an unauthorized machine).
   - Set **Severity Priority** to `High`.
   - Set **Component Area** to `Spindle & Toolholder`.
   - Enter **Symptom Description**: `"Excessive chatter and high-frequency vibration during roughing pass."`
   - Click **"Capture Fresh Telemetry Snapshot"** to automatically pull the current 4.5+ m/s² vibration reading into the ticket.
   - Click **"Submit Incident Report"**.
   - The new ticket (e.g., `INC-2026-103`) appears immediately in the incident list with status **"Open"**.

---

### Flow 2: Supervisor Persona (Plant-Wide Triage & Assignment)

**Goal:** Triage incidents across 400 machines, filter by plant and status, and assign the open ticket to maintenance.

1. **Switch to Supervisor:**
   - In the top-right header, select **Marcus Vance (Supervisor)**.
2. **Explore 400-Machine Fleet Filtering:**
   - Navigate to the **Dashboard** view.
   - Notice the supervisor has access to the full fleet across all 4 plants:
     - **Plant A:** Precision Machining (100 machines)
     - **Plant B:** Powertrain Components (100 machines)
     - **Plant C:** Heavy Machining (100 machines)
     - **Plant D:** Finishing & Grinding (100 machines)
   - Use the **Plant Filter** dropdown to view only `Plant A`.
   - Use the **Machine Type Filter** to select `CNC Vertical Machining Center`.
   - Observe how the high-density inventory table updates instantaneously. Every row displays both the human-readable display name and the unique machine code.
3. **Triage & Assign the Incident:**
   - Navigate to **Incidents & Maintenance**.
   - Select the newly created ticket `INC-2026-103` from the list.
   - Click the blue button **"Assign Incident"**.
   - Select **Frank Kowalski (Maintenance)** from the technician dropdown.
   - Click **"Confirm Assignment"**.
   - The ticket status updates from **"Open"** to **"In_Investigation"**.

---

### Flow 3: Maintenance Persona (AI Root-Cause Diagnosis & Work Order)

**Goal:** Inspect the sensor readings, run the Generative AI Investigation Assistant, complete physical checklist steps, and log maintenance progress.

1. **Switch to Maintenance:**
   - In the top-right header, select **Frank Kowalski (Maintenance)**.
2. **Review Incident Dossier:**
   - Navigate to **Incidents & Maintenance** and select ticket `INC-2026-103`.
   - In the central dossier panel, review the **Verified Physical Sensor Readings**:
     - Vibration RMS: `4.5 m/s²` (Measured by machine accelerometer collar)
     - Motor Power: `11.8 kW` (Spindle VFD power meter)
     - Motor Load: `98.2%` (Calculated continuous percentage)
     - Flank Wear $V_b$: `0.28 mm` (Empirical Dataset 1 correlation)
3. **Run AI Root Cause Assistant:**
   - In the **AI Root Cause & Diagnostic Assistant** card, click the purple button **"Run AI Investigation Analysis"**.
   - Within 800ms, the assistant synthesizes the readings into grounded hypotheses:
     - *Hypothesis 1:* Mechanical toolholder taper fretting or collet clamping torque loss.
     - *Hypothesis 2:* Z-axis ball screw pre-load binding or way-lube starvation.
   - Note the **Mandatory Safety Disclaimer** banner requiring compliance with facility Lock-Out/Tag-Out (LOTO) procedures.
   - Note the **Excluded Channels** note explicitly citing that raw sensor channel 14 was excluded because its engineering unit is unverified in primary documentation.
4. **Complete Physical Checklist:**
   - Under **Recommended Physical Investigation Steps**, check off:
     - `[x] Step 1: Check spindle runout at tool shank with calibrated 0.001 mm dial test indicator.`
     - `[x] Step 2: Inspect collet bore, pull-stud, and toolholder 7:24 taper for fretting corrosion.`
5. **Log Maintenance Action & Close:**
   - Click **"Update Action Progress"**. Enter note: `"Cleaned toolholder taper seat, re-torqued pull stud, and verified runout within 0.003 mm tolerance."`
   - Ticket moves to **"Action_Required"**.
   - Click **"Close Incident Ticket"**. Enter closure summary: `"Vibration returned to 1.78 m/s² normal baseline. Part passed CMM inspection."`
   - Ticket status becomes **"Closed"** with timestamp and technician sign-off.

---

### Flow 4: Manager Persona (Executive Analytics & Dataset Deep-Dive)

**Goal:** Review multi-plant health metrics, empirical data models, and statistical baselines.

1. **Switch to Manager:**
   - In the top-right header, select **Elena Rostova (Manager)**.
2. **Review Fleet KPIs:**
   - Navigate to **Dashboard**. Review total fleet availability, active alerts, and plant-by-plant operational uptime.
3. **Explore Empirical Datasets:**
   - Navigate to **Analytics & Datasets** in the sidebar.
   - Explore the 5 insight tabs:
     - **Dataset 1 (Tool Wear):** 2,054 rows analyzing flank wear width ($V_b$ in mm), IQR spread, and cutting condition quartiles.
     - **Dataset 2 (Roughness):** 612 rows evaluating surface roughness arithmetic mean ($R_a$ in µm) with linear regression against speed and feed.
     - **Dataset 3 (Mill Telemetry):** 25,286 rows of high-frequency sensor readings across 18 merged experimental runs.
     - **Dataset 4 (Cycle to Failure):** 968 rows tracking tool life in discrete cut cycles.
     - **Data Pipeline Health Audit:** Quality metrics validating 100% row match, missing value handling policies, and zero unauthorized data imputation.

---

### Flow 5: Admin Persona (User Governance & Roster Management)

**Goal:** Create a new user profile, manage roles, and review the full machine fleet inventory.

1. **Switch to Admin:**
   - In the top-right header, select **Sarah Connor (Admin)**.
2. **Manage Platform Users:**
   - Navigate to **User Administration** (accessible only to Admin).
   - View the current active personnel roster across all roles and shifts.
   - Click **"+ Add New User"**. Fill in:
     - Full Name: `David Miller`
     - Work ID: `OP-7745`
     - Role: `Operator`
     - Assigned Plant: `Plant A`
     - Assigned Machine: `CNC-VMC-002`
   - Click **"Create User"** and verify that David Miller appears in the roster.
   - Note: The system prevents deleting the last remaining administrative account or creating duplicate Work IDs.

---

## 4. Summary of Individual Contributions (AI App Development)

As the **AI App Developer**, my individual engineering contributions encompassed:

| Component Area | Implementation Files | Key Features Built |
| :--- | :--- | :--- |
| **Frontend Architecture** | `src/App.tsx`, `src/main.tsx`, `index.html` | React SPA structure, dark industrial styling, routing, error boundaries, and mobile responsiveness. |
| **API Client Service** | `src/services/apiClient.ts` | Complete client-side abstraction layer, REST wire integration, localStorage offline persistence, and RBAC gatekeeping. |
| **UI Views & Dashboards** | `src/views/*` (5 primary views) | Dashboard, Machine Condition, Incidents, Analytics, and Users views with high-density control-room layouts. |
| **Fleet Scale (400 Machines)** | `src/data/machinesData.ts`, `machine-name.json` | 400 CNC machine master list across 4 plants with dual identification (`displayName` + `machineCode`). |
| **Incident Workflow Engine** | `src/views/IncidentsView.tsx` | End-to-end incident lifecycle (Create, Assign, Progress, Close) with deduplication and RBAC validation. |
| **Generative AI Assistant** | `src/views/IncidentsView.tsx`, `api_server/main.py` | Grounded root-cause hypotheses, physical unit tagging, unverified channel exclusion, and interactive physical checklist. |
| **Automated Testing** | `tests/run_all_tests.py` | Authored and verified 92 automated test cases covering frontend seed data, operator restrictions, and dashboard integrity. |
