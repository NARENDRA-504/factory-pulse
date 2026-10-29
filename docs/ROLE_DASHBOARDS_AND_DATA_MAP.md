# FactoryPulse role dashboards and data map

## Scope and presentation

FactoryPulse provides five role dashboards: Operator, Supervisor, Maintenance, Manager, and Admin. There is no Super Admin role. All five use the same light, high-contrast visual system, with role-appropriate navigation, compact metrics, clear filters, responsive cards, and plain-language explanations. The visuals are native FactoryPulse UI; they are not a Microsoft Power BI connection.

## Role views

| Role | Dashboard focus and available actions | Data-backed visuals | Requested measures that remain unavailable |
|---|---|---|---|
| Operator | Assigned workstation, live execution and issue reporting | Login banner shows authenticated operator, machine/station, current shift label and session start; assigned-machine status, exact-unit sensor meters/history, incident queue | Session start is not a shift attendance/login record. Production target/actual, cycle time, good/scrap counts and shift output remain unavailable until production events and targets are supplied |
| Supervisor | Plant and line/bay oversight, prioritize and assign response | Plant and line filters; machine-condition heatmap from latest persisted status; reporting coverage; prioritized open incidents/work orders | OEE, hourly output vs target, downtime-cause Pareto and operator allocation/check-in matrix require real production, downtime-reason and attendance/allocation records |
| Maintenance | Diagnose selected equipment and act on assigned work | Machine selector; current telemetry and saved trends; severity-ordered fault queue; work-order status/actions; observed downtime intervals where supported by history | Pressure when the Simulator does not send it; MTBF/MTTR and technician response timing require complete failure, repair, assignment and acknowledgement timestamps |
| Manager | Plant comparisons, macro condition and decisions needing attention | Plant and production-line condition comparisons show normal/warning/down-or-critical/unreported roster counts, plus open risks and reporting coverage | Line comparison is machine condition only, not output/OEE. Day/week/month OEE, yield/scrap cost, downtime loss and energy per unit need verified production, cycle standard, cost and meter sources |
| Admin | People/access, machine allocation, incident oversight, audit and connectivity | User/role administration, machine registry, Admin-only Activity Log, backend/MySQL/receiver health indicators | Power BI source/refresh remains unverified. IP/device fields are stored only when optional audit columns are installed; old rows can be null. Manual-override event type and role-usage analytics are not currently populated |

## Data lineage and mappings

| UI value | Authoritative source | Mapping / interpretation |
|---|---|---|
| Employee, role, shift, assigned machine | MySQL `users`; authenticated session in `auth_sessions` | Role and assignment are read server-side. The operator banner displays authenticated session start from `auth_sessions.created_at_utc`; UTC is stored, browser renders local time. This is not proof of shift attendance. |
| Login/logout/failed login/session expiry and business changes | MySQL `activity_log`, written transactionally with the related action where supported | Employee ID/name, role at event, UTC timestamp, session ID and request ID when available. IP/device are written only if optional audit columns have been applied; older rows may have no values. Manual-override event type is not configured. |
| Machine identity, plant, line, type and limits | Canonical catalog `public/machine-name.json`, plus registered SQL `machines` records | `machine_id` is the Simulator key (for example `MCH-001`); machine code is the FactoryPulse work-station label. The catalog is not proof that a machine is registered in SQL. |
| Current and historical sensor values | AI Simulator sender -> `POST /api/v1/telemetry` -> MySQL `simulator_sensor_readings` | One source record per sensor; `reading_id` deduplicates retries. `sensor_name`, `sensor_unit`, value, expected bounds, machine status, quality, and timestamp are preserved. UTC timestamp is used for ordering. |
| Latest sensor status by stream | `simulator_sensor_latest` / `v_factorypulse_latest_readings` when migration trigger and view are present | Pointer to the newest `(machine_id, sensor_name)` record, ordered by timestamp and row ID tie-break. Underlying history remains in `simulator_sensor_readings`. |
| Incidents and maintenance work | MySQL `incidents`, `incident_logs`, `maintenance_work_orders` | Queues and status/assignment actions come from operational records. Sensor snapshot is retained when recorded. Unsupported measurements remain null/unavailable; RPM, current, or vibration velocity are never converted to unrelated metrics. |
| Recorded downtime | Persisted machine-status history through the downtime API | Only explicit `STOPPED` status intervals inside observed readings count. Missing communications are not interpreted as downtime; logical analysis rounds are not production cycles. |
| Production/OEE/quality/energy/financial values | No verified operational source currently mapped | Do not infer values from synthetic dashboard seed data, machine count, telemetry-only status, research datasets, or historical/unverified Power BI views. Show unavailable until real source tables and definitions are connected. |
| Power BI | Repository report artifacts/configuration | No verified report refresh/source connection is represented by this UI. Admin status is explicitly “Unverified”. |

## Prepared schema additions (not applied)

The following additive SQL files are proposals for review by the schema owner. They have not been applied or validated against the live MySQL server; the DML-only runtime account must not run them.

| File | Proposed source coverage | Runtime status |
|---|---|---|
| `scripts/migrations/20261028_role_dashboard_operational_sources.sql` | Production targets/events, explicit downtime reason intervals, line/shift operator allocation, optional session/audit IP/device and changed-resource context | Prepared only; do not assume tables/columns exist |
| `scripts/migrations/20261028_role_dashboard_kpi_extensions.sql` | Effective-dated ideal cycle standards, maintenance failure/acknowledgement/repair/resolution events, kWh meter intervals and approved cost rates with currency | Prepared only; no sample data; do not assume tables exist |

Even after approval/application, these tables need actual source integrations and verified definitions before a dashboard can display the metrics as live. No target, cost rate, energy usage, attendance, alarm reason or Power BI refresh is invented here.

## Integration boundaries

- MySQL is the source of truth for operational machines, telemetry, incidents, work orders, sessions, and audit events.
- The separate AI Simulator sends sensor readings to the FactoryPulse API; it is not merged into this project folder.
- Supabase, if configured, is only for notification delivery. It does not query, proxy, mutate, or replicate operational MySQL data and is not in the Jupyter or Power BI path.
- Gemini is optional and must be explicitly enabled per machine question. Local SQL-grounded answers remain available without it. Credentials and personnel records are never sent to the model.

## Access and interaction rules

- Operator telemetry is restricted to the server-assigned machine, even if a client changes filters or route parameters.
- Supervisor, Maintenance, Manager, and Admin filters affect only records allowed by backend role/plant policy.
- User/role management and Activity Log remain Admin-only. The Activity Log is a business audit feature, not a device-monitoring log.
- Unavailable measures must be labeled as unavailable and must not be filled with demo values or guessed calculations.
