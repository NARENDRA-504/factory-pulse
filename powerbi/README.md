# Power BI connection preparation

Existing files found outside the repository:
- Documents/admins dashboard.pbix: visual definitions reference `synthetic dataset` machine_id/machine_status. Its underlying live MySQL connection and refresh are not verified.
- Documents/visualization.pbix: visual definitions reference unrelated `sales data` City/Sales/Region/Segment. Not FactoryPulse telemetry.

The original reports were not modified.

## Prepared actual MySQL inputs
LatestReadings.pq, SensorHistory.pq and Incidents.pq use the local ziro_manufacturing database directly. No API keys/passwords are embedded, and Supabase is not involved. SensorHistory limits the last24hours to50000rows; it is not an all-history production/downtime model.

In Power BI Desktop: Get Data -> Blank Query -> Advanced Editor, paste the content of a .pq file, then use Database authentication for127.0.0.1:3306. Enter MySQL credentials in Power BI's credential dialog, never in the query. Oracle MySQL Connector/NET is required for the native MySQL connector. Import mode uses Refresh; these prepared queries do not establish automatic real-time refresh.

Recommended report: latestRPM card filteredsensorRPM; trendtimestamp/sensor_value filteredone sensor+machine; machine status counts distinctmachine_id with lateststatus; incident severity/status bars. Never sum different physical sensor units. LatestReadings has multiple sensors per machine; distinctmachine counts must avoid counting one machine six times.

## Verification boundary
Actual source views and records were checked through MySQL. M queries have not been executed in Power BI Desktop. Native app-control approval timed out, so no report refresh was performed. Do not claim this is a connected/refreshing Power BI report yet. Do not publish workplace telemetry to a public report.

Official connector reference: https://learn.microsoft.com/en-us/power-query/connectors/mysql-database
