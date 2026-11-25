"""Exercise an explicitly isolated restored database; never connects to live MySQL.

Changes only the disposable restored copy (temporary passwords, sessions, one normal
reading and an incident/work order). Original credentials are never needed or printed.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess

from verify_mysql_restore import docker_cli

PROBE = r'''
import datetime, json, secrets
from fastapi.testclient import TestClient
from sqlalchemy import text
from api_server import main as api

checks={}
def require(condition, label):
    if not condition: raise RuntimeError(label)
    checks[label]=True

engine=api.get_telemetry_engine()
accounts={}
password=secrets.token_urlsafe(32)
with engine.begin() as c:
    for role in ('Operator','Supervisor','Maintenance','Manager','Admin','Super Admin'):
        query="SELECT id,work_id,full_name FROM users WHERE role=:role AND is_active=1"
        if role=='Supervisor': query+=" AND work_id='SUP-A01'"
        row=c.execute(text(query+' ORDER BY id LIMIT 1'),{'role':role}).mappings().first()
        require(row is not None, role+' account available')
        accounts[role]=dict(row)
        c.execute(text('UPDATE users SET password_hash=:hash WHERE id=:id'),
            {'hash':api._hash_password(password,secrets.token_bytes(16)),'id':row['id']})
    c.execute(text("UPDATE users SET assigned_machine='CNC-5AX-001' WHERE id=:id"),{'id':accounts['Operator']['id']})

with TestClient(api.app) as client:
    require(client.get('/ready').status_code==200,'container readiness')
    require(client.get('/api/v1/admin/users').status_code==401,'anonymous denied')
    headers={}
    for role, account in accounts.items():
        r=client.post('/api/v1/auth/login',json={'work_id':account['work_id'],'password':password})
        require(r.status_code==200,role+' login')
        headers[role]={'Authorization':'Bearer '+r.json()['access_token']}
        require(client.get('/api/v1/telemetry/latest/MCH-001',headers=headers[role]).status_code==200,role+' authorized telemetry')
    require(client.get('/api/v1/telemetry/latest/MCH-002',headers=headers['Operator']).status_code==403,'operator boundary')
    require(client.get('/api/v1/telemetry/latest/MCH-036',headers=headers['Supervisor']).status_code==403,'supervisor team boundary')
    for role in ('Operator','Supervisor','Maintenance','Manager'):
        require(client.get('/api/v1/admin/users',headers=headers[role]).status_code==403,role+' admin boundary')
    reading_id='READ-RECOVERY-'+secrets.token_hex(16).upper()
    payload={'reading_id':reading_id,'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),
      'machine_id':'MCH-001','machine_type':'5-Axis CNC Machining Center',
      'department':'Floor A1: Aerospace Micro-Milling','production_line':'Line 5AX-01',
      'sensor_name':'RPM','sensor_unit':'RPM','sensor_value':2400,'expected_min':1000,
      'expected_max':5000,'machine_status':'NORMAL','data_quality':'GOOD','fault_mode':None}
    delivery={'X-Simulator-API-Key':os.environ['SIMULATOR_API_KEY']}
    require(client.post('/api/v1/telemetry',json=payload,headers=delivery).status_code==201,'fresh ingest')
    require(client.post('/api/v1/telemetry',json=payload,headers=delivery).status_code==200,'duplicate acknowledgement')
    with engine.connect() as c:
        require(c.execute(text('SELECT COUNT(*) FROM simulator_sensor_readings WHERE reading_id=:id'),{'id':reading_id}).scalar_one()==1,'single persisted reading')
    incident={'machine_code':'CNC-5AX-001','severity':'Medium',
      'symptom_description':'Isolated recovery acceptance; no physical fault or repair.',
      'component_area':'Recovery-'+secrets.token_hex(8),'operator_notes':'Disposable restored database only.'}
    r=client.post('/api/v1/incidents',json=incident,headers=headers['Operator'])
    require(r.status_code in (200,201),'incident creation')
    iid=r.json()['id']; path='/api/v1/incidents/'+str(iid)
    require(client.patch(path+'/assign',json={'technician_name':accounts['Maintenance']['full_name']},headers=headers['Supervisor']).status_code==200,'technician assignment')
    require(client.patch(path+'/progress',json={'progress_notes':'Recovery test inspection recorded; no live machine affected.'},headers=headers['Maintenance']).status_code==200,'maintenance progress')
    require(client.patch(path+'/close',json={'closure_notes':'Recovery acceptance workflow complete on isolated database.'},headers=headers['Maintenance']).status_code==200,'technician resolution')
    for role in accounts:
        r=client.get(path,headers=headers[role])
        require(r.status_code==200 and r.json()['status']=='Closed',role+' resolved incident visibility')
    with engine.connect() as c:
        statuses=c.execute(text('SELECT status FROM maintenance_work_orders WHERE incident_id=:id'),{'id':iid}).scalars().all()
        require(bool(statuses) and all(s=='Completed' for s in statuses),'linked work order completed')
    for role in accounts:
        require(client.post('/api/v1/auth/logout',headers=headers[role]).status_code==200,role+' logout')
        require(client.get('/api/v1/auth/me',headers=headers[role]).status_code==401,role+' revoked session')
print('RECOVERY_RESULT='+json.dumps({'passed':True,'checks':checks,'live_database_touched':False,'external_provider_calls':False}))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore-report', type=Path, required=True)
    args = parser.parse_args()
    report = json.loads(args.restore_report.read_text())
    if not report.get('dump_restore_verified'):
        raise RuntimeError('A completed isolated restore is required.')
    cli = docker_cli()
    details = json.loads(subprocess.check_output([cli, 'inspect', report['container']], text=True))[0]
    if (details['Config'].get('Labels', {}).get('factorypulse.purpose') != 'isolated-restore'
            or details['HostConfig']['NetworkMode'] != 'none'
            or details['HostConfig'].get('PortBindings')
            or not details['State']['Running']):
        raise RuntimeError('Only the running network-none recovery container is allowed.')
    private = dict(item.split('=', 1) for item in details['Config']['Env'] if '=' in item)
    from urllib.parse import quote
    env = {'DATABASE_URL':'mysql+pymysql://root:'+quote(private['MYSQL_ROOT_PASSWORD'],safe='')+'@127.0.0.1:3306/'+report['database'],
           'DEPLOYMENT_MODE':'local','APP_ENV':'production','DEMO_AUTH_ENABLED':'false',
           'SIMULATOR_API_KEY':__import__('secrets').token_urlsafe(32),'FACTORY_TIMEZONE':'Asia/Kolkata'}
    bootstrap = 'import os,sys,json; os.environ.update(json.loads(sys.stdin.readline())); exec(sys.stdin.read())'
    result = subprocess.run([cli,'run','--rm','-i','--network','container:'+report['container'],
        '--entrypoint','python','factorypulse-api:verification','-c',bootstrap],
        input=json.dumps(env)+'\n'+PROBE,text=True,capture_output=True,timeout=240)
    marker = next((line[len('RECOVERY_RESULT='):] for line in result.stdout.splitlines() if line.startswith('RECOVERY_RESULT=')),None)
    if result.returncode or not marker:
        # Never relay raw process output: authentication tokens/SQL can be logged.
        failure = result.stderr.splitlines()[-1] if result.stderr else 'Probe did not return evidence.'
        if failure.startswith('RuntimeError:'):
            print(failure)
        raise RuntimeError('Isolated application acceptance failed; live database unchanged.')
    evidence=json.loads(marker)
    args.restore_report.with_suffix('.acceptance.json').write_text(json.dumps(evidence,indent=2)+'\n')
    report['application_workflow_verified']=True
    report['application_acceptance_checks']=len(evidence['checks'])
    report['restore_verified']=bool(report.get('data_restore_verified'))
    report['verification_scope']='Isolated MySQL data recovery and container API workflows; browser and hosted acceptance excluded.'
    report['restored_copy_modified_by_acceptance']=True
    args.restore_report.write_text(json.dumps(report,indent=2)+'\n')
    print('PASS: '+str(len(evidence['checks']))+' isolated application acceptance checks; live database unchanged.')


if __name__=='__main__':
    main()
