"""Register the explicitly approved roster without inventing dates, prices or inspections."""
import sys,json,argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api_server import main as api
p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');args=p.parse_args()
catalog=api.load_available_machine_master();engine=api.get_telemetry_engine();created=0
with engine.begin() as c:
 existing=set(c.execute(api._sql_text('SELECT machine_code FROM machines')).scalars())
 for mid,m in catalog.items():
  if m['machineCode'] in existing:continue
  if args.apply:
   c.execute(api._sql_text('''INSERT INTO machines(machine_code,machine_id,name,model,line_id,status,last_inspection_date,active_workpiece,machine_type,plant,location,sensor_configuration,simulator_machine_id,is_active)
    VALUES(:code,:mid,:name,:model,:line,'Offline',NULL,'Not recorded',:kind,:plant,:floor,:identity,:mid,1)'''),{'code':m['machineCode'],'mid':mid,'name':m['displayName'],'model':m.get('model') or 'Not recorded','line':m['productionLine'],'kind':m['machineType'],'plant':m['plant'],'floor':m['shopFloor'],'identity':json.dumps({'identity':m})})
  created+=1
 if args.apply and created:api._audit_insert(c,employee_name='Authorized local setup',event_type='machine_roster_registered',resource_type='machine_registry',details=f'Registered {created} approved catalog machines. Inspection/installation dates and business rates remain unknown. No accounts or readings changed.')
print(('Registered' if args.apply else 'Would register'),created,'machines; unknown inspection dates retained as NULL.')
