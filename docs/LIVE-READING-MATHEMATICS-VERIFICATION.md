# Live reading and calculation verification — 2 November 2026

## Actual runtime checks

- Restarted the separate Simulator API and web service, explicitly resumed delivery, and started the existing 40-machine roster. Accounts, passwords, schemas and environment files were preserved.
- Matched 880 newly generated readings across all 40 machines with MySQL by reading ID, machine, sensor name, unit and value: 880 exact matches. Historical Simulator records intentionally deleted from MySQL during cleanup were excluded from this fresh-delivery check.
- All five role logins and protected fleet endpoints succeeded. Operator returned one authorized machine (18 latest sensor streams); other tested roles returned 40 machines (720 streams). This checks existing access behavior; it does not establish new plant allocation policies.
- Three observations found all 40 machines reporting, with the oldest per-machine current snapshot approximately 3.67, 4.73 and 5.09 seconds old. Production snapshots can be older because they publish on completed parts, not every sensor tick.
- An actual Operator browser received 14 polling responses with changing saved timestamps and RPM. No browser response fixtures were used.
- All four report layouts passed actual-data desktop/mobile previews with no page errors or horizontal overflow; Maintenance's existing overview remained available.

## Mathematics

- Planned output: 120 total parts / 12 hours = 10 total parts/hour. Ideal cycle: 12 × 3,600 / 120 = 360 seconds per part. Good-part rate can be lower when parts are rejected or the machine stops.
- Actual output = latest good counter + latest scrap counter for each machine. Repeated cumulative snapshots must not be summed.
- Quality = good / (good + scrap) × 100. With no completed parts, quality is unavailable rather than 0% or 100%.
- Shaft power in kW = torque in Nm × RPM / 9,549, rounded to two decimals. This is derived mechanical power, not measured electrical consumption.
- All 40 live machines matched the Simulator's current good/scrap state, the 120/360 plan, the quality formula and the shaft-power formula (0.02 kW rounding tolerance).
- Existing Simulator calculation tests passed, including the 12-hour/120-part scenario, units, derived power and torque-range motor load. These isolated tests mock storage.

## Corrections

- Missing production counters no longer become zero in the live telemetry comparison.
- Overview fleet output/target comparisons require matching counter/target coverage; Manager line comparisons exclude incomplete pairs.
- Progress text preserves true percentages above 100%; only the physical progress bar is capped at its width.
- Invalid or negative production numbers are excluded. Missing sensor values no longer become zero in overview range charts.
- Observed good-part rates exclude invalid, negative and non-GOOD samples and restart their observation after a counter reset.
- Seven focused frontend calculation tests, TypeScript checks and the production build passed. Existing Vite configuration and bundle-size warnings remain.

## Limits

The running source samples every five seconds; a one-second end-to-end guarantee was not verified. Production changes only after a completed cycle. Simulator values remain generated estimates, and successful transport does not make them calibrated physical measurements. Motor load remains a torque-range proxy. Power BI refresh, physical calibration, electrical energy, finance metrics and complete OEE are not established by these checks. No historic telemetry values were rewritten to make charts look different.

Local private evidence: `.local/readings-audit-2026-11-02.json`, `.local/live-mathematics-check.json`, `.local/live-browser-check.json`, and `.local/role-report-preview-results.json`.
