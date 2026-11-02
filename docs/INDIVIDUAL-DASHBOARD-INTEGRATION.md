# Individual dashboard integration

The supplied WhatsApp ZIP contains four dashboard screenshots. It contains no Power BI report file, dataset, or connection details. FactoryPulse recreates their useful layouts as interactive application charts; this does not establish a Microsoft Power BI connection.

## Placement

The **My report dashboard** tab is the default dashboard for Operator, Supervisor, Manager, and Admin. Existing role overviews and live machine telemetry remain accessible. Maintenance keeps its existing diagnostic overview because no Maintenance reference was supplied.

| Reference | Application charts and information |
| --- | --- |
| Admin | Sensor record, machine, and line counts; record status donut; records by line; stacked line/status bars |
| Operator | Assigned machine slicer; RPM, load, temperature and parts cards; load gauge; saved temperature trend; scoped incident table |
| Supervisor | Actual/target comparison by line; good/rejected bars; machine status donut; incidents by line |
| Manager | Actual/target comparison; output share donut; machine status donut; output/reject scatter |

Plant, line, searchable machine, and date/time slicers narrow each report. Operators remain restricted to their assigned machine. Other roles receive only the roster supplied by the authenticated API. Backend permission checks remain unchanged.

## Data mapping and calculation corrections

- Live cards use the latest saved MySQL reading for each machine/sensor. The existing latest-reading refresh runs approximately every second; detailed Operator history refreshes every ten seconds.
- Good and scrap counters are cumulative snapshots. Only the newest counter for each machine is used; repeated samples are never added together. Both counters must exist before a machine contributes output.
- Targets are compared only for machines with corresponding production counters. Partial coverage is shown. Comparisons show at most eight lines to retain readable labels.
- Sensor-record status counts and machine-status counts have distinct denominators. Missing machine readings are visible as unavailable.
- Temperature and percentage readings are not summed. Coolant temperature is not inferred from machine or motor temperature. When coolant temperature is absent, the trend is explicitly titled for the available machine temperature.
- Historical windows use the existing authenticated per-machine telemetry endpoint with `since` and `until`. At most three requests run concurrently. The 1,000-record cap per machine and partial request failures are disclosed. Historical production is a counter snapshot within the window, not production during that window.
- Current incidents are labeled separately from historical telemetry. The telemetry date filter does not pretend to filter incident creation dates.
- Shift breakdowns, OEE, running time, and financial figures are unavailable where the required shift identifiers, calendar, availability, ideal-cycle and quality definitions are absent. The reference screenshot values are never inserted into operational data.

## Verification

- TypeScript check and production build run for this integration.
- Four focused data tests cover cumulative-counter deduplication, Operator scope, record versus machine counts, and unavailable numeric values.
- Actual authenticated browser previews passed for all four reports at desktop and mobile widths: no console errors or page overflow. Maintenance's existing view was also checked. Date validation and the authenticated historical request were exercised.
- At preview time MySQL returned no telemetry. Empty states were verified against actual responses. Populated charts were additionally previewed using isolated browser response fixtures, with no test telemetry written to MySQL. This is layout/calculation verification, not proof of a running live sender.

No receiver, database schema, Simulator configuration, account, environment file, or delivery stop/resume setting was changed. Existing live delivery must be running to populate the charts. Actual Power BI embedding and refresh remain unverified until report files or an authorized report connection are provided.

## Role layout refinement — 2 November 2026
The initial screenshot-based report collection was refined to make responsibilities visibly distinct. Operator now leads with a large assigned-station production tracker. Supervisor uses an amber attention summary and clickable floor board, with good/reject output and incident-priority bars. Manager uses indigo executive yield metrics, plant scorecards, readable line plan comparisons, production share and high-priority risks; optional slicers are collapsed initially. Admin uses rose governance cards, real account distribution, recent audit events and working user/activity/registry shortcuts. Admin data comes from existing protected APIs, refreshing every30seconds; telemetry scope filters do not filter account or audit records. Maintenance retains its diagnostic and work-order overview with a violet Diagnostic workbench treatment.
Actual authenticated desktop/mobile browser previews passed for all four reports; Maintenance overview remained available. Admin user-management navigation, Supervisor station selection and Manager filter toggle passed. No backend, receiver, Simulator, permission or schema change was required for these layouts.

