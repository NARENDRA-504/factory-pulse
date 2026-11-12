"""Twelve-hour factory shifts and immutable handovers in the existing MySQL audit log."""
import datetime as dt
import json
import os
from zoneinfo import ZoneInfo
from fastapi import Depends, HTTPException, Request, Query
from pydantic import BaseModel, Field
from .team_access import check_machine, scoped_catalog


def shift_window(now, timezone='Asia/Kolkata', start_hour=6):
    local=now.astimezone(ZoneInfo(timezone))
    anchor=local.replace(hour=start_hour,minute=0,second=0,microsecond=0)
    if local < anchor: anchor-=dt.timedelta(days=1)
    index=int((local-anchor).total_seconds()//43200)
    start=anchor+dt.timedelta(hours=12*index)
    return start, start+dt.timedelta(hours=12), 'Shift A' if index==0 else 'Shift B'


def counter_output(rows, baseline=None):
    """Sum increases, counting post-reset values once. Never sum cumulative samples."""
    previous=baseline;total=0;resets=0
    for row in rows:
        value=row['value']
        if value is None or row.get('quality','GOOD')!='GOOD':
            previous=None
            continue
        if previous is not None:
            if value < previous: total+=value;resets+=1
            else: total+=value-previous
        previous=value
    return {'parts':total,'counter_resets':resets}


class ShiftEvent(BaseModel):
    machine_id: str
    event: str
    note: str = Field(default='', max_length=200)


def register(app, api):
    sql=api['_sql_text']
    def metadata(offset=0):
        timezone=os.getenv('FACTORY_TIMEZONE','Asia/Kolkata')
        start,end,label=shift_window(api['_utcnow'](),timezone,int(os.getenv('SHIFT_START_HOUR','6')))
        start-=dt.timedelta(hours=12*offset);end-=dt.timedelta(hours=12*offset)
        label='Shift A' if start.hour==int(os.getenv('SHIFT_START_HOUR','6')) else 'Shift B'
        return {'shift_id':start.strftime('%Y-%m-%d')+('-A' if label=='Shift A' else '-B'),
                'label':label,'starts_at':start.isoformat(),'ends_at':end.isoformat(),
                'timezone':timezone,'target_per_machine':120,'hours':12,'historical':offset>0}

    @app.get('/api/v1/operations/shift')
    def current_shift(machine_id: str | None = Query(None), offset: int = Query(0,ge=0,le=27), user=Depends(api['get_current_user'])):
        shift=metadata(offset);start=dt.datetime.fromisoformat(shift['starts_at']).astimezone(dt.timezone.utc).replace(tzinfo=None)
        end=dt.datetime.fromisoformat(shift['ends_at']).astimezone(dt.timezone.utc).replace(tzinfo=None)
        catalog=scoped_catalog(user,api['load_available_machine_master']());output=[]
        if machine_id:
            machine=api['resolve_canonical_machine'](machine_id);check_machine(user,machine['machineCode'])
            catalog={mid:m for mid,m in catalog.items() if mid==machine_id}
        with api['get_telemetry_engine']().connect() as c:
            for mid,machine in catalog.items():
                parts={};first=None;last=None;complete=True;has_baseline=True
                for sensor in ('Good Parts','Scrap Parts'):
                    params={'mid':mid,'sensor':sensor,'start':start,'end':end}
                    prior=c.execute(sql('''SELECT sensor_value_json,data_quality,reading_timestamp FROM simulator_sensor_readings
                        WHERE machine_id=:mid AND sensor_name=:sensor AND reading_timestamp<=:start
                        ORDER BY reading_timestamp DESC,id DESC LIMIT 1'''),params).mappings().first()
                    rows=c.execute(sql('''SELECT sensor_value_json,data_quality,reading_timestamp FROM simulator_sensor_readings
                        WHERE machine_id=:mid AND sensor_name=:sensor AND reading_timestamp>:start AND reading_timestamp<:end
                        ORDER BY reading_timestamp,id LIMIT 20001'''),params).mappings().all()
                    if len(rows)>20000:complete=False
                    usable=[]
                    for r in rows[:20000]:
                        value=api['_decode_sensor_value'](r['sensor_value_json'])
                        usable.append({'value':value if isinstance(value,(int,float)) and not isinstance(value,bool) and value>=0 else None,'quality':r['data_quality']})
                    baseline=api['_decode_sensor_value'](prior['sensor_value_json']) if prior and prior['data_quality']=='GOOD' and (start-prior['reading_timestamp']).total_seconds()<=30 else None
                    if not isinstance(baseline,(int,float)) or isinstance(baseline,bool) or baseline<0:baseline=None
                    has_baseline=has_baseline and baseline is not None and all(r['value'] is not None and r['quality']=='GOOD' for r in usable)
                    parts[sensor]=counter_output(usable,baseline) if usable else {'parts':None,'counter_resets':0}
                    if rows:
                        first=min(first,rows[0]['reading_timestamp']) if first else rows[0]['reading_timestamp']
                        last=max(last,rows[-1]['reading_timestamp']) if last else rows[-1]['reading_timestamp']
                good=parts['Good Parts']['parts'];scrap=parts['Scrap Parts']['parts']
                output.append({'machine_id':mid,'machine_code':machine['machineCode'],
                    'good':good if complete else None,'scrap':scrap if complete else None,
                    'actual':good+scrap if complete and good is not None and scrap is not None else None,
                    'target':120,'coverage':'full_counter_baseline' if has_baseline and complete else 'observed_only' if complete else 'sample_limit_reached',
                    'counter_resets':sum(v['counter_resets'] for v in parts.values()),
                    'first_observed':api['_iso_utc'](first) if first else None,'last_observed':api['_iso_utc'](last) if last else None})
            events=c.execute(sql('''SELECT id,employee_work_id,employee_name,event_type,
                JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(details) THEN details ELSE '{}' END,'$.resource_id')) resource_id,
                details,occurred_at_utc FROM activity_log
                WHERE event_type IN ('break_start','break_end','downtime_reason','handover') AND occurred_at_utc>=:start AND occurred_at_utc<:end
                ORDER BY id DESC LIMIT 500'''),{'start':start,'end':end}).mappings().all()
        allowed=set(catalog)
        return {**shift,'machines':output,'events':[dict(r) for r in events if str(r['resource_id']).split('/')[0] in allowed],
                'method':'Observed positive cumulative-counter changes, including recorded resets. Missing baselines or gaps can undercount; targets are planned, not measured.'}

    @app.post('/api/v1/operations/shift/events',status_code=201)
    def record_event(payload:ShiftEvent,request:Request,user=Depends(api['require_roles'](['Operator','Supervisor']))):
        if payload.event not in {'break_start','break_end','downtime_reason','handover'}:
            raise HTTPException(422,'Choose break_start, break_end, downtime_reason or handover')
        machine=api['resolve_canonical_machine'](payload.machine_id);check_machine(user,machine['machineCode'])
        if payload.event in {'handover','downtime_reason'} and len(payload.note.strip())<3:raise HTTPException(422,'Enter a short note')
        shift=metadata()
        with api['get_telemetry_engine']().begin() as c:
            c.execute(sql('SELECT id FROM users WHERE id=:id FOR UPDATE'),{'id':user['id']})
            if payload.event.startswith('break_'):
                last=c.execute(sql("""SELECT event_type FROM activity_log WHERE employee_id=:uid
                    AND JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(details) THEN details ELSE '{}' END,'$.resource_id'))=:ref
                    AND event_type IN ('break_start','break_end') ORDER BY id DESC LIMIT 1"""),
                    {'uid':user['id'],'ref':payload.machine_id+'/'+shift['shift_id']}).scalar()
                if (payload.event=='break_start' and last=='break_start') or (payload.event=='break_end' and last!='break_start'):
                    raise HTTPException(409,'Break state has already changed. Refresh the shift log.')
            api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],
                event_type=payload.event,session_id=user.get('session_id'),request_id=getattr(request.state,'request_id',None),request=request,
                resource_type='shift',resource_id=payload.machine_id+'/'+shift['shift_id'],details=json.dumps({'shift':shift['shift_id'],'resource_id':payload.machine_id+'/'+shift['shift_id'],'note':payload.note.strip()},ensure_ascii=False))
        return {'saved':True,'shift_id':shift['shift_id']}
