# FactoryPulse — User Walkthrough

Prepared 30 October 2026.

This guide describes the application's role navigation, operational pages, charts and common workflows. It is based on the GitHub source and screenshots supplied in this chat. Local services and database connections could not be verified during preparation.

## 1. What FactoryPulse does

FactoryPulse brings machine condition, production progress, incident handling, maintenance work and account administration into one interface. Each employee signs in and receives a workspace suited to their role.

The intended operational data path is:

**AI Simulator → FactoryPulse receiver → MySQL → authorized dashboard/API → charts.**

The Simulator generates readings and keeps its own SQLite delivery queue. FactoryPulse stores accepted readings in MySQL. Dashboard refreshes request those saved records. A moving chart therefore depends on new readings reaching MySQL successfully; opening a browser page alone does not start production or telemetry generation.

The dashboard visuals are built into the web app. A Power BI-style appearance does not establish a Microsoft Power BI connection. The repository's analytics page explicitly reports that no Power BI report is present.

## 2. Sign in and find your way around

1. Open the main app at **http://localhost:3000/** when its local services are running.
2. Enter your assigned employee ID and password. The employee ID is converted to uppercase by the sign-in form.
3. Use the eye icon to reveal or hide the password you are typing.
4. Select **Continue to FactoryPulse**. Successful authentication opens your role's dashboard.
5. Use the left sidebar to move between pages. On smaller screens, use the menu button to open the sidebar.
6. Open your profile to review your employee identity, assigned station and allowed permissions.
7. Use **Log Out** when finishing your session.

The login illustration is decorative. Its animation is independent of machine activity. Your role comes from your account; it is not chosen from a public role picker.

### Shared controls

| Control | Purpose | How to interpret it |
|---|---|---|
| Refresh | Reload operational information | This requests data; it does not generate readings. |
| Report Problem | Open an incident-report form | Check the target machine before submitting. Role authorization still applies. |
| Notification bell | Open notifications | Where available, acknowledge, dismiss or open the related machine/incident. Acknowledging is not the same as resolving an incident. |
| Profile | Review your identity and access | Shows allowed permissions and account details. |
| Machine assistant | Ask machine and production questions | Uses the permitted machine or fleet context. See section 9. |
| Plant, line, type and machine selectors | Focus a page on a relevant subset | Available filters vary by role and page. |

## 3. Operator walkthrough

The Operator menu contains **My Production**, **Machine Readings** and **Report an Incident**.

### My Production

Start with the identity banner: operator name and ID, machine ID/station, shift label and session start. Confirm that the assigned machine is the machine you intend to monitor. An assignment mismatch can prevent another station's readings from appearing.

The production panel explains the shift using:

- **Total parts produced:** good parts plus scrap/rejected parts.
- **Good parts:** the latest saved acceptable-part counter.
- **Scrap/rejected parts:** the latest saved rejected-part counter.
- **Shift target:** the planned count supplied in the production data.
- **Good-part production rate:** a rate derived from a period of saved good-part counters. The UI needs at least one minute of suitable history.
- **Cycle time:** the latest time per cycle, alongside the configured target.
- **Production progress:** a visual comparison between actual output and target.
- **Shift quality mix:** a doughnut chart showing good versus scrap parts.
- **Recent machine alarms:** open incident reports for the assigned station.

For the requested 12-hour, 120-part plan, the planned average is **10 parts/hour**, or **one part every 6 minutes = 360 seconds**. Confirm the saved target and cycle values match this plan. Parts should not rise every second merely because sensor samples arrive every second.

Production counters from the current Simulator are modeled values. Their presence in MySQL confirms storage, but does not turn them into verified physical factory output. Historical counter snapshots must not be summed as though every snapshot represents additional parts.

### Session and downtime

**My session & machine downtime** shows the operator ID, login time, elapsed session duration and assigned station. Session duration records time since sign-in; it does not establish attendance or productive machine time.

Choose **Last 15 minutes**, **Last hour** or **Last 24 hours** to inspect recorded machine stops. Downtime uses explicit recorded STOPPED intervals and the backend's interval rules. The round chart divides the analysis into reporting windows; a reporting round is not a manufacturing cycle.

**My operator activity log** shows this employee's recent account events, their timestamps and the role recorded at the time. Other employees' account logs belong in the Admin workspace.

### Machine Readings

Open this page for the assigned machine's individual sensor charts. Each sensor has its own fixed chart position. New values update that sensor's graph rather than automatically replacing it with a different measurement.

Read the current value, unit, expected range, quality flag and saved timestamp together. Hover over a chart point to inspect its recorded value. Available signals can include temperature, motor temperature, vibration, pressure, RPM, current, coolant flow, torque, voltage and production-related counters. A signal appears only when supported and received.

### Report an Incident

1. Open **Report an Incident** or **Report Problem**.
2. Confirm the permitted target machine.
3. Select severity: Low, Medium, High or Critical.
4. Describe the component/subsystem and observed symptom.
5. Add useful operator notes and submit.
6. Open the resulting ticket and check its status. When attached, the sensor evidence is a saved snapshot from report time.

Follow workplace safety procedures for urgent hazards; submitting an app ticket is not an equipment safety interlock.

## 4. Supervisor walkthrough

The Supervisor menu contains **My Machines**, **Production & Operators**, **Machine Health** and **Line Reports**, with **Incidents & Priorities** and **Work Orders** as supporting pages.

### My Machines and Machine Health

Use plant and line/bay selectors to focus the workspace. The line condition heatmap shows the newest saved status for each machine. A machine without a report should remain identifiable as having no data.

The dashboard includes reporting-machine counts, normal and warning/critical counts, open incident totals, output/target summaries, a response queue, machine status charts and individual sensor trends. Use the response queue to identify the highest-priority recorded issues, then open the relevant operational page.

### Production & Operators

Compare each machine's latest good-plus-scrap count with its shift target. The good/scrap doughnut explains the selected production mix. The allocation table shows machine code/ID, line, assigned operator, shift and reported status where supplied.

Allocation is not proof that an employee is currently present. The inspected page explicitly says attendance and supervisor ownership are not recorded by the current allocation API. Do not describe automatic four-machine supervisor ownership as verified from this view.

### Incidents & Priorities

Filter by status and severity or search for a ticket/machine. Open a ticket to inspect its description and saved evidence. Supervisors have an assignment action for open tickets that lists active maintenance technicians. Choose the technician and confirm the assignment.

### Line Reports

Review work orders by status, incident severity and recorded repair notes. Use **Open work orders** to move into the detailed queue. These reports describe recorded workflow history; a chart does not establish an externally refreshed Power BI report.

## 5. Maintenance walkthrough

The Maintenance menu contains **Work Overview**, **Assigned Work**, **Equipment Diagnostics**, **Active Faults** and **Work History**.

1. Open **Work Overview** to identify current faults and incomplete work.
2. Open **Assigned Work**. Search by work-order code, machine, technician or repair notes. Filter by status or priority.
3. Open **Equipment Diagnostics** for saved sensor trends and the machine's recorded condition.
4. Record inspection findings and actions taken through the available progress/update controls.
5. Update the work order from Pending to In Progress and then Completed when the required work is done.
6. Return to the incident and record closure verification where permitted.
7. Review **Work History** for recorded order states and repair notes.

Work-order statuses shown in the inspected page are **Pending**, **In Progress** and **Completed**. Priorities are **Low**, **Medium** and **Urgent**. Incident severity and work-order priority are different fields.

The incident page permits Maintenance to record progress and provides closure controls for Maintenance and Supervisors. Confirm actual machine readiness before closing a ticket. Completing a work order and closing its incident are separate workflow actions unless the backend explicitly links them.

MTBF means average operating time between qualifying failures. MTTR means average repair/restoration time for qualifying events. These require complete, consistently defined records. Some research analytics displays include fallback figures, so do not present every displayed reliability number as a live plant measurement.

## 6. Manager walkthrough

The Manager menu contains **Downtime Overview**, **Production Comparisons**, **Team & Assignments**, **Output & Production Rate**, **Part Quality** and **Machine Health**, plus **Incidents & Priorities** and **Work Orders**.

| Page | What it helps you decide | Important limitation |
|---|---|---|
| Downtime Overview | Which machines currently need attention? | Current condition and incident counts alone do not measure elapsed downtime or financial loss. |
| Production Comparisons | Which machines are closest to their configured targets? | Uses latest saved counters; day/week/month production periods need reset boundaries and historical records. |
| Team & Assignments | Which operator/shift is recorded against each machine? | Does not prove attendance or supervisor coverage. |
| Output & Production Rate | How output and machine condition compare in the permitted scope | Rates require enough valid history. |
| Part Quality | How good-part share and scrap mix compare | Missing counters must remain unavailable. |
| Machine Health | Which recorded signals or statuses need investigation? | A status snapshot is not a diagnosis or safety certification. |

Financial scrap cost, downtime revenue loss, energy per finished unit and complete OEE require approved cost/rate inputs, production periods, operating schedules and energy measurements. Do not infer them from an RPM reading or substitute derived shaft power for electrical consumption.

## 7. Admin walkthrough

The Admin menu contains **System Overview**, **People & Role Access**, **Machine Management**, **Incident Oversight** and **Activity Log**, with **Machine Diagnostics** and **Work Orders** available as supporting pages.

### People & Role Access

Search by employee name, work ID, machine or email. Review team-by-role and shift-coverage charts, inspect a profile, or edit personnel details.

To add an account, complete the available name, work ID, role, shift, assigned machine, department and email fields, set an initial password, choose active access and save. The form offers Operator, Supervisor, Manager, Maintenance and Admin roles.

To reset a password, edit the employee and enter a new password in **Set a new password**. Leaving that field blank keeps the existing password. The source requires at least 12 characters for a new password and reports that password resets revoke existing sessions.

The eye icon reveals only the new password being typed. Existing stored passwords are one-way hashes and cannot be displayed as a list of original passwords.

Use deactivation to remove sign-in access while retaining account/audit history; the page also offers reactivation. Recheck the saved machine assignment before asking an operator to open another machine's dashboard.

**Shift-label caveat:** the inspected personnel form still labels three eight-hour shifts. The requested 12-hour/120-part production plan must not be confused with these roster labels. Confirm the local configuration before explaining shift scheduling during a presentation.

### Machine Management

Search the inventory by ID, code, name or location. Filter by operating state, type or plant. The page supports refresh and activation/deactivation controls.

Use **Add New Machine** to enter the machine name, optional manufacturer, type, department, location, installation date, initial operating status and optional notes. After saving, confirm the registration success response and the machine's appearance in the inventory.

Registering a machine and receiving readings for it are separate steps. Its sender identity must match the receiver mapping. Confirm that the Simulator knows the new machine before expecting live values. Changing inventory does not by itself prove that every machine is running or delivering data.

### Incident Oversight and Work Orders

Review recorded incidents and maintenance work across the permitted scope. Use status/priority filters to locate incomplete records. Available actions remain role-specific; an Admin page should not be assumed to grant every Supervisor or Maintenance workflow action.

### Activity Log

The log displays recorded event time, employee ID/name, role, event type, captured session duration, IP/device information, session/request identifiers, changed resource and details. Times use the configured factory time zone. Fields that were not captured are shown accordingly.

Use this page to investigate sign-in/sign-out activity and audited operational changes. A missing IP, event or device field cannot be reconstructed from a chart.

### Data Pipeline Status

Where shown, this panel reports backend/MySQL status, machines receiving data, recent event counts, latest ingestion time, stale machines and the reported Power BI connection status. Check timestamps as well as the status label.

## 8. How to explain every chart type

| Chart/control | Meaning | Useful interaction or caution |
|---|---|---|
| Individual line/area trend | A sensor's saved values over time | Hover for timestamp/value. One sample is a current reading, not a trend. |
| Horizontal bar chart | Compare counts or values between machines/categories | Confirm units and whether the data are counts, rates or durations. |
| Actual/target comparison bars | Compare latest output with the planned target | Do not add repeated cumulative snapshots. |
| Stacked/split good-and-scrap bars | Compare production composition by machine | Total = good + scrap for the same counter period. |
| Doughnut/pie | Show category shares, such as status, quality or severity | The center/legend defines the total being divided. |
| Heatmap | Scan status across multiple machines | No data should not be treated as normal operation. |
| Progress bar | Show completion against a target | A completed target does not prove the shift has ended. |
| Range/bullet bar | Place a reading within its own configured bounds | Different units do not share a meaningful numerical scale. |
| KPI tile | Present a current value or aggregate | Check its scope, saved timestamp and calculation basis. |
| Slicer/filter | Change the records included in a view | A filter narrows available access; it does not grant access. |

Common units include **°C** temperature, **mm/s** vibration velocity, **RPM** rotation speed, **bar** pressure, **A** current, **V** voltage, **L/min** coolant flow, **Nm** torque, **kW** power, **s/cycle** cycle time and **parts/hour** production rate. Vibration velocity in mm/s must not be described as acceleration in m/s².

The current source describes Motor Power as derived shaft power from torque and RPM, and Motor Load as a torque-range estimate. These should not be presented as measured electrical input power or measured VFD load.

The live telemetry page requests current data every second and describes detailed history refreshing every two seconds. Other operational pages use different schedules. Those intervals are polling settings, not a guaranteed end-to-end delivery time.

## 9. Machine and production assistant

Open the floating **Machine assistant** button. Ask a focused question about the selected machine or your authorized fleet, such as “What is the latest temperature?” or “How is this machine progressing against its target?”

The chat is available to every role, while machine access follows account permissions. Changing machine resets the page's chat context. Use the clear button to clear the conversation. Answers cannot control equipment.

The optional **Use Gemini for my next question** checkbox sends the question, up to four preceding questions and limited telemetry for the selected machine to Google. It requires a selected machine and working backend provider configuration. A local answer or a visible chat window does not prove the external provider succeeded.

## 10. Simulator companion and live demonstration

The Simulator is a separate application, typically opened locally at **http://127.0.0.1:5174/**. Its reported fleet controls include machine selection, start/pause/resume/stop and a configurable sampling interval. Its current report describes an existing 40-machine selectable roster; the actual running inventory must be checked before claiming another count.

For a live demonstration:

1. Confirm MySQL, both backends and both web pages are running.
2. In the Simulator, select machines known to FactoryPulse and start generation.
3. Inspect delivery status: queued, retrying or failed readings have not all reached the receiver merely because they are stored in SQLite.
4. Open FactoryPulse as an authorized user and select the matching machine.
5. Check that the latest saved timestamp advances and the individual chart gains new points.
6. Switch to a second permitted machine and confirm its own ID, timestamps and readings.
7. Show production progress separately; the 360-second plan does not produce a new part every second.
8. Report a sample issue, assign it with a Supervisor account, record repair progress with Maintenance and review the history with Admin.

A Simulator “delivered” indication, a successful receiver response, a stored MySQL record and a visible dashboard reading are different checkpoints. Verify all of them before announcing that the complete pipeline works.

## 11. Troubleshooting during a presentation

| Symptom | Check next |
|---|---|
| Main page cannot be reached | Confirm the frontend process and its actual port. |
| Login says Failed to fetch | Confirm the authentication backend, API base URL and allowed browser origin. |
| Simulator shows API unavailable/500 | Inspect its backend error and SQLite readiness; the webpage itself may still load. |
| Could not connect to receiver | Confirm the receiver process and configured URL. Check matching authentication locally without displaying secrets. |
| Operator cannot see the desired machine | Check the saved assignment and canonical machine mapping. |
| Values remain old | Compare sender generation, delivery queue, latest SQL timestamp and dashboard timestamp. |
| Chart is flat | Check real sample variation, timestamps, axis range and precision. Do not add invented points. |
| Production count does not change every second | Compare elapsed production time with the target cycle; sensor sampling is a separate schedule. |
| Power BI shows unavailable | A real report, data source and successful refresh still need to be configured/verified. |
| Disk is full | Free space safely before restarting writers; preserve needed database and archived records. |

## 12. Suggested presentation script

“FactoryPulse gives each employee a focused manufacturing workspace. The sender generates machine readings, the receiver saves them in MySQL, and authorized dashboards visualize those saved values.

“An Operator sees their station, shift counts, condition, individual sensor trends and incident reporting. A Supervisor compares machines and assigns maintenance work. Maintenance records diagnosis, progress and resolution. A Manager compares output, quality and current operational risks. Admin manages accounts and machines and reviews the audit trail.

“Here I check the machine identity and advancing timestamp, then show a second machine. The graphs represent recorded samples. Production targets and modeled figures retain their stated calculation basis. Power BI and external AI are described according to their actual configuration and verification status.”

## 13. Evidence and verification limits

Source inspected: the current GitHub main branch of **NARENDRA-504/factory-pulse**, retrieved 30 October 2026. These checks establish source behavior, not successful local execution or a match with uncommitted PC changes.

Key references:

- [Role navigation](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/roleNavigation.ts)
- [App routing and shared controls](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/App.tsx)
- [Role dashboard panels](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/components/RoleDashboardHighlights.tsx)
- [Individual live sensor charts](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/components/SimulatorFleetTelemetryDashboard.tsx)
- [Operator session and downtime](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/components/OperatorSessionPanel.tsx)
- [Role operations pages](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/views/RoleOperationsView.tsx)
- [Incident workflows](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/views/IncidentsView.tsx)
- [Work orders](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/views/MaintenanceManagementView.tsx)
- [People and password resets](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/views/UsersView.tsx)
- [Machine inventory](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/views/MachineManagementView.tsx)
- [Machine registration](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/components/AddMachineModal.tsx)
- [Activity Log](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/views/ActivityLogView.tsx)
- [Machine chat](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/components/FactoryChat.tsx)
- [Analytics and Power BI status](https://github.com/NARENDRA-504/factory-pulse/blob/main/src/views/AnalyticsView.tsx)

Local browser checks, live database access, external AI responses, Power BI refresh and complete end-to-end workflows were not verified during this documentation task because local execution tools were unavailable. No passwords or API secrets are included in this guide.
