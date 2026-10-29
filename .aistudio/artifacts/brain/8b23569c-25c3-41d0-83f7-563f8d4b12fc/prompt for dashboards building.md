# FACTORYPULSE INDUSTRIAL PLATFORM — PROMPT FOR DASHBOARDS BUILDING

## Role-Based Dashboard Architecture: Manager vs. Supervisor

This document defines the functional analysis, technical specifications, and production-grade implementation prompt for building **Plant Manager** and **Shift Supervisor** dashboards in smart manufacturing, Industrial IoT (IIoT), and manufacturing incident response systems.

---

## 1. Domain Analysis: Manager vs. Supervisor Operational Perspectives

Industrial manufacturing operations require strict separation of concerns between **Strategic Governance (Manager)** and **Tactical Execution (Supervisor)**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PLANT MANAGER DASHBOARD                         │
│   Strategic · Financial · Multi-Facility · Compliance · Capital ROI   │
│   • Multi-Plant OEE (Availability × Performance × Quality)             │
│   • Unplanned Downtime Cost ($/hr & Financial Loss Ledger)             │
│   • Downtime Root-Cause Pareto Distribution (Mechanical, Tool, Elect)  │
│   • Substation Peak Demand Load & Tariff Avoidance (kW / 3,400 kW)     │
│   • Executive Capital Sign-Offs (Spindle Overhauls, Coolant Batches)   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ High-level SLAs & Shift Handover
┌────────────────────────────────────▼───────────────────────────────────┐
│                      SHIFT SUPERVISOR DASHBOARD                        │
│     Tactical · Shop Floor · Line Readiness · Staffing · Triage Desk     │
│   • Live Shift Pulse (Staffing 16/16, On-Duty Specialists, Briefing)   │
│   • Active Plant Status (Plants A–D: Nominal, Warning, Critical)       │
│   • Rapid Incident Triage Desk (SLA < 25m, 1-Click Tech Assign & WO)   │
│   • Telemetry Envelope Monitoring (Chiller > 35°C, Motor Load > 85%)   │
│   • Shift Handover Log & Safety Continuity Journal (Shift A → Shift B) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. In-Depth Metric & Component Specification

### A. What Must Be Shown on the Plant Manager Dashboard

1. **Executive Multi-Facility Header & Timeframe Switcher**:
   - Timeframe toggles: `Current Shift (8h)`, `Weekly Cycle (7d)`, `Month-to-Date (MTD 30d)`.
   - Clear multi-facility context: Oversight across all plants (Plant A: Precision, Plant B: Powertrain, Plant C: Heavy, Plant D: Finishing).
   - Export Executive Operations Report (JSON/PDF).

2. **Executive Financial & Performance KPI Strip**:
   - **Overall Equipment Effectiveness (OEE)**: World-Class standard benchmark (90%+). Clear decomposition:
     $$\text{OEE} = \text{Availability} \times \text{Performance} \times \text{Quality}$$
     - Example: $93.5\% \text{ (Avail)} \times 95.8\% \text{ (Perf)} \times 98.4\% \text{ (Quality)} = 87.8\% \text{ OEE}$.
   - **Financial Downtime Loss**: Direct dollar loss calculated from lost machine hours multiplied by standardized line rate ($1,450/hr), plus scrap workpiece loss.
   - **Production Output Attainment**: Actual units produced vs. planned shift target (e.g., 5,420 / 6,000 parts, 90.3% attainment).
   - **Substation Electrical Peak Demand**: Total instantaneous facility draw vs. utility penalty threshold (e.g., 2,410 kW / 3,400 kW max capacity).

3. **Multi-Plant Benchmarking Matrix**:
   - Comparative table and stacked progress bars for Plants A, B, C, D showing:
     - Individual Plant OEE %
     - Availability %, Performance %, Quality %
     - Finished parts count vs target
     - Open critical incident count
     - Operational status badge (Exceeding Target, On Pace, Needs Attention)

4. **7-Day Trend Visualizer**:
   - Dual-axis SVG visualization correlating daily ticket incident count (vertical bars) with total lost production downtime in hours (trend curve).

5. **Downtime Root-Cause Pareto Breakdown**:
   - Mechanical Wear & Spindle Bearing Play (42%, $14,200 loss)
   - Flank Wear ($V_b$) & Cutting Tool Chipping (28%, $9,500 loss)
   - Electrical & VFD Inverter Thermal Surges (16%, $5,400 loss)
   - Operator Setup, Workpiece Clamping & Offsets (14%, $4,700 loss)
   - Accompanying Reliability Engineering ROI analysis highlighting preventative maintenance savings.

6. **Executive Maintenance & Capital Authorization Desk**:
   - Pending overhaul and vendor requisition cards requiring Manager sign-off:
     - Spindle bearing replacement ($4,200)
     - Synthetic coolant replenishment ($6,800)
     - 5-Axis shift calibration schedule shift
   - Interactive 1-click `Authorize Sign-Off` with state persistence.

---

### B. What Must Be Shown on the Shift Supervisor Dashboard

1. **Shift Status, Readiness & Staffing Console**:
   - Active shift identifier: Shift A (06:00 – 14:00 UTC), Shift Supervisor name & badge (Elena Rostova · SUP-201).
   - Station Headcount: 16/16 cutting stations staffed, 4 on-duty maintenance specialists available.
   - Pre-shift safety briefing verification sign-off with toggle state.
   - Shift elapsed timer (e.g., 2h 45m / 8h 00m).

2. **Fleet Health & Plant Readiness Overview**:
   - Total active roster machines (e.g., 40 units across Plants A–D) and canonical catalog reference (400 units).
   - Dynamic counts: Nominal (cutting within tolerances), Warning (elevated vibration/temperature), Critical (safety interlock trip), Offline.
   - Plant cards for Plants A, B, C, D detailing:
     - Availability %
     - Nominal / Warning / Critical machine distribution
     - Average chiller fluid temperature (°C)
     - Sub-feed electrical consumption (kW)
     - Open tickets count

3. **Shift Triage Desk & Rapid Dispatch Station**:
   - Live ticket queue showing active incidents with:
     - Incident ticket code, machine code, severity badge, symptom description, reporter identity.
     - Response SLA countdown target (< 25 min response standard).
     - **Quick Actions**:
       - `Assign Specialist`: Assign lead vibration or mechanical technician.
       - `Dispatch Work Order`: Instantly convert ticket into a formal Maintenance Work Order with priority and specific action notes.
       - `Inspect Telemetry`: Drill down to machine sensor stream.

4. **Equipment Sensor Envelope Monitoring**:
   - **Chiller Coolant Stability Chart**: SVG bar comparison comparing plant coolant temperatures against 35.0°C warning and 45.0°C critical trip limits.
   - **Spindle Motor Load Chart**: Horizontal inverter cutting load comparison benchmarked against 85% safe continuous envelope.

5. **Fleet Inventory & Live Telemetry Browser**:
   - Filterable machine catalog table:
     - Filter by Plant (All, Plant A, B, C, D)
     - Filter by Machine Category (7 standard CNC types)
     - Filter by Status (Nominal, Warning, Critical, Offline)
     - Live Spindle RPM, Vibration RMS (mm/s), and Inverter Motor Load (%).

6. **Shift Handover Log & Safety Continuity Journal**:
   - Interactive message stream for instructions passed to incoming shift supervisor.
   - Post note form appending author, timestamp (UTC), and plant tag.
   - `Export Shift Brief` download button generating clean JSON/text handoff documentation.

---

## 3. Production Master Implementation Prompt

Use the following complete system prompt when prompting an LLM or instructing an engineering team to construct these dashboards from scratch:

```markdown
# PROMPT: BUILD PRODUCTION-GRADE INDUSTRIAL MANAGER & SUPERVISOR DASHBOARDS

You are a Principal Full-Stack Engineer and Industrial UI/UX Architect.
Build two specialized, production-ready operational dashboards for a CNC smart manufacturing and incident response platform:
1. ManagerDashboard (Plant Manager / Executive Operations)
2. SupervisorDashboard (Shift Supervisor / Floor Operations Lead)

### 1. Visual & Aesthetic Architecture
- High-contrast industrial aerospace dark theme:
  - Background: Deep navy/slate (#070d18, #0c1424, #0b1322)
  - Borders: Crisp slate (border-slate-800, border-slate-700)
  - Typography: Clean sans-serif for UI, tabular monospace (font-mono) for all engineering readings and timestamps
  - Color Tokens: Teal (#2dd4bf) for nominal/primary, Sky (#38bdf8) for coolant/chiller, Purple (#c084fc) for executive/power, Amber (#fbbf24) for warning/overload, Rose (#f43f5e) for critical/stoppage.
- Zero placeholder pills, zero dummy non-working buttons, zero "mock" tags. Every element must be operational.

### 2. Functional Requirements for ManagerDashboard
- Timeframe filter: Toggle between 'Current Shift (8h)', 'Weekly Cycle (7d)', 'Month-to-Date (30d)'.
- True OEE Decomposition: Availability % × Performance % × Quality % = Overall OEE %. Show both individual gauges and plant-by-plant breakdown.
- Financial Loss Ledger: Compute unplanned downtime financial impact at standard $1,450/hr rate, scrap loss, and preventative maintenance ROI.
- Cross-Plant Benchmark: Compare Plants A, B, C, D with actual machine counts, parts produced vs target, and active incident counts.
- 7-Day Trend Visualizer: SVG chart correlating daily incident ticket volume (bars) with lost downtime hours (line).
- Pareto Downtime Root-Cause Breakdown: Mechanical (42%), Tool Wear (28%), Electrical (16%), Setup/Clamping (14%).
- Power Draw vs Substation Limit: Compare current kW vs 850 kW per-plant substation limit (3,400 kW total).
- Executive Capital Authorization Ledger: Sign-off cards for spindle overhauls ($4,200), coolant replenishment ($6,800), and calibration schedules, with 1-click authorization persisting in browser storage.
- Export Executive Operations Report: Downloadable JSON summary.

### 3. Functional Requirements for SupervisorDashboard
- Shift Status & Staffing: Active Shift A indicator, 16/16 station staffing count, 4 on-duty technicians, pre-shift safety briefing sign-off checkbox, shift elapsed time.
- Fleet Health Cards: Nominal, Warning, Critical, Offline counts dynamically calculated from active machine roster.
- Plant Cards (Plants A–D): Operational readiness %, machine distribution, chiller temperature (°C), kW draw, active ticket count.
- Shift Triage Desk: Table of active incidents with severity filter, status filter, SLA countdown indicator, 1-click technician assignment modal, and 1-click work order dispatch modal.
- Sensor Envelope Monitoring:
  - Coolant Chiller Temperature SVG chart with 35.0°C warning and 45.0°C trip limits.
  - Motor Inverter Load SVG comparison with 85% safe continuous limit.
- Machine Roster Browser: Dual identification (e.g. MCH-001 · CNC-5AX-001), 3-tier filters (Plant, Type, Status), live RPM, RMS vibration (mm/s), motor load (%).
- Shift Handover Journal: Form to append timestamped operational notes for incoming shift supervisor, with export shift brief capability.

### 4. Technical Constraints
- Framework: React 19 + TypeScript + Tailwind CSS.
- Safe State Management: Graceful fallbacks for local storage in restricted environments (iframes).
- Clean Code: Zero TypeScript compiler errors (tsc --noEmit), zero runtime window.alert calls.
- Component Contracts: Accept currentUser, machines, incidents, workOrders, onNavigate, onSelectMachine, and onRefreshData props.
```

---

## 4. Acceptance Verification Checklist

| Area | Requirement | Verification Method |
|---|---|---|
| **Supervisor** | Shift Headcount & Safety Briefing | Visible status indicator and toggleable safety briefing button |
| **Supervisor** | Plant Health Distribution | 4 plant cards with Nominal, Warning, Critical counts |
| **Supervisor** | Rapid Triage Desk | Severity and Status filters, Quick Assign modal, Dispatch Work Order modal |
| **Supervisor** | Sensor Envelope Charts | SVG bars for Coolant Temp (< 35°C) and Motor Load (< 85%) |
| **Supervisor** | Shift Handover Continuity | Note submission form, timestamped log, and JSON export button |
| **Manager** | Timeframe Filter | Toggle between Shift (8h), 7-Day, MTD with metric adjustment |
| **Manager** | OEE Decomposition | Availability × Performance × Quality calculation with plant comparison |
| **Manager** | Downtime Financial Cost | Dollar loss calculation ($1,450/hr), scrap loss, and PM ROI |
| **Manager** | 7-Day Trend Line & Pareto | Vector SVG dual-axis trend and root-cause Pareto bars |
| **Manager** | Capital Authorizations | Interactive sign-off buttons with local storage persistence |
| **Integration**| Role Routing Switcher | Seamless toggling between Role Command Console and Live Telemetry Matrix |
| **Quality** | Automated Test Suite | 100% pass rate in master test suite (`tests/run_all_tests.py`) |
| **Quality** | TypeScript Compilation | Zero errors in `tsc --noEmit` and clean Vite build |
