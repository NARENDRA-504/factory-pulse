# Sensor reliability, authorized alerts and SOP revision acknowledgement

Implemented 12 November 2026. No telemetry ingestion contract, Simulator source, account, environment file or database privilege was changed. No migration is required.

## Using the features

1. **Machine Readings / Machine Health**, or **Pipeline & Health**: Sensor reliability lists the selected machine's seven common physical channels. It checks observation age, quality, finite numeric values and exact units. Missing readings, future timestamps and unit mismatches are separate issues. On selecting a machine, up to 121 observations per channel from the last 120 seconds are checked for unchanged output.
2. **Notification bell**: the active inbox now comes from authenticated MySQL queries, refreshed five seconds after each completed request. It replaces the browser-local role-only notification path in the main app. It never trusts a client-provided role, department or machine list. The bell counts open incidents not acknowledged by the current account in its available acknowledgement history.
3. **Incident details → Response steps & relevant SOP**: read the applicable steps and their revision/approval status, enter a note, then use **Record guidance read**. The server verifies the document ID and content hash are still applicable and records the revision, hash, approval status and actor in MySQL audit history. An acknowledgement does not close an incident or authorize restart.
4. **Maintenance Orders**, or **Pipeline & Health** for non-Operators: Maintenance results shows recorded open/resolved incidents, mean elapsed report-to-resolution, mean first recorded acknowledgement and repeated machine/component report counts. Use 7/30/90-day windows.

## Alert routing

- Operator: Medium/High (shown as Suspect) and Critical incidents for the assigned machine only.
- Supervisor: Suspect and Critical incidents for the server-configured team machines only.
- Maintenance: Suspect and Critical incidents that are unassigned or assigned to that technician, consistent with existing incident permissions.
- Manager: Critical escalations only in the alert inbox; existing incident/analytics access is unchanged.
- Admin / Super Admin: operational oversight of all severities.

These are **committed incident notifications**. The inbox does not invent diagnoses or classify raw readings using ML. Existing opt-in sustained threshold automation remains separate and retains its policy. Its validation now rejects wrong units and malformed/nonfinite bounds before creating an automatic incident. Database commit precedes notification visibility. No email, mobile push, guaranteed instantaneous notification, or Supabase delivery is claimed. The old local-only cloud configuration drawer is no longer part of the active notification center; Supabase remains outside MySQL, notebook and Power BI data paths.

## Honest measurement limits

The common channel contract is RPM, Temperature, Motor Temperature, Vibration, Pressure, Current and Coolant Flow. This is the existing pipeline's common set, not a universal hardware specification. Missing/stale data does not prove physical disconnection. Identical GOOD values over at least 60 seconds and ten observations while NORMAL generate **unchanged review**, not a confirmed frozen-sensor fault. Stable pressure or RPM can legitimately be constant. These reliability checks create no incidents and control no equipment.

Maintenance durations are from incident creation to closure, including waiting/investigation. They are not hands-on repair time, proven MTTR or MTBF. No repair/replacement cost or downtime saving is fabricated. Recurrence means repeated machine/component reports, not a confirmed common root cause. Future/negative closure dates are excluded. Only incidents created within the selected window are included, capped at 5,000. First acknowledgement history is bounded to the latest 1,000 acknowledgement events. Partial coverage is displayed; old unlinked events cannot be reconstructed.

The inbox is capped at 100 open incidents, with Critical first. Per-account acknowledgement history is capped at 1,000 events. Resolved incidents disappear from the active inbox after refresh and remain in incident/work-order history. No existing records were deleted.

## SOP approval boundary

The catalog already supports explicit machine mappings, approver, equipment manual reference, effective date and review due date. The interface now exposes those available fields and records the exact document read. Existing training documents remain **training**: no factory procedure, approver or manufacturer instruction was fabricated. To supply approved procedures, provide the actual machine-specific manual/procedure and approver details for review and mapping. Approval remains a human responsibility. The existing ML model remains shadow-only and sends no automatic alerts.

## Verification

- Targeted backend suite: 60 tests passed, including role scopes, closed-incident exclusion, wrong-unit threshold rejection, missing/stale/nonfinite channels, unchanged-review conditions, no-data metrics and SOP hash mismatch rejection.
- Real read-only MySQL checks: 40 machines, 280 common-channel checks, all fresh; selected-machine historical checks succeeded. Inbox and maintenance queries succeeded for all six available roles, with Operator/Supervisor scopes checked and Manager limited to Critical alerts.
- Real SOP acknowledgement transaction verified revision/hash/status persistence and no incident closure, then rolled back. No test business event was retained.
- Browser component checks exercised alert acknowledgement, SOP hash submission and desktop/mobile layout with mocked APIs. Screenshots are test fixtures, not live production evidence.
- TypeScript and production build passed; existing Vite configuration/bundle size warnings remain.
- Final read-only presentation check passed for both web/API services, MySQL, 40 fresh machines and advancing saved reading IDs over six seconds.

Local URLs: FactoryPulse http://localhost:3000/ and Simulator http://127.0.0.1:5174/ . No Git push was performed.
