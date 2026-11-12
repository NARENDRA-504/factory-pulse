# FactoryPulse SOP and RAG review preview

Prepared: 11 November 2026. Status: proposed training design, not an approved machine procedure or a deployed ML capability.

## What each component does

- SOP: reviewed instructions describing who should respond and which approved procedure to follow.
- RAG: retrieves matching SOP passages and explains them alongside authorized machine evidence, with sources.
- Detection: machine-specific configured rules and, later, a validated model determine abnormality. RAG does not diagnose a fault or assign severity on its own.
- Routing: application logic selects the responsible people from trusted assignments. The language model does not select notification recipients or change records.

The current app has general role/module guidance and local document retrieval. The automatic machine-specific severity/SOP workflow below is a proposed extension. This preview does not change live alert rules, notifications, machine controls, MySQL or the Simulator.

## Example SOP document

**Document ID:** FP-SOP-TEMP-001  
**Title:** Elevated machine temperature response  
**Revision:** Draft 0.1  
**Approval:** Training draft; mentor/equipment-owner review pending  
**Applies to:** Machines explicitly assigned this procedure after review  
**Measurement:** The configured temperature sensor, in its recorded unit. Machine and motor temperatures must not be substituted for one another.  
**Trigger:** A validated detector reports Suspect, or a configured approved critical temperature rule reports Critical. Numeric limits, persistence and reset criteria must come from the applicable equipment/site specification. None are approved by this draft.

### Operator steps

1. Confirm the machine identifier, sensor name, timestamp, unit and data-quality flag shown in the alert.
2. Follow the approved equipment/site response procedure. Report the observed condition and symptoms to the assigned supervisor. Do not bypass an interlock or attempt unauthorized repair.
3. Attach relevant reading references to the incident. Follow the authorized handover and restart process; an app status clearing does not authorize restart.

### Supervisor steps

1. Confirm which workstation and operator are affected and review the evidence and alert level.
2. Assign the concern to the responsible maintenance team, prioritize the response and coordinate coverage under the approved site process.
3. For Critical alerts, notify the responsible plant manager. Confirm the required inspection and authorization before accepting resolution.

### Maintenance steps

1. Review the assigned incident, reading history and relevant equipment documentation.
2. Use the site-approved isolation and inspection procedure. This draft does not prescribe electrical, mechanical, isolation or restart operations.
3. Record findings, actions and verification results. Resolve the incident only after the required authorization and linked work-order updates.

### Manager steps for Critical alerts

1. Review the affected production scope and the assigned response owner.
2. Coordinate operational escalation and recovery decisions with the supervisor and maintenance lead.
3. Track investigation and resolution. The model provides no cost estimate or repair/replacement decision.

### Source requirements

Before this draft can become an actionable equipment SOP, add the equipment/manual reference, applicable machine identifiers, approving owner, effective date, approved limits, reset conditions and the exact approved operating response. Retain revision history. Until then, show it as training guidance and say that an approved machine-specific procedure is unavailable.

## Proposed severity and recipient policy

| State | On-screen behavior | Proposed recipients |
|---|---|---|
| Normal | Current readings and general guidance | No abnormality notification |
| Suspect | Evidence, observation duration and matching role-specific SOP | Assigned machine Operator, assigned Supervisor, responsible Maintenance team |
| Critical | Prominent alert, incident reference and matching response instructions | Same responsible team plus responsible Plant Manager |
| Unavailable / stale / invalid | Data-quality or connectivity notice; no healthy-state claim | Route to the configured data/system owner; distinct from machine abnormality |

Admin is not a default machine-abnormality recipient. Admin receives relevant system/access issues. Missing ownership must be surfaced, with a configured escalation fallback rather than broadcast access to everyone. Maintenance permissions and plant/team assignments must be enforced server-side.

Suspect alerts should meet configured persistence criteria. Repeat notifications for the same active event should be deduplicated; escalation to Critical must still be delivered. Approved critical-limit rules should be evaluated independently of model availability. Recovery requires configured hysteresis/persistence and any necessary human verification. No time durations or numeric safety thresholds are invented here.

## Example on-screen card

**SUSPECT — Temperature pattern requires review**  
Machine: MCH-001 / CNC-5AX-001  
Evidence: timestamped temperature readings and their identifiers would appear here.  
Detection source: validated model or configured rule, explicitly identified.  
Data freshness: age and data quality shown with the evidence.  
Procedure: FP-SOP-TEMP-001, Draft 0.1 — training guidance; approval pending.

**Operator — what to do next**

1. Confirm that the alert refers to your assigned machine and the intended temperature sensor.
2. Report the observed condition to your supervisor and follow the approved site response procedure.
3. Record symptoms and hand over to the assigned response team.

**Sent to:** authorized assigned Operator, Supervisor and Maintenance recipients would be listed only after actual delivery status is known. This preview sends nothing.

**Source:** FP-SOP-TEMP-001, Operator steps 1–3. No approved machine-specific limits or operating response are supplied by this training draft.

Do not show a fabricated value, model probability, diagnosis, timestamp, notification success or approval badge.

## Example RAG conversation

**Operator:** My machine has a temperature warning. What should I do?

**Assistant:** The detector has flagged a temperature concern for your assigned machine. Here are the supporting readings and detection source [reading references]. Check the machine and sensor identity, then follow the approved site response and report the observed condition to your supervisor [FP-SOP-TEMP-001, Operator steps 1–3]. The available document is a training draft; an approved equipment-specific response has not been provided. I cannot confirm the cause or authorize a repair or restart.

The opening detection statement is allowed only when a real, authorized detector event exists. Without that evidence, reply: “I cannot verify an active temperature warning. I can show general guidance or the approved procedure if one is available.”

## Retrieval and response contract

1. Authenticate the user and resolve the selected machine within the user's server-authorized scope.
2. Read the detector event and fresh permitted sensor evidence. Record rule/model version and event timestamps.
3. Filter SOPs by applicability, approval, current revision, fault category and role before retrieval. A similarly named document for another machine is not sufficient.
4. Retrieve the matching passages and build the answer from those passages and recorded evidence. Treat document text as reference material, not executable instructions.
5. Show document ID, revision, section and reading references. Separate confirmed observations from unknown cause or tentative model output.
6. If an approved procedure is missing, mismatched or withdrawn, report that gap. Do not invent thresholds or repair instructions.
7. Notification and incident actions remain deterministic server operations, separate from the read-only RAG answer.

## Acceptance checks before activating automatic suggestions

- Operator cannot retrieve another machine's private readings.
- Supervisor receives only alerts for their assigned scope.
- Normal produces no abnormality notification.
- Suspect notifies the responsible team without notifying all users.
- Critical escalation reaches the responsible manager without duplicate incident creation.
- Stale or invalid readings do not produce a Normal/healthy claim.
- Missing/failed model does not suppress approved critical-limit rules.
- Wrong-machine, expired and unapproved SOPs cannot appear as approved operating instructions.
- Repeated events are deduplicated; changed severity is retained.
- Each answer displays actual source references and handles missing SOPs explicitly.

## Implementation order

First review this document and supply approved machine-specific SOP content. Build and test the SOP applicability/revision catalog and read-only retrieval. Separately train and validate Normal/Suspect/Critical detection against suitable machine-health data. Then connect the deployed detector events to role routing, incident handling and SOP cards, with end-to-end verification. The existing defective-part practice dataset is not a machine-failure forecasting dataset.
