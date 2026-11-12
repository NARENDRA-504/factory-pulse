import datetime as dt,json,math,tempfile,unittest
from pathlib import Path
from unittest.mock import patch,MagicMock
from fastapi import FastAPI,Depends,HTTPException,Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine,text
from sqlalchemy.pool import StaticPool
from api_server.operational_readiness import register,summarize_pipeline
from api_server.health_model import predict_machine,FEATURES,scores,load_model
from api_server.access_roles import role_allowed
from api_server.team_access import check_machine

NOW=dt.datetime(2026,11,12,10,tzinfo=dt.timezone.utc)
CATALOG={'M1':{'machineCode':'CNC-1','machineId':'M1'},'M2':{'machineCode':'CNC-2','machineId':'M2'}}

class HealthTests(unittest.TestCase):
 def test_pipeline_fresh_stale_missing_and_clock(self):
  row={'machine_id':'M1','reading_id':'R1','reading_timestamp':NOW-dt.timedelta(seconds=2),'created_at':NOW-dt.timedelta(seconds=1)}
  r=summarize_pipeline(CATALOG,[row],NOW);self.assertEqual(r['machines_receiving'],1);self.assertEqual(r['ingestion_delay_ms']['median'],1000);self.assertEqual(r['machines'][1]['state'],'no_data')
  row['reading_timestamp']=NOW+dt.timedelta(seconds=1);self.assertEqual(summarize_pipeline(CATALOG,[row],NOW)['future_dated_readings'],1)
  row['reading_timestamp']=NOW-dt.timedelta(seconds=60);self.assertEqual(summarize_pipeline(CATALOG,[row],NOW)['status'],'stale')
 def test_shadow_requires_fresh_aligned_good_units_and_finite_features(self):
  rows=[{'machine_id':'M1','reading_id':str(i),'sensor_name':sensor,'sensor_unit':unit,'sensor_value':1.0,'data_quality':'GOOD','timestamp':NOW.isoformat()} for i,(sensor,unit) in enumerate(FEATURES.values())]
  with patch('api_server.health_model.model_status',return_value={'status':'shadow_only'}):
   for key,value in [('data_quality','BAD'),('sensor_value',float('nan')),('sensor_unit','wrong'),('timestamp',(NOW-dt.timedelta(seconds=40)).isoformat())]:
    broken=[dict(r) for r in rows];broken[0][key]=value;result=predict_machine(broken,NOW);self.assertEqual(result['status'],'insufficient_data');self.assertFalse(result['alerts_enabled'])
   broken=[dict(r) for r in rows];broken[0]['timestamp']=(NOW-dt.timedelta(seconds=8)).isoformat();self.assertEqual(predict_machine(broken,NOW)['status'],'insufficient_data')
 def test_artifact_checksum_rejects_tamper(self):
  with tempfile.TemporaryDirectory() as d:
   model=Path(d)/'m.json';report=Path(d)/'e.json';model.write_text('{}');report.write_text('{"model_sha256":"wrong"}')
   with patch('api_server.health_model.MODEL',model),patch('api_server.health_model.REPORT',report):
    load_model.cache_clear()
    with self.assertRaises(ValueError):load_model(1)
  load_model.cache_clear()

class ReadinessWorkflowTests(unittest.TestCase):
 def setUp(self):
  self.db=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
  self.user={'id':1,'work_id':'OP-1','full_name':'One','role':'Operator','assigned_machine':'CNC-1','session_id':'S1'};self.fail=False
  with self.db.begin() as c:
   for stmt in ['CREATE TABLE users(id INT)','INSERT INTO users VALUES(1),(2)',
       'CREATE TABLE incidents(id INT,machine_code TEXT,severity TEXT,status TEXT,component_area TEXT,sensor_snapshot TEXT,assigned_to_id INT,created_at TEXT)',
       "INSERT INTO incidents VALUES(1,'CNC-1','High','Open','Temperature','[]',NULL,'2026-11-12 10:00:00'),(2,'CNC-2','High','Open','Pressure','[]',NULL,'2026-11-12 10:00:00')",
       'CREATE TABLE activity_log(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INT,employee_work_id TEXT,event_type TEXT,resource_type TEXT,resource_id TEXT,details TEXT,occurred_at_utc TEXT)',
       'CREATE TABLE simulator_sensor_readings(id INT,machine_id TEXT,machine_code TEXT,sensor_name TEXT,machine_status TEXT,reading_timestamp TEXT,created_at TEXT,reading_id TEXT)',
       'CREATE TABLE simulator_sensor_latest(reading_row_id INT)',
       "INSERT INTO simulator_sensor_readings VALUES(1,'M1','CNC-1','RPM','NORMAL','2026-11-12 10:00:00','2026-11-12 10:00:00','R1'),(2,'M2','CNC-2','RPM','NORMAL','2026-11-12 10:00:00','2026-11-12 10:00:00','R2')",
       'INSERT INTO simulator_sensor_latest VALUES(1),(2)']:c.execute(text(stmt))
  def auth():return self.user
  def require(roles):
   def dep(user=Depends(auth)):
    if not role_allowed(user['role'],roles):raise HTTPException(403,'Denied')
    return user
   return dep
  def audit(c,**kw):
   if self.fail:raise RuntimeError('Audit failed')
   c.execute(text('INSERT INTO activity_log(employee_id,employee_work_id,event_type,resource_type,resource_id,details,occurred_at_utc) VALUES(:uid,:badge,:event,:kind,:rid,:details,:time)'),{'uid':kw['employee_id'],'badge':kw['employee_work_id'],'event':kw['event_type'],'kind':kw['resource_type'],'rid':str(kw['resource_id']),'details':kw['details'],'time':NOW.isoformat()})
  def resolve(mid):
   if mid not in CATALOG:raise HTTPException(404,'Machine not found')
   return CATALOG[mid]
  app=FastAPI()
  @app.get('/api/v1/operations/shift')
  def shift(machine_id=None,offset=0,user=Depends(auth)):
   return {'shift_id':'2026-11-12-A','label':'Shift A','machines':[{'good':10,'scrap':1,'target':120,'coverage':'observed_only'}]}
  register(app,{'get_current_user':auth,'require_roles':require,'_sql_text':lambda s:text(s.replace(' FOR UPDATE','')),'get_telemetry_engine':lambda:self.db,
      'load_available_machine_master':lambda:CATALOG,'_utcnow':lambda:NOW,'resolve_canonical_machine':resolve,'_iso_utc':str,'_audit_insert':audit,
      'get_simulator_fleet_latest_readings':lambda user:[]})
  self.client=TestClient(app,raise_server_exceptions=False)
 def tearDown(self):self.client.close();self.db.dispose()
 def publish(self):return self.client.post('/api/v1/operations/handovers',json={'machine_id':'M1','note':'Check fixture on next shift','restrictions':'Await inspection'})
 def test_readiness_scoped_to_operator(self):
  r=self.client.get('/api/v1/operations/readiness').json();self.assertEqual(r['mysql'],'reachable');self.assertEqual([m['machine_id'] for m in r['machines']],['M1']);self.assertNotIn('sender',r)
 def test_handover_authorization_acknowledgement_and_duplicate(self):
  self.assertEqual(self.client.get('/api/v1/operations/handover/M2').status_code,403)
  self.assertEqual(self.publish().status_code,201)
  r=self.client.get('/api/v1/operations/handover/M1').json();self.assertEqual(r['history'][0]['good'],10);hid=r['history'][0]['id']
  url=f'/api/v1/operations/handovers/{hid}/acknowledge'
  self.assertEqual(self.client.post(url,json={'note':'Read and checked'}).status_code,409)
  self.user={**self.user,'id':2,'work_id':'OP-2'}
  self.assertEqual(self.client.post(url,json={'note':'Read and checked'}).status_code,200)
  self.assertEqual(self.client.post(url,json={'note':'Read and checked'}).status_code,409)
 def test_audit_failure_does_not_publish(self):
  self.fail=True;self.assertEqual(self.publish().status_code,500)
  with self.db.connect() as c:self.assertEqual(c.execute(text('SELECT COUNT(*) FROM activity_log')).scalar(),0)
 def test_manager_cannot_publish_and_scope_kept_for_incident_response(self):
  self.assertEqual(self.client.get('/api/v1/operations/incidents/2/response').status_code,403)
  self.assertEqual(self.client.get('/api/v1/operations/incidents/1/response').status_code,200)
  self.user={**self.user,'role':'Manager'};self.assertEqual(self.publish().status_code,403)
 def test_whitespace_notes_rejected_and_ack_is_not_closure(self):
  url='/api/v1/operations/incidents/1/acknowledge'
  self.assertEqual(self.client.post(url,json={'note':'       '}).status_code,422)
  self.assertEqual(self.client.post(url,json={'note':'Checked assigned machine'}).status_code,200)
  with self.db.connect() as c:self.assertEqual(c.execute(text('SELECT status FROM incidents WHERE id=1')).scalar(),'Open')

 def test_legacy_audit_schema_without_optional_resource_columns(self):
  with self.db.begin() as c:
   c.execute(text('ALTER TABLE activity_log DROP COLUMN resource_type'))
   c.execute(text('ALTER TABLE activity_log DROP COLUMN resource_id'))
  # Match the production audit writer: only insert columns available in this database.
  original=self.db
  from sqlalchemy import event
  @event.listens_for(original,'before_cursor_execute',retval=True)
  def legacy_writer(conn,cursor,statement,parameters,context,executemany):
   if statement.startswith('INSERT INTO activity_log(employee_id,employee_work_id,event_type,resource_type,resource_id,details,occurred_at_utc)'):
    statement='INSERT INTO activity_log(employee_id,employee_work_id,event_type,details,occurred_at_utc) VALUES(?,?,?,?,?)'
    parameters=tuple(parameters[i] for i in (0,1,2,5,6))
   return statement,parameters
  self.assertEqual(self.publish().status_code,201)
  hid=self.client.get('/api/v1/operations/handover/M1').json()['history'][0]['id']
  self.user={**self.user,'id':2,'work_id':'OP-2'}
  url=f'/api/v1/operations/handovers/{hid}/acknowledge'
  self.assertEqual(self.client.post(url,json={'note':'Incoming shift checked'}).status_code,200)
  self.assertEqual(self.client.post(url,json={'note':'Incoming shift checked'}).status_code,409)
  self.assertEqual(self.client.post('/api/v1/operations/incidents/1/acknowledge',json={'note':'Read machine guidance'}).status_code,200)
  response=self.client.get('/api/v1/operations/incidents/1/response')
  self.assertEqual(response.status_code,200)
  self.assertEqual(response.json()['history'][0]['event'],'alert_acknowledged')

 def test_sop_ack_records_revision_hash_and_rejects_stale_document(self):
  sop=self.client.get('/api/v1/operations/incidents/1/response').json()['sop']['sources'][0]
  payload={'document_id':sop['document_id'],'sha256':sop['sha256'],'note':'Read the applicable training guidance'}
  url='/api/v1/operations/incidents/1/sop-acknowledge'
  self.assertEqual(self.client.post(url,json={**payload,'sha256':'0'*64}).status_code,409)
  self.assertEqual(self.client.post(url,json=payload).status_code,200)
  with self.db.connect() as c:
   details=json.loads(c.execute(text("SELECT details FROM activity_log WHERE event_type='sop_acknowledged'")).scalar_one())
   self.assertEqual(details['sha256'],sop['sha256']);self.assertEqual(details['approval'],'training')
   self.assertEqual(c.execute(text('SELECT status FROM incidents WHERE id=1')).scalar(),'Open')
  self.assertEqual(self.client.post('/api/v1/operations/incidents/2/sop-acknowledge',json=payload).status_code,403)
