"""Repeatable local integration checks. Credentials stay in ignored local files."""
import json
from pathlib import Path
import time
import httpx
from dotenv import dotenv_values
from sqlalchemy import create_engine, text

ROOT=Path(__file__).resolve().parents[1]

def main():
    accounts=json.loads((ROOT/'.local/accounts.json').read_text())
    settings=dotenv_values(ROOT/'.env')
    report={'checks':{},'roles':{}}
    with httpx.Client(base_url='http://127.0.0.1:8001',timeout=30) as api:
        for badge,account in accounts.items():
            response=api.post('/api/v1/auth/login',json={'work_id':badge,'password':account['password']})
            response.raise_for_status()
            token=response.json()['access_token']
            api.headers['Authorization']='Bearer '+token
            start=time.monotonic()
            readings=api.get('/api/v1/telemetry/fleet/latest'); readings.raise_for_status()
            records=readings.json()
            admin=api.get('/api/v1/admin/system-health')
            assert admin.status_code==(200 if account['role']=='Admin' else 403)
            if account['role']=='Operator': assert all(row['machine_id']=='MCH-001' for row in records)
            report['roles'][account['role']]={'readings':len(records),'fleet_seconds':round(time.monotonic()-start,3),'admin_boundary':'PASS'}
            denied=api.post('/api/v1/intelligence/query',json={'question':'Latest readings for MCH-101','machine_id':'MCH-101'})
            if account['role']=='Operator': assert denied.status_code==403
            downtime=api.get('/api/v1/telemetry/downtime/MCH-001?minutes=15'); downtime.raise_for_status()
            evidence=api.post('/api/v1/intelligence/query',json={'question':'Latest machine readings','machine_id':'MCH-001'});evidence.raise_for_status()
            assert evidence.json()['evidence_source']=='FactoryPulse MySQL'
            assert evidence.json()['provider_status']=='disabled'
            api.post('/api/v1/auth/logout').raise_for_status()
        # Track a real Simulator reading, rather than inject a made-up fixture.
        simulator=httpx.get('http://127.0.0.1:5174/api/v1/telemetry/latest/MCH-001?limit=1',timeout=15)
        simulator.raise_for_status(); source=simulator.json()[0]
        row=None
        engine=create_engine(settings['DATABASE_URL'],pool_pre_ping=True)
        for attempt in range(15):
            with engine.connect() as connection:
                row=connection.execute(text('SELECT reading_id,machine_id,sensor_name,sensor_value_json,reading_timestamp FROM simulator_sensor_readings WHERE reading_id=:reading_id'),{'reading_id':source['reading_id']}).mappings().first()
            if row: break
            time.sleep(1)
        assert row is not None, 'The real Simulator reading did not reach MySQL during the verification window'
        assert row['machine_id']==source['machine_id']
        assert json.loads(row['sensor_value_json'])==source['sensor_value']
        report['checks']['simulator_to_mysql']={'status':'PASS','reading_id':source['reading_id'],'sensor':source['sensor_name'],'source_timestamp':source['timestamp']}
        allowed={'reading_id','timestamp','machine_id','machine_type','department','production_line','sensor_name','sensor_unit','sensor_value','expected_min','expected_max','machine_status','data_quality','fault_mode'}
        duplicate=api.post('/api/v1/telemetry',json={k:v for k,v in source.items() if k in allowed},headers={'X-Simulator-API-Key':settings['SIMULATOR_API_KEY']})
        assert duplicate.status_code==200 and duplicate.json()['duplicate'] is True
        report['checks']['duplicate_delivery']='PASS'
    report['checks']['external_ai']='BLOCKED: approved optional selected-machine delivery; provider configuration missing'
    report['checks']['power_bi']='BLOCKED: no report, connection or refresh evidence'
    with engine.connect() as connection:
        columns=set(connection.execute(text("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='machines'")).scalars())
    report['checks']['machine_management_migration']='APPLIED: required columns present' if {'machine_id','operating_limits','sensor_configuration'}.issubset(columns) else 'BLOCKED: schema-owner execution required'
    (ROOT/'.local/live-verification.json').write_text(json.dumps(report,indent=2,default=str))
    print('PASS: real Simulator reading persisted in MySQL; duplicate accepted idempotently.')
    print('PASS: five role logins, scoped readings, Admin boundaries, local intelligence and downtime endpoints.')
    for role,result in report['roles'].items(): print(role, result)
    print('External AI and Power BI refresh remain unverified; schema status is recorded in the private verification report.')

if __name__=='__main__': main()
