"""Explicit local finite demonstrations. Never resumes the background outbox."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
import httpx
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

class DemoRequest(BaseModel):
    machine_id: str = Field(min_length=1,max_length=32)
    scenario_id: str = Field(min_length=1,max_length=64)
    duration_seconds: int = Field(default=60)

def settings():
    if os.getenv('DEPLOYMENT_MODE','local') != 'local':
        raise HTTPException(409,'Demonstration controls are available only in local mode')
    base=(os.getenv('SIMULATOR_CONTROL_URL') or 'http://127.0.0.1:8002').rstrip('/')
    parsed=urlparse(base)
    if parsed.scheme!='http' or parsed.hostname not in ('127.0.0.1','localhost') or parsed.username or parsed.password or parsed.path:
        raise HTTPException(503,'A loopback Simulator control URL is required')
    from dotenv import dotenv_values
    path=Path(__file__).resolve().parents[2]/'AI Simulator/backend/.env'
    key=os.getenv('SIMULATOR_CONTROL_API_KEY') or (dotenv_values(path).get('SIMULATOR_API_KEY','') if path.exists() else '')
    return base, {'X-API-Key':key} if key else {}

async def simulator(method,path,payload=None,timeout=5):
    base,headers=settings()
    try:
        async with httpx.AsyncClient(timeout=timeout,trust_env=False) as client:
            r=await client.request(method,base+path,headers=headers,json=payload)
        if r.status_code!=200:
            raise HTTPException(409 if r.status_code==409 else 503,'Simulator refused this action; check its controls and readiness')
        if len(r.content)>100000:raise ValueError()
        return r.json()
    except HTTPException:raise
    except (httpx.HTTPError,ValueError):
        raise HTTPException(503,'Simulator control unavailable. A started scenario remains bounded; use Stop finite demo to cancel.') from None

def public_status(data):
    keys=('active','job_id','machine_id','scenario_id','title','level','duration_seconds','stored','delivered','pending','failed','frames','started_at','finished_at','message')
    return {k:data.get(k) for k in keys if k in data}

def register(app,api):
    admin=api['require_roles'](['Admin'])
    def audit(user,request,event,payload):
        with api['get_telemetry_engine']().begin() as c:
            api['_audit_insert'](c,employee_id=user['id'],employee_name=user.get('full_name'),role=user['role'],
                employee_work_id=user.get('work_id'),event_type=event,session_id=user.get('session_id'),
                request=request,resource_type='finite_demo',resource_id=payload.get('machine_id'),
                details=json.dumps(payload,separators=(',',':')))
    @app.get('/api/v1/admin/demo/catalog/{machine_id}')
    async def catalog(machine_id:str,user=Depends(admin)):
        api['resolve_canonical_machine'](machine_id)
        from urllib.parse import quote
        data=await simulator('GET','/api/v1/simulation/scenarios?machine_id='+quote(machine_id,safe=''))
        return {'machine_id':machine_id,'scenarios':[{k:s.get(k) for k in ('id','title','level')} for s in data.get('scenarios',[])],
                'notice':'Finite synthetic demonstration. Assignment, repair and closure remain explicit employee actions.'}
    @app.get('/api/v1/admin/demo/status')
    async def status(user=Depends(admin)):
        return public_status(await simulator('GET','/api/v1/simulation/scenarios/status'))
    @app.post('/api/v1/admin/demo/run')
    async def run(payload:DemoRequest,request:Request,user=Depends(admin)):
        if payload.duration_seconds not in (0,60):raise HTTPException(422,'Choose one sample or a 60-second demonstration')
        api['resolve_canonical_machine'](payload.machine_id)
        # Audit must commit before a request can generate demonstration readings.
        audit(user,request,'finite_demo_requested',payload.model_dump())
        data=await simulator('POST','/api/v1/simulation/scenarios/send',payload.model_dump(),timeout=100)
        ids=[r.get('reading_id') for r in data.get('last_readings',[]) if r.get('reading_id')][:32]
        matched=0
        if ids:
            params={f'id{i}':v for i,v in enumerate(ids)}
            with api['get_telemetry_engine']().connect() as c:
                matched=c.execute(api['_sql_text']('SELECT COUNT(*) FROM simulator_sensor_readings WHERE reading_id IN ('+','.join(':'+k for k in params)+')'),params).scalar()
        evidence={'checked':len(ids),'matched':matched,'basis':'Final affected sensor samples only; not every frame or browser render'}
        result={**public_status(data),'mysql_verification':evidence}
        audit(user,request,'finite_demo_finished',{'machine_id':payload.machine_id,'scenario_id':payload.scenario_id,'matched':matched,'checked':len(ids)})
        return result
    @app.post('/api/v1/admin/demo/stop')
    async def stop(request:Request,user=Depends(admin)):
        audit(user,request,'finite_demo_stop_requested',{})
        data=await simulator('POST','/api/v1/simulation/scenarios/stop')
        return {'stopped':data.get('stopped') is True,'message':'Finite demo stopped; previously accepted requests may already be saved. Background delivery remains paused.'}
