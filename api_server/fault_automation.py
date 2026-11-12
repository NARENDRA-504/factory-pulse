"""Opt-in, sustained sensor alerts; never controls equipment or auto-closes incidents."""
import datetime as dt
import json
import math
import threading
import uuid
from pathlib import Path
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

PATH=Path(__file__).resolve().parents[1]/'.local/fault-policy.json'
UNITS={'RPM':'RPM','Temperature':'\u00b0C','Motor Temperature':'\u00b0C','Vibration':'mm/s','Pressure':'bar','Current':'A','Torque':'Nm','Coolant Flow':'L/min','Coolant Temperature':'\u00b0C'}
PHYSICAL=set(UNITS)


class FaultPolicy(BaseModel):
    enabled: bool=False
    sustained_seconds: int=Field(default=30,ge=15,le=600)
    minimum_samples: int=Field(default=3,ge=3,le=60)


class SustainedAlerts:
    def __init__(self):self.states={}
    def observe(self, rows, now, seconds=30, samples=3):
        due=[];seen=set()
        for r in rows:
            key=(r['machine_id'],r['sensor_name']);seen.add(key)
            stamp=dt.datetime.fromisoformat(str(r['timestamp']).replace('Z','+00:00'))
            if stamp.tzinfo is None:stamp=stamp.replace(tzinfo=dt.timezone.utc)
            value=r['sensor_value'];low=r.get('expected_min');high=r.get('expected_max')
            bad=(r['sensor_name'] in PHYSICAL and r['data_quality']=='GOOD' and isinstance(value,(int,float))
                 and not isinstance(value,bool) and math.isfinite(value) and r.get('sensor_unit')==UNITS.get(r['sensor_name'])
                 and all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) for x in (low,high)) and low<=high
                 and (value<low or value>high) and 0<=(now-stamp).total_seconds()<=30)
            if not bad:self.states.pop(key,None);continue
            previous=self.states.get(key)
            if previous and stamp<previous['last']:continue
            if not previous or (stamp-previous['last']).total_seconds()>30:
                previous={'first':stamp,'last':stamp,'samples':1};self.states[key]=previous
            elif stamp>previous['last']:
                previous['samples']+=1;previous['last']=stamp
            if previous['samples']>=samples and (stamp-previous['first']).total_seconds()>=seconds:due.append(r)
        for key in set(self.states)-seen:self.states.pop(key,None)
        return due


def register(app,api):
    sql=api['_sql_text'];stop=threading.Event();tracker=SustainedAlerts();state={'status':'disabled','created':0}
    def policy():return FaultPolicy.model_validate_json(PATH.read_text()) if PATH.exists() else FaultPolicy()
    def scan():
        rule=policy()
        if not rule.enabled:tracker.states.clear();state['status']='disabled';return
        with api['get_telemetry_engine']().connect() as c:
            reporter=c.execute(sql("SELECT id FROM users WHERE role IN ('Admin','Super Admin') AND is_active=1 ORDER BY id LIMIT 1")).scalar()
        if not reporter:state['status']='no_active_admin_reporter';return
        rows=[r.model_dump() for r in api['get_simulator_fleet_latest_readings'](user={'role':'Admin'})]
        for r in tracker.observe(rows,api['_utcnow'](),rule.sustained_seconds,rule.minimum_samples):
            machine=api['resolve_canonical_machine'](r['machine_id']);area='Automatic sensor alert: '+r['sensor_name']
            with api['get_telemetry_engine']().begin() as c:
                machine_row=c.execute(sql('SELECT id FROM machines WHERE machine_code=:code FOR UPDATE'),{'code':machine['machineCode']}).scalar()
                if machine_row is None:continue
                existing=c.execute(sql("SELECT id FROM incidents WHERE machine_code=:code AND component_area=:area AND status<>'Closed' LIMIT 1"),{'code':machine['machineCode'],'area':area}).scalar()
                if existing:continue
                description=f"{r['sensor_name']} remained outside configured {r['expected_min']}–{r['expected_max']} {r['sensor_unit']} for at least {rule.sustained_seconds}s. Latest value {r['sensor_value']} {r['sensor_unit']}. Review required; no diagnosis or equipment action was performed."
                result=c.execute(sql('''INSERT INTO incidents(incident_code,machine_code,reporter_id,severity,symptom_description,component_area,data_provenance,status,sensor_snapshot)
                    VALUES(:code,:machine,:reporter,:severity,:description,:area,'SIMULATED','Open',:snapshot)'''),
                    {'code':'INC-AUTO-'+uuid.uuid4().hex[:16].upper(),'machine':machine['machineCode'],'reporter':reporter,
                     'severity':'Critical' if r['machine_status']=='CRITICAL' else 'High','description':description,'area':area,'snapshot':json.dumps([r],default=str)})
                api['_audit_insert'](c,employee_name='FactoryPulse alert worker',event_type='automatic_incident_created',resource_type='incident',resource_id=str(result.lastrowid),details=description[:450])
            # Commit precedes visibility to the existing role-authorized incident polling.
            state['created']+=1
        state.update(status='monitoring',checked_at=api['_utcnow']().isoformat())
    def worker():
        while not stop.wait(10):
            try:scan()
            except Exception as exc:state['status']='degraded_'+type(exc).__name__
            try:
                tmp=PATH.with_name('fault-worker.tmp');tmp.write_text(json.dumps(state));tmp.replace(PATH.with_name('fault-worker.json'))
            except OSError:pass
    @app.on_event('startup')
    def start():threading.Thread(target=worker,daemon=True,name='sustained-fault-monitor').start()
    @app.on_event('shutdown')
    def shutdown():stop.set()
    @app.get('/api/v1/admin/fault-policy')
    def get(user=Depends(api['require_roles'](['Admin']))):return {'policy':policy().model_dump(),'worker':state}
    @app.put('/api/v1/admin/fault-policy')
    def save(payload:FaultPolicy,request:Request,user=Depends(api['require_roles'](['Admin']))):
        with api['get_telemetry_engine']().begin() as c:
            api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],event_type='fault_policy_changed',request=request,resource_type='fault_policy',resource_id='physical_sensors',details=payload.model_dump_json())
        tmp=PATH.with_suffix('.tmp');tmp.write_text(payload.model_dump_json());tmp.replace(PATH)
        return {'saved':True}
