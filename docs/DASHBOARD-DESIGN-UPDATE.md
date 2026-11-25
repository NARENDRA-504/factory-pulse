# Dashboard design update — 23 November 2026

Design reference: Microsoft Power BI dashboard guidance, https://learn.microsoft.com/power-bi/create-reports/service-dashboards-design-tips . This is a native FactoryPulse interface update, not a new Microsoft Power BI integration.

The shared light canvas now has a compact role masthead, scope summary, primary next action and accessible focus states. Operator uses teal for workstation execution; Supervisor uses amber for shift coordination; Maintenance uses violet for repair work; Manager uses blue for plant comparisons; Admin and Super Admin use blue-teal for governance. Warning and Critical meaning still uses the existing status colors.

Scope summaries count only the machines returned for the signed-in role. Operator incident counts additionally match the assigned station. Scope counts are roster/incident records, not fabricated production or online-machine statistics. Primary actions open existing authorized screens: reporting, incident prioritization, maintenance queue, analytics or user management.

Report filters now open on demand as a horizontal responsive panel. Plant, line, machine radio slicers and historical date-window controls retain their existing state, authorization and requests. Clear filters and Return to live still operate as before. Collapsing filters does not clear them. The compact report context retains the latest timestamp and live/last-saved/historical status. Charts use the available page width rather than a permanent narrow slicer column. Removed the duplicate report banner.

Operator motor load now uses a compact horizontal comparison with a numerical value, 0–100% display scale and actual configured expected bounds. Values beyond the scale remain visible numerically; the graphic is clipped to its scale. The source's torque-proxy qualification remains visible. Existing independent sensor histories, bars, donuts and role-specific workspaces retain their datasets and calculations.

Validation: TypeScript and production build passed. Twelve existing chart/production/report calculations passed. Four actual workplace accounts (Operator, Supervisor, Maintenance, Manager) signed in, rendered on 1440px desktop and 390px mobile, and had no page errors/overflow; report filter show/hide passed where the report tab exists. Six-role masthead fixtures verified primary-action targets and Operator incident scoping, including Admin/Super Admin. Those Admin fixtures are not actual Admin sign-in evidence.

Final read-only preflight passed all eight service/SQL checks. Both apps remain READY_IDLE with zero running Simulator machines and paused delivery. No schema, API contract, account, password, sender, model, operational calculation or telemetry record was changed by this design pass. Sign-in/out checks create ordinary audit events. A fresh live transfer was not generated for a frontend-only change.
