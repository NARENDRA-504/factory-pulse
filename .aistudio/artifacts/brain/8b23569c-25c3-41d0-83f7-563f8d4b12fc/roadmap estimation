# Roadmap Estimation — Phase 1 Remaining Work

**Project:** FactoryPulse — AI Manufacturing Incident and Maintenance Response Platform  
**Program:** Ziro Digital Internship Program (ZDIP)  
**Phase 1 Scope:** AI App Development · Python · SQL · Statistics · Data Analytics · Generative AI Features  
**Document Type:** Phase 1 Completion & Estimation Audit  
**Status Date:** October 26, 2026  

---

## 1. Executive Summary & Estimation Methodology

This artifact provides an objective work breakdown and realistic effort estimation for all remaining Phase 1 tasks across both individual responsibilities (**My Roadmap · AI App Development**) and collective responsibilities (**Overall Team Roadmap**).

### Estimation Conventions & Ground Rules
1. **Confirmed Remaining Work:** Tasks whose software implementations are substantially prepared in the codebase, but whose final operational delivery, presentation, or formal sign-off require active external stakeholder execution.
2. **Unable to Verify:** Tasks that depend on interpersonal coordination, multi-developer workspace telemetry, or external communication channels (e.g., meeting logs, live collaborative branching) that cannot be directly inspected within this isolated build environment.
3. **Completed Work:** Tasks verified by working code, automated test executions (92/92 passing), production builds, and database schemas. *Completed work is explicitly not presented as estimated work.*

---

## 2. Item-by-Item Breakdown & Effort Estimates

### A. Individual Roadmap Remaining Work ("My Roadmap · AI App Development")

| Roadmap Item | Status | Confirmed vs. Unable to Verify | Description of Remaining Work | Dependencies & Missing Information | Realistic Effort Estimate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Week 2: Connect your work with the other two team members** | Unable to verify | **Unable to Verify** | Cross-developer contract synchronization, joint code review sessions, and API interface sign-off with the Data Analytics Engineer and SQL/Database Engineer. (Backend schemas and datasets are already integrated into the app, but cross-member git collaboration history is unavailable in this environment). | • Teammate availability & communication channels (Slack/Discord/Email)<br>• Teammate pull requests or branch review logs<br>• Formal inter-team interface sign-off meeting | **2 – 4 Hours** |
| **Week 3: Prepare and deliver the product demo** | Partially completed | **Confirmed Remaining Work** | The software demo foundation is 100% operational (role-based personas, telemetry simulation, 400-machine fleet filtering, incident creation/close lifecycle, AI diagnostic drawer). Remaining work consists of drafting the oral presentation script, preparing demonstration slide deck, and delivering the live interactive demo to program mentors. | • Program presentation guidelines & duration limits<br>• Evaluator rubric and schedule<br>• Presentation slide template | **3 – 5 Hours** |
| **Week 3: Showcase your working output in the team V1 demo** | Partially completed | **Confirmed Remaining Work** | The production application is compiled and actively running on port 3000. Remaining work involves participating in the live team presentation meeting and walking evaluators through the frontend AI App features alongside teammate contributions. | • Unified team rehearsal meeting<br>• Confirmed demonstration time slot with evaluators | **2 – 3 Hours** |

---

### B. Team Roadmap Remaining Work ("Overall Team Roadmap")

| Roadmap Item | Status | Confirmed vs. Unable to Verify | Description of Remaining Work | Dependencies & Missing Information | Realistic Effort Estimate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Week 3: Showcase the working V1 Phase 1 application** | Partially completed | **Confirmed Remaining Work** | The complete software stack (React frontend, FastAPI server, MySQL relational schema, 4 empirical datasets, 400 verified CNC machines) is built and passing 92 automated tests. Remaining work entails conducting the formal Phase 1 team capstone showcase with instructors and evaluators. | • Final presentation agenda and dial-in link<br>• Program evaluation criteria and Q&A session allocation | **2 – 4 Hours** |

---

## 3. Detailed Task Descriptions & Risk Assessment

### Task 1: Cross-Member Interface Synchronization
- **Category:** Unable to Verify (Collaborative Governance)
- **Work Required:**
  - Verify that the FastAPI endpoints (`api_server/main.py`) match any newly updated data science pipelines developed by the Data Analytics teammate.
  - Confirm that the 5 analytical SQL views in `scripts/export_mysql_schema.sql` align with any reporting queries requested by the Database teammate.
- **Risk & Mitigation:**
  - *Risk:* Divergent schema assumptions between teammates.
  - *Mitigation:* The application already implements standard, hardened schemas and provides comprehensive test suites (`tests/test_fastapi_server.py`, `tests/test_live_database_engine.py`) as unambiguous API contracts.

### Task 2: Product Demo Preparation & Dry Run
- **Category:** Confirmed Remaining Work (Individual Delivery)
- **Work Required:**
  - Construct a structured 10-minute presentation covering:
    1. Problem Statement: Machine downtime and sensor data complexity in 400-machine CNC facilities.
    2. Architecture: React SPA + Tailwind CSS + FastAPI Python API + MySQL relational storage.
    3. Live Demo:
       - Operator persona: restricted view to assigned machine (`CNC-MILL-01`), live telemetry graphs, anomaly reporting.
       - Supervisor persona: plant-level multi-filtering across Plants A, B, C, D, incident triage and assignment.
       - Maintenance persona: investigation dossier, AI-assisted root cause hypotheses with mandatory safety disclaimers, work order management.
       - Admin persona: user roster administration, role configuration, fleet inventory audit.
    4. Dataset Provenance: Empirical validation across Datasets 1, 2, 3, and 4 (28,920 rows).
- **Risk & Mitigation:**
  - *Risk:* Network latency or browser display discrepancies during live demo.
  - *Mitigation:* The application utilizes cached offline seed data (`src/data/seedData.ts` and `src/data/machinesData.ts`) alongside live API routes, guaranteeing 100% demo reliability without third-party service dependencies.

### Task 3: Team Capstone Showcase Delivery
- **Category:** Confirmed Remaining Work (Team Delivery)
- **Work Required:**
  - Conduct a full dry-run with all 3 teammates.
  - Coordinate speaker transitions between Data Analytics (ETL & statistics), Database (SQL views & schema), and AI App Development (UI, RBAC & Generative AI).
  - Participate in post-presentation technical Q&A.

---

## 4. Summary of Estimated Remaining Hours

| Responsibility Scope | Confirmed Remaining Hours | Unverified Coordination Hours | Total Projected Effort |
| :--- | :--- | :--- | :--- |
| **Individual (AI App Dev)** | 5 – 8 Hours | 2 – 4 Hours | **7 – 12 Hours** |
| **Unified Team** | 2 – 4 Hours | 0 Hours | **2 – 4 Hours** |
| **Total Phase 1 Completion** | **7 – 12 Hours** | **2 – 4 Hours** | **9 – 16 Hours** |

*Note: All core engineering, coding, data modeling, algorithm integration, and automated verification tasks for Phase 1 are 100% finished and verified in the FactoryPulse codebase.*
