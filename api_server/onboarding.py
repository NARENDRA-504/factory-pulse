"""Explicit Admin sender provisioning. Never starts streams or changes passwords."""
import json
import os
import threading
from pathlib import Path
import httpx
from dotenv import dotenv_values
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from .team_access import PLAN

LOCK=threading.Lock()


class Onboard(BaseModel):
    template_machine_id:str
    operator_work_id:str | None=None
    supervisor_work_id:str | None=None


def register(app,api):
    sql=api['_sql_text']
    @app.post('/api/v1/admin/onboarding/{machine_id}')
    def onboard(machine_id:str,payload:Onboard,request:Request,user=Depends(api['require_roles'](['Admin']))):
        machine=api['resolve_canonical_machine'](machine_id)
        if payload.template_machine_id not in api['load_available_machine_master']():raise HTTPException(422,'Choose an available sensor template')
        with api['get_telemetry_engine']().connect() as c:
            registered=c.execute(sql('SELECT id FROM machines WHERE machine_code=:code'),{'code':machine['machineCode']}).scalar()
        if not registered:raise HTTPException(409,'Save this machine in Machine Management first.')
        with LOCK:
            plan=json.loads(PLAN.read_text(encoding='utf-8'));team=None
            if payload.operator_work_id and not payload.supervisor_work_id:
                raise HTTPException(422,'Select the responsible supervisor when assigning an operator.')
            if payload.supervisor_work_id:
                team=next((t for t in plan['teams'] if t['supervisor_work_id']==payload.supervisor_work_id),None)
                if not team:raise HTTPException(422,'Choose a planned team supervisor')
                if team['plant']!=machine['plant']:raise HTTPException(422,'Choose a supervisor from this machine’s plant')
                memberships=[t for t in plan['teams'] if any(m['machine_code']==machine['machineCode'] for m in t['machines'])]
                if memberships and team not in memberships:raise HTTPException(409,'Machine already belongs to another team')
                if not memberships and len(team['machines'])>=plan['maximum_machines_per_supervisor']:raise HTTPException(409,'This team already has four machines')
            with api['get_telemetry_engine']().connect() as c:
                if payload.operator_work_id:
                    operator=c.execute(sql("SELECT id FROM users WHERE work_id=:badge AND role='Operator' AND is_active=1"),{'badge':payload.operator_work_id}).scalar()
                    if not operator:raise HTTPException(422,'Choose an active Operator account')
                if team:
                    supervisor=c.execute(sql("SELECT id FROM users WHERE work_id=:badge AND role='Supervisor' AND department=:department AND is_active=1"),{'badge':payload.supervisor_work_id,'department':team['department']}).scalar()
                    if not supervisor:raise HTTPException(422,'The team supervisor assignment is inactive or changed')
            # Backend-only credentials: explicitly configured for hosted installations,
            # or the existing separate local Simulator environment on this PC.
            local=Path(__file__).resolve().parents[1].parent/'AI Simulator/backend/.env'
            config=dotenv_values(local) if local.is_file() else {}
            key=os.getenv('SIMULATOR_CONTROL_API_KEY') or config.get('SIMULATOR_API_KEY')
            url=os.getenv('SIMULATOR_CONTROL_URL','http://127.0.0.1:8002').rstrip('/')
            if not key:raise HTTPException(503,'Configure the backend Simulator control credentials; do not put them in browser settings.')
            try:
                response=httpx.post(url+'/api/v1/onboarding/register',headers={'X-API-Key':key},json={'identity':machine,'template_machine_id':payload.template_machine_id},timeout=15)
                if response.status_code!=200:raise HTTPException(503,'Sender registration was not confirmed. Existing machine records remain saved.')
                result=response.json()
                if result.get('machine_id')!=machine_id or not result.get('registered'):raise ValueError('Unexpected sender acknowledgement')
            except httpx.RequestError as exc:raise HTTPException(503,'The Simulator backend is unavailable. Retry onboarding after it is running.') from exc
            old_plan=PLAN.read_text(encoding='utf-8')
            if team and not any(m['machine_code']==machine['machineCode'] for m in team['machines']):
                team['machines'].append({'machine_id':machine_id,'machine_code':machine['machineCode']})
            try:
                with api['get_telemetry_engine']().begin() as c:
                    if payload.operator_work_id:
                        c.execute(sql('UPDATE users SET assigned_machine=:code,department=COALESCE(:department,department) WHERE work_id=:badge'),{'code':machine['machineCode'],'department':team['department'] if team else None,'badge':payload.operator_work_id})
                        if team:team['primary_operators'][machine['machineCode']]=payload.operator_work_id
                    api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],event_type='machine_onboarded',request=request,resource_type='machine',resource_id=machine_id,details=json.dumps({'template':payload.template_machine_id,'operator':payload.operator_work_id,'supervisor':payload.supervisor_work_id}))
                    tmp=PLAN.with_suffix('.tmp');tmp.write_text(json.dumps(plan,indent=2),encoding='utf-8');tmp.replace(PLAN)
            except Exception:
                tmp=PLAN.with_suffix('.tmp');tmp.write_text(old_plan,encoding='utf-8');tmp.replace(PLAN)
                raise
        api['_extra_machine_cache']=None
        return {'registered':True,'machine_id':machine_id,'started':False,'message':'Sender profile is ready. Start this machine in AI Simulator, then confirm Fresh telemetry here. Existing streams were not changed.'}
