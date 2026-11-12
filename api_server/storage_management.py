"""Bounded MySQL compaction; summaries and deletion always share one transaction."""
import hashlib
import datetime as dt
import json
import math
import shutil
import sqlite3
import threading
from pathlib import Path
from fastapi import Depends, HTTPException, Request, Query
from pydantic import BaseModel, Field

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE_MARKER=ROOT/'.local/storage-archive-enabled'
POLICY=ROOT/'.local/storage-policy.json'
LOCK=threading.Lock()
STATE={'status':'not_run','deleted':0,'last_run':None}
STREAM_CURSOR=0


class Policy(BaseModel):
    enabled: bool=False
    raw_days: int=Field(default=14,ge=7,le=365)
    batch_size: int=Field(default=500,ge=50,le=1000)
    low_disk_gb: int=Field(default=5,ge=2,le=100)
    sender_cleanup: bool=False
    sender_raw_days: int=Field(default=2,ge=1,le=30)


def load_policy():
    return Policy.model_validate_json(POLICY.read_text()) if POLICY.exists() else Policy()


def summarize(rows):
    groups={}
    for r in rows:
        key=(r['machine_id'],r['sensor_name'],r['sensor_unit'],r['reading_timestamp'].replace(minute=0,second=0,microsecond=0))
        g=groups.setdefault(key,{'count':0,'numeric':0,'sum':0.,'min':None,'max':None})
        g['count']+=1
        try:value=json.loads(r['sensor_value_json']) if isinstance(r['sensor_value_json'],str) else r['sensor_value_json']
        except (ValueError,TypeError):value=None
        if r['data_quality']=='GOOD' and isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value):
            g['numeric']+=1;g['sum']+=value;g['min']=min(value,g['min']) if g['min'] is not None else value;g['max']=max(value,g['max']) if g['max'] is not None else value
    return groups


def reading_fingerprint(row):
    keys=('machine_id','machine_code','machine_type','department','production_line','sensor_name','sensor_unit','machine_status','data_quality','fault_mode')
    value=json.loads(row['sensor_value_json']) if isinstance(row['sensor_value_json'],str) else row['sensor_value_json']
    stamp=row['reading_timestamp']
    if isinstance(stamp,str):stamp=dt.datetime.fromisoformat(stamp.replace('Z','+00:00'))
    if stamp.tzinfo:stamp=stamp.astimezone(dt.timezone.utc).replace(tzinfo=None)
    data={k:row[k] for k in keys};data['time']=stamp.isoformat(timespec='microseconds')
    data['value']=format(float(value),'.17g') if isinstance(value,(int,float)) and not isinstance(value,bool) else value
    data['value_type']='number' if isinstance(value,(int,float)) and not isinstance(value,bool) else type(value).__name__
    for k in ('expected_min','expected_max'):data[k]=format(float(row[k]),'.6g')
    return hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def prune_sender(path, accepted_lookup, cutoff, batch=500):
    """Discard only old DELIVERED SQLite payloads whose IDs also exist in MySQL."""
    db=sqlite3.connect(path,timeout=2);db.row_factory=sqlite3.Row
    try:
        db.execute('BEGIN IMMEDIATE')
        rows=db.execute('''SELECT r.id,r.reading_id FROM machine_telemetry r
            JOIN telemetry_delivery d ON d.reading_id=r.reading_id
            WHERE d.status='DELIVERED' AND r.timestamp<?
              AND EXISTS(SELECT 1 FROM machine_telemetry newer WHERE newer.machine_id=r.machine_id
                AND newer.sensor_name=r.sensor_name AND newer.timestamp>r.timestamp)
            ORDER BY r.id LIMIT ?''',(cutoff,batch)).fetchall()
        confirmed=accepted_lookup([r['reading_id'] for r in rows]) if rows else set()
        ids=[r['reading_id'] for r in rows if r['reading_id'] in confirmed]
        if ids:
            args=','.join('?' for _ in ids)
            db.execute('DELETE FROM machine_telemetry WHERE reading_id IN ('+args+')',ids)
            db.execute("DELETE FROM telemetry_delivery WHERE status='DELIVERED' AND reading_id IN ("+args+')',ids)
        db.commit()
        return len(ids)
    except Exception:
        db.rollback();raise
    finally:db.close()


def compact(engine,sql,policy):
    """Never deletes latest pointers, accounts, incidents, audit or sender outbox."""
    cutoff=dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)-dt.timedelta(days=policy.raw_days)
    global STREAM_CURSOR
    with engine.begin() as c:
        # Existing (machine_id,sensor_name,reading_timestamp) index avoids a
        # full history scan and locks only a bounded set of old stream rows.
        streams=c.execute(sql('SELECT machine_id,sensor_name,reading_row_id FROM simulator_sensor_latest ORDER BY machine_id,sensor_name LIMIT 32 OFFSET :offset'),{'offset':STREAM_CURSOR}).mappings().all()
        if not streams:
            STREAM_CURSOR=0
            return 0
        rows=[]
        processed=0
        for stream in streams:
            rows.extend(c.execute(sql('''SELECT r.* FROM simulator_sensor_readings r
                WHERE machine_id=:mid AND sensor_name=:sensor AND reading_timestamp<:cutoff
                AND id<>:latest ORDER BY reading_timestamp,id LIMIT :batch FOR UPDATE'''),
                {'mid':stream['machine_id'],'sensor':stream['sensor_name'],'latest':stream['reading_row_id'],
                 'cutoff':cutoff,'batch':policy.batch_size-len(rows)}).mappings().all())
            processed+=1
            if len(rows)>=policy.batch_size:break
        STREAM_CURSOR+=processed
        if not rows:return 0
        for row in rows:
            c.execute(sql('INSERT INTO telemetry_archived_ids(reading_id,payload_hash) VALUES(:id,:payload)'),{'id':row['reading_id'],'payload':reading_fingerprint(row)})
        for (mid,sensor,unit,hour),g in summarize(rows).items():
            c.execute(sql('''INSERT INTO telemetry_hourly_summary
                (machine_id,sensor_name,sensor_unit,hour_utc,sample_count,good_numeric_count,numeric_sum,numeric_min,numeric_max)
                VALUES (:mid,:sensor,:unit,:hour,:count,:numeric,:sum,:min,:max)
                ON DUPLICATE KEY UPDATE sample_count=sample_count+VALUES(sample_count),
                good_numeric_count=good_numeric_count+VALUES(good_numeric_count),numeric_sum=numeric_sum+VALUES(numeric_sum),
                numeric_min=CASE WHEN numeric_min IS NULL THEN VALUES(numeric_min) WHEN VALUES(numeric_min) IS NULL THEN numeric_min ELSE LEAST(numeric_min,VALUES(numeric_min)) END,
                numeric_max=CASE WHEN numeric_max IS NULL THEN VALUES(numeric_max) WHEN VALUES(numeric_max) IS NULL THEN numeric_max ELSE GREATEST(numeric_max,VALUES(numeric_max)) END'''),
                {'mid':mid,'sensor':sensor,'unit':unit,'hour':hour,**g})
        params={f'id{i}':r['id'] for i,r in enumerate(rows)}
        result=c.execute(sql('DELETE FROM simulator_sensor_readings WHERE id IN ('+','.join(':'+k for k in params)+')'),params)
        if result.rowcount!=len(rows):raise RuntimeError('Compaction count mismatch; rolled back')
        return len(rows)


def register(app,api):
    sql=api['_sql_text'];stop=threading.Event()
    @app.get('/api/v1/telemetry/hourly/{machine_id}')
    def hourly(machine_id:str,days:int=Query(30,ge=1,le=365),sensor_name:str | None=Query(None,max_length=128),user=Depends(api['get_current_user'])):
        from .team_access import check_machine
        machine=api['resolve_canonical_machine'](machine_id);check_machine(user,machine['machineCode'])
        params={'mid':machine_id,'since':api['_utcnow']().replace(tzinfo=None)-dt.timedelta(days=days)}
        condition=''
        if sensor_name:condition=' AND sensor_name=:sensor';params['sensor']=sensor_name
        with api['get_telemetry_engine']().connect() as c:
            rows=c.execute(sql('''SELECT machine_id,sensor_name,sensor_unit,hour_utc,sample_count,good_numeric_count,
                numeric_sum/NULLIF(good_numeric_count,0) numeric_average,numeric_min,numeric_max
                FROM telemetry_hourly_summary WHERE machine_id=:mid AND hour_utc>=:since'''+condition+' ORDER BY hour_utc DESC,sensor_name LIMIT 1000'),params).mappings().all()
        return {'records':[dict(r) for r in rows],'limit':1000,'note':'Archived hourly sensor statistics only. Counter averages are not shift production totals; raw retained readings are served separately.'}
    def ready():
        with api['get_telemetry_engine']().connect() as c:
            return c.execute(sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('telemetry_hourly_summary','telemetry_archived_ids')")).scalar()==2
    def run():
        with LOCK:
            policy=load_policy()
            if not policy.enabled:return {'status':'disabled','deleted':0}
            if not ready():return {'status':'migration_required','deleted':0}
            deleted=compact(api['get_telemetry_engine'](),sql,policy)
            sender_deleted=0
            if policy.sender_cleanup:
                from dotenv import dotenv_values
                simulator=ROOT.parent/'AI Simulator'
                configured=dotenv_values(simulator/'backend/.env').get('DATABASE_PATH')
                path=Path(configured) if configured else simulator/'data/simulator.db'
                if not path.is_absolute():path=simulator/'backend'/path
                path=path.resolve()
                if not path.is_relative_to(simulator.resolve()) or not path.is_file():
                    raise RuntimeError('Sender database path is unavailable or outside its project')
                def accepted(ids):
                    params={f'id{i}':value for i,value in enumerate(ids)};names=','.join(':'+k for k in params)
                    with api['get_telemetry_engine']().connect() as c:
                        return set(c.execute(sql(f'SELECT reading_id FROM simulator_sensor_readings WHERE reading_id IN ({names}) UNION SELECT reading_id FROM telemetry_archived_ids WHERE reading_id IN ({names})'),params).scalars())
                cutoff=(api['_utcnow']()-dt.timedelta(days=policy.sender_raw_days)).isoformat()
                sender_deleted=prune_sender(path,accepted,cutoff,policy.batch_size)
            STATE.update(status='completed',deleted=deleted,sender_deleted=sender_deleted,last_run=api['_utcnow']().isoformat())
            return dict(STATE)
    def worker():
        while not stop.wait(60):
            try:STATE.update(run())
            except Exception as error:STATE.update(status='degraded_'+type(error).__name__,deleted=0)
            try:
                tmp=ROOT/'.local/storage-worker.tmp';tmp.write_text(json.dumps(STATE));tmp.replace(ROOT/'.local/storage-worker.json')
            except OSError:pass
    @app.on_event('startup')
    def start_worker():
        threading.Thread(target=worker,daemon=True,name='telemetry-compaction').start()
    @app.on_event('shutdown')
    def stop_worker():stop.set()
    @app.get('/api/v1/admin/storage')
    def status(user=Depends(api['require_roles'](['Admin']))):
        policy=load_policy();disk=shutil.disk_usage(ROOT)
        return {'policy':policy.model_dump(),'summary_table_ready':ready(),'worker':STATE,
                'free_gb':round(disk.free/1024**3,2),'low_space':disk.free<policy.low_disk_gb*1024**3,
                'note':'Cleanup reuses MySQL space; it does not necessarily shrink database files on disk. Undelivered Simulator records are never touched.'}
    @app.put('/api/v1/admin/storage')
    def configure(payload:Policy,request:Request,user=Depends(api['require_roles'](['Admin']))):
        if payload.enabled and not ready():raise HTTPException(409,'Run 20261102_operational_readiness.sql with your schema-owner account before enabling cleanup.')
        with LOCK:
            with api['get_telemetry_engine']().begin() as c:
                api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],event_type='storage_policy_changed',resource_type='storage_policy',resource_id='telemetry',request=request,details=json.dumps(payload.model_dump()))
            if payload.enabled:ARCHIVE_MARKER.write_text('Required to preserve archived reading idempotency; do not delete.')
            tmp=POLICY.with_suffix('.tmp');tmp.write_text(payload.model_dump_json());tmp.replace(POLICY)
        return {'saved':True,'policy':payload.model_dump()}
