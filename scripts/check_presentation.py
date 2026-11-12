"""Read-only one-command local demo check. Never starts streams, changes users or prints keys."""
import datetime as dt,json,sys,time,urllib.request,urllib.error
from pathlib import Path
from dotenv import dotenv_values
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
def main():
    checks={}
    for name,url in [('FactoryPulse web','http://127.0.0.1:3000/'),('FactoryPulse API','http://127.0.0.1:8001/health'),('Simulator web','http://127.0.0.1:5174/')]:
        checks[name]=get(url)['ok']
    path=ROOT.parent/'AI Simulator/backend/.env';key=dotenv_values(path).get('SIMULATOR_API_KEY','') if path.exists() else ''
    result=get('http://127.0.0.1:8002/api/v1/simulation/fleet',{'X-API-Key':key} if key else {})
    checks['Simulator API']=result['ok']
    # Read persisted pointers directly from the configured MySQL source; no browser credentials required.
    try:
        sys.path.insert(0,str(ROOT));from api_server.main import get_telemetry_engine,_sql_text
        def saved():
            with get_telemetry_engine().connect() as c:
                rows=c.execute(_sql_text('SELECT r.reading_id,r.machine_id,r.reading_timestamp FROM simulator_sensor_latest l JOIN simulator_sensor_readings r ON r.id=l.reading_row_id LIMIT 6400')).mappings().all()
                return {r['reading_id'] for r in rows},rows
        before,_=saved();time.sleep(6);after,rows=saved();checks['MySQL read']=True
        checks['Readings advance in six seconds']=bool(after-before)
        now=dt.datetime.now(dt.timezone.utc)
        fresh={r['machine_id'] for r in rows if 0<=(now-(r['reading_timestamp'].replace(tzinfo=dt.timezone.utc) if r['reading_timestamp'].tzinfo is None else r['reading_timestamp'])).total_seconds()<=30}
        checks['Fresh persisted readings']=bool(fresh);print('Machines with a reading newer than 30s:',len(fresh))
    except Exception as e:
        checks['MySQL read']=False;print('MySQL check unavailable:',type(e).__name__)
    for name,ok in checks.items():print(('PASS' if ok else 'CHECK')+' | '+name)
    print('This checks services and stored data only. Role rendering, Gemini and Power BI refresh need their own verification.')
    return 0 if all(checks.values()) else 1
if __name__=='__main__':sys.exit(main())
