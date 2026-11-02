# Dashboard model inputs

The separate AI Simulator now emits 13 additional scalar streams through the existing authenticated telemetry contract. FactoryPulse stores them in MySQL and reads them through the existing role-protected APIs. No database migration, password, account or environment change is required.

| New stream | Unit | Meaning |
| --- | --- | --- |
| Model Planned Time | s | Observed selected-machine time since the model window began |
| Model Run Time | s | Productive time; excludes pause, shutdown and maintenance |
| Model Down Time | s | Planned time minus running time |
| Model Ideal Time | s | Running time adjusted for configured cycle pace, including work in progress |
| Model Window Good / Scrap | parts | Counter increments after this window's baseline; old shift counts excluded |
| Model Electrical Power | kW | Shaft power divided by assumed motor efficiency, or configured standby power |
| Model Electrical Energy | kWh | Integrated modeled power over observed time |
| Model Scrap Cost | INR | New scrap multiplied by the rate configured when it occurred |
| Model Downtime Loss | INR | Non-running time multiplied by the configured hourly loss rate |
| Model Motor Efficiency | % | Published assumption, initially 90% |
| Model Scrap Unit Cost | INR/part | Published assumption; initially unconfigured |
| Model Downtime Hour Cost | INR/h | Published assumption; initially unconfigured |

## Use

1. Open the Simulator at http://127.0.0.1:5174/.
2. Expand **Dashboard data model · energy and cost assumptions** on Dashboard.
3. Set motor efficiency and standby kW as needed. Demonstration rates are now configured at ₹65/rejected part and ₹1,200/stopped hour; see `DEMONSTRATION-COST-ASSUMPTIONS.md` for the explicit assumptions. You can change them. Zero means unconfigured, so the financial value remains unavailable.
4. Save. Rates apply prospectively; previously unpriced activity is excluded. The Simulator keeps these non-secret assumptions in `data/operations-assumptions.json` outside the application source.
5. **New model window** starts a fresh observation baseline. It preserves raw history, the outbox and production counters. Use this after noisy samples if you need a complete new energy window.
6. Run the selected fleet. FactoryPulse's report dashboards and role overviews show the modeled operations panel for Operator, Supervisor, Maintenance and Manager. Admin retains system/access information.

## Calculation boundaries

- Availability = summed running seconds / summed observed planned seconds.
- Cycle-pace performance = summed ideal-equivalent seconds / summed running seconds. This is a work-in-progress training estimate, not standard completed-unit certified OEE.
- Quality = window good / (window good + window scrap). It stays unavailable before a part completes.
- OEE estimate = availability × cycle-pace performance × quality. No artificial startup quality of 100%.
- Energy per good part = summed energy / summed window good, only with positive good counts and complete energy coverage. It is an observation-window ratio, not a certified full-cycle part-energy cost.
- One missing/noisy power interval makes energy for that window unavailable rather than quietly counting zero. Start a new model window to recover complete coverage.
- Selected-machine roles and slicers are respected. Incomplete multi-stream snapshots are excluded rather than mixing incompatible core timestamps. Coverage count is shown.
- Pause, maintenance and selected-machine shutdown continue observed time and standby energy. Global emergency Stop All freezes generation and delivery, including model clocks. Offline/global-stop time is not silently recorded as factory downtime.
- Shift production remains the existing **120 parts / 12 hours = 10 parts/hour = 360 seconds/part** model. Backend restarts restore progress without creating parts.
- Costs are illustrative configured estimates, never approved factory accounts. The financial cards now show current-rate exposure across the observation window; the original source cost streams still accrue prospectively. See `DEMONSTRATION-COST-ASSUMPTIONS.md`. Monetary display rounds only at the end to two decimal places. Energy is modeled, never claimed to come from a physical electrical meter. Real Power BI refresh/gateway verification, staffing attendance, approved financial records and reliability event histories are separate requirements.

## Delivery and resource use

Each machine round now carries 32 streams (19 existing plus 13 model inputs). The live fleet remains at a five-second sampling interval, with existing bounded batches, stable reading IDs and retry behavior. A one-second 40-machine guarantee has not been established. No Simulator files are published to GitHub by this change.

## Verification — 2 November 2026

- Preserved all 40 production counters and cycle progress through backend restarts.
- 1,802 fresh source records matched MySQL exactly, including machine, reading ID, name, unit and value.
- Role APIs returned 1,280 latest streams to fleet roles and 32 to the assigned Operator (one machine).
- All 40 paused model clocks accrued planned/down time without adding run time or parts. Emergency Stop All froze model clocks and the MySQL reading count; resume restored all 40 active models.
- 54 Simulator regression tests, 12 receiver/profile checks and 11 JavaScript calculation tests passed. Tests use temporary databases/configuration; delivery pause markers are isolated from the live latch.
- Main TypeScript check and both production builds passed. Existing bundle-size warnings remain.
- Fourteen live role/tab chart views rendered with no browser errors, invalid numeric labels or missing chart containers.
- At initial model verification both cost rates were unconfigured. The later requested demonstration configuration uses explicitly assumed ₹65/part and ₹1,200/hour, with formulas visible in the app. Real Power BI refresh, physical sensor validation and approved financial totals are not established by these tests.
- Explicit model-panel previews passed for Operator (1 authorized machine), Supervisor, Maintenance and Manager (40 machines each), with no browser errors. The Simulator settings and model-window reset controls were visible. A final queue snapshot showed delivery ready, 1,632,701 delivered records and no pending or failed records at that moment.
