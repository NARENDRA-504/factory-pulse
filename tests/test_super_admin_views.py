"""Employee-view permissions and attribution. Isolated SQLite, no live accounts."""
import unittest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from api_server import super_admin as views
from api_server.access_roles import role_allowed
from api_server.team_access import machine_codes

class EmployeeViewTests(unittest.TestCase):
 def setUp(self):
  self.db=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
  with self.db.begin() as c:
   c.execute(text('CREATE TABLE users(id INTEGER PRIMARY KEY,work_id TEXT,full_name TEXT,role TEXT,assigned_machine TEXT,email TEXT,department TEXT,shift TEXT,is_active INT)'))
   c.execute(text("INSERT INTO users VALUES(1,'OWNER','Owner','Super Admin',NULL,'owner@test',NULL,NULL,1),(2,'OP1','Operator','Operator','CNC-1','op@test','Bay','Shift A',1),(3,'ADM','Admin','Admin',NULL,'adm@test',NULL,NULL,1),(4,'OFF','Inactive','Operator','CNC-2','off@test','Bay','Shift A',0)"))
   c.execute(text('CREATE TABLE audit(actor_id INT,event TEXT,target_id INT)'))
  self.actor=1;self.fail_audit=False
  self.api={'DEMO_AUTH_ENABLED':False,'_sql_text':text,'get_telemetry_engine':lambda:self.db}
  def auth(request:Request):
   with self.db.connect() as c:root=dict(c.execute(text('SELECT * FROM users WHERE id=:id'),{'id':self.actor}).mappings().one())
   root.update(session_id='session-'+str(self.actor),session_started_at_utc='2026-11-12T00:00:00Z')
   return views.effective_user(root,request,self.api)
  def require(allowed):
   def check(user=Depends(auth)):
    if not role_allowed(user['role'],allowed):raise HTTPException(403,'Denied')
    return user
   return check
  def audit(c,**kw):
   if self.fail_audit:raise RuntimeError('audit unavailable')
   c.execute(text('INSERT INTO audit VALUES(:actor,:event,:target)'),{'actor':kw['employee_id'],'event':kw['event_type'],'target':kw['resource_id']})
  self.api.update(require_roles=require,_audit_insert=audit)
  app=FastAPI();views.register(app,self.api)
  @app.get('/whoami')
  def who(user=Depends(auth)):return user
  @app.get('/operator-only')
  def operator_only(user=Depends(require(['Operator']))):return {'allowed':True}
  self.client=TestClient(app,raise_server_exceptions=False)
 def tearDown(self):
  views.clear_view('session-1');views.clear_view('session-2');views.clear_view('session-3');self.client.close();self.db.dispose()
 def switch(self,target=2):return self.client.post('/api/v1/super-admin/user-view',json={'employee_id':target,'reason':'Support and workflow review','minutes':15})
 def test_only_super_admin_can_list_or_switch(self):
  for actor in (2,3):
   self.actor=actor;self.assertEqual(self.client.get('/api/v1/super-admin/users').status_code,403);self.assertEqual(self.switch().status_code,403)
 def test_switch_uses_target_role_scope_and_keeps_owner(self):
  self.assertEqual(self.switch().status_code,200)
  u=self.client.get('/whoami').json();self.assertEqual(u['role'],'Operator');self.assertEqual(u['view_owner_work_id'],'OWNER');self.assertEqual(machine_codes(u),{'CNC-1'})
  self.assertEqual(self.client.get('/operator-only').status_code,200)
  # Controls still use the original root session while viewing an employee.
  self.assertEqual(self.client.get('/api/v1/super-admin/users').status_code,200)
  self.assertEqual(self.switch(None).status_code,200);self.assertEqual(self.client.get('/whoami').json()['role'],'Super Admin')
 def test_inactive_and_missing_targets_rejected(self):
  self.assertEqual(self.switch(4).status_code,409);self.assertEqual(self.switch(999).status_code,404)
  self.assertEqual(self.client.get('/whoami').json()['role'],'Super Admin')
 def test_failed_audit_never_activates_view(self):
  self.fail_audit=True;self.assertEqual(self.switch().status_code,500);self.assertEqual(self.client.get('/whoami').json()['role'],'Super Admin')
 def test_target_deactivation_and_owner_demotion_end_view(self):
  self.switch()
  with self.db.begin() as c:c.execute(text('UPDATE users SET is_active=0 WHERE id=2'))
  self.assertEqual(self.client.get('/whoami').status_code,403);self.assertEqual(self.client.get('/whoami').json()['role'],'Super Admin')
  with self.db.begin() as c:c.execute(text('UPDATE users SET is_active=1 WHERE id=2'))
  self.switch()
  with self.db.begin() as c:c.execute(text("UPDATE users SET role='Admin' WHERE id=1"))
  self.assertEqual(self.client.get('/whoami').json()['role'],'Admin');self.assertEqual(self.switch().status_code,403)
 def test_list_has_no_password_or_employee_tokens(self):
  result=self.client.get('/api/v1/super-admin/users').json()
  self.assertEqual(len(result),4)
  for r in result:self.assertFalse({'password','password_hash','access_token'}&set(r))
 def test_switches_audited_under_real_owner(self):
  self.switch();self.switch(None)
  with self.db.connect() as c:
   self.assertEqual(list(c.execute(text('SELECT * FROM audit'))),[(1,'employee_view_started',2),(1,'employee_view_ended',None)])
 def test_action_audit_uses_owner_with_target_in_details(self):
  from api_server import main
  request=MagicMock();request.client=None;request.headers={}
  request.state.acting_principal={'id':1,'work_id':'OWNER','full_name':'Owner','role':'Super Admin'}
  request.state.acting_as={'id':2,'work_id':'OP1','role':'Operator'}
  c=MagicMock();c.execute.return_value.all.return_value=[(name,) for name in ['employee_id','employee_work_id','employee_name','role_at_event','event_type','occurred_at_utc','session_id','request_id','details']]
  main._audit_insert(c,employee_id=2,employee_work_id='OP1',employee_name='Operator',role='Operator',event_type='incident_created',request=request)
  params=c.execute.call_args.args[1]
  self.assertEqual(params['employee_id'],1);self.assertEqual(params['role_at_event'],'Super Admin');self.assertIn('Acting as OP1',params['details'])

 def test_reason_is_required_and_view_expires_with_audit(self):
  self.assertEqual(self.client.post('/api/v1/super-admin/user-view',json={'employee_id':2}).status_code,422)
  with patch('api_server.super_admin.time.monotonic',return_value=100):self.assertEqual(self.switch().status_code,200)
  with patch('api_server.super_admin.time.monotonic',return_value=1100):self.assertEqual(self.client.get('/whoami').json()['role'],'Super Admin')
  with self.db.connect() as c:self.assertEqual(c.execute(text("SELECT count(*) FROM audit WHERE event='employee_view_expired'")).scalar(),1)
 def test_structured_audit_preserves_shift_resource_reference(self):
  from api_server import main
  request=MagicMock();request.client=None;request.headers={}
  request.state.acting_principal={'id':1,'work_id':'OWNER','full_name':'Owner','role':'Super Admin'}
  request.state.acting_as={'id':2,'work_id':'OP1','role':'Operator'}
  c=MagicMock();c.execute.return_value.all.return_value=[(name,) for name in ['employee_id','employee_work_id','employee_name','role_at_event','event_type','occurred_at_utc','session_id','request_id','details']]
  main._audit_insert(c,event_type='handover',request=request,details='{"resource_id":"M1/shiftA","note":"Checked"}')
  details=__import__('json').loads(c.execute.call_args.args[1]['details']);self.assertEqual(details['resource_id'],'M1/shiftA');self.assertEqual(details['acting_as'],'OP1')
