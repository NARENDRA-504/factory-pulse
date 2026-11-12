"""SQL-backed cost assumptions, service plans, inspections and onboarding checks."""
import datetime as dt
import json
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel,ConfigDict,Field
from .team_access import check_machine,scoped_catalog
from .usage_tracking import usage_summary
from typing import Literal


class Settings(BaseModel):
    model_config=ConfigDict(allow_inf_nan=False)
    scrap_inr_per_part: float=Field(default=0,ge=0,le=1000000)
    downtime_inr_per_hour: float=Field(default=0,ge=0,le=10000000)
    electricity_inr_per_kwh: float=Field(default=0,ge=0,le=10000)
    costs_approved: bool=False
    cost_basis: Literal['unconfigured','internship_estimate','factory_approved']='unconfigured'
    cost_note: str=Field(default='',max_length=300)
    service_interval_hours: float | None=Field(default=None,gt=0,le=100000)
    service_interval_cycles: int | None=Field(default=None,gt=0,le=100000000)
    next_service_at: dt.datetime | None=None
    checklist: list[str]=Field(default_factory=list,max_length=8)


class Inspection(BaseModel):
    completed_steps:list[str]=Field(max_length=8)
    note:str=Field(min_length=3,max_length=200)
    complete_service: bool=False


def read_settings(row):
    limits=row.get('operating_limits') or {}
    if isinstance(limits,str):limits=json.loads(limits)
    return Settings.model_validate(limits.get('factorypulse_operations',{}))


def register(app,api):
    sql=api['_sql_text']
    def machine_row(c,mid,user,lock=False):
        machine=api['resolve_canonical_machine'](mid);check_machine(user,machine['machineCode'])
        row=c.execute(sql('SELECT * FROM machines WHERE machine_code=:code'+(' FOR UPDATE' if lock else '')),{'code':machine['machineCode']}).mappings().first()
        if not row:raise HTTPException(409,'Register this machine in Machine Management first.')
        return machine,dict(row)
    @app.get('/api/v1/operations/cost-rates')
    def rates(user=Depends(api['get_current_user'])):
        catalog=scoped_catalog(user,api['load_available_machine_master']())
        with api['get_telemetry_engine']().connect() as c:
            stored={r['machine_code']:dict(r) for r in c.execute(sql('SELECT machine_code,operating_limits FROM machines')).mappings()}
        return {mid:read_settings(stored.get(m['machineCode'],{})).model_dump(mode='json') for mid,m in catalog.items()}

    @app.get('/api/v1/operations/machines/{machine_id}')
    def details(machine_id:str,user=Depends(api['get_current_user'])):
        with api['get_telemetry_engine']().connect() as c:
            machine,row=machine_row(c,machine_id,user);settings=read_settings(row)
            operators=c.execute(sql("SELECT COUNT(*) FROM users WHERE role='Operator' AND is_active=1 AND assigned_machine=:code"),{'code':machine['machineCode']}).scalar()
            inspections=c.execute(sql("""SELECT id,employee_work_id,employee_name,details,occurred_at_utc FROM activity_log
                WHERE event_type='inspection_completed'
                AND JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(details) THEN details ELSE '{}' END,'$.machine_id'))=:id
                ORDER BY id DESC LIMIT 20"""),{'id':machine_id}).mappings().all()
        due=settings.next_service_at
        if due and due.tzinfo is None:due=due.replace(tzinfo=dt.timezone.utc)
        readings=api['get_simulator_fleet_latest_readings'](user=user)
        own={r.sensor_name:r for r in readings if r.machine_id==machine_id}
        exposure={}
        cohort=own.get('Model Planned Time')
        for name,sensor,rate in [('scrap','Model Window Scrap',settings.scrap_inr_per_part),('downtime','Model Down Time',settings.downtime_inr_per_hour/3600),('energy','Model Electrical Energy',settings.electricity_inr_per_kwh)]:
            r=own.get(sensor)
            value=r.sensor_value if r and cohort and r.timestamp==cohort.timestamp and r.data_quality=='GOOD' else None
            exposure[name]=round(float(value)*rate,2) if settings.costs_approved and rate>0 and isinstance(value,(int,float)) and not isinstance(value,bool) and value>=0 else None
        fresh=max((r.timestamp for r in own.values()),default=None)
        limits=row.get('operating_limits') or {}
        if isinstance(limits,str):limits=json.loads(limits)
        usage=usage_summary(limits.get('factorypulse_usage',{}),settings)
        return {'machine_id':machine_id,'machine_code':machine['machineCode'],'settings':settings.model_dump(mode='json'),'usage':usage,
            'service_due':bool(due and due<=api['_utcnow']()) or usage['due'],'last_inspection_date':str(row.get('last_inspection_date') or ''),
            'inspections':[dict(r) for r in inspections],'cost_exposure_inr':exposure,'latest_reading':fresh,
            'onboarding':{'sql_registered':True,'operator_assigned':bool(operators),'receiving':bool(fresh and (api['_utcnow']()-dt.datetime.fromisoformat(str(fresh).replace('Z','+00:00'))).total_seconds()<=30)},
            'cost_basis':'Configured rates × latest observed model-window scrap, downtime seconds / 3600, and modeled electrical kWh. Estimates, not accounting totals.'}
    @app.put('/api/v1/admin/operations/machines/{machine_id}')
    def configure(machine_id:str,payload:Settings,request:Request,user=Depends(api['require_roles'](['Admin']))):
        if any(not step.strip() or len(step)>120 for step in payload.checklist):raise HTTPException(422,'Use up to eight checklist steps, each 1–120 characters.')
        if len(set(payload.checklist))!=len(payload.checklist):raise HTTPException(422,'Checklist steps must be unique.')
        if payload.next_service_at and payload.next_service_at.tzinfo is None:raise HTTPException(422,'Service date must include timezone')
        with api['get_telemetry_engine']().begin() as c:
            machine,row=machine_row(c,machine_id,user,True)
            c.execute(sql("UPDATE machines SET operating_limits=JSON_SET(COALESCE(operating_limits,JSON_OBJECT()),'$.factorypulse_operations',CAST(:config AS JSON)) WHERE machine_code=:code"),{'config':payload.model_dump_json(),'code':machine['machineCode']})
            api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],event_type='machine_operations_configured',request=request,resource_type='machine',resource_id=machine_id,changed_fields=list(payload.model_fields),details='Updated cost assumptions, service due date and inspection checklist. Other operating limits preserved.')
        return {'saved':True}
    @app.post('/api/v1/maintenance/inspections/{machine_id}',status_code=201)
    def inspect(machine_id:str,payload:Inspection,request:Request,user=Depends(api['require_roles'](['Maintenance']))):
        with api['get_telemetry_engine']().begin() as c:
            machine,row=machine_row(c,machine_id,user,True);settings=read_settings(row)
            if not settings.checklist:raise HTTPException(409,'An Admin must configure the inspection checklist first.')
            if set(payload.completed_steps)!=set(settings.checklist):raise HTTPException(422,'Complete every configured inspection step.')
            if payload.complete_service:
                limits=row.get('operating_limits') or {}
                if isinstance(limits,str):limits=json.loads(limits)
                usage=limits.get('factorypulse_usage',{});streams=usage.get('streams',{})
                if not all(streams.get(k,{}).get('timestamp') for k in ('run_seconds','good_parts','scrap_parts')):raise HTTPException(409,'Usage tracking needs valid running-time and part-counter baselines before service completion.')
                usage['service_baseline']={'run_seconds':streams['run_seconds']['total'],'cycles':streams['good_parts']['total']+streams['scrap_parts']['total'],'at':api['_utcnow']().isoformat()}
                c.execute(sql("UPDATE machines SET operating_limits=JSON_SET(operating_limits,'$.factorypulse_usage',CAST(:state AS JSON)) WHERE machine_code=:code"),{'state':json.dumps(usage),'code':machine['machineCode']})
            c.execute(sql('UPDATE machines SET last_inspection_date=UTC_DATE() WHERE machine_code=:code'),{'code':machine['machineCode']})
            api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],event_type='inspection_completed',request=request,resource_type='machine',resource_id=machine_id,details=json.dumps({'machine_id':machine_id,'steps':len(payload.completed_steps),'note':payload.note,'service_completed':payload.complete_service},ensure_ascii=False))
        return {'saved':True,'next_service_unchanged':True,'usage_baseline_reset':payload.complete_service}
