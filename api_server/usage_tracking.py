"""Durable observed usage; never presented as a machine's lifetime meter."""
import datetime as dt
import json
import math
import threading
from pathlib import Path

SENSORS={'Model Run Time':'run_seconds','Good Parts':'good_parts','Scrap Parts':'scrap_parts'}

def advance(state, readings, now):
    state=json.loads(json.dumps(state or {}))
    state.setdefault('started_at',now.isoformat());state.setdefault('streams',{})
    for r in readings:
        key=SENSORS.get(r['sensor_name'])
        if not key:continue
        stamp=dt.datetime.fromisoformat(str(r['timestamp']).replace('Z','+00:00'))
        if stamp.tzinfo is None:stamp=stamp.replace(tzinfo=dt.timezone.utc)
        age=(now-stamp).total_seconds()
        stream=state['streams'].setdefault(key,{'total':0,'resets':0,'gaps':0})
        last=stream.get('timestamp')
        if last and stamp<=dt.datetime.fromisoformat(last):continue
        value=r['sensor_value']
        valid=r['data_quality']=='GOOD' and isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) and value>=0 and 0<=age<=30
        if not valid:
            stream['baseline']=None;continue
        baseline=stream.get('baseline')
        gap=last and (stamp-dt.datetime.fromisoformat(last)).total_seconds()>60
        if gap:stream['gaps']+=1
        if baseline is not None and not gap:
            stream['total']+=value-baseline if value>=baseline else value
            if value<baseline:stream['resets']+=1
        stream.update(baseline=value,timestamp=stamp.isoformat())
    return state

def usage_summary(state, settings):
    streams=(state or {}).get('streams',{})
    def observed(key):
        stream=streams.get(key,{})
        return stream.get('total') if stream.get('timestamp') else None
    run=observed('run_seconds')
    good=observed('good_parts');scrap=observed('scrap_parts')
    cycles=good+scrap if good is not None and scrap is not None else None
    baseline=(state or {}).get('service_baseline',{})
    hours=max(0,(run-baseline.get('run_seconds',0))/3600) if run is not None else None
    parts=max(0,cycles-baseline.get('cycles',0)) if cycles is not None else None
    checks=[]
    for name,value,limit in [('Running hours',hours,settings.service_interval_hours),('Completed parts',parts,settings.service_interval_cycles)]:
        checks.append({'name':name,'observed':value,'interval':limit,'due':bool(limit and value is not None and value>=limit)})
    return {'started_at':(state or {}).get('started_at'),'checks':checks,'due':any(x['due'] for x in checks),
            'recorded_gaps':sum(s.get('gaps',0) for s in streams.values()),'basis':'Observed counter increases since tracking/service baseline. Gaps may undercount; this is not lifetime equipment usage.'}

def register(app,api):
    stop=threading.Event();sql=api['_sql_text']
    def scan():
        rows=api['get_simulator_fleet_latest_readings'](user={'role':'Admin'})
        grouped={}
        for row in rows:
            r=row.model_dump()
            if r['sensor_name'] in SENSORS:grouped.setdefault(r['machine_code'],[]).append(r)
        for code,readings in grouped.items():
            with api['get_telemetry_engine']().begin() as c:
                row=c.execute(sql('SELECT operating_limits FROM machines WHERE machine_code=:code FOR UPDATE'),{'code':code}).mappings().first()
                if not row:continue
                limits=row['operating_limits'] or {}
                if isinstance(limits,str):limits=json.loads(limits)
                state=advance(limits.get('factorypulse_usage',{}),readings,api['_utcnow']())
                c.execute(sql("UPDATE machines SET operating_limits=JSON_SET(COALESCE(operating_limits,JSON_OBJECT()),'$.factorypulse_usage',CAST(:state AS JSON)) WHERE machine_code=:code"),{'code':code,'state':json.dumps(state)})
    def worker():
        while not stop.wait(15):
            status={'checked_at':api['_utcnow']().isoformat()}
            try:scan();status['status']='tracking'
            except Exception as exc:status['status']='degraded_'+type(exc).__name__
            try:
                path=Path(__file__).resolve().parents[1]/'.local'/'usage-worker.json'
                path.write_text(json.dumps(status))
            except OSError:pass
    @app.on_event('startup')
    def start():threading.Thread(target=worker,daemon=True,name='observed-machine-usage').start()
    @app.on_event('shutdown')
    def shutdown():stop.set()
