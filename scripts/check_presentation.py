"""Read-only local demo preflight. No passwords/tokens printed; never sends readings."""
import argparse,datetime as dt,json,shutil,sys,time,urllib.request
from pathlib import Path
from dotenv import dotenv_values
try:
    from scripts.connect_local_apps import simulator_root
except ModuleNotFoundError:
    from connect_local_apps import simulator_root
ROOT=Path(__file__).resolve().parents[1]

def get(url,headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers or {}),timeout=5) as r:
            raw=r.read(500001)
            if len(raw)>500000:return {'ok':False,'reason':'Response exceeds check bound'}
            try:data=json.loads(raw)
            except ValueError:data={}
            return {'ok':r.status==200,'data':data}
    except Exception as e:return {'ok':False,'reason':type(e).__name__}

def telemetry_state(running,paused,fresh,advanced):
    if running is None:return 'UNKNOWN'
    if running==0 and paused:return 'READY_IDLE'
    if paused:return 'DELIVERY_PAUSED'
    if advanced and fresh:return 'LIVE'
    return 'WAITING_FOR_DELIVERY'

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--observe-seconds',type=int,default=0,choices=range(0,16));parser.add_argument('--json',action='store_true');args=parser.parse_args(argv)
    report={'checked_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':{},'notes':[]}
    for name,url in [('FactoryPulse web','http://127.0.0.1:3000/'),('FactoryPulse API','http://127.0.0.1:8001/health'),('Simulator web','http://127.0.0.1:5174/')]:
        report['checks'][name]='PASS' if get(url)['ok'] else 'FAIL'
    path=simulator_root(ROOT)/'backend/.env';key=dotenv_values(path).get('SIMULATOR_API_KEY','') if path.exists() else ''
    headers={'X-API-Key':key} if key else {}
    fleet=get('http://127.0.0.1:8002/api/v1/simulation/fleet',headers);sender=get('http://127.0.0.1:8002/api/v1/integration/status',headers)
    report['checks']['Simulator API']='PASS' if fleet['ok'] else 'FAIL'
    # `ready` deliberately becomes false while paused. Finite manual sends
    # use a scoped grant without enabling the background outbox worker.
    report['checks']['Sender configured']='PASS' if sender['ok'] and sender['data'].get('enabled') and sender['data'].get('configured') else 'FAIL'
    running=fleet.get('data',{}).get('running');paused=sender.get('data',{}).get('paused');report.update(running_machines=running,delivery_paused=paused)
    try:
        from sqlalchemy import create_engine,text
        cfg=dotenv_values(ROOT/'.env');engine=create_engine(cfg.get('DATABASE_URL',''),pool_pre_ping=True,connect_args={'connect_timeout':5})
        with engine.connect() as c:
            tables=set(c.execute(text('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE()')).scalars())
            required={'users','auth_sessions','activity_log','machines','incidents','maintenance_work_orders','simulator_sensor_readings','simulator_sensor_latest'}
            report['missing_tables']=sorted(required-tables);report['checks']['Required SQL tables']='FAIL' if required-tables else 'PASS'
            def saved():return list(c.execute(text('SELECT r.reading_id,r.machine_id,r.reading_timestamp FROM simulator_sensor_latest l JOIN simulator_sensor_readings r ON r.id=l.reading_row_id LIMIT 6400')).mappings())
            rows=saved();before={r['reading_id'] for r in rows}
            if args.observe_seconds:time.sleep(args.observe_seconds);rows=saved()
            advanced=bool({r['reading_id'] for r in rows}-before);now=dt.datetime.now(dt.timezone.utc)
            fresh={r['machine_id'] for r in rows if 0<=(now-(r['reading_timestamp'].replace(tzinfo=dt.timezone.utc) if r['reading_timestamp'].tzinfo is None else r['reading_timestamp'])).total_seconds()<=30}
            report.update(fresh_machines=len(fresh),saved_streams=len(rows),readings_advanced=advanced if args.observe_seconds else None)
            report['checks']['MySQL read']='PASS'
            report['active_role_counts']={r[0]:r[1] for r in c.execute(text('SELECT role,COUNT(*) FROM users WHERE is_active=1 GROUP BY role'))}
            report['checks']['Active administrator']='PASS' if sum(report['active_role_counts'].get(k,0) for k in ('Admin','Super Admin')) else 'FAIL'
            report['telemetry_state']=telemetry_state(running,paused,bool(fresh),advanced or (not args.observe_seconds and bool(fresh)))
        engine.dispose()
    except Exception as e:report['checks']['MySQL read']='FAIL';report['notes'].append('SQL check unavailable: '+type(e).__name__);report['telemetry_state']='UNKNOWN'
    report['free_disk_gib']=round(shutil.disk_usage(ROOT).free/1024**3,2)
    if report['free_disk_gib']<2:report['notes'].append('Less than2GiB free. Keep generation stopped and review storage before a fleet demonstration.')
    if report['telemetry_state']=='READY_IDLE':report['notes'].append('Intentional manual mode. Open Simulator and explicitly send a finite scenario; old readings being stale is expected.')
    report['notes'].append('Service/SQL preflight only; login passwords, role rendering, ML accuracy, Gemini and Power BI refresh are not certified by this check.')
    report['ready']=all(v=='PASS' for v in report['checks'].values())
    out=ROOT/'.local/local-demo-readiness.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(report,indent=2),encoding='utf-8')
    if args.json:print(json.dumps(report,indent=2))
    else:
        for name,state in report['checks'].items():print(state+' | '+name)
        print('Telemetry: '+report['telemetry_state']);print('Free disk: '+str(report['free_disk_gib'])+' GiB')
        for note in report['notes']:print(note)
    return 0 if report['ready'] else 1
if __name__=='__main__':sys.exit(main())
