"""Transactional Operator requests and team-scoped Supervisor decisions."""
import json
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from typing import Literal
from .team_access import PLAN, check_machine

class ChangeRequest(BaseModel):
    machine_id: str = Field(min_length=1,max_length=32)
    reason: str = Field(min_length=8,max_length=1000)
    @field_validator('reason')
    @classmethod
    def meaningful(cls,value):
        value=value.strip()
        if len(value)<8: raise ValueError('Explain why you need a different machine')
        return value

class Decision(BaseModel):
    decision: Literal['Approved','Rejected','Cancelled']
    note: str = Field(min_length=5,max_length=1000)
    @field_validator('note')
    @classmethod
    def meaningful(cls,value):
        value=value.strip()
        if len(value)<5:raise ValueError('Enter a meaningful decision note')
        return value

def operator_team(operator):
    try:
        plan=json.loads(PLAN.read_text(encoding='utf-8'))
    except (OSError,ValueError):raise HTTPException(503,'Team assignments are unavailable') from None
    matches=[t for t in plan.get('teams',[]) if t['department']==operator.get('department')
             and any(m['machine_code']==operator.get('assigned_machine') for m in t['machines'])]
    if len(matches)!=1:raise HTTPException(409,'Your current machine and department need a valid supervisor team assignment first.')
    return matches[0]

def authorize_review(user,row):
    if user['role']=='Super Admin':return
    if (user['role']!='Supervisor' or user.get('work_id')!=row['supervisor_work_id']
            or user.get('department')!=row['team_department']):
        raise HTTPException(403,'Only the responsible team Supervisor or Super Admin may review this request.')
    check_machine(user,row['from_machine_code']);check_machine(user,row['to_machine_code'])

SELECT='''SELECT r.*,u.work_id AS operator_work_id,u.full_name AS operator_name,
 v.full_name AS reviewed_by_name FROM machine_change_requests r
 JOIN users u ON u.id=r.operator_id LEFT JOIN users v ON v.id=r.reviewed_by_id'''

def register(app,api):
    sql=api['_sql_text']; engine=api['get_telemetry_engine']
    def ready(c):
        if not c.execute(sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='machine_change_requests'")).scalar():
            raise HTTPException(503,'Machine-change setup is pending. Apply 20261112_machine_change_and_super_admin.sql using the schema owner.')
    def audit(c,user,request,event,rid,details):
        api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],
            event_type=event,session_id=user.get('session_id'),request=request,
            request_id=getattr(request.state,'request_id',None),resource_type='machine_change',resource_id=rid,
            changed_fields=['assigned_machine'] if event=='machine_change_approved' else ['status'],details=details[:500])
    def output(row):
        data=dict(row)
        data.pop('pending_operator_id',None)
        for k in ['created_at_utc','reviewed_at_utc']:
            if data.get(k):data[k]=api['_iso_utc'](data[k])
        return data

    @app.get('/api/v1/machine-change/options')
    def options(user=Depends(api['require_roles'](['Operator']))):
        team=operator_team(user)
        codes={m['machine_code'] for m in team['machines']}
        catalog=api['load_available_machine_master']()
        return {'supervisor_work_id':team['supervisor_work_id'],'current_machine':user.get('assigned_machine'),
            'machines':[{'machine_id':mid,'machine_code':m['machineCode'],'name':m.get('displayName',m['machineCode'])}
                        for mid,m in catalog.items() if m['machineCode'] in codes and m['machineCode']!=user.get('assigned_machine')]}

    @app.get('/api/v1/machine-change/requests')
    def listing(user=Depends(api['require_roles'](['Operator','Supervisor','Admin']))):
        params={};where='1=1'
        if user['role']=='Operator':where='r.operator_id=:uid';params['uid']=user['id']
        elif user['role']=='Supervisor':
            where='r.supervisor_work_id=:badge AND r.team_department=:department'
            params={'badge':user['work_id'],'department':user.get('department')}
        with engine().connect() as c:
            ready(c)
            rows=c.execute(sql(SELECT+' WHERE '+where+' ORDER BY r.id DESC LIMIT 200'),params).mappings().all()
        if user['role']=='Supervisor':
            from .team_access import machine_codes
            allowed=machine_codes(user)
            rows=[r for r in rows if r['from_machine_code'] in allowed and r['to_machine_code'] in allowed]
        return [output(r) for r in rows]

    @app.post('/api/v1/machine-change/requests',status_code=201)
    def create(payload:ChangeRequest,request:Request,user=Depends(api['require_roles'](['Operator']))):
        with engine().begin() as c:
            ready(c)
            operator=c.execute(sql('SELECT id,work_id,role,is_active,assigned_machine,department,shift FROM users WHERE id=:id FOR UPDATE'),{'id':user['id']}).mappings().first()
            if not operator or operator['role']!='Operator' or not operator['is_active']:raise HTTPException(403,'An active Operator account is required')
            team=operator_team(operator)
            catalog=api['load_available_machine_master']()
            target=catalog.get(payload.machine_id)
            if not target or target['machineCode'] not in {m['machine_code'] for m in team['machines']}:
                raise HTTPException(403,'Choose an available machine within your current supervisor team')
            if target['machineCode']==operator['assigned_machine']:raise HTTPException(422,'Choose a different machine')
            if c.execute(sql("SELECT id FROM machine_change_requests WHERE operator_id=:id AND status='Pending'"),{'id':user['id']}).scalar():
                raise HTTPException(409,'You already have a pending request. Cancel it before submitting another.')
            supervisor=c.execute(sql("SELECT id FROM users WHERE work_id=:badge AND department=:department AND role='Supervisor' AND is_active=1"),{'badge':team['supervisor_work_id'],'department':team['department']}).scalar()
            if not supervisor:raise HTTPException(409,'Your responsible Supervisor must be active before requesting a change')
            rid=c.execute(sql('''INSERT INTO machine_change_requests(operator_id,from_machine_code,to_machine_code,
                supervisor_work_id,team_department,reason,status,created_at_utc)
                VALUES(:id,:old,:new,:supervisor,:department,:reason,'Pending',UTC_TIMESTAMP(6))'''),
                {'id':user['id'],'old':operator['assigned_machine'],'new':target['machineCode'],
                 'supervisor':team['supervisor_work_id'],'department':team['department'],'reason':payload.reason}).lastrowid
            audit(c,user,request,'machine_change_requested',rid,payload.reason)
        return {'id':rid,'status':'Pending','message':'Request sent to your Supervisor. Your current assignment has not changed.'}

    @app.patch('/api/v1/machine-change/requests/{request_id}')
    def decide(request_id:int,payload:Decision,request:Request,user=Depends(api['require_roles'](['Operator','Supervisor','Super Admin']))):
        with engine().begin() as c:
            ready(c)
            # A consistent operator-row lock order serializes approvals and competing
            # user-account assignment updates. No passwords or hash columns are read.
            operators=c.execute(sql("SELECT id,role,is_active,assigned_machine,department,shift FROM users WHERE role='Operator' ORDER BY id FOR UPDATE")).mappings().all()
            row=c.execute(sql('SELECT * FROM machine_change_requests WHERE id=:id FOR UPDATE'),{'id':request_id}).mappings().first()
            if not row:raise HTTPException(404,'Request not found')
            if payload.decision=='Cancelled':
                if user['role']!='Operator' or row['operator_id']!=user['id']:raise HTTPException(403,'Only the requesting Operator can cancel')
            else:authorize_review(user,row)
            if row['status']!='Pending':raise HTTPException(409,'This request has already been reviewed or cancelled')
            if payload.decision=='Approved':
                operator=next((o for o in operators if o['id']==row['operator_id']),None)
                if not operator or not operator['is_active'] or operator['assigned_machine']!=row['from_machine_code'] or operator['department']!=row['team_department']:
                    raise HTTPException(409,'The Operator assignment changed. Reject this stale request and ask for a new one.')
                team=operator_team(operator)
                if team['supervisor_work_id']!=row['supervisor_work_id'] or row['to_machine_code'] not in {m['machine_code'] for m in team['machines']}:
                    raise HTTPException(409,'The team changed. A new request is required.')
                available={m['machineCode'] for m in api['load_available_machine_master']().values()}
                if row['to_machine_code'] not in available:raise HTTPException(409,'The requested machine is no longer available')
                if any(o['id']!=operator['id'] and o['is_active'] and o['assigned_machine']==row['to_machine_code']
                       and (not o['shift'] or not operator['shift'] or o['shift']==operator['shift']) for o in operators):
                    raise HTTPException(409,'This machine has another active Operator in the same shift. An Admin must resolve coverage first; no assignment was changed.')
                c.execute(sql('UPDATE users SET assigned_machine=:machine WHERE id=:id'),{'machine':row['to_machine_code'],'id':row['operator_id']})
            c.execute(sql('''UPDATE machine_change_requests SET status=:status,review_note=:note,
                reviewed_by_id=:user,reviewed_at_utc=UTC_TIMESTAMP(6) WHERE id=:id'''),
                {'status':payload.decision,'note':payload.note,'user':user['id'],'id':request_id})
            audit(c,user,request,'machine_change_'+payload.decision.lower(),request_id,
                f"{row['from_machine_code']} -> {row['to_machine_code']}. {payload.note}")
        return {'id':request_id,'status':payload.decision,'message':'Decision saved. Approved assignments are read from MySQL on the next account refresh.'}
