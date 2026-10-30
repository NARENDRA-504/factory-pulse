"""Bounded batch ingestion using the existing per-sensor telemetry contract."""
import json
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from .main import SimulatorTelemetryIngest


class TelemetryBatch(BaseModel):
    readings: list[SimulatorTelemetryIngest] = Field(min_length=1, max_length=100)


def persist_batch(payloads, api, engine=None):
    ids = [p.reading_id for p in payloads]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, 'Batch reading IDs must be unique')
    machines = {}
    for payload in payloads:
        if payload.machine_id not in machines:
            machines[payload.machine_id] = api['resolve_canonical_machine'](payload.machine_id)
        machine = machines[payload.machine_id]
        if machine.get('is_active') is False:
            raise HTTPException(422, 'Batch contains a deactivated machine')
        api['validate_simulator_sensor_unit'](payload)
    sql = api['_sql_text']
    params = {f'id{i}': value for i, value in enumerate(ids)}
    placeholders = ','.join(':' + key for key in params)
    try:
        with (engine or api['get_telemetry_engine']()).begin() as connection:
            existing = {r['reading_id']: r for r in connection.execute(sql(
                f'SELECT * FROM simulator_sensor_readings WHERE reading_id IN ({placeholders})'), params).mappings().all()}
            values = []
            for payload in payloads:
                machine = machines[payload.machine_id]
                if payload.reading_id in existing:
                    if not api['_reading_values_match'](existing[payload.reading_id], payload, machine):
                        raise HTTPException(409, 'reading_id already exists with different telemetry')
                    continue
                values.append(dict(reading_id=payload.reading_id, machine_id=payload.machine_id,
                    machine_code=machine['machineCode'], reading_timestamp=payload.timestamp.replace(tzinfo=None),
                    machine_type=machine['machineType'], department=machine['shopFloor'],
                    production_line=machine['productionLine'], sensor_name=payload.sensor_name,
                    sensor_unit=payload.sensor_unit, sensor_value_json=json.dumps(payload.sensor_value, allow_nan=False),
                    expected_min=payload.expected_min, expected_max=payload.expected_max,
                    machine_status=payload.machine_status, data_quality=payload.data_quality, fault_mode=payload.fault_mode,
                    data_provenance='SIMULATED', data_source='AI_SIMULATOR'))
            if values:
                # Trigger updates lock the latest pointer for each stream.
                # Use the same lock order in concurrent batches to avoid deadlocks.
                values.sort(key=lambda row: (row['machine_id'], row['sensor_name'], row['reading_timestamp'], row['reading_id']))
                columns = list(values[0])
                connection.execute(sql(f"INSERT INTO simulator_sensor_readings ({','.join(columns)}) VALUES ({','.join(':'+k for k in columns)})"), values)
        return {'accepted_reading_ids': ids, 'stored': len(values), 'duplicates': len(existing)}
    except HTTPException:
        raise
    except Exception as exc:
        # Retries are safe: no acknowledgement is returned before commit.
        code = getattr(getattr(exc, 'orig', None), 'args', [None])[0]
        print(f'[Batch ingestion] SQL failure: {type(exc).__name__}; code={code if isinstance(code, int) else "unavailable"}')
        raise HTTPException(503, 'Telemetry batch could not be committed') from exc


def register(app, api):
    @app.get('/api/v1/telemetry/capabilities')
    def capabilities(_authorized=Depends(api['require_simulator_api_key'])):
        return {'batch_version': 1, 'max_batch_readings': 100}

    @app.post('/api/v1/telemetry/batch')
    def ingest(payload: TelemetryBatch, _authorized=Depends(api['require_simulator_api_key'])):
        return persist_batch(payload.readings, api)
