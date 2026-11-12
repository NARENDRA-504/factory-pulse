"""Role-scoped reliability, persisted incident routing and observed maintenance results.

Read-only endpoints; no receiver changes, generated readings or cloud delivery.
"""
import datetime as dt
import json
import math
from collections import Counter,defaultdict
from fastapi import Depends,Query
from .team_access import scoped_catalog,check_machine,sql_scope
from .operational_readiness import utc

# These are the current pipeline's common physical channels, not universal equipment specifications.
COMMON={'RPM':'RPM','Temperature':'°C','Motor Temperature':'°C','Vibration':'mm/s','Pressure':'bar','Current':'A','Coolant Flow':'L/min'}

def sensor_checks(catalog,rows,now,history=None):
    history=history or {}; result=[]
    indexed={(r['machine_id'],r['sensor_name']):r for r in rows}
    for mid,m in catalog.items():
        for sensor,unit in COMMON.items():
            r=indexed.get((mid,sensor));issues=[];age=None;value=None
            if r is None:issues.append('missing')
            else:
                try:
                    age=(now-utc(r['reading_timestamp'])).total_seconds()
                    if age<0:issues.append('future_timestamp')
                    elif age>30:issues.append('stale')
                except (ValueError,TypeError):issues.append('invalid_timestamp')
                try:value=json.loads(r['sensor_value_json'])
                except (ValueError,TypeError):issues.append('invalid_value')
                if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
                    if 'invalid_value' not in issues:issues.append('invalid_value')
                    value=None
                if r.get('data_quality')!='GOOD':issues.append('quality_'+str(r.get('data_quality','missing')).lower())
                if r.get('sensor_unit')!=unit:issues.append('unit_mismatch')
                points=history.get((mid,sensor),[])
                # Unchanged output can be legitimate; explicitly report a review candidate, not a sensor failure.
                if not issues and len(points)>=10 and r.get('machine_status')=='NORMAL':
                    valid=[]
                    for point in points:
                        try:
                            v=json.loads(point['sensor_value_json']);t=utc(point['reading_timestamp'])
                            if point.get('data_quality')=='GOOD' and point.get('sensor_unit')==unit and not isinstance(v,bool) and isinstance(v,(int,float)) and math.isfinite(v) and 0<=(now-t).total_seconds()<=120:valid.append((t,v))
                        except (ValueError,TypeError):pass
                    if len(valid)>=10 and (max(x[0] for x in valid)-min(x[0] for x in valid)).total_seconds()>=60 and len(set(v for _,v in valid))==1:
                        issues.append('unchanged_review')
            result.append({'machine_id':mid,'machine_code':m['machineCode'],'sensor':sensor,'expected_unit':unit,
                           'received_unit':r.get('sensor_unit') if r else None,'value':value,'age_seconds':age,
                           'issues':issues,'state':'review' if issues==['unchanged_review'] else 'unreliable' if issues else 'fresh',
                           'reading_id':r.get('reading_id') if r else None})
    return result

def routed(role,severity):
    if role in {'Admin','Super Admin'}:return True
    if role=='Manager':return severity=='Critical'
    return role in {'Operator','Supervisor','Maintenance'} and severity in {'Medium','High','Critical'}

def maintenance_summary(rows,acks,now):
    closed=[];invalid=0;open_count=0;groups=Counter();response=[]
    for r in rows:
        groups[(r['machine_code'],r['component_area'])]+=1
        try:
            start=utc(r['created_at'])
            if r['status']=='Closed' and r.get('closed_at'):
                end=utc(r['closed_at']);seconds=(end-start).total_seconds()
                if seconds>=0 and end<=now:closed.append(seconds)
                else:invalid+=1
            elif r['status']!='Closed':open_count+=1
            if r['id'] in acks:
                seconds=(utc(acks[r['id']])-start).total_seconds()
                if seconds>=0 and utc(acks[r['id']])<=now:response.append(seconds)
        except (ValueError,TypeError):invalid+=1
    return {'incidents_sampled':len(rows),'open':open_count,'resolved':len(closed),'invalid_dates':invalid,
            'mean_report_to_resolution_minutes':sum(closed)/len(closed)/60 if closed else None,
            'mean_first_ack_minutes':sum(response)/len(response)/60 if response else None,'acknowledgement_samples':len(response),
            'repeated_groups':[{'machine_code':k[0],'component':k[1],'reports':v} for k,v in groups.most_common(10) if v>1],
            'notice':'Report-to-resolution includes waiting and investigation; it is not hands-on repair time or MTBF. Acknowledgement is the first recorded alert acknowledgement, not technician arrival.'}

def register(app,api):
    sql=api['_sql_text'];engine=api['get_telemetry_engine'];current=api['get_current_user']
    def incident_scope(user,params):
        scope=sql_scope(user,'i.machine_code',params)
        if user['role']=='Maintenance':
            params['tech']=user['id'];scope+=' AND (i.assigned_to_id IS NULL OR i.assigned_to_id=:tech)'
        return scope

    @app.get('/api/v1/operations/sensor-reliability')
    def reliability(machine_id:str|None=Query(default=None,max_length=32),user=Depends(current)):
        catalog=scoped_catalog(user,api['load_available_machine_master']())
        if machine_id:
            m=api['resolve_canonical_machine'](machine_id);check_machine(user,m['machineCode'])
            machine_id=m['machineId'];catalog={machine_id:m}
        params={};scope=sql_scope(user,'r.machine_code',params)
        if machine_id:scope+=' AND r.machine_id=:mid';params['mid']=machine_id
        now=api['_utcnow']();history={}
        with engine().connect() as c:
            rows=[dict(r) for r in c.execute(sql("SELECT r.machine_id,r.sensor_name,r.sensor_unit,r.sensor_value_json,r.data_quality,r.machine_status,r.reading_timestamp,r.reading_id FROM simulator_sensor_latest l JOIN simulator_sensor_readings r ON r.id=l.reading_row_id WHERE "+scope+" LIMIT 6400"),params).mappings()]
            if machine_id:
                for sensor in COMMON:
                    history[(machine_id,sensor)]=[dict(r) for r in c.execute(sql("SELECT reading_timestamp,sensor_value_json,data_quality,sensor_unit FROM simulator_sensor_readings WHERE machine_id=:mid AND sensor_name=:sensor AND reading_timestamp>=:since AND reading_timestamp<=:now ORDER BY reading_timestamp DESC,id DESC LIMIT 121"),{'mid':machine_id,'sensor':sensor,'since':(now-dt.timedelta(seconds=120)).replace(tzinfo=None),'now':now.replace(tzinfo=None)}).mappings()]
        checks=sensor_checks(catalog,rows,now,history)
        return {'checked_at':now.isoformat(),'checks':checks,'summary':dict(Counter(r['state'] for r in checks)),
                'history_checked':bool(machine_id),'notice':'Common pipeline channels only. Missing or stale data is not proof of a disconnected sensor. Unchanged values are review candidates, not confirmed failures; constant readings may be valid. No equipment command or incident is generated.'}

    @app.get('/api/v1/operations/alert-inbox')
    def inbox(user=Depends(current)):
        params={};scope=incident_scope(user,params)
        # Filter on the server, before LIMIT or serialization. Managers receive Critical only.
        if user['role']=='Manager':scope+=" AND i.severity='Critical'"
        elif user['role'] not in {'Admin','Super Admin'}:scope+=" AND i.severity IN ('Medium','High','Critical')"
        with engine().connect() as c:
            rows=c.execute(sql("SELECT i.id,i.incident_code,i.machine_code,i.severity,i.component_area,i.status,i.created_at FROM incidents i WHERE "+scope+" AND i.status<>'Closed' ORDER BY CASE i.severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 ELSE 2 END,i.created_at DESC,i.id DESC LIMIT 100"),params).mappings().all()
            ack_rows=c.execute(sql("SELECT details,occurred_at_utc FROM activity_log WHERE employee_id=:employee AND event_type='alert_acknowledged' ORDER BY id DESC LIMIT 1000"),{'employee':user['id']}).mappings().all()
        acked={}
        for a in ack_rows:
            try:acked.setdefault(json.loads(a['details'])['incident_id'],api['_iso_utc'](a['occurred_at_utc']))
            except (ValueError,TypeError,KeyError):pass
        return {'alerts':[{'id':r['id'],'code':r['incident_code'],'machine_code':r['machine_code'],'level':'Critical' if r['severity']=='Critical' else 'Suspect' if r['severity'] in {'High','Medium'} else 'Information','severity':r['severity'],'component':r['component_area'],'status':r['status'],'acknowledged_at':acked.get(r['id']),'created_at':api['_iso_utc'](r['created_at'])} for r in rows],
                'scope':'Latest 100 open incidents in your authorized scope; acknowledgements from your latest 1000 acknowledgement events; Maintenance sees unassigned or own work. Manager escalation is Critical only. Admin oversight includes all severities.',
                'delivery':'Authenticated in-app polling from committed MySQL incidents; no email, push or Supabase delivery is claimed.'}

    @app.get('/api/v1/operations/maintenance-effectiveness')
    def effectiveness(days:int=Query(default=30,ge=1,le=90),user=Depends(api['require_roles'](['Supervisor','Maintenance','Manager','Admin']))):
        now=api['_utcnow']();params={'since':(now-dt.timedelta(days=days)).replace(tzinfo=None),'until':now.replace(tzinfo=None)};scope=incident_scope(user,params)
        with engine().connect() as c:
            rows=[dict(r) for r in c.execute(sql("SELECT i.id,i.machine_code,i.component_area,i.status,i.created_at,i.closed_at FROM incidents i WHERE "+scope+" AND i.created_at>=:since AND i.created_at<=:until ORDER BY i.created_at DESC,i.id DESC LIMIT 5001"),params).mappings()]
            ids={r['id'] for r in rows[:5000]};acks={}
            # New acknowledgements store incident IDs in valid JSON, also on legacy audit schemas.
            logs=c.execute(sql("SELECT details,occurred_at_utc FROM activity_log WHERE event_type='alert_acknowledged' AND occurred_at_utc>=:since ORDER BY id DESC LIMIT 1001"),params).mappings().all()
            for r in logs[:1000]:
                try:
                    id=json.loads(r['details']).get('incident_id')
                    if id in ids and (id not in acks or utc(r['occurred_at_utc'])<utc(acks[id])):acks[id]=r['occurred_at_utc']
                except (ValueError,TypeError,AttributeError):pass
        return {**maintenance_summary(rows[:5000],acks,now),'days':days,'incident_limit_reached':len(rows)>5000,'ack_history_limit_reached':len(logs)>1000,
                'coverage':'Latest 5000 incidents reported in window; acknowledgement history limited to latest 1000 matching events.'}
