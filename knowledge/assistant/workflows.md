# Incident and maintenance workflow
An operator reports a concern for the assigned machine. An authorized supervisor prioritizes and assigns the incident. The assigned technician records investigation and repair findings. Resolving a ticket requires meaningful verification notes and confirmation. The incident closure transaction also completes linked work orders and writes audit events. Closed incidents display as Resolved. A completed work order alone is not necessarily a resolved incident. This workflow does not certify that a physical repair occurred.

# Service intervals
Service plans may use a calendar due date, inspection checklist, observed running hours and completed parts. Observed usage starts from a recorded baseline and can undercount missing intervals; it is not lifetime machine usage. Explicit service completion resets the observed usage interval without silently moving the calendar due date. Unconfigured service intervals remain unavailable. Use equipment-maker approved intervals for real maintenance decisions.

# Access and data sources
Operators can access their assigned machine. Supervisors can access only their configured teams. Maintenance, Manager and Admin retain their server-authorized scope. The assistant is read-only and cannot control equipment or change accounts. MySQL is the operational source of truth. The separate sender generates modeled telemetry. Power BI Desktop Import reports need manual Refresh; app polling does not refresh a PBIX report. Supabase is reserved for notifications and does not proxy MySQL queries.
