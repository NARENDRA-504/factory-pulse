import unittest
from unittest.mock import patch
from sqlalchemy import create_engine,text
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from api_server import main as api

class PersonalActivityTests(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
  with self.engine.begin() as c:
   c.execute(text('CREATE TABLE activity_log(id INTEGER, employee_id INTEGER, event_type TEXT, occurred_at_utc TEXT, role_at_event TEXT)'))
   c.execute(text("INSERT INTO activity_log VALUES (1,11,'sign_in','2026-10-29 08:00:00','Operator'),(2,22,'sign_in','2026-10-29 09:00:00','Admin'),(3,11,'sign_out','2026-10-29 10:00:00','Operator')"))
  self.client=TestClient(api.app)
 def tearDown(self):
  api.app.dependency_overrides.pop(api.get_current_user,None)
  self.client.close();self.engine.dispose()
 def test_self_history_does_not_allow_employee_override_or_expose_session_data(self):
  api.app.dependency_overrides[api.get_current_user]=lambda:{'id':11,'work_id':'OP-TEST','role':'Operator'}
  with patch.object(api,'DEMO_AUTH_ENABLED',False),patch.object(api,'get_telemetry_engine',return_value=self.engine):
   response=self.client.get('/api/v1/auth/me/activity?employee_id=22')
  self.assertEqual(response.status_code,200)
  events=response.json()['events'];self.assertEqual([e['id'] for e in events],[3,1])
  self.assertTrue(all(e['role']=='Operator' for e in events))
  self.assertNotIn('session_id',events[0]);self.assertNotIn('details',events[0])
 def test_anonymous_history_is_rejected(self):
  with patch.object(api,'DEMO_AUTH_ENABLED',False):
   self.assertEqual(self.client.get('/api/v1/auth/me/activity').status_code,401)

if __name__=='__main__':unittest.main()
