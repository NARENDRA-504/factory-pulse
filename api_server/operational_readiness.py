"""Read-only diagnostics and explicit, audited handovers/acknowledgements.

No ingestion hooks, automatic model alerts, equipment commands or Supabase queries.
"""
import datetime as dt
import hashlib
import json
import math
import time
import urllib.request
from pathlib import Path
from fastapi import Depends, HTTPException, Request, Query
from pydantic import BaseModel, Field
from .team_access import scoped_catalog, check_machine, sql_scope
from .health_model import model_status, predict_machine
from .sop_retrieval import retrieve_sop
from .live_analytics import summarize_downtime

def utc(value):
    parsed=value if isinstance(value,dt.datetime) else dt.datetime.fromisoformat(str(value).replace('Z','+00:00'))
    return parsed.replace(tzinfo=dt.timezone.utc) if parsed.tzinfo is None else parsed.astimezone(dt.timezone.utc)

def summarize_pipeline(catalog,rows,now):
    machines=[];delays=[];future=0
    for mid,m in catalog.items():
        samples=[r for r in rows if r['machine_id']==mid];ages=[];fresh=0
        for r in samples:
            age=(now-utc(r['reading_timestamp'])).total_seconds();ages.append(age)
            if age<0:future+=1
            if 0<=age<=30:fresh+=1
            if r.get('created_at'):
                delay=(utc(r['created_at'])-utc(r['reading_timestamp'])).total_seconds()*1000
                if delay>=0:delays.append(delay)
        machines.append({'machine_id':mid,'machine_code':m['machineCode'],'streams':len(samples),'fresh_streams':fresh,
            'age_seconds':max(0,min(ages)) if ages and min(ages)>=0 else None,
            'state':'no_data' if not samples else 'clock_skew' if min(ages)<0 else 'fresh' if fresh==len(samples) else 'partial' if fresh else 'stale',
            'latest_at':max((utc(r['reading_timestamp']).isoformat() for r in samples),default=None)})
    delays.sort();fresh_count=sum(m['fresh_streams']>0 for m in machines)
    return {'machines':machines,'machines_in_scope':len(catalog),'machines_receiving':fresh_count,
        'sensor_streams':len(rows),'future_dated_readings':future,
        'ingestion_delay_ms':{'median':delays[len(delays)//2] if delays else None,'p95':delays[min(len(delays)-1,int(.95*len(delays)))] if delays else None,
            'basis':'Latest saved creation time minus observation time; not browser end-to-end latency.'},
        'fingerprint':hashlib.sha256('|'.join(sorted(r['reading_id'] for r in rows)).encode()).hexdigest(),
        'status':'live' if fresh_count else 'waiting' if not rows else 'stale'}

_sender_cache={'at':0,'value':None}
def sender_health():
    # Fixed local observability endpoint: never forward arbitrary browser URLs or keys.
    if time.monotonic()-_sender_cache['at']<10:return _sender_cache['value']
    try:
        from dotenv import dotenv_values
        path=Path(__file__).resolve().parents[2]/'AI Simulator/backend/.env'
        key=dotenv_values(path).get('SIMULATOR_API_KEY','') if path.exists() else ''
        req=urllib.request.Request('http://127.0.0.1:8002/api/v1/integration/status',headers={'X-API-Key':key} if key else {})
        with urllib.request.urlopen(req,timeout=1.5) as response:
            raw=response.read(20001)
            if len(raw)>20000:raise ValueError('Oversize sender status')
            data=json.loads(raw)
        value={k:data.get(k) for k in ('enabled','configured','ready','paused','pending','retrying','failed','delivered','sample_size','counts_scope','last_success_at')}
        value.update(status='reachable',has_delivery_error=bool(data.get('latest_error')))
    except Exception:value={'status':'unavailable','notice':'Local sender status could not be checked; MySQL reading continues independently.'}
    _sender_cache.update(at=time.monotonic(),value=value)
    return value

class Handover(BaseModel):
    machine_id:str=Field(min_length=1,max_length=32)
    note:str=Field(min_length=8,max_length=120)
    restrictions:str=Field(default='',max_length=70)

class SopAcknowledgement(BaseModel):
    document_id:str=Field(min_length=1,max_length=64)
    sha256:str=Field(pattern=r'^[a-f0-9]{64}$')
    note:str=Field(min_length=5,max_length=120)

class Acknowledge(BaseModel):
    note:str=Field(min_length=5,max_length=120)

def register(app,api):
    current=api['get_current_user'];sql=api['_sql_text'];engine=api['get_telemetry_engine']
    def audit(c,user,request,event,resource,rid,details):
        api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],
            event_type=event,session_id=user.get('session_id'),request=request,resource_type=resource,resource_id=rid,
            request_id=getattr(request.state,'request_id',None),details=details)
    def machine_for(user,mid):
        m=api['resolve_canonical_machine'](mid);check_machine(user,m['machineCode']);return m
    def endpoint(path):
        return next(r.endpoint for r in app.routes if getattr(r,'path',None)==path and 'GET' in getattr(r,'methods',set()))
    def structured(row):
        try:
            data=json.loads(row['details'])
            return data if isinstance(data,dict) else {}
        except (ValueError,TypeError):return {}
    def incident(c,id,user):
        r=c.execute(sql('SELECT id,machine_code,severity,status,component_area,sensor_snapshot,assigned_to_id,created_at FROM incidents WHERE id=:id'),{'id':id}).mappings().first()
        if not r:raise HTTPException(404,'Incident not found')
        check_machine(user,r['machine_code'])
        if user['role']=='Maintenance' and r['assigned_to_id'] not in (None,user['id']):raise HTTPException(403,'Incident assigned to another technician')
        return r

    @app.get('/api/v1/operations/readiness')
    def readiness(user=Depends(current)):
        start=time.perf_counter();catalog=scoped_catalog(user,api['load_available_machine_master']());now=api['_utcnow']()
        try:
            params={};scope=sql_scope(user,'r.machine_code',params)
            with engine().connect() as c:
                c.execute(sql('SELECT 1'))
                rows=[dict(r) for r in c.execute(sql('''SELECT r.machine_id,r.reading_id,r.reading_timestamp,r.created_at
                    FROM simulator_sensor_latest l JOIN simulator_sensor_readings r ON r.id=l.reading_row_id
                    WHERE '''+scope+' LIMIT 6401'),params).mappings() if r['machine_id'] in catalog]
            result=summarize_pipeline(catalog,rows[:6400],now);result['sample_limit_reached']=len(rows)>6400
            result['mysql']='reachable'
        except Exception:
            result={'mysql':'unavailable','status':'degraded','machines':[],'notice':'MySQL diagnostics unavailable. No data has been altered.'}
        result.update(checked_at=now.isoformat(),query_ms=round((time.perf_counter()-start)*1000,1),model=model_status())
        if user['role'] in {'Admin','Super Admin'}:result['sender']=sender_health()
        return result

    @app.get('/api/v1/intelligence/health-model/{machine_id}')
    def model(machine_id:str,user=Depends(current)):
        machine_for(user,machine_id)
        rows=[r.model_dump() for r in api['get_simulator_fleet_latest_readings'](user=user) if r.machine_id==machine_id]
        return {'machine_id':machine_id,**predict_machine(rows,api['_utcnow']())}

    @app.get('/api/v1/operations/handover/{machine_id}')
    def handover(machine_id:str,user=Depends(current)):
        m=machine_for(user,machine_id)
        shift=endpoint('/api/v1/operations/shift')(machine_id=machine_id,offset=0,user=user)
        now=api['_utcnow'](); since=now-dt.timedelta(hours=12)
        with engine().connect() as c:
            points=c.execute(sql("SELECT reading_timestamp,machine_status FROM simulator_sensor_readings WHERE machine_id=:mid AND sensor_name='RPM' AND reading_timestamp>=:since AND reading_timestamp<=:until ORDER BY reading_timestamp DESC,id DESC LIMIT 10001"),{'mid':machine_id,'since':since.replace(tzinfo=None),'until':now.replace(tzinfo=None)}).mappings().all()
            downtime=summarize_downtime([(utc(r['reading_timestamp']),r['machine_status']=='STOPPED') for r in points[:10000]],since,now)
            downtime['coverage']='latest_10000_RPM_samples' if len(points)>10000 else 'available_RPM_samples_in_last_12h'
            incidents=[dict(r) for r in c.execute(sql("SELECT id,severity,status,component_area FROM incidents WHERE machine_code=:code AND status<>'Closed' ORDER BY id DESC LIMIT 20"),{'code':m['machineCode']}).mappings()]
            recent=c.execute(sql("SELECT id,employee_id,employee_work_id,event_type,details,occurred_at_utc FROM activity_log WHERE event_type IN ('handover_published','handover_acknowledged') ORDER BY id DESC LIMIT 300")).mappings().all()
        logs=[]
        for r in recent:
            d=structured(r)
            if str(d.get('resource_id','')).split('/')[0]!=machine_id:continue
            logs.append({'id':r['id'],'employee_work_id':r['employee_work_id'],'event':r['event_type'],'at':api['_iso_utc'](r['occurred_at_utc']),**d})
        return {'machine_id':machine_id,'machine_code':m['machineCode'],'shift':shift,'downtime':downtime,'open_incidents':incidents,
                'history':logs,'history_scope':'latest 300 handover events, filtered to authorized machine',
                'notice':'Output is observed counter change. Downtime is limited to recorded observations. Restrictions are employee notes, not equipment authorization.'}

    @app.post('/api/v1/operations/handovers',status_code=201)
    def publish(payload:Handover,request:Request,user=Depends(api['require_roles'](['Operator','Supervisor']))):
        if len(payload.note.strip())<8:raise HTTPException(422,'Enter a meaningful handover note')
        draft=handover(payload.machine_id,user);shift=draft['shift'];counts=next(iter(shift['machines']),{})
        details={'resource_id':payload.machine_id+'/'+shift['shift_id'],'good':counts.get('good'),'scrap':counts.get('scrap'),
            'coverage':counts.get('coverage'),'open_incidents':len(draft['open_incidents']),'stopped_seconds_12h':round(draft['downtime']['total_seconds']),
            'note':payload.note.strip(),'restrictions':payload.restrictions.strip()}
        serialized=json.dumps(details,separators=(',',':'),ensure_ascii=False)
        # Keep JSON valid inside the existing bounded audit details column, including delegated-view metadata.
        if len(serialized)>430:raise HTTPException(422,'Shorten the handover note or restrictions')
        with engine().begin() as c:
            c.execute(sql('SELECT id FROM users WHERE id=:id FOR UPDATE'),{'id':user['id']})
            audit(c,user,request,'handover_published','machine_handover',payload.machine_id,serialized)
        return {'saved':True,'message':'Handover saved with its observed production snapshot. The next employee can acknowledge it.'}

    @app.post('/api/v1/operations/handovers/{handover_id}/acknowledge')
    def accept(handover_id:int,payload:Acknowledge,request:Request,user=Depends(api['require_roles'](['Operator','Supervisor','Maintenance']))):
        if len(payload.note.strip())<5:raise HTTPException(422,'Enter a meaningful acknowledgement')
        with engine().begin() as c:
            row=c.execute(sql("SELECT id,employee_id,details FROM activity_log WHERE id=:id AND event_type='handover_published' FOR UPDATE"),{'id':handover_id}).mappings().first()
            if not row:raise HTTPException(404,'Handover not found')
            d=structured(row);mid=str(d.get('resource_id','')).split('/')[0];machine_for(user,mid)
            actual=getattr(request.state,'acting_principal',user)
            if row['employee_id']==actual['id']:raise HTTPException(409,'A different employee must acknowledge this handover')
            previous=c.execute(sql("SELECT id FROM activity_log WHERE event_type='handover_acknowledged' AND CASE WHEN JSON_VALID(details) THEN JSON_EXTRACT(details,'$.handover_id') ELSE NULL END=:hid AND employee_id=:uid LIMIT 1"),{'hid':handover_id,'uid':actual['id']}).scalar()
            if previous:raise HTTPException(409,'You already acknowledged this handover')
            audit(c,user,request,'handover_acknowledged','machine_handover',str(handover_id),json.dumps({'resource_id':d['resource_id'],'handover_id':handover_id,'note':payload.note.strip()},separators=(',',':')))
        return {'saved':True,'message':'Handover acknowledged'}

    @app.get('/api/v1/operations/incidents/{incident_id}/response')
    def response(incident_id:int,user=Depends(current)):
        with engine().connect() as c:
            r=incident(c,incident_id,user)
            from sqlalchemy import inspect
            columns={x['name'] for x in inspect(c).get_columns('activity_log')}
            linked="CASE WHEN JSON_VALID(details) THEN JSON_EXTRACT(details,'$.incident_id') ELSE NULL END=:numeric_id"
            if {'resource_type','resource_id'} <= columns:
                linked="(resource_type='incident' AND resource_id=:id) OR ("+linked+")"
            history=c.execute(sql("SELECT employee_work_id,event_type,details,occurred_at_utc FROM activity_log WHERE "+linked+" ORDER BY id DESC LIMIT 30"),{'id':str(incident_id),'numeric_id':incident_id}).mappings().all()
        m=next((m for m in api['load_available_machine_master']().values() if m['machineCode']==r['machine_code']),None)
        snapshot=r['sensor_snapshot']
        try:snapshot=json.loads(snapshot) if isinstance(snapshot,str) else snapshot
        except ValueError:snapshot=[]
        facts=[f for f in (snapshot or []) if isinstance(f,dict)] if isinstance(snapshot,list) else []
        sop=retrieve_sop(str(r['component_area']),user['role'],m['machineId'] if m else None,facts,api['_utcnow']())
        return {'incident_id':incident_id,'status':r['status'],'severity':r['severity'],'sop':sop,
            'stages':[{'label':'Report','done':True},{'label':'Assign technician','done':r['assigned_to_id'] is not None},
                      {'label':'Repair and verify','done':r['status']=='Closed'},{'label':'Resolved','done':r['status']=='Closed'}],
            'history':[{'employee_work_id':x['employee_work_id'],'event':x['event_type'],'at':api['_iso_utc'](x['occurred_at_utc'])} for x in history]}

    @app.post('/api/v1/operations/incidents/{incident_id}/acknowledge')
    def acknowledge(incident_id:int,payload:Acknowledge,request:Request,user=Depends(api['require_roles'](['Operator','Supervisor','Maintenance']))):
        if len(payload.note.strip())<5:raise HTTPException(422,'Enter a meaningful acknowledgement')
        with engine().begin() as c:
            row=incident(c,incident_id,user)
            if row['status']=='Closed':raise HTTPException(409,'This incident is already resolved')
            audit(c,user,request,'alert_acknowledged','incident',incident_id,json.dumps({'incident_id':incident_id,'note':payload.note.strip()},separators=(',',':')))
        return {'saved':True,'message':'Acknowledged. Assignment, repair notes and closure still use the incident workflow.'}

    @app.post('/api/v1/operations/incidents/{incident_id}/sop-acknowledge')
    def acknowledge_sop(incident_id:int,payload:SopAcknowledgement,request:Request,user=Depends(api['require_roles'](['Operator','Supervisor','Maintenance']))):
        if len(payload.note.strip())<5:raise HTTPException(422,'Enter a meaningful acknowledgement')
        current_response=response(incident_id,user)
        source=next((s for s in current_response['sop']['sources'] if s['document_id']==payload.document_id and s['sha256']==payload.sha256),None)
        if not source:raise HTTPException(409,'The procedure changed or is no longer applicable. Refresh and read the current guidance.')
        if current_response['status']=='Closed':raise HTTPException(409,'This incident is already resolved')
        details=json.dumps({'incident_id':incident_id,'document_id':source['document_id'],'revision':source['revision'],
                           'sha256':source['sha256'],'approval':source['approval_status'],'note':payload.note.strip()},separators=(',',':'))
        if len(details)>430:raise HTTPException(422,'Shorten the acknowledgement note')
        with engine().begin() as c:
            latest=incident(c,incident_id,user)
            c.execute(sql('SELECT id FROM incidents WHERE id=:id FOR UPDATE'),{'id':incident_id})
            latest=incident(c,incident_id,user)
            if latest['status']=='Closed':raise HTTPException(409,'This incident is already resolved')
            audit(c,user,request,'sop_acknowledged','incident',incident_id,details)
        return {'saved':True,'message':'Guidance revision acknowledged. This does not authorize operation, restart or incident closure.'}
