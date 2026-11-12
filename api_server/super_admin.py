"""Audited, server-controlled employee views bound to a real Super Admin session.

No employee passwords or employee login tokens are issued. Views are intentionally
process-local: restarting the server returns the owner to their own account.
"""
from threading import RLock
import time
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

_views = {}
_lock = RLock()
CONTROL_PATHS = {'/api/v1/super-admin/users', '/api/v1/super-admin/user-view', '/api/v1/auth/logout'}
SAFE_FIELDS = 'id,work_id,full_name,role,assigned_machine,email,department,shift,is_active'

def clear_view(session_id):
    with _lock: _views.pop(session_id, None)

def effective_user(principal, request, api):
    session = principal['session_id']
    with _lock:
        view = _views.get(session)
        if view and view["expires"] <= time.monotonic():
            with api['get_telemetry_engine']().begin() as c:
                api['_audit_insert'](c,employee_id=principal['id'],employee_work_id=principal['work_id'],
                    employee_name=principal['full_name'],role=principal['role'],event_type='employee_view_expired',
                    session_id=session,request=request,resource_type='employee_view',resource_id=view['employee_id'],
                    details='Employee view time limit reached; returned to the session owner.')
            _views.pop(session, None); view = None
    target_id = view["employee_id"] if view else None
    if not target_id: return principal
    if principal['role'] != 'Super Admin':
        clear_view(session)
        return principal
    # Control routes always authenticate the real session owner, never the view.
    if request.url.path in CONTROL_PATHS: return principal
    with api['get_telemetry_engine']().connect() as c:
        target = c.execute(api['_sql_text']('SELECT '+SAFE_FIELDS+' FROM users WHERE id=:id'), {'id':target_id}).mappings().first()
    if not target or not target['is_active']:
        clear_view(session)
        raise HTTPException(403, 'Employee view ended because that account is inactive. Refresh to return to Super Admin.')
    request.state.acting_principal = principal
    request.state.acting_as = {'id':target['id'], 'work_id':target['work_id'], 'role':target['role']}
    return dict(target) | {'session_id':session, 'session_started_at_utc':principal['session_started_at_utc'],
                           'view_owner_work_id':principal['work_id'], 'view_owner_name':principal['full_name'],
                           'view_remaining_seconds':max(0,int(view['expires']-time.monotonic())), 'view_reason':view['reason']}

class UserView(BaseModel):
    employee_id: int | None = Field(default=None, gt=0)
    reason: str = Field(default="", max_length=160)
    minutes: int = Field(default=15, ge=1, le=30)

def register(app,api):
    owner = api['require_roles'](['Super Admin'])
    sql=api['_sql_text']
    def audit(c,user,request,event,target,reason="",minutes=0):
        api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],
            event_type=event,session_id=user['session_id'],request=request,request_id=getattr(request.state,'request_id',None),
            resource_type='employee_view',resource_id=target.get('id') if target else None,
            details=('Employee view: '+target['work_id']+'; effective role '+target['role']+f'; duration {minutes} min; reason: {reason}') if target else 'Returned to own Super Admin account')

    @app.get('/api/v1/super-admin/users')
    def users(user=Depends(owner)):
        if api['DEMO_AUTH_ENABLED']:raise HTTPException(403,'Employee views require a real authenticated database session')
        with api['get_telemetry_engine']().connect() as c:
            rows=c.execute(sql('SELECT '+SAFE_FIELDS+' FROM users ORDER BY role,full_name,work_id')).mappings().all()
        return [dict(r) for r in rows]

    @app.post('/api/v1/super-admin/user-view')
    def switch(payload:UserView,request:Request,user=Depends(owner)):
        if api['DEMO_AUTH_ENABLED']:raise HTTPException(403,'Employee views require a real authenticated database session')
        target=None
        if payload.employee_id and payload.employee_id!=user["id"] and len(payload.reason.strip())<8:
            raise HTTPException(422,"Enter a reason of at least 8 characters before opening an employee view")
        with _lock:
            with api['get_telemetry_engine']().begin() as c:
                if payload.employee_id and payload.employee_id!=user['id']:
                    target=c.execute(sql('SELECT '+SAFE_FIELDS+' FROM users WHERE id=:id'),{'id':payload.employee_id}).mappings().first()
                    if not target:raise HTTPException(404,'Employee not found')
                    if not target['is_active']:raise HTTPException(409,'Inactive accounts cannot be opened')
                    if user['session_id'] not in _views and len(_views)>=1024:raise HTTPException(503,'Employee view capacity reached; end another view first')
                audit(c,user,request,'employee_view_started' if target else 'employee_view_ended',target,payload.reason.strip(),payload.minutes)
            # Publish the switch only after the audit transaction commits.
            if target:_views[user['session_id']]={'employee_id':target['id'],'expires':time.monotonic()+payload.minutes*60,'reason':payload.reason.strip()}
            else:_views.pop(user['session_id'],None)
        return {'viewing_employee_id': target['id'] if target else None, 'message':'Employee view opened' if target else 'Returned to Super Admin'}
