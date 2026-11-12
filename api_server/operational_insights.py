"""Authorized SQL facts, downtime and optional owner-approved Gemini analysis."""
import datetime as dt
import os
import re
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from .live_analytics import summarize_downtime
from .chat_scope import in_scope
from .team_access import check_machine,sql_scope,scoped_catalog
from .conversation import conversation_reply, private_request
from .gemini_insights import generate_selected_analysis, provider_configuration
from .rag import retrieve_context, local_knowledge_answer, resolve_retrieval_question
from .sop_retrieval import retrieve_sop


def as_utc(value):
    parsed=value if isinstance(value,dt.datetime) else dt.datetime.fromisoformat(str(value).replace('Z','+00:00'))
    return parsed.replace(tzinfo=dt.timezone.utc) if parsed.tzinfo is None else parsed.astimezone(dt.timezone.utc)


class FactoryQuestion(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    machine_id: str | None = None
    use_ai: bool = False
    prior_questions: list[str] = Field(default_factory=list,max_length=4)


def register(app, api):
    current = api['get_current_user']
    sql = api['_sql_text']
    engine = api['get_telemetry_engine']
    fleet = api['get_simulator_fleet_latest_readings']

    @app.get('/api/v1/telemetry/downtime/{machine_id}')
    def downtime(machine_id: str, minutes: int = Query(60, ge=1, le=1440), user=Depends(current)):
        machine=api['resolve_canonical_machine'](machine_id)
        check_machine(user,machine['machineCode'])
        if user['role']=='Operator' and machine['machineCode']!=user.get('assigned_machine'):
            raise HTTPException(403,'Operators may only view their assigned machine')
        until=api['_utcnow'](); since=until-dt.timedelta(minutes=minutes)
        parameters={'machine_id':machine_id,'since':since.replace(tzinfo=None),'until':until.replace(tzinfo=None)}
        with engine().connect() as connection:
            previous=connection.execute(sql('''SELECT reading_timestamp,
                MAX(CASE WHEN machine_status='STOPPED' THEN 1 ELSE 0 END) AS stopped
                FROM simulator_sensor_readings WHERE machine_id=:machine_id AND reading_timestamp<:since
                GROUP BY reading_timestamp ORDER BY reading_timestamp DESC LIMIT 1'''),parameters).mappings().first()
            rows=connection.execute(sql('''SELECT reading_timestamp,
                MAX(CASE WHEN machine_status='STOPPED' THEN 1 ELSE 0 END) AS stopped
                FROM simulator_sensor_readings WHERE machine_id=:machine_id AND reading_timestamp BETWEEN :since AND :until
                GROUP BY reading_timestamp ORDER BY reading_timestamp'''),parameters).mappings().all()
        observations=[(r['reading_timestamp'],bool(r['stopped'])) for r in ([previous] if previous else [])+list(rows)]
        result=summarize_downtime(observations,since,until,
            round_minutes=max(1,min(1440,int(os.getenv('SIMULATION_ROUND_MINUTES','30')))),
            stale_seconds=max(2,int(os.getenv('TELEMETRY_STALE_SECONDS','30'))))
        for row in result['rounds']:
            row['round_id']=machine_id+'/'+row['round_id']
        return {'machine_id':machine_id,'since':since.isoformat(),'until':until.isoformat(),
                'observed_timestamps':len(rows),**result}

    @app.get('/api/v1/admin/system-health')
    def health(user=Depends(api['require_roles'](['Admin']))):
        readings=fleet(user=user); latest={}
        for row in readings:
            if row.machine_id not in latest or row.timestamp>latest[row.machine_id]: latest[row.machine_id]=row.timestamp
        now=api['_utcnow'](); threshold=max(2,int(os.getenv('TELEMETRY_STALE_SECONDS','30')))
        fresh=sum((now-as_utc(t)).total_seconds()<=threshold for t in latest.values())
        with engine().connect() as connection:
            status_column = connection.execute(sql("""SELECT COLUMN_TYPE FROM information_schema.columns
                WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='simulator_sensor_readings'
                  AND COLUMN_NAME='machine_status'""")).scalar()
            summary=connection.execute(sql('''SELECT COUNT(*) AS recent_events, MAX(created_at) AS latest_ingestion
                FROM (SELECT created_at FROM simulator_sensor_readings ORDER BY id DESC LIMIT 1001) recent WHERE created_at>=UTC_TIMESTAMP()-INTERVAL 15 MINUTE''')).mappings().first()
        return {'backend':'reachable','mysql':'reachable','receiver_configured':bool(os.getenv('SIMULATOR_API_KEY')),
            'pause_state_storage': 'ready' if status_column and "'IDLE'" in status_column else 'database_update_required',
            'latest_ingestion':api['_iso_utc'](summary['latest_ingestion']) if summary['latest_ingestion'] else None,
            'events_last_15_minutes':('1000+ (bounded)' if summary['recent_events']>1000 else summary['recent_events']),'machines_receiving':fresh,
            'machines_with_saved_data':len(latest),'stale_machines':len(latest)-fresh,'stale_after_seconds':threshold,
            'ai':{'status':'configured_not_verified' if not provider_configuration()[2] else 'unconfigured',
                  'missing_settings':provider_configuration()[2]},
            'power_bi':{'status':'unverified','reason':'No report, semantic-model connection or successful refresh evidence is available.'}}

    @app.post('/api/v1/intelligence/query')
    def intelligence(payload: FactoryQuestion, user=Depends(current)):
        if any(len(q)>1000 for q in payload.prior_questions):
            raise HTTPException(422,'Previous questions must be at most 1000 characters')
        safe_prior=[q for q in payload.prior_questions if in_scope(q)]
        if private_request(payload.question) or not in_scope(payload.question,safe_prior):
            answer=conversation_reply(payload.question)
            generated={'provider_status':'local_conversation','generated_analysis':None,
                       'provider_message':'Local conversation; no factory records accessed.'}
            if payload.use_ai and not private_request(payload.question):
                # Only conversational questions are carried over; machine evidence never enters this path.
                prior=[q for q in payload.prior_questions if not in_scope(q) and not private_request(q)]
                prompt=('Previous questions: '+repr(prior)+'\nCurrent question: '+payload.question) if prior else payload.question
                generated=generate_selected_analysis(prompt,None,[],conversation=True)
            return {'answer':answer,'facts':[],'calculation':None,'limitations':[],**generated,
                    'evidence_source':'Conversation · no factory records accessed',
                    'generated_at':api['_utcnow']().isoformat()}
        machine_id=payload.machine_id
        mentioned=re.findall(r'\bMCH-\d{3}\b',payload.question.upper())
        if len(set(mentioned))>1: raise HTTPException(422,'Select one machine for a detailed question')
        if mentioned: machine_id=mentioned[0]
        if payload.use_ai and not machine_id:
            raise HTTPException(422,'Select one machine before requesting Gemini analysis')
        if machine_id:
            machine=api['resolve_canonical_machine'](machine_id)
            check_machine(user,machine['machineCode'])
            if user['role']=='Operator' and machine['machineCode']!=user.get('assigned_machine'):
                raise HTTPException(403,'Operators may only ask about their assigned machine')
        safe_prior=[q for q in safe_prior if all(id==machine_id for id in re.findall(r'\bMCH-\d{3}\b',q.upper()))]
        retrieval_question=resolve_retrieval_question(payload.question,safe_prior)
        rows=fleet(user=user)
        if machine_id: rows=[row for row in rows if row.machine_id==machine_id]
        question=retrieval_question.lower()
        if re.search(r'\b(sop|procedure|instructions|safe[ -]?stop|switch off|emergency stop)\b',question) or ('what should' in question and 'do' in question):
            procedure=retrieve_sop(retrieval_question,user['role'],machine_id,[r.model_dump() for r in rows],api['_utcnow']())
            sources=procedure['sources']
            answer=procedure['notice']
            if machine_id:answer+='\nMachine: '+machine_id+' · Received status: '+procedure.get('level','Unavailable')+'.'
            for source in sources:
                answer+='\n\n['+source['id']+'] '+source['title']+' · Revision '+source['revision']+' · '+source['section']+'\n'
                answer+='\n'.join(f'{i+1}. {step}' for i,step in enumerate(source['steps']))
            return {'answer':answer,'facts':[],'calculation':None,'sources':sources,'procedure':procedure,
                    'retrieval':{'method':'role_and_machine_filtered_sop_retrieval'},
                    'provider_status':'disabled','generated_analysis':None,
                    'provider_message':'SOP steps are retrieved directly without generative rewriting.',
                    'limitations':['Normal Stop, Emergency Stop and power isolation are different actions. Exact equipment actions require the approved procedure.',
                                   'No ML diagnosis, notification delivery or machine control is performed by this answer.'],
                    'evidence_source':'Role-specific SOP catalog','generated_at':api['_utcnow']().isoformat()}
        if 'critical' in question: rows=[row for row in rows if row.machine_status=='CRITICAL']
        elif 'warning' in question: rows=[row for row in rows if row.machine_status in {'WARNING','CRITICAL'}]
        sensor_filters=[('motor temperature','Motor Temperature'),('coolant flow','Coolant Flow'),('motor load','Motor Load'),('motor power','Motor Power'),('rpm','RPM'),('spindle','RPM'),('vibration','Vibration'),('temperature','Temperature'),('pressure','Pressure'),('voltage','Voltage'),('torque','Torque'),('current draw','Current')]
        for term,sensor in sensor_filters:
            if term in question:
                rows=[row for row in rows if row.sensor_name==sensor]
                break
        facts=[row.model_dump() for row in rows[:60]]
        answer=f'Found {len(rows)} latest saved sensor readings for {len({row.machine_id for row in rows})} authorized machines.' if facts else 'No saved readings match this question in your authorized scope.'
        if facts:
            answer+='\n'+ '\n'.join(f"{r['machine_id']} · {r['sensor_name']}: {r['sensor_value'] if r['sensor_value'] is not None else 'Unavailable'} {r['sensor_unit']} ({r['machine_status']})" for r in facts[:6])
        calculation=None
        limitations=['SQL evidence is authoritative. Generated analysis is advisory and cannot control machines.']
        if any(word in question for word in ['downtime','round','stoppage']):
            if machine_id:
                calculation=downtime(machine_id=machine_id,minutes=60,user=user)
                answer=f"Recorded explicit STOPPED downtime in the last hour: {calculation['total_seconds']:.1f} seconds."
                limitations.append(calculation['round_definition'])
            else: limitations.append('Select a machine to calculate its recorded downtime.')
        if any(word in question for word in ['production','output','jobs','power','coolant','tool wear']):
            limitations.append('Only recorded fields are available. Modeled counts and derived power are estimates; missing measurements cannot be inferred.')
        if 'sop' in question: limitations.append('Project guidance is available; no manufacturer-verified SOP manual is connected.')
        safe_prior=[q for q in safe_prior if all(id==machine_id for id in re.findall(r'\bMCH-\d{3}\b',q.upper()))]
        context_question=('Previous manufacturing questions (context only): '+repr(safe_prior)+'\nCurrent question: '+payload.question) if safe_prior else payload.question
        retrieval=retrieve_context(retrieval_question,facts,machine_id,api['_utcnow'](),
            stale_seconds=max(2,int(os.getenv('TELEMETRY_STALE_SECONDS','30'))))
        retrieval['followup_context_used']=retrieval_question!=payload.question
        limitations.extend(retrieval['warnings'])
        sources=retrieval['sources']
        if calculation is not None:
            sources.append({'id':'C1','kind':'calculation','title':'Observed STOPPED downtime over the last hour',
                            'source':'FactoryPulse MySQL status intervals',
                            'excerpt':f"Observed STOPPED time: {calculation['total_seconds']:.1f} seconds. Unobserved gaps are unknown."})
            answer+=' [C1]'
        elif facts:
            answer+='\nSources: '+', '.join('['+s['id']+']' for s in sources if s['kind']=='telemetry')
        else:
            knowledge=local_knowledge_answer([s for s in sources if s['kind']=='project_knowledge'][:1])
            if knowledge: answer+='\n\n'+knowledge
        if not sources: limitations.append('No relevant evidence was retrieved. Rephrase or select a machine with saved readings.')
        reading_ids={source.get('reading_id') for source in sources if source['kind']=='telemetry'}
        retrieved_facts=[fact for fact in facts if fact.get('reading_id') in reading_ids]
        if calculation is None and retrieved_facts:
            answer=f'Retrieved {len(retrieved_facts)} of {len(rows)} matching latest readings in your authorized scope.\n'
            answer+='\n'.join(f"[{source['id']}] {source['title']}: {source['excerpt']}"
                               for source in sources if source['kind']=='telemetry')
        knowledge_sources=[s for s in sources if s['kind']=='project_knowledge']
        if retrieved_facts and knowledge_sources:
            answer+='\n\nRelevant project guidance\n'+local_knowledge_answer(knowledge_sources[:1])
        generated=generate_selected_analysis(context_question,machine_id,retrieved_facts,calculation,retrieved_sources=sources) if payload.use_ai else {
            'provider_status':'disabled','generated_analysis':None,'provider_message':'Local SQL evidence only; Gemini was not requested.'}
        return {'answer':answer,'facts':retrieved_facts,'calculation':calculation,'limitations':limitations,
                'sources':sources,'retrieval':{key:value for key,value in retrieval.items() if key!='sources'},
                **generated,'evidence_source':'Authorized MySQL and locally retrieved project knowledge','generated_at':api['_utcnow']().isoformat()}

    @app.get('/api/v1/analytics/fleet-statistics')
    def fleet_statistics(user=Depends(api['require_roles'](['Supervisor', 'Manager', 'Maintenance', 'Admin']))):
        from .telemetry_cleaner_and_stats import compute_fleet_sensor_statistics
        readings = fleet(user=user)
        dicts = []
        for r in readings:
            dicts.append({
                'machine_id': r.machine_id,
                'sensor_name': r.sensor_name,
                r.sensor_name.lower().replace(' ', '_'): r.sensor_value,
                'temperature_celsius': r.sensor_value if 'temperature' in r.sensor_name.lower() else None,
                'vibration_rms_mms': r.sensor_value if 'vibration' in r.sensor_name.lower() else None,
                'spindle_speed_rpm': r.sensor_value if 'rpm' in r.sensor_name.lower() or 'spindle' in r.sensor_name.lower() else None,
                'motor_load_pct': r.sensor_value if 'load' in r.sensor_name.lower() else None,
                # Current (A) is not power (kW); only explicitly named power
                # channels may populate this field.
                'motor_power_kw': r.sensor_value if 'power' in r.sensor_name.lower() else None,
            })
        stats = compute_fleet_sensor_statistics(dicts)
        return {
            'generated_at': api['_utcnow']().isoformat(),
            'total_sample_readings': len(readings),
            'unique_machines_sampled': len({r.machine_id for r in readings}),
            'sensor_statistics': stats,
            'data_provenance': 'EMPIRICAL_AND_SIMULATED'
        }

    @app.get('/api/v1/analytics/manufacturing-kpis')
    def manufacturing_kpis(user=Depends(api['require_roles'](['Supervisor', 'Manager', 'Maintenance', 'Admin']))):
        rows=fleet(user=user);values={}
        cohorts={r.machine_id:r.timestamp for r in rows if r.sensor_name=='Model Planned Time'}
        for r in rows:
            if r.timestamp==cohorts.get(r.machine_id) and r.data_quality=='GOOD' and isinstance(r.sensor_value,(int,float)) and not isinstance(r.sensor_value,bool) and r.sensor_value>=0:
                values.setdefault(r.machine_id,{})[r.sensor_name]=r.sensor_value
        complete=[v for v in values.values() if all(k in v for k in ('Model Planned Time','Model Run Time','Model Window Good','Model Window Scrap')) and 0<=v['Model Run Time']<=v['Model Planned Time']]
        planned=sum(v['Model Planned Time'] for v in complete);run=sum(v['Model Run Time'] for v in complete)
        params={};scope=sql_scope(user,'machine_code',params)
        with engine().connect() as c:
            incidents=c.execute(sql('SELECT COUNT(*) FROM incidents WHERE '+scope),params).scalar()
            resolutions=c.execute(sql('SELECT TIMESTAMPDIFF(SECOND,created_at,closed_at)/3600.0 FROM incidents WHERE closed_at>=created_at AND '+scope),params).scalars().all()
        return {'timestamp':api['_utcnow']().isoformat(),'data_source':'MySQL observed model windows; not certified shift OEE',
            'active_machines':len(scoped_catalog(user,api['load_available_machine_master']())),
            'planned_production_hours':planned/3600 if complete else None,'operating_hours':run/3600 if complete else None,
            'total_downtime_hours':(planned-run)/3600 if complete else None,'availability_pct':100*run/planned if planned else None,
            'downtime_pct':100*(planned-run)/planned if planned else None,'total_parts_produced':sum(v['Model Window Good']+v['Model Window Scrap'] for v in complete) if complete else None,
            'total_incidents_reported':incidents,'mtbf_hours':None,'mttr_hours':sum(float(r) for r in resolutions)/len(resolutions) if resolutions else None,
            'limitations':['MTTR is reported incident creation-to-closure time, not measured repair labor. MTBF needs validated failure intervals.','Only machines with complete model-window inputs are included.'],'reporting_machines':len(complete)}

    @app.get('/api/v1/analytics/business-insights')
    def business_insights(user=Depends(api['require_roles'](['Supervisor', 'Manager', 'Maintenance', 'Admin']))):
        rows=fleet(user=user);down=[];vibration=[]
        for r in rows:
            if r.data_quality!='GOOD' or not isinstance(r.sensor_value,(int,float)):continue
            if r.sensor_name=='Model Down Time':down.append({'machine_id':r.machine_id,'downtime_hours':r.sensor_value/3600,'stoppage_count':None})
            if r.sensor_name=='Vibration' and r.sensor_value>r.expected_max:vibration.append({'machine_id':r.machine_id,'sensor_name':r.sensor_name,'max_val':r.sensor_value})
        params={};scope=sql_scope(user,'machine_code',params)
        with engine().connect() as c:
            incidents=c.execute(sql("SELECT machine_code,COUNT(*) incident_count,SUM(severity IN ('High','Critical')) high_sev_count FROM incidents WHERE "+scope+' GROUP BY machine_code ORDER BY incident_count DESC LIMIT 5'),params).mappings().all()
            backlog=c.execute(sql('SELECT status,COUNT(*) count FROM maintenance_work_orders WHERE '+scope+' GROUP BY status'),params).mappings().all()
        return {'generated_at':api['_utcnow']().isoformat(),'highest_downtime_machines':sorted(down,key=lambda r:r['downtime_hours'],reverse=True)[:5],
            'highest_incident_machines':[dict(r) for r in incidents],'department_stoppages':[],'high_vibration_machines':vibration[:5],
            'maintenance_backlog':[dict(r) for r in backlog],'methodology':'Authorized SQL incidents and work orders; latest modeled downtime seconds converted to hours. Sensor row counts are never converted to duration. Reason-coded department totals are unavailable.'}

    @app.post('/api/v1/telemetry/validate-batch')
    def validate_batch(payload: dict, user=Depends(api['require_roles'](['Admin', 'Supervisor', 'Maintenance']))):
        from .telemetry_cleaner_and_stats import batch_clean_telemetry
        records = payload.get('records', [])
        if not isinstance(records, list):
            raise HTTPException(422, 'records must be a list of telemetry events')
        return batch_clean_telemetry(records)
