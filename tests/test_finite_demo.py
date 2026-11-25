import unittest
from unittest.mock import AsyncMock,MagicMock,patch
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from api_server.demo_control import register,settings,public_status
from scripts.audit_health_validation import wilson
from scripts.validate_health_dataset import validate

class DemoTests(unittest.TestCase):
 def setUp(self):
  self.role='Admin';self.db=MagicMock();self.audit=MagicMock()
  def require(roles):
   def auth():
    if self.role not in ('Admin','Super Admin'):raise HTTPException(403,'Denied')
    return {'id':1,'role':self.role,'work_id':'TEST'}
   return auth
  app=FastAPI();register(app,{'require_roles':require,'resolve_canonical_machine':lambda mid:{'machineCode':'CNC'},
   'get_telemetry_engine':lambda:self.db,'_sql_text':lambda s:s,'_audit_insert':self.audit})
  self.client=TestClient(app)
 def tearDown(self):self.client.close()
 def test_workplace_roles_cannot_send_stop_or_inspect(self):
  with patch('api_server.demo_control.simulator',new_callable=AsyncMock) as sim:
   for role in ('Operator','Supervisor','Maintenance','Manager'):
    self.role=role
    self.assertEqual(self.client.get('/api/v1/admin/demo/status').status_code,403)
    self.assertEqual(self.client.post('/api/v1/admin/demo/stop').status_code,403)
    self.assertEqual(self.client.post('/api/v1/admin/demo/run',json={'machine_id':'M1','scenario_id':'normal'}).status_code,403)
   sim.assert_not_called();self.audit.assert_not_called()
 def test_single_sample_records_audit_and_checks_mysql(self):
  self.db.connect.return_value.__enter__.return_value.execute.return_value.scalar.return_value=1
  with patch('api_server.demo_control.simulator',new_callable=AsyncMock,return_value={'active':False,'frames':1,'delivered':1,'last_readings':[{'reading_id':'R1'}]}) as sim:
   r=self.client.post('/api/v1/admin/demo/run',json={'machine_id':'M1','scenario_id':'normal','duration_seconds':0})
   self.assertEqual(r.status_code,200);self.assertEqual(r.json()['mysql_verification']['matched'],1)
   self.assertEqual(self.audit.call_count,2)
   self.assertEqual(sim.call_args.args[1],'/api/v1/simulation/scenarios/send')
 def test_unbounded_duration_and_failed_audit_never_send(self):
  with patch('api_server.demo_control.simulator',new_callable=AsyncMock) as sim:
   self.assertEqual(self.client.post('/api/v1/admin/demo/run',json={'machine_id':'M1','scenario_id':'normal','duration_seconds':300}).status_code,422)
   sim.assert_not_called()
  self.audit.side_effect=RuntimeError('audit unavailable')
  with patch('api_server.demo_control.simulator',new_callable=AsyncMock) as sim:
   with self.assertRaises(RuntimeError):self.client.post('/api/v1/admin/demo/run',json={'machine_id':'M1','scenario_id':'normal','duration_seconds':0})
   sim.assert_not_called()
 def test_only_local_controls_and_explicit_status_fields(self):
  with patch.dict('os.environ',{'DEPLOYMENT_MODE':'hosted'}):
   with self.assertRaises(HTTPException):settings()
  with patch.dict('os.environ',{'DEPLOYMENT_MODE':'local','SIMULATOR_CONTROL_URL':'http://example.com'}):
   with self.assertRaises(HTTPException):settings()
  self.assertNotIn('secret',public_status({'active':False,'secret':'never'}))
 def test_small_sample_uncertainty(self):
  low,high=wilson(17,32)
  self.assertLess(low,17/32);self.assertGreater(high,17/32)
  self.assertIsNone(wilson(0,0))
 def test_empty_or_leaking_training_data_cannot_authorize_release(self):
  self.assertFalse(validate([])['valid'])
  row={'packet_id':'A','machine_id':'M1','observed_at_utc':'2026-01-01T00:00:00Z','fault_event_id':'F1','split':'train','label_source':'synthetic','quality_flag':'GOOD','health_priority':'Normal',
       **{k:1 for k in __import__('api_server.health_model',fromlist=['FEATURES']).FEATURES}}
  result=validate([row,{**row,'packet_id':'B','split':'test'}])
  self.assertFalse(result['valid']);self.assertFalse(result['release_authorized'])
  self.assertTrue(any('leaks across splits' in e for e in result['errors']))
 def test_well_formed_temporal_dataset_is_checked_but_not_promoted(self):
  from api_server.health_model import FEATURES,LABELS
  rows=[]
  for day,split in enumerate(('train','validation','test'),1):
   for i,label in enumerate(LABELS):
    rows.append({'packet_id':f'{day}-{i}','machine_id':'M1','observed_at_utc':f'2026-01-0{day}T00:00:00Z',
      'fault_event_id':f'F-{day}-{i}','split':split,'label_source':'synthetic','quality_flag':'GOOD','health_priority':label,**{k:1 for k in FEATURES}})
  result=validate(rows);self.assertTrue(result['valid']);self.assertFalse(result['release_authorized'])
  self.assertEqual(result['test_machines_seen_in_train'],1)
