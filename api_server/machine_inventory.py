"""Admin inventory with explicit registry provenance and SQL telemetry status."""
import datetime as dt
import os
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from .operational_insights import as_utc


def build_inventory(catalog, registered, readings, now, stale_seconds=30):
    saved_by_code={row['machine_code']:row for row in registered}
    telemetry={}
    for reading in readings:
        row=reading.model_dump(mode='json') if hasattr(reading,'model_dump') else dict(reading)
        telemetry.setdefault(row['machine_id'],[]).append(row)
    result=[]
    known_codes=set()
    for machine in catalog.values():
        code=machine['machineCode'];known_codes.add(code)
        stored=saved_by_code.get(code)
        sensors=telemetry.get(machine['machineId'],[])
        timestamp=max((as_utc(row['timestamp']) for row in sensors),default=None)
        connection='RECEIVING' if timestamp and (now-timestamp).total_seconds()<=stale_seconds else 'STALE' if timestamp else 'WAITING'
        rank={'NORMAL':0,'MAINTENANCE':1,'WARNING':2,'CRITICAL':3,'STOPPED':4}
        cohort=[row for row in sensors if timestamp and (timestamp-as_utc(row['timestamp'])).total_seconds()<=stale_seconds]
        status=max((row['machine_status'] for row in cohort),key=lambda value:rank.get(value,-1),default='UNKNOWN')
        result.append({'machine_id':machine['machineId'],'machine_code':code,
            'name':stored['name'] if stored else machine['displayName'],
            'model':stored['model'] if stored else machine['model'],'machine_type':machine['machineType'],
            'production_line':stored['line_id'] if stored else machine['productionLine'],
            'plant':machine['plant'],'location':machine['shopFloor'],
            'registry_source':'MYSQL' if stored else 'REFERENCE_CATALOG','registered_in_sql':bool(stored),
            'description':stored.get('description') if stored else '',
            'last_inspection_date':str(stored.get('last_inspection_date') or '') if stored else '',
            'is_active':bool(stored.get('is_active',True)) if stored else True,
            'operating_status':status,'connection_status':connection,
            'latest_timestamp':timestamp.isoformat() if timestamp else None,'sensors':sensors})
    for row in registered:
        if row['machine_code'] in known_codes: continue
        result.append({'machine_id':f"DB-{row['id']}",'machine_code':row['machine_code'],
            'name':row['name'],'model':row['model'],'machine_type':'Not configured',
            'production_line':row['line_id'],'plant':'Not configured','location':'Not configured',
            'registry_source':'MYSQL','registered_in_sql':True,'operating_status':'UNKNOWN',
            'connection_status':'CONFIGURATION_REQUIRED','latest_timestamp':None,'sensors':[]})
    return result


class MachineRegistration(BaseModel):
    name: str = Field(min_length=1,max_length=128)
    model: str = Field(min_length=1,max_length=128)
    description: str = Field(default='',max_length=2000)
    last_inspection_date: dt.date
    is_active: bool = True

    def checked(self):
        if not self.name.strip() or not self.model.strip():
            raise HTTPException(status_code=422,detail='Name and model cannot be blank')
        if self.last_inspection_date > dt.datetime.now(dt.timezone.utc).date():
            raise HTTPException(status_code=422,detail='Inspection date cannot be in the future')
        return self


def register(app,api):
    @app.get('/api/v1/admin/machine-inventory')
    def inventory(user=Depends(api['require_roles'](['Admin']))):
        with api['get_telemetry_engine']().connect() as connection:
            rows=connection.execute(api['_sql_text']('SELECT * FROM machines ORDER BY machine_code')).mappings().all()
            columns=connection.execute(api['_sql_text']("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='machines'")).all()
        fields={row[0] for row in columns}
        records=build_inventory(api['load_canonical_machine_master'](),[dict(row) for row in rows],
            api['get_simulator_fleet_latest_readings'](user=user),api['_utcnow'](),
            max(2,int(os.getenv('TELEMETRY_STALE_SECONDS','30'))))
        return {'records':records,'sql_registered':len(rows),'catalog_stations':len(api['load_canonical_machine_master']()),
            'receiving':sum(row['connection_status']=='RECEIVING' for row in records),
            'stale':sum(row['connection_status']=='STALE' for row in records),
            'schema_ready':{'machine_id','operating_limits','sensor_configuration'}.issubset(fields),
            'management_note':'SQL registration requires a recorded inspection date. Catalog identity and telemetry history are preserved.'}

    @app.put('/api/v1/admin/machine-inventory/{machine_id}')
    def save_machine(machine_id: str,payload: MachineRegistration,request: Request,
                     user=Depends(api['require_roles'](['Admin']))):
        payload.checked()
        machine=api['resolve_canonical_machine'](machine_id)
        engine=api['get_telemetry_engine']()
        try:
            with engine.begin() as connection:
                existing=connection.execute(api['_sql_text']('SELECT id FROM machines WHERE machine_code=:code FOR UPDATE'),{'code':machine['machineCode']}).first()
                params={'code':machine['machineCode'],'machine_id':machine_id,'name':payload.name.strip(),
                    'model':payload.model.strip(),'description':payload.description,'inspection':payload.last_inspection_date,
                    'active':payload.is_active,'line':machine['productionLine'],'type':machine['machineType'],
                    'plant':machine['plant'],'location':machine['shopFloor']}
                if existing:
                    connection.execute(api['_sql_text']('UPDATE machines SET name=:name,model=:model,description=:description,last_inspection_date=:inspection,is_active=:active WHERE machine_code=:code'),params)
                else:
                    connection.execute(api['_sql_text']("""INSERT INTO machines
                      (machine_code,machine_id,name,model,line_id,machine_type,plant,location,description,
                       last_inspection_date,is_active,status,active_workpiece,simulator_machine_id)
                      VALUES (:code,:machine_id,:name,:model,:line,:type,:plant,:location,:description,
                              :inspection,:active,'Offline','Not recorded',:machine_id)"""),params)
                api['_audit_insert'](connection,employee_id=user['id'],employee_work_id=user['work_id'],
                    employee_name=user['full_name'],role=user['role'],session_id=user.get('session_id'),
                    request_id=getattr(request.state,'request_id',None),
                    event_type='machine_updated' if existing else 'machine_registered',
                    details=f"Saved SQL machine registration {machine_id}; active={payload.is_active}")
            return {'saved':True,'machine_id':machine_id,'storage':'MySQL'}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503,detail='Machine registration could not be saved. Check the database migration and connection.')
