# Per-machine live telemetry

Open the AI Simulator at http://127.0.0.1:5174/ → **Machines** → choose a machine card.

The selected machine page contains:

- Machine ID, station code, name, plant, line and running/stopped state.
- Latest saved physical and derived readings with units, configured ranges, quality, timestamps and per-reading delivery state.
- Good/scrap/target/cycle values from the existing production model.
- One chart per physical or derived signal. Charts use actual saved timestamps. Missing and noisy samples create gaps; a single point is not presented as a trend.
- Searchable recent-reading table with original reading IDs.
- A collapsed list of the additional modeled operations inputs.
- **All machines** to return to the directory. The shared selector can also change the viewed machine.

The page polls every two seconds, with one request at a time. New values follow the fleet's sampling interval (currently five seconds). This does not promise two-second generation or delivery.

## Delivery meaning

The data path remains **Simulator → authenticated FactoryPulse receiver → MySQL → FactoryPulse dashboards**. The Simulator does not directly connect to MySQL or acquire its credentials.

The new read-only endpoint, `GET /api/v1/machines/{machine_id}/live`, reads at most 960 local history rows (640 by default), deduplicates the newest row per sensor, and joins delivery states by reading ID. Existing API-key middleware protects it. It does not write telemetry, change counters, start or reset machines, or alter the delivery queue.

**Receiver acknowledged** means the local outbox recorded a successful FactoryPulse response for that reading ID. **Queued**, **Delivery failed** and **Not queued** remain distinct. Local storage alone never becomes a delivery confirmation. Summary counts cover only the bounded loaded records, not lifetime delivery totals. An emergency stop shows delivery stopped while preserving the last saved data.

## Checks

- 56 Simulator backend tests passed, including selected-machine scoping, read-only behavior, authentication, unknown machine and limit validation.
- Matched 96 acknowledged readings from MCH-001, MCH-002 and MCH-036 exactly against FactoryPulse MySQL by ID, machine, name, unit and value.
- Preserved all 40 production counters and cycle progress across the targeted backend restart; resumed the existing fleet.
- Simulator production build passed with its existing bundle-size warning.

No FactoryPulse ingestion contract, accounts, passwords, environment files or historical records were changed for this feature. The Simulator stays separate and local.
- Browser checks passed for MCH-001, MCH-002 and MCH-036: each showed 32 sensor streams and 12 independent dynamic charts. Search and return-to-directory passed; no simulation-control requests were made. Phone-width previews had no document overflow. Final delivery status remained ready with no failed records in the checked queue snapshot.
