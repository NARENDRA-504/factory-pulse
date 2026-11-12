> Current evidence (3 November 2026): see [PHASE1-VERIFICATION.md](PHASE1-VERIFICATION.md). The implementation notes below include historical checks and limitations; later verified Power BI and Gemini results supersede earlier unavailable statements.

# Shift history, observed service usage and cost planning

Implemented 2 November 2026. Main app: http://localhost:3000. Separate Simulator: http://127.0.0.1:5174.

## Where to find the features

- Operator → My Production → Shift production & handover: choose Current shift or a prior 12-hour shift. Compare its observed output with the preceding shift. Historical views do not offer event-entry controls.
- Supervisor → line coordination: the same shift selector remains limited to the supervisor's assigned team. Manager → plant performance offers the comparison in read-only mode, with machine breakdown collapsed to keep the overview compact.
- Admin → machine readiness, service & costs → Configure rates & service checklist: set the manufacturer's running-hour/part service interval, calendar date and inspection steps. Empty intervals disable that usage trigger. The date input displays the saved date in browser local time.
- Maintenance → Service plans & inspection history: inspect observed hours/parts and due status. Completing an inspection alone does not restart a service interval. Check “Service was performed” only when service was actually completed; all checklist steps and a note remain mandatory. This action restarts observed usage intervals, preserves the calendar date and adds an audit entry.
- Admin → cost settings → Cost & contribution planner: enter material, processing, salvage, selling price, variable cost, throughput and tariff. Copy calculated estimates into the editable settings, review them and explicitly enable/save them. Manager has a scenario calculator that does not write settings.

## Cost research and calculation

There is no universal market rate that guarantees high manufacturer profit. Rates depend on the product, process, region and electricity contract. No actual factory accounting rates were inferred from internet prices or silently applied to all machines.

The planner's initial scenario reproduces the existing internship assumptions: material ₹50, processing ₹20 and recovery ₹5 → ₹65 lost per scrap part. Selling price ₹250 less variable cost ₹130 → ₹120 contribution per good part; at ten good parts per hour, an unrecoverable hour of downtime represents ₹1,200 lost contribution. These are examples, not market quotations or audited losses. Electricity starts unconfigured at zero; the machine exposure API treats a zero tariff as unavailable rather than inventing a free-energy bill.

- Scrap loss = material + wasted processing − recovery, floored at zero.
- Lost downtime contribution = max(0, selling price − variable cost) × lost good parts/hour. Do not add it to an all-inclusive machine-hour rate that already contains the same costs.
- Price for a target contribution margin = variable cost ÷ (1 − margin fraction). A 25% margin differs from a 25% markup. Fixed costs, taxes, customer demand and recoverable lost output still affect actual profit.
- Energy exposure = observed modeled electrical kWh × entered INR/kWh. Demand charges and other bill components require separate treatment or a documented effective rate.

Reference sources consulted:

- BDC, pricing costs and target margins: https://www.bdc.ca/en/articles-tools/marketing-sales-export/marketing/steps-setting-right-price-your-products-services
- Central Electricity Authority, tariff and duty reference: https://cea.nic.in/wp-content/uploads/fs___a/2026/03/Book_2025.pdf
- US Department of Energy, energy per unit of output: https://www.energy.gov/cmei/energy-efficiency-vs-energy-intensity

Rate-source choices distinguish internship estimates from factory-approved rates. The note field records assumptions/source. Copying a scenario does not enable or save it automatically. Costs remain estimates rather than booked expenses.

## Data correctness and persistence

Shift history reads MySQL counters and audit events, bounded by both start and end timestamps. Offset 0 is the current shift; the API supports offsets through 27, and the UI compares the selected shift with its predecessor. The date window is limited to retained detail; missing history is unavailable, not invented. Counter resets are counted once, noisy data breaks the baseline, and missing baselines may undercount. A per-sensor 20,000-sample safety cap returns unavailable rather than a misleading partial total. At sustained one-second sampling this can prevent full 12-hour reconstruction; a durable shift rollup is still needed for that case. Archived hourly averages cannot reconstruct part totals.

The usage worker checks saved latest values every 15 seconds and stores checkpoints under `machines.operating_limits.factorypulse_usage`. It preserves the other operating-limit keys and all operational records. The first good sample is a baseline and contributes no historic usage. Duplicate/out-of-order samples add nothing. Recorded counter resets add the new post-reset count once. Gaps over 60 seconds establish a new baseline and are reported as possible undercounting. This is observed usage since tracking/service, not a lifetime hardware meter. Missing streams do not create zero-valued verified baselines.

Due status is true if any configured calendar/hour/part trigger is reached. The equipment maker's interval must be entered; none was invented. Service completion requires valid running-time and both part-counter baselines. The audit record distinguishes an inspection from service completion.

MySQL remains the source of truth. No new schema migration was necessary. The separate Simulator, its secrets, accounts and live delivery contract were not modified for these additions. Supabase is not in these query paths.

## Power BI verification boundary

Update, 3 November 2026: after the user completed connector installation and MySQL Basic authentication, a new `powerbi/FactoryPulse Machine Overview.pbix` was built and saved. Import and subsequent native Refresh succeeded for 1,280 latest rows / 40 machines. RPM and temperature bars, status donut, machine slicer and pressure/vibration table are present. Single-machine filtering passed (40 → 1 → 40). This supersedes the blocked-refresh statement below for this new report only. Import requires Home → Refresh; automatic cloud refresh, gateway, publishing and app embedding remain unconfigured. Originals and ingestion pipeline were unchanged. See powerbi/README.md.

Power BI Desktop is installed and was opened. Its email sign-in dialog requires the user's interaction before UI checking can continue. No credentials were entered and no actual report refresh was claimed. The local report files were inspected without modification: `admins dashboard.pbix` visuals reference `synthetic dataset`; `visualization.pbix` visuals reference `sales data`. Neither inspection proves a live FactoryPulse MySQL refresh.

Prepared direct-MySQL queries remain in `powerbi/`. A genuine refresh needs the intended MySQL queries loaded in Power BI, a working native connector and database authentication. Import refresh is separate from the app's live polling; do not promise one-second Power BI refresh. Official connector requirements: https://learn.microsoft.com/en-us/power-query/connectors/mysql-database

## Verification

Seventeen focused backend tests passed, including reset/duplicate/noise/gap handling and service-baseline calculations. Real-MySQL checks passed for historical access restrictions, settings and explicit service completion; QA business writes were rolled back. All 40 machines advanced and all 1,280 sampled latest values exactly matched stored MySQL values. Four role browser previews showed dynamic polling, no page errors and no mobile horizontal overflow. Type checking and production build passed with existing Vite/configuration and bundle-size warnings. Admin setting handlers were checked with a local test dependency override inside a rolled-back transaction, not a successful Admin credential login.
