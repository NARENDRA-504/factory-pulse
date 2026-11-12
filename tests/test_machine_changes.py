"""Isolated transactional tests; no production database or credentials used."""
import contextlib
import unittest
from unittest.mock import patch
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from api_server.access_roles import role_allowed, protect_privileged_account
from api_server.machine_changes import register

TEAM={'department':'Bay A','supervisor_work_id':'SUP-A','machines':[{'machine_code':'CNC-1'},{'machine_code':'CNC-2'}]}

class MachineChangeTests(unittest.TestCase):
 def setUp(self):
  self.db=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
  with self.db.begin() as c:
   c.execute(text('CREATE TABLE users(id INTEGER PRIMARY KEY,work_id TEXT,full_name TEXT,role TEXT,is_active INT,assigned_machine TEXT,department TEXT,shift TEXT)'))
   c.execute(text("INSERT INTO users VALUES(1,'OP-1','Operator One','Operator',1,'CNC-1','Bay A','Shift A'),(2,'SUP-A','Supervisor','Supervisor',1,NULL,'Bay A',NULL),(3,'SA','Owner','Super Admin',1,NULL,NULL,NULL),(4,'ADM','Admin','Admin',1,NULL,NULL,NULL)"))
   c.execute(text('CREATE TABLE machine_change_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,operator_id INT,from_machine_code TEXT,to_machine_code TEXT,supervisor_work_id TEXT,team_department TEXT,reason TEXT,status TEXT,created_at_utc TEXT,reviewed_at_utc TEXT,reviewed_by_id INT,review_note TEXT)'))
   c.execute(text('CREATE TABLE audit(event TEXT)'))
  self.actor=1;self.fail_audit=False
  def dependency(allowed):
   def auth():
    with self.db.connect() as c:u=dict(c.execute(text('SELECT * FROM users WHERE id=:id'),{'id':self.actor}).mappings().one())
    if not role_allowed(u['role'],allowed):raise HTTPException(403,'Denied')
    return u
   return auth
  def sql(value):
   if 'information_schema.tables' in value:return text('SELECT 1')
   return text(value.replace(' FOR UPDATE','').replace('UTC_TIMESTAMP(6)',"'2026-11-12 00:00:00'"))
  def audit(c,**kw):
   if self.fail_audit:raise RuntimeError('audit unavailable')
   c.execute(text('INSERT INTO audit VALUES(:event)'),{'event':kw['event_type']})
  app=FastAPI();register(app,{'_sql_text':sql,'get_telemetry_engine':lambda:self.db,'require_roles':dependency,'_audit_insert':audit,'_iso_utc':lambda v:v+'Z','load_available_machine_master':lambda:{'M1':{'machineCode':'CNC-1'},'M2':{'machineCode':'CNC-2'}}})
  self.client=TestClient(app,raise_server_exceptions=False)
  self.team=patch('api_server.machine_changes.operator_team',return_value=TEAM);self.team.start()
  self.scope=patch('api_server.machine_changes.check_machine',side_effect=lambda u,m:None if m in ['CNC-1','CNC-2'] else (_ for _ in ()).throw(HTTPException(403,'scope')));self.scope.start()
 def tearDown(self):self.team.stop();self.scope.stop();self.db.dispose()
 def create(self):return self.client.post('/api/v1/machine-change/requests',json={'machine_id':'M2','reason':'Machine inspection required'})
 def decide(self,decision='Approved'):return self.client.patch('/api/v1/machine-change/requests/1',json={'decision':decision,'note':'Reviewed coverage and approved'})
 def assignment(self):
  with self.db.connect() as c:return c.execute(text('SELECT assigned_machine FROM users WHERE id=1')).scalar()
 def test_create_does_not_change_assignment_and_duplicate_blocked(self):
  self.assertEqual(self.create().status_code,201);self.assertEqual(self.assignment(),'CNC-1');self.assertEqual(self.create().status_code,409)
 def test_operator_cannot_approve_but_can_cancel(self):
  self.create();self.assertEqual(self.decide().status_code,403);self.assertEqual(self.decide('Cancelled').status_code,200);self.assertEqual(self.assignment(),'CNC-1')
 def test_responsible_supervisor_approval_updates_assignment_and_audit(self):
  self.create();self.actor=2;self.assertEqual(self.decide().status_code,200);self.assertEqual(self.assignment(),'CNC-2');self.assertEqual(self.decide().status_code,409)
  with self.db.connect() as c:self.assertEqual(c.execute(text('SELECT count(*) FROM audit')).scalar(),2)
 def test_wrong_supervisor_and_admin_cannot_approve(self):
  self.create()
  with self.db.begin() as c:c.execute(text("UPDATE users SET department='Another bay' WHERE id=2"))
  self.actor=2;self.assertEqual(self.decide().status_code,403);self.actor=4;self.assertEqual(self.decide().status_code,403)
 def test_super_admin_can_review(self):
  self.create();self.actor=3;self.assertEqual(self.decide('Rejected').status_code,200);self.assertEqual(self.assignment(),'CNC-1')
 def test_occupied_machine_blocks_and_keeps_request_pending(self):
  self.create()
  with self.db.begin() as c:c.execute(text("INSERT INTO users VALUES(5,'OP-2','Two','Operator',1,'CNC-2','Bay A','Shift A')"))
  self.actor=2;self.assertEqual(self.decide().status_code,409);self.assertEqual(self.assignment(),'CNC-1')
 def test_stale_assignment_blocks(self):
  self.create()
  with self.db.begin() as c:c.execute(text("UPDATE users SET assigned_machine='CNC-2' WHERE id=1"))
  self.actor=2;self.assertEqual(self.decide().status_code,409)
 def test_audit_failure_rolls_back_approval_and_assignment(self):
  self.create();self.actor=2;self.fail_audit=True;self.assertEqual(self.decide().status_code,500);self.assertEqual(self.assignment(),'CNC-1')
  with self.db.connect() as c:self.assertEqual(c.execute(text('SELECT status FROM machine_change_requests')).scalar(),'Pending')
 def test_cross_team_target_and_invalid_notes(self):
  self.assertEqual(self.client.post('/api/v1/machine-change/requests',json={'machine_id':'other','reason':'Please transfer me'}).status_code,403)
  self.assertEqual(self.client.post('/api/v1/machine-change/requests',json={'machine_id':'M2','reason':'   '}).status_code,422)
 def test_super_admin_inherits_admin_only_and_is_protected(self):
  self.assertTrue(role_allowed('Super Admin',['Admin']));self.assertTrue(role_allowed('Super Admin',['Operator']));self.assertFalse(role_allowed('Admin',['Super Admin']))
  for old,new in [('Super Admin',None),(None,'Super Admin')]:
   with self.assertRaises(HTTPException):protect_privileged_account({'role':'Admin'},old,new)
