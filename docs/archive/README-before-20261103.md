# Power BI connection preparation

## Verified report — 3 November 2026

`FactoryPulse Machine Overview.pbix` is a new saved local report. Native MySQL import and subsequent Home → Refresh succeeded for 1,280 latest sensor rows from `127.0.0.1:3306`, `ziro_manufacturing.v_factorypulse_latest_readings`, represented as 40 rows in a calculated Machine Snapshot table.

Visuals: RPM and temperature comparison bars, machine-status donut, machine-code slicer and pressure/vibration table. Selecting CNC-5AX-001 filtered the bars to one machine and the donut from 40 to 1; clearing selection restored 40. Read-only inspection of the saved PBIX confirmed five visual definitions. Refresh completed without an error and displayed values changed.

Numeric conversion accepts GOOD quality only; invalid numbers become blank. Units remain separate. Pressure and vibration table columns are not summed. Status uses the RPM stream as a consistent round reference. Source provenance remains SIMULATED / AI_SIMULATOR, not verified physical factory measurements. Latest-only values cannot establish historical trends; none were invented.

**This is Import mode: click Home → Refresh for updated values.** Cloud gateway, automatic refresh, publishing and app embedding are not configured or verified. Web-app live polling is separate. Original reports, accounts, Simulator and ingestion services were not changed.

The current connector UI calls MySQL username/password authentication **Basic**. Enter credentials only in Power BI's credential dialog, never in queries or GitHub. The saved report uses the native navigator view; other prepared .pq queries below have not all been imported/refreshed. Earlier blocked-verification notes below are historical and superseded for this new report only.

Existing files found outside the repository:
- Documents/admins dashboard.pbix: visual definitions reference `synthetic dataset` machine_id/machine_status. Its underlying live MySQL connection and refresh are not verified.
- Documents/visualization.pbix: visual definitions reference unrelated `sales data` City/Sales/Region/Segment. Not FactoryPulse telemetry.

The original reports were not modified.

## Prepared actual MySQL inputs
LatestReadings.pq, SensorHistory.pq and Incidents.pq use the local ziro_manufacturing database directly. No API keys/passwords are embedded, and Supabase is not involved. SensorHistory limits the last24hours to50000rows; it is not an all-history production/downtime model.

In Power BI Desktop: Get Data -> Blank Query -> Advanced Editor, paste the content of a .pq file, then use Database authentication for127.0.0.1:3306. Enter MySQL credentials in Power BI's credential dialog, never in the query. Oracle MySQL Connector/NET is required for the native MySQL connector. Import mode uses Refresh; these prepared queries do not establish automatic real-time refresh.

Recommended report: latestRPM card filteredsensorRPM; trendtimestamp/sensor_value filteredone sensor+machine; machine status counts distinctmachine_id with lateststatus; incident severity/status bars. Never sum different physical sensor units. LatestReadings has multiple sensors per machine; distinctmachine counts must avoid counting one machine six times.

## Verification boundary

2 November follow-up: Power BI Desktop was successfully opened through its installed Store alias. Its email sign-in dialog needs the user to cancel or complete it; authentication dialogs cannot be automated. Refresh remains unverified. A fresh read-only PBIX ZIP inspection confirmed the same visual entities: `synthetic dataset` in admins dashboard.pbix and `sales data` in visualization.pbix. Originals were preserved.
Actual source views and records were checked through MySQL. M queries have not been executed in Power BI Desktop. Native app-control approval timed out, so no report refresh was performed. Do not claim this is a connected/refreshing Power BI report yet. Do not publish workplace telemetry to a public report.

Official connector reference: https://learn.microsoft.com/en-us/power-query/connectors/mysql-database

HourlySensorSummary.pq reads archived hourly statistics directly from MySQL. Empty is expected until old raw readings are compacted. Do not sum hourly averages or treat averaged cumulative part counters as production totals. This prepared query has not been refreshed in Power BI Desktop.
