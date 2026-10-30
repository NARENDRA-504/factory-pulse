"""Admin inventory, machine management, 50-machine configuration, and AI health assistant."""
import datetime as dt
import os
import json
try:
    from fastapi import Depends, HTTPException, Request, Query
except ModuleNotFoundError:
    import sys
    import types
    class HTTPException(Exception):
        def __init__(self, status_code: int = 500, detail: str = ""):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)
    def Depends(f=None):
        return f
    class Request:
        pass
    def Query(default=None, **kwargs):
        return default

    if 'fastapi' not in sys.modules:
        _fastapi_mod = types.ModuleType('fastapi')
        _fastapi_mod.HTTPException = HTTPException
        _fastapi_mod.Depends = Depends
        _fastapi_mod.Request = Request
        _fastapi_mod.Query = Query
        sys.modules['fastapi'] = _fastapi_mod

try:
    from pydantic import BaseModel, Field
except ModuleNotFoundError:
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self, **kwargs):
            return self.__dict__
    def Field(*args, **kwargs):
        return kwargs.get('default', None)

from typing import Optional, List, Dict, Any, Literal
from .live_analytics import summarize_downtime
from .gemini_insights import analyze_machine_health


def as_utc(value):
    parsed = value if isinstance(value, dt.datetime) else dt.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    return parsed.replace(tzinfo=dt.timezone.utc) if parsed.tzinfo is None else parsed.astimezone(dt.timezone.utc)


DEFAULT_SIMULATED_MACHINES = int(os.getenv("SIMULATOR_ACTIVE_MACHINE_COUNT", "50"))
DYNAMIC_REGISTERED_MACHINES: Dict[str, Dict[str, Any]] = {}


def get_default_active_count():
    return int(os.getenv("SIMULATOR_ACTIVE_MACHINE_COUNT", "50"))


def build_inventory(catalog, registered, readings, now, stale_seconds=30, active_limit=None):
    if active_limit is None:
        active_limit = get_default_active_count()

    saved_by_code = {row['machine_code']: row for row in registered}
    saved_by_id = {row.get('machine_id'): row for row in registered if row.get('machine_id')}

    telemetry = {}
    for reading in readings:
        row = reading.model_dump(mode='json') if hasattr(reading, 'model_dump') else dict(reading)
        telemetry.setdefault(row['machine_id'], []).append(row)

    result = []
    known_codes = set()
    known_ids = set()

    # Sort catalog machines stably by machineId (MCH-001, MCH-002, ...)
    sorted_catalog = sorted(catalog.values(), key=lambda m: m.get('machineId', ''))

    for idx, machine in enumerate(sorted_catalog):
        code = machine['machineCode']
        mid = machine['machineId']
        known_codes.add(code)
        known_ids.add(mid)

        stored = saved_by_code.get(code) or saved_by_id.get(mid)
        sensors = telemetry.get(mid, [])
        timestamp = max((as_utc(row['timestamp']) for row in sensors), default=None)

        # Connection status
        connection = 'RECEIVING' if timestamp and (now - timestamp).total_seconds() <= stale_seconds else 'STALE' if timestamp else 'WAITING'
        # IDLE supersedes a recent NORMAL reading but cannot hide a concurrent alert.
        rank = {'NORMAL': 0, 'IDLE': 1, 'MAINTENANCE': 1, 'WARNING': 2, 'CRITICAL': 3, 'STOPPED': 4}
        cohort = [row for row in sensors if timestamp and (timestamp - as_utc(row['timestamp'])).total_seconds() <= stale_seconds]
        status = max((row['machine_status'] for row in cohort), key=lambda value: rank.get(value, -1), default='UNKNOWN')

        # Active state: if explicitly stored in SQL, respect it.
        # Otherwise, default to active for the first active_limit machines (1..50), inactive for >50.
        if stored and 'is_active' in stored and stored['is_active'] is not None:
            is_active = bool(stored['is_active'])
        else:
            is_active = (idx < active_limit)

        # Downtime calculation from telemetry
        obs = [(as_utc(r['timestamp']), r.get('machine_status') == 'STOPPED') for r in sensors]
        downtime = summarize_downtime(obs, now - dt.timedelta(hours=24), now, round_minutes=30, stale_seconds=stale_seconds) if obs else {'total_seconds': 0, 'current_downtime_seconds': 0}

        result.append({
            'machine_id': mid,
            'machine_code': code,
            'name': (stored.get('name') if stored else None) or machine.get('displayName', code),
            'model': (stored.get('model') if stored else None) or machine.get('model', 'Standard'),
            'machine_type': (stored.get('machine_type') if stored else None) or machine.get('machineType', '5-Axis CNC'),
            'production_line': (stored.get('line_id') if stored else None) or machine.get('productionLine', 'Line 1'),
            'plant': (stored.get('plant') if stored else None) or machine.get('plant', 'Main Plant'),
            'location': (stored.get('location') if stored else None) or machine.get('shopFloor', 'Floor 1'),
            'manufacturer': (stored.get('manufacturer') if stored else None) or machine.get('manufacturer', 'Mazak'),
            'registry_source': 'MYSQL' if stored else 'REFERENCE_CATALOG',
            'registered_in_sql': bool(stored),
            'description': (stored.get('description', '') if stored else '') or machine.get('description', ''),
            'last_inspection_date': str((stored.get('last_inspection_date') if stored else None) or machine.get('lastInspectionDate') or ''),
            'installation_date': str((stored.get('installation_date') if stored else None) or ''),
            'is_active': is_active,
            'operating_status': status,
            'connection_status': connection,
            'current_round_downtime_seconds': downtime.get('current_downtime_seconds', 0),
            'total_downtime_seconds': downtime.get('total_seconds', 0),
            'latest_timestamp': timestamp.isoformat() if timestamp else None,
            'sensors': sensors
        })

    # Add any SQL-registered machines not in catalog (such as newly created machines)
    for row in registered:
        code = row.get('machine_code')
        mid = row.get('machine_id') or f"DB-{row['id']}"
        if code in known_codes or mid in known_ids:
            continue
        known_codes.add(code)
        known_ids.add(mid)

        sensors = telemetry.get(mid, [])
        timestamp = max((as_utc(r['timestamp']) for r in sensors), default=None)
        if timestamp:
            connection = 'RECEIVING' if (now - timestamp).total_seconds() <= stale_seconds else 'STALE'
        else:
            connection = 'CONFIGURATION_REQUIRED'

        obs = [(as_utc(r['timestamp']), r.get('machine_status') == 'STOPPED') for r in sensors]
        downtime = summarize_downtime(obs, now - dt.timedelta(hours=24), now, round_minutes=30, stale_seconds=stale_seconds) if obs else {'total_seconds': 0, 'current_downtime_seconds': 0}

        result.append({
            'machine_id': mid,
            'machine_code': code or f"CNC-{mid}",
            'name': row.get('name', f"Machine {mid}"),
            'model': row.get('model', 'Standard CNC'),
            'machine_type': row.get('machine_type', '5-Axis CNC Machining Center'),
            'production_line': row.get('line_id', 'Line 5AX-01'),
            'plant': row.get('plant', 'Plant A: Precision Machining'),
            'location': row.get('location', 'Floor A1: Aerospace Micro-Milling'),
            'manufacturer': row.get('manufacturer', 'Mazak'),
            'registry_source': 'MYSQL',
            'registered_in_sql': True,
            'description': row.get('description', ''),
            'last_inspection_date': str(row.get('last_inspection_date') or ''),
            'installation_date': str(row.get('installation_date') or ''),
            'is_active': bool(row.get('is_active', True)),
            'operating_status': row.get('status', 'Nominal'),
            'connection_status': connection,
            'current_round_downtime_seconds': downtime.get('current_downtime_seconds', 0),
            'total_downtime_seconds': downtime.get('total_seconds', 0),
            'latest_timestamp': timestamp.isoformat() if timestamp else None,
            'sensors': sensors
        })

    return result


class MachineCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    machine_type: str = Field(..., min_length=2, max_length=128)
    department: str = Field(..., min_length=2, max_length=128)
    location: str = Field(..., min_length=2, max_length=255)
    status: Literal['Nominal', 'Warning', 'Critical', 'Offline', 'Down', 'Idle', 'Maintenance'] = 'Nominal'
    installation_date: dt.date
    manufacturer: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = Field(None, max_length=2000)
    is_active: bool = True


class MachineRegistration(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    model: str = Field(min_length=1, max_length=128)
    description: str = Field(default='', max_length=2000)
    last_inspection_date: dt.date
    is_active: bool = True

    def checked(self):
        if not self.name.strip() or not self.model.strip():
            raise HTTPException(status_code=422, detail='Name and model cannot be blank')
        if self.last_inspection_date > dt.datetime.now(dt.timezone.utc).date():
            raise HTTPException(status_code=422, detail='Inspection date cannot be in the future')
        return self


def register(app, api):
    require_admin = api['require_roles'](['Admin'])
    get_user = api['get_current_user']

    @app.get('/api/v1/admin/machine-inventory')
    def inventory(user=Depends(require_admin)):
        with api['get_telemetry_engine']().connect() as connection:
            rows = connection.execute(api['_sql_text']('SELECT * FROM machines ORDER BY machine_code')).mappings().all()
            columns = connection.execute(api['_sql_text']("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='machines'")).all()
        fields = {row[0] for row in columns}
        available = api['load_available_machine_master']()
        codes = {m['machineCode'] for m in available.values()}
        rows = [row for row in rows if row['machine_code'] in codes]
        records = build_inventory(available, [dict(row) for row in rows],
            api['get_simulator_fleet_latest_readings'](user=user), api['_utcnow'](),
            max(2, int(os.getenv('TELEMETRY_STALE_SECONDS', '30'))))
        return {'records': records, 'sql_registered': len(rows), 'catalog_stations': len(available), 'archived_catalog_stations': len(api['load_canonical_machine_master']()) - len(available),
            'receiving': sum(row['connection_status'] == 'RECEIVING' for row in records),
            'stale': sum(row['connection_status'] == 'STALE' for row in records),
            'schema_ready': {'machine_id', 'operating_limits', 'sensor_configuration'}.issubset(fields),
            'management_note': 'SQL registration requires a recorded inspection date. Catalog identity and telemetry history are preserved.'}

    @app.get('/api/v1/simulator/active-machines')
    def get_simulator_active_machines():
        """Expose active machine roster for AI Simulator synchronization (default ~50 machines)."""
        limit = get_default_active_count()
        catalog = api['load_canonical_machine_master']()
        sorted_catalog = sorted(catalog.values(), key=lambda m: m.get('machineId', ''))
        active = []

        # Read SQL overrides if database is available
        sql_machines = {}
        try:
            with api['get_telemetry_engine']().connect() as conn:
                rows = conn.execute(api['_sql_text']('SELECT machine_id, machine_code, name, is_active FROM machines')).mappings().all()
                for r in rows:
                    if r.get('machine_id'):
                        sql_machines[r['machine_id']] = r
        except Exception:
            pass

        for idx, m in enumerate(sorted_catalog):
            mid = m['machineId']
            if mid in sql_machines:
                is_act = bool(sql_machines[mid].get('is_active', True))
            else:
                is_act = (idx < limit)
            if is_act:
                active.append({
                    'machine_id': mid,
                    'machine_code': m['machineCode'],
                    'display_name': m['displayName'],
                    'machine_type': m['machineType'],
                    'department': m['shopFloor'],
                    'production_line': m['productionLine'],
                    'is_active': True
                })

        # Include dynamically registered machines
        for mid, d in DYNAMIC_REGISTERED_MACHINES.items():
            if d.get('is_active', True) and not any(a['machine_id'] == mid for a in active):
                active.append({
                    'machine_id': mid,
                    'machine_code': d.get('machine_code', f"CNC-{mid}"),
                    'display_name': d.get('name', mid),
                    'machine_type': d.get('machine_type', 'CNC'),
                    'department': d.get('location', 'Floor A1'),
                    'production_line': d.get('line_id', 'Line 5AX-01'),
                    'is_active': True
                })

        return {
            'default_configured_count': limit,
            'active_count': len(active),
            'active_machine_ids': [a['machine_id'] for a in active],
            'machines': active
        }

    @app.post('/api/v1/simulator/register-machine')
    def register_simulator_machine(payload: Dict[str, Any], user=Depends(require_admin)):
        """Dynamic simulator registration endpoint allowing zero-restart ingestion."""
        machine_id = payload.get('machine_id')
        if not machine_id:
            raise HTTPException(422, 'machine_id required')
        DYNAMIC_REGISTERED_MACHINES[machine_id] = payload
        return {'registered': True, 'machine_id': machine_id, 'simulator_sync': 'SYNCHRONIZED'}

    @app.get('/api/v1/admin/machine-inventory')
    def inventory(user=Depends(require_admin)):
        """Returns full machine inventory with active counts, downtime, and connection state."""
        rows = []
        fields = set()
        try:
            with api['get_telemetry_engine']().connect() as connection:
                rows = connection.execute(api['_sql_text']('SELECT * FROM machines ORDER BY machine_code')).mappings().all()
                columns = connection.execute(api['_sql_text']("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='machines'")).all()
                fields = {row[0] for row in columns}
        except Exception:
            rows = []

        catalog = api['load_canonical_machine_master']()
        # Merge dynamic additions
        for mid, dynamic_rec in DYNAMIC_REGISTERED_MACHINES.items():
            if mid not in catalog:
                catalog[mid] = {
                    'machineId': mid,
                    'machineCode': dynamic_rec.get('machine_code', f"CNC-{mid}"),
                    'displayName': dynamic_rec.get('name', mid),
                    'machineType': dynamic_rec.get('machine_type', '5-Axis CNC Machining Center'),
                    'model': dynamic_rec.get('model', 'C-Series'),
                    'plant': dynamic_rec.get('plant', 'Plant A: Precision Machining'),
                    'shopFloor': dynamic_rec.get('location', 'Floor A1: Aerospace Micro-Milling'),
                    'productionLine': dynamic_rec.get('production_line', 'Line 5AX-01'),
                    'manufacturer': dynamic_rec.get('manufacturer', 'Mazak'),
                    'status': dynamic_rec.get('status', 'Nominal'),
                    'is_active': dynamic_rec.get('is_active', True)
                }

        readings = api['get_simulator_fleet_latest_readings'](user=user)
        records = build_inventory(
            catalog,
            [dict(row) for row in rows],
            readings,
            api['_utcnow'](),
            max(2, int(os.getenv('TELEMETRY_STALE_SECONDS', '30'))),
            active_limit=get_default_active_count()
        )

        active_recs = [r for r in records if r['is_active']]

        # Dynamic KPI calculations
        active_count = len(active_recs)
        running_count = sum(1 for r in active_recs if r['operating_status'] in ('NORMAL', 'Nominal') and r['connection_status'] == 'RECEIVING')
        idle_count = sum(1 for r in active_recs if r['operating_status'] in ('IDLE', 'Idle', 'WAITING') or r['connection_status'] == 'WAITING')
        down_count = sum(1 for r in active_recs if r['operating_status'] in ('STOPPED', 'CRITICAL', 'Critical', 'Down'))
        maintenance_count = sum(1 for r in active_recs if r['operating_status'] in ('MAINTENANCE', 'Maintenance'))

        return {
            'records': records,
            'sql_registered': len(rows),
            'catalog_stations': len(catalog),
            'total_registered': len(records),
            'active_machines': active_count,
            'running_machines': running_count,
            'idle_machines': idle_count,
            'down_machines': down_count,
            'maintenance_machines': maintenance_count,
            'receiving': sum(row['connection_status'] == 'RECEIVING' for row in records),
            'stale': sum(row['connection_status'] == 'STALE' for row in records),
            'schema_ready': {'machine_id', 'is_active'}.issubset(fields) if fields else True,
            'management_note': 'Initial active machine population is set to 50 machines. Additional machines register dynamically in SQL and the AI Simulator.'
        }

    @app.post('/api/v1/admin/machines', status_code=201)
    def create_machine(payload: MachineCreateRequest, request: Request, user=Depends(require_admin)):
        """Admin creates a new machine. Auto-generates unique machine_id, persists in SQL, and registers with simulator."""
        engine = api['get_telemetry_engine']()
        catalog = api['load_canonical_machine_master']()

        # Generate next unique machine ID (e.g. MCH-051 or MCH-401)
        # Determine highest existing numerical ID in catalog and SQL
        all_ids = set(catalog.keys()).union(DYNAMIC_REGISTERED_MACHINES.keys())
        try:
            with engine.connect() as conn:
                existing = conn.execute(api['_sql_text']('SELECT machine_id FROM machines')).scalars().all()
                all_ids.update(filter(None, existing))
        except Exception:
            pass

        # Try MCH-051 first if default 50 were active and MCH-051 is open, or next highest
        numeric_ids = []
        for mid in all_ids:
            if mid.startswith('MCH-'):
                try:
                    numeric_ids.append(int(mid[4:]))
                except ValueError:
                    pass

        # If exactly 50 active machines exist and we are adding 1, generate MCH-051
        if 51 not in numeric_ids:
            new_num = 51
        else:
            new_num = max(numeric_ids, default=50) + 1
        new_machine_id = f"MCH-{new_num:03d}"

        # Generate machine code
        type_prefix = {
            '5-Axis CNC Machining Center': 'CNC-5AX',
            'CNC Vertical Machining Center': 'CNC-VMC',
            'CNC Turning Center': 'CNC-TURN',
            'CNC Horizontal Machining Center': 'CNC-HMC',
            'CNC Grinding Machine': 'CNC-GRIND',
            'CNC Drilling and Tapping Center': 'CNC-DRILL',
            'CNC Mill-Turn Center': 'CNC-MT'
        }.get(payload.machine_type, 'CNC-GEN')
        new_machine_code = f"{type_prefix}-{new_num:03d}"

        model_name = payload.manufacturer + " " + payload.name if payload.manufacturer else payload.name

        # Store in dynamic cache immediately for instant simulator ingestion & zero restart
        machine_record = {
            'machineId': new_machine_id,
            'machine_id': new_machine_id,
            'machineCode': new_machine_code,
            'machine_code': new_machine_code,
            'displayName': payload.name.strip(),
            'name': payload.name.strip(),
            'model': model_name,
            'machineType': payload.machine_type,
            'machine_type': payload.machine_type,
            'plant': 'Plant A: Precision Machining',
            'shopFloor': payload.department,
            'location': payload.location,
            'productionLine': 'Line 5AX-01',
            'line_id': 'Line 5AX-01',
            'status': payload.status,
            'installation_date': payload.installation_date.isoformat(),
            'manufacturer': payload.manufacturer or 'Mazak',
            'description': payload.description or '',
            'is_active': payload.is_active,
            'registered_in_sql': True
        }

        # Persist to MySQL
        try:
            with engine.begin() as connection:
                connection.execute(api['_sql_text']("""
                    INSERT INTO machines
                      (machine_code, machine_id, name, model, line_id, machine_type, plant, location,
                       manufacturer, installation_date, description, last_inspection_date, is_active,
                       status, active_workpiece, simulator_machine_id)
                    VALUES
                      (:code, :mid, :name, :model, :line, :type, :plant, :loc,
                       :mfr, :inst_date, :desc, :inst_date, :active,
                       :status, 'Standard Production Run', :mid)
                    ON DUPLICATE KEY UPDATE
                      name = VALUES(name),
                      model = VALUES(model),
                      machine_type = VALUES(machine_type),
                      location = VALUES(location),
                      is_active = VALUES(is_active),
                      status = VALUES(status)
                """), {
                    'code': new_machine_code,
                    'mid': new_machine_id,
                    'name': payload.name.strip(),
                    'model': model_name,
                    'line': 'Line 5AX-01',
                    'type': payload.machine_type,
                    'plant': 'Plant A: Precision Machining',
                    'loc': payload.location,
                    'mfr': payload.manufacturer,
                    'inst_date': payload.installation_date,
                    'desc': payload.description or '',
                    'active': payload.is_active,
                    'status': payload.status
                })
                api['_audit_insert'](
                    connection,
                    employee_id=user['id'],
                    employee_work_id=user['work_id'],
                    employee_name=user['full_name'],
                    role=user['role'],
                    session_id=user.get('session_id'),
                    request_id=getattr(request.state, 'request_id', None),
                    event_type='machine_created',
                    details=f"Created new machine {new_machine_id} ({new_machine_code}: {payload.name}); active={payload.is_active}"
                )
        except Exception as e:
            raise HTTPException(503, 'Machine was not saved in MySQL') from e

        DYNAMIC_REGISTERED_MACHINES[new_machine_id] = machine_record

        return {
            'success': True,
            'machine': machine_record,
            'machine_id': new_machine_id,
            'machine_code': new_machine_code,
            'simulator_registered': False,
            'message': f"Machine {new_machine_id} saved in FactoryPulse MySQL. Configure its sender before expecting readings."
        }

    @app.patch('/api/v1/admin/machines/{machine_id}/activation')
    def toggle_activation(machine_id: str, payload: Dict[str, bool], request: Request, user=Depends(require_admin)):
        """Toggle active simulation state of a machine."""
        is_active = bool(payload.get('is_active', True))

        try:
            engine = api['get_telemetry_engine']()
            with engine.begin() as connection:
                connection.execute(api['_sql_text']("""
                    UPDATE machines SET is_active = :is_active WHERE machine_id = :mid OR machine_code = :mid
                """), {'is_active': is_active, 'mid': machine_id})
                api['_audit_insert'](
                    connection,
                    employee_id=user['id'],
                    employee_work_id=user['work_id'],
                    employee_name=user['full_name'],
                    role=user['role'],
                    session_id=user.get('session_id'),
                    request_id=getattr(request.state, 'request_id', None),
                    event_type='machine_activation_toggled',
                    details=f"Machine {machine_id} activation set to {is_active}"
                )
        except Exception as e:
            raise HTTPException(503, 'Activation was not saved in MySQL') from e

        if machine_id in DYNAMIC_REGISTERED_MACHINES:
            DYNAMIC_REGISTERED_MACHINES[machine_id]['is_active'] = is_active
        return {'machine_id': machine_id, 'is_active': is_active, 'status': 'updated'}

    @app.get('/api/v1/machines/{machine_id}/ai-health')
    def machine_ai_health(machine_id: str, user=Depends(get_user)):
        """AI Machine Health Assistant analyzing live sensor telemetry, downtime, and failure indicators."""
        machine = api['resolve_canonical_machine'](machine_id)
        if user['role'] == 'Operator' and machine.get('machineCode') != user.get('assigned_machine'):
            raise HTTPException(403, 'Operators may only view AI health for their assigned machine')

        readings = []
        try:
            readings = api['get_simulator_telemetry_readings'](machine_id=machine_id, limit=60, user=user)
            readings = [r.model_dump() if hasattr(r, 'model_dump') else dict(r) for r in readings]
        except Exception:
            readings = []

        downtime = {}
        try:
            downtime = api['downtime'](machine_id=machine_id, minutes=60, user=user)
        except Exception:
            downtime = {'total_seconds': 0, 'current_downtime_seconds': 0}

        return analyze_machine_health(machine_id, machine, readings, downtime)

    @app.put('/api/v1/admin/machine-inventory/{machine_id}')
    def save_machine(machine_id: str, payload: MachineRegistration, request: Request,
                     user=Depends(require_admin)):
        payload.checked()
        machine = api['resolve_canonical_machine'](machine_id)
        engine = api['get_telemetry_engine']()
        try:
            with engine.begin() as connection:
                existing = connection.execute(api['_sql_text']('SELECT id FROM machines WHERE machine_code=:code FOR UPDATE'), {'code': machine['machineCode']}).first()
                params = {
                    'code': machine['machineCode'], 'machine_id': machine_id, 'name': payload.name.strip(),
                    'model': payload.model.strip(), 'description': payload.description, 'inspection': payload.last_inspection_date,
                    'active': payload.is_active, 'line': machine['productionLine'], 'type': machine['machineType'],
                    'plant': machine['plant'], 'location': machine['shopFloor']
                }
                if existing:
                    connection.execute(api['_sql_text']('UPDATE machines SET name=:name,model=:model,description=:description,last_inspection_date=:inspection,is_active=:active WHERE machine_code=:code'), params)
                else:
                    connection.execute(api['_sql_text']("""INSERT INTO machines
                      (machine_code,machine_id,name,model,line_id,machine_type,plant,location,description,
                       last_inspection_date,is_active,status,active_workpiece,simulator_machine_id)
                      VALUES (:code,:machine_id,:name,:model,:line,:type,:plant,:location,:description,
                              :inspection,:active,'Offline','Not recorded',:machine_id)"""), params)
                api['_audit_insert'](
                    connection, employee_id=user['id'], employee_work_id=user['work_id'],
                    employee_name=user['full_name'], role=user['role'], session_id=user.get('session_id'),
                    request_id=getattr(request.state, 'request_id', None),
                    event_type='machine_updated' if existing else 'machine_registered',
                    details=f"Saved SQL machine registration {machine_id}; active={payload.is_active}"
                )
            if machine_id in DYNAMIC_REGISTERED_MACHINES:
                DYNAMIC_REGISTERED_MACHINES[machine_id]['is_active'] = payload.is_active
            return {'saved': True, 'machine_id': machine_id, 'storage': 'MySQL'}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503, detail='Machine registration could not be saved. Check database connection.')
