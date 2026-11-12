# Maintenance ticket resolution

Maintenance staff now have a **Complete repair & close ticket** panel on the dashboard (both report and overview views) and Maintenance Orders page. It lists only open incidents assigned to the signed-in technician. Choose **Close ticket · Resolve incident**, enter repair/verification notes, and confirm. Unassigned incidents need supervisor assignment first.

The existing MySQL incident-close transaction saves `Closed`, closure notes, closing employee and UTC closure timestamp, completes linked work orders, and records audit events. The UI presents Closed as **Resolved** in the incident list. The same database record is read by every role within its existing authorized machine/team scope. The current browser refreshes immediately after resolution; other sessions poll every 10 seconds. No new status enum or database migration is needed.

Completing an individual work order alone remains separate and is labeled **Complete order only**. Use the close-ticket panel to resolve the incident as well. Closing an incident does not change machine telemetry, restart equipment, clear a physical fault or count as preventive-service completion. Persistent abnormal readings may generate a new incident under the existing fault rules.

Server permissions remain Supervisor or assigned Maintenance technician for incident closure. Operators, Managers, Admins and other technicians cannot use this action. Whitespace-only notes are rejected. Duplicate closure returns a conflict instead of rewriting the original sign-off.

## Verified 3 November 2026

- Two note-validation unit tests passed.
- Actual local MySQL transaction test: assigned technician closure, linked order completion, audit record, all five roles reading/listing the resolved incident, forbidden role/other technician rejection, empty notes rejection and duplicate-close conflict passed. All QA business writes were rolled back. Role authorization was exercised with test dependency overrides, not other employees' passwords.
- Headless browser: actual Maintenance login and panel visible; browser-only incident fixture checked confirmation, required notes, exact close request, resolved feedback and queue removal. No real incident was closed by the browser test. No page errors or mobile horizontal overflow.
- TypeScript check and production build passed; existing Vite configuration and large-bundle warnings remain.
- Only the FactoryPulse API was restarted to load note validation. Simulator was not restarted or modified.
