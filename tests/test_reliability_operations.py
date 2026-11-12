import datetime as dt,json,unittest
from fastapi import FastAPI,Depends,HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine,text
from sqlalchemy.pool import StaticPool
from api_server.reliability_operations import sensor_checks,maintenance_summary,register
from api_server.access_roles import role_allowed
from api_server.fault_automation import SustainedAlerts
NOW=dt.datetime(2026,11,12,10,tzinfo=dt.timezone.utc)
CAT={'M1':{'machineId':'M1','machineCode':'CNC-5AX-001'},'M2':{'machineId':'M2','machineCode':'CNC-5AX-002'},'M3':{'machineId':'M3','machineCode':'CNC-VMC-001'}}
class ReliabilityTests(unittest.TestCase):
 def row(self,**kw):return dict({'machine_id':'M1','sensor_name':'RPM','sensor_unit':'RPM','sensor_value_json':'2400','data_quality':'GOOD','machine_status':'NORMAL','reading_timestamp':NOW,'reading_id':'R1'},**kw)
 def test_stale_missing_quality_units_and_invalid_values(self):
  for changes,issue in [({'reading_timestamp':NOW-dt.timedelta(seconds=31)},'stale'),({'sensor_unit':'Hz'},'unit_mismatch'),({'sensor_value_json':'"unknown"'},'invalid_value'),({'sensor_value_json':'NaN'},'invalid_value'),({'data_quality':'NOISY'},'quality_noisy'),({'reading_timestamp':NOW+dt.timedelta(seconds=1)},'future_timestamp')]:
   result=sensor_checks({'M1':CAT['M1']},[self.row(**changes)],NOW)
   self.assertIn(issue,result[0]['issues']);self.assertEqual(result[1]['issues'],['missing'])
 def test_constant_is_only_review_after_enough_observation_while_running(self):
  points=[self.row(reading_timestamp=NOW-dt.timedelta(seconds=i*7)) for i in range(10)]
  r=sensor_checks({'M1':CAT['M1']},[self.row()],NOW,{('M1','RPM'):points})[0]
  self.assertEqual(r['state'],'review');self.assertEqual(r['issues'],['unchanged_review'])
  self.assertEqual(sensor_checks({'M1':CAT['M1']},[self.row(machine_status='IDLE')],NOW,{('M1','RPM'):points})[0]['state'],'fresh')
  points[-1]['sensor_value_json']='2399'
  self.assertEqual(sensor_checks({'M1':CAT['M1']},[self.row()],NOW,{('M1','RPM'):points})[0]['state'],'fresh')
 def test_resolution_is_elapsed_report_time_not_fabricated_mtbf(self):
  r=maintenance_summary([{'id':1,'machine_code':'C1','component_area':'Temp','status':'Closed','created_at':NOW-dt.timedelta(hours=2),'closed_at':NOW},{'id':2,'machine_code':'C1','component_area':'Temp','status':'Open','created_at':NOW,'closed_at':None}],{1:NOW-dt.timedelta(minutes=90)},NOW)
  self.assertEqual(r['mean_report_to_resolution_minutes'],120);self.assertEqual(r['mean_first_ack_minutes'],30);self.assertEqual(r['repeated_groups'][0]['reports'],2)
  self.assertIsNone(maintenance_summary([],{},NOW)['mean_report_to_resolution_minutes'])
 def test_wrong_units_never_create_threshold_alert(self):
  tracker=SustainedAlerts()
  for sec in (0,15,30,45):
   stamp=NOW+dt.timedelta(seconds=sec)
   self.assertEqual(tracker.observe([{'machine_id':'M1','sensor_name':'Temperature','sensor_unit':'F','data_quality':'GOOD','timestamp':stamp.isoformat(),'sensor_value':90,'expected_min':25,'expected_max':70}],stamp),[])
class RoutesTests(unittest.TestCase):
 def setUp(self):
  self.db=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
  self.user={'id':1,'work_id':'OP-1','role':'Operator','assigned_machine':'CNC-5AX-001'}
  with self.db.begin() as c:
   for stmt in ['CREATE TABLE incidents(id INT,incident_code TEXT,machine_code TEXT,severity TEXT,component_area TEXT,status TEXT,created_at TEXT,closed_at TEXT,assigned_to_id INT)',"INSERT INTO incidents VALUES(1,'I1','CNC-5AX-001','High','Temp','Open','2026-11-12 09:00:00',NULL,NULL),(2,'I2','CNC-5AX-002','Critical','RPM','Open','2026-11-12 09:00:00',NULL,2),(3,'I3','CNC-VMC-001','Critical','Temp','Open','2026-11-12 09:00:00',NULL,9),(4,'I4','CNC-5AX-001','Critical','Temp','Closed','2026-11-12 08:00:00','2026-11-12 09:00:00',2)",
   'CREATE TABLE activity_log(id INT,employee_id INT,event_type TEXT,details TEXT,occurred_at_utc TEXT)',
   'CREATE TABLE simulator_sensor_latest(reading_row_id INT)','CREATE TABLE simulator_sensor_readings(id INT,machine_id TEXT,machine_code TEXT,sensor_name TEXT,sensor_unit TEXT,sensor_value_json TEXT,data_quality TEXT,machine_status TEXT,reading_timestamp TEXT,reading_id TEXT)',
   "INSERT INTO simulator_sensor_readings VALUES(1,'M1','CNC-5AX-001','RPM','RPM','2400','GOOD','NORMAL','2026-11-12 10:00:00','R1')",'INSERT INTO simulator_sensor_latest VALUES(1)']:c.execute(text(stmt))
  def auth():return self.user
  def require(roles):
   def dep(user=Depends(auth)):
    if not role_allowed(user['role'],roles):raise HTTPException(403)
    return user
   return dep
  self.app=FastAPI();register(self.app,{'_sql_text':text,'get_telemetry_engine':lambda:self.db,'get_current_user':auth,'require_roles':require,'load_available_machine_master':lambda:CAT,'resolve_canonical_machine':lambda mid:CAT[mid],'_utcnow':lambda:NOW,'_iso_utc':lambda x:str(x)})
  self.client=TestClient(self.app)
 def tearDown(self):self.client.close();self.db.dispose()
 def ids(self):return [x['id'] for x in self.client.get('/api/v1/operations/alert-inbox').json()['alerts']]
 def test_roles_and_closed_incidents(self):
  self.assertEqual(self.ids(),[1])
  self.user={**self.user,'role':'Manager'};self.assertEqual(self.ids(),[3,2])
  self.user={**self.user,'role':'Maintenance','id':2};self.assertEqual(self.ids(),[2,1])
  self.user={**self.user,'role':'Supervisor','work_id':'SUP-A01','department':'Plant A / Team A01'};self.assertEqual(self.ids(),[2,1])
  self.user={**self.user,'role':'Admin'};self.assertEqual(self.ids(),[3,2,1])
 def test_reliability_cannot_open_other_machine(self):
  self.assertEqual(self.client.get('/api/v1/operations/sensor-reliability?machine_id=M2').status_code,403)
  r=self.client.get('/api/v1/operations/sensor-reliability?machine_id=M1').json()
  self.assertEqual(len(r['checks']),7);self.assertTrue(all(x['machine_id']=='M1' for x in r['checks']))
 def test_maintenance_metrics_operator_forbidden_and_supervisor_scoped(self):
  self.assertEqual(self.client.get('/api/v1/operations/maintenance-effectiveness').status_code,403)
  self.user={**self.user,'role':'Supervisor','work_id':'SUP-A01','department':'Plant A / Team A01'}
  r=self.client.get('/api/v1/operations/maintenance-effectiveness').json();self.assertEqual(r['incidents_sampled'],3);self.assertEqual(r['resolved'],1);self.assertEqual(r['mean_report_to_resolution_minutes'],60)
