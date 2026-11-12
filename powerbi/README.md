# FactoryPulse Power BI

Current report: `FactoryPulse Machine Overview.pbix`.

Verified locally on 3 November 2026: native MySQL Import from the latest-reading view, successful manual Home -> Refresh, 1,280 source rows and 40 machine snapshot rows at that check. Visuals: RPM and temperature bar charts, machine status donut, machine slicer, pressure/vibration table. Slicer tested from 40 machines to one and back. Numeric GOOD values are used; sensor units are preserved and pressure/vibration are not summed. Source provenance remains simulated.

Connection: `127.0.0.1:3306`, database `ziro_manufacturing`, MySQL Basic authentication. Enter credentials locally in Power BI; never commit them. Connector/NET must be installed. Use an appropriately restricted reporting account for deployment.

This is a latest-state report, not a historical OEE report. Import data changes only after Refresh. Gateway, scheduled cloud refresh, publishing, role-level Power BI security and app embedding are not verified. App live charts refresh separately through FactoryPulse's authorized API.

The notebook reads the same MySQL latest view, but a later refresh may differ because live data advances. Compare reading IDs/timestamps at the same snapshot, not a later moving mean.

Original external reports `admins dashboard.pbix` and `visualization.pbix` reference other sources; they were preserved and are not claimed to use this operational pipeline. Older documentation is retained under docs/archive.
