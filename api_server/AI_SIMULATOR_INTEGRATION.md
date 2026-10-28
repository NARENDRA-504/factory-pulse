# FactoryPulse AI Simulator telemetry contract

## Audit findings

FactoryPulse's API entry point is `api_server/main.py` (FastAPI, `/api/v1`). Before this change it had no external telemetry ingestion route. `GET /api/v1/machines/{code}/telemetry` returned a fixed sample, and the role-gated `POST /api/v1/machines/inject-telemetry` returned a generated demo record without inserting it. The latter's response now explicitly says `DEMO_ONLY_NOT_PERSISTED`.

The MySQL DDL existed in `scripts/export_mysql_schema.sql`, but the API did not create a database engine/session or write telemetry to it. `apiClient.ts` also uses seeded browser data, local storage, and browser messages. The HTTP receiver and persistent history panel are now implemented separately from that local demo preview.

I inspected the separate AI Simulator source read-only. Its exact `TelemetryRecord` has one row per sensor: `reading_id`, UTC timestamp, canonical `machine_id`, machine labels, `sensor_name`, `sensor_unit`, `sensor_value`, expected bounds, `machine_status`, `data_quality`, and nullable `fault_mode`. `sensor_value` can be numeric, null, or a string (for example `ERROR`) during simulated faults/noise. The simulator adapter posts this record unchanged and supports a configurable auth header. Its canonical catalog matches FactoryPulse's 400 machine master; for example `MCH-001` maps to `CNC-5AX-001`.

FactoryPulse's existing `sim_telemetry_events` table is a wide aggregate/demo snapshot and cannot represent the simulator's one-row-per-sensor payload without discarding data. The smallest compatible change is an additive `simulator_sensor_readings` table in the **same MySQL database**, not a second database. Existing tables and history are preserved. Machine labels are resolved from `public/machine-name.json`; a mismatched label in a request is replaced with the canonical label. The canonical `machine_id` and matching machine code are both stored. There is no machine-table foreign key because the SQL machine table is not populated with this canonical master.

## Exact ingestion contract

- Method/path: `POST /api/v1/telemetry`
- Header: `X-Simulator-API-Key: <secret>`
- Content type: `application/json`
- Body limit: 16 KiB
- Authentication: `SIMULATOR_API_KEY` must be set in FactoryPulse's backend environment; comparison is constant-time. Missing server configuration returns `503`; a missing or incorrect key returns `401`.
- Persistence: inserts into `simulator_sensor_readings` within a transaction. `reading_id` is unique. An identical retry returns `200` with `stored: 0` and `duplicate: true`; reuse of an ID for different data returns `409`.
- Provenance: FactoryPulse stamps `data_provenance: "SIMULATED"` and `data_source: "AI_SIMULATOR"`. These are server-controlled and are not accepted from the request.

Request example, matching the simulator's current schema:

```json
{
  "reading_id": "READ-7D11014C997A",
  "timestamp": "2026-10-26T10:30:00+00:00",
  "machine_id": "MCH-001",
  "machine_type": "5-Axis CNC Machining Center",
  "department": "Floor A1: Aerospace Micro-Milling",
  "production_line": "Line 5AX-01",
  "sensor_name": "Vibration",
  "sensor_unit": "mm/s",
  "sensor_value": 1.32,
  "expected_min": 0.5,
  "expected_max": 5,
  "machine_status": "NORMAL",
  "data_quality": "GOOD",
  "fault_mode": null
}
```

`machine_status` must be `NORMAL`, `WARNING`, `CRITICAL`, `MAINTENANCE`, or `STOPPED`. `data_quality` must be `GOOD` or `NOISY`. Numeric values must be finite; expected bounds must be finite and ordered. The API intentionally permits noisy sensor values outside expected bounds, nulls, and strings so simulated faults are retained. It rejects unknown fields rather than silently dropping them. Timestamps must include a timezone; storage and responses are normalized to UTC.

New record response (`201`):

```json
{
  "stored": 1,
  "duplicate": false,
  "reading_id": "READ-7D11014C997A",
  "machine_id": "MCH-001",
  "machine_code": "CNC-5AX-001",
  "machine_name": "5-Axis-01 – Mazak VARIAXIS C-600",
  "data_provenance": "SIMULATED"
}
```

Malformed fields, invalid enums, invalid timestamps, and unknown machine IDs return `422`. A database configuration/availability error or an unapplied schema migration returns a generic `503`; raw database details are only logged by exception class. No API key or credential is included in logs or responses.

## Retrieval

`GET /api/v1/telemetry/latest/MCH-001?limit=100&sensor_name=Vibration&data_source=AI_SIMULATOR&since=2026-10-26T00:00:00Z&until=2026-10-27T00:00:00Z` returns stored raw sensor records newest first, including the canonical machine ID, resolved machine code/display name, sensor value/unit, timestamp, status, quality, fault mode, and simulated provenance. All filters are optional except the canonical machine ID in the path. `limit` is bounded from 1 to 1000 and timestamps must be timezone-aware. This route uses FactoryPulse's existing bearer-token dependency; its current tokens are demo work IDs (for example `OP-101`), which are prototype authentication rather than production-grade identity. Operators can read only their assigned machine (currently `CNC-5AX-001`); other roles can read any canonical machine.

The shared role home dashboard now reads saved AI Simulator data from MySQL through `GET /api/v1/telemetry/fleet/latest` and refreshes every 10 seconds. Operators receive only their assigned machine; fleet roles can filter the returned data by plant and machine type. The dashboard includes latest readings, status and quality summaries, plant/type comparisons, and a selected machine/sensor history chart based only on stored timestamps. One point is displayed as a current value rather than a fabricated line. Incident and work-order actions continue to use FactoryPulse operational records.

Simulator fields remain raw: RPM, vibration (mm/s), temperature, motor temperature, torque, and current are shown only when actually received. The current sender does not supply production counts, shift targets, coolant temperature, motor load percentage, or motor power in kW, so the role dashboard identifies these as unavailable instead of using roster values as Simulator measurements.

The existing `GET /api/v1/machines/{code}/telemetry` is unchanged and still returns a fixed sample. Use `/api/v1/telemetry/latest/{machine_id}` to verify ingested records.

## Configuration

FactoryPulse backend environment:

```text
DATABASE_URL=mysql+pymysql://<user>:<password>@<host>:3306/<database>
SIMULATOR_API_KEY=<long-random-secret>
```

FactoryPulse frontend `.env.local`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8001
```

URL-encode reserved characters in database passwords. Do not commit real values or place the simulator secret in a `VITE_*` variable.

Apply `scripts/export_mysql_schema.sql` to a fresh database, or run the additive migration `scripts/migrations/20261026_create_simulator_sensor_readings.sql` once against an existing database. The migration only creates the new table; it does not modify or delete historical tables or records.

Start FactoryPulse's API on a port different from the simulator (the simulator's documented default is 8000). Example local setup:

```powershell
python -m pip install -r api_server/requirements.txt
python -m uvicorn api_server.main:app --host 0.0.0.0 --port 8001
```

AI Simulator backend `.env` (set the API key value equal to FactoryPulse's `SIMULATOR_API_KEY`):

```text
TELEMETRY_PUSH_ENABLED=true
TELEMETRY_RECEIVER_URL=http://127.0.0.1:8001/api/v1/telemetry
TELEMETRY_AUTH_HEADER=X-Simulator-API-Key
TELEMETRY_API_KEY=<same-long-random-secret>
TELEMETRY_CONNECT_TIMEOUT=3
TELEMETRY_MAX_RETRIES=3
```

Use an address reachable from the simulator host/container instead of `127.0.0.1` if the projects run in separate environments. The simulator outbox already retries transient errors and deduplicates by `reading_id`; it only treats a 2xx response as delivered. No simulator source changes or payload transformation are needed.

## Scope and verification limits

The receiver stores raw sensor readings and the dashboard displays the per-sensor values as received. It does not infer an aggregate spindle/load/power snapshot or create incidents. Distinct values are not remapped into incompatible units (for example, current in amperes is not motor power in kW).

The AI Simulator payload schema matches the receiver. A prior database check confirmed the test reading `READ-TEST-7FC57D0B7E484137827F91435CEC3F11` was stored in MySQL for `MCH-001` as `RPM`, `2400 RPM`, `GOOD`, and `NORMAL`. In this turn, the frontend production build and TypeScript check succeeded, but a live browser refresh could not be verified because the in-app browser could not reach the local development ports. The `.env` file is present; secret values were not displayed or copied into this document. Confirm the MySQL connection, migration, and authenticated dashboard endpoint from the local browser before treating the live dashboard refresh as verified.

The isolated persistence and retrieval check can be repeated without touching development data with `python -m unittest tests.test_telemetry_ingestion tests.test_telemetry_http_contract` from the FactoryPulse repository, using its configured Python test environment. That test writes one fixture into an in-memory SQLite database, retrieves it, and checks canonical identity, duplicate behavior, authorization, query bounds, and write failures. It is not a substitute for the live MySQL test above.
