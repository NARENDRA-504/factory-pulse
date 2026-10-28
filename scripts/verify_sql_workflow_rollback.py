"""Exercise SQL workflows inside an explicitly rolled-back transaction."""
import contextlib,uuid,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI
from starlette.requests import Request
from sqlalchemy import create_engine,text
from dotenv import dotenv_values
from api_server import main
from api_server.sql_incidents import register,Report,Assignment,Progress,Closure

def run():
 engine=create_engine(dotenv_values(Path(__file__).resolve().parents[1]/'.env')['DATABASE_URL'])
 with engine.connect() as c:
  tx=c.begin()
  try:
   users={r['work_id']:dict(r) for r in c.execute(text("SELECT id,work_id,full_name,role,assigned_machine FROM users WHERE work_id IN ('OPS-OPERATOR','OPS-SUPERVISOR','OPS-MAINTENANCE')")).mappings()}
   before=c.execute(text('SELECT COUNT(*) FROM incidents')).scalar()
   class TransactionEngine:
    @contextlib.contextmanager
    def begin(self):yield c
    @contextlib.contextmanager
    def connect(self):yield c
   api=dict(vars(main));api['get_telemetry_engine']=lambda:TransactionEngine()
   app=FastAPI();register(app,api)
   def endpoint(path,method):return next(r.endpoint for r in app.routes if getattr(r,'path','')==path and method in r.methods)
   request=Request({'type':'http','headers':[]})
   report=endpoint('/api/v1/incidents','POST')(Report(machine_code='CNC-5AX-001',severity='Medium',symptom_description='Rollback-only integration verification',component_area='TEST-'+uuid.uuid4().hex[:12]),request,users['OPS-OPERATOR'])
   id=report['id'];assert report['measured_vib_rms'] is None and report['sensor_snapshot']
   assigned=endpoint('/api/v1/incidents/{incident_id}/assign','PATCH')(id,Assignment(technician_name=users['OPS-MAINTENANCE']['full_name']),request,users['OPS-SUPERVISOR']);assert assigned['status']=='In_Investigation'
   progress=endpoint('/api/v1/incidents/{incident_id}/progress','PATCH')(id,Progress(progress_notes='Rollback-only inspection and resolution verification'),request,users['OPS-MAINTENANCE']);assert progress['notes']
   closed=endpoint('/api/v1/incidents/{incident_id}/close','PATCH')(id,Closure(closure_notes='Rollback-only resolution verification'),request,users['OPS-MAINTENANCE']);assert closed['status']=='Closed'
   assert c.execute(text("SELECT COUNT(*) FROM maintenance_work_orders WHERE incident_id=:id AND status='Completed'"),{'id':id}).scalar()==1
   tx.rollback();assert c.execute(text('SELECT COUNT(*) FROM incidents')).scalar()==before
   print('PASS: SQL create, raw sensor snapshot, assignment/work order, maintenance notes, closure and audit; all fixtures rolled back.')
  finally:
   if tx.is_active:tx.rollback()
if __name__=='__main__':run()
