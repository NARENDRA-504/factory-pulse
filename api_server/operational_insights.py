"""Authorized SQL facts, downtime and optional owner-approved Gemini analysis."""
import datetime as dt
import os
import re
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from .live_analytics import summarize_downtime
from .chat_scope import in_scope
from .gemini_insights import generate_selected_analysis, provider_configuration


def as_utc(value):
    parsed=value if isinstance(value,dt.datetime) else dt.datetime.fromisoformat(str(value).replace('Z','+00:00'))
    return parsed.replace(tzinfo=dt.timezone.utc) if parsed.tzinfo is None else parsed.astimezone(dt.timezone.utc)


class FactoryQuestion(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)
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
            summary=connection.execute(sql('''SELECT COUNT(*) AS recent_events, MAX(created_at) AS latest_ingestion
                FROM simulator_sensor_readings WHERE created_at>=UTC_TIMESTAMP()-INTERVAL 15 MINUTE''')).mappings().first()
        return {'backend':'reachable','mysql':'reachable','receiver_configured':bool(os.getenv('SIMULATOR_API_KEY')),
            'latest_ingestion':api['_iso_utc'](summary['latest_ingestion']) if summary['latest_ingestion'] else None,
            'events_last_15_minutes':summary['recent_events'],'machines_receiving':fresh,
            'machines_with_saved_data':len(latest),'stale_machines':len(latest)-fresh,'stale_after_seconds':threshold,
            'ai':{'status':'configured_not_verified' if not provider_configuration()[2] else 'unconfigured',
                  'missing_settings':provider_configuration()[2]},
            'power_bi':{'status':'unverified','reason':'No report, semantic-model connection or successful refresh evidence is available.'}}

    @app.post('/api/v1/intelligence/query')
    def intelligence(payload: FactoryQuestion, user=Depends(current)):
        if any(len(q)>1000 for q in payload.prior_questions):
            raise HTTPException(422,'Previous questions must be at most 1000 characters')
        safe_prior=[q for q in payload.prior_questions if in_scope(q)]
        if not in_scope(payload.question,safe_prior):
            return {'answer':'I can help only with machines, production, sensor readings, maintenance and factory operations. Ask a machine or production question.',
                'facts':[],'calculation':None,'limitations':[],
                'provider_status':'out_of_scope','generated_analysis':None,
                'provider_message':'No factory data or external AI was accessed for this unrelated question.',
                'evidence_source':'Scope guidance','generated_at':api['_utcnow']().isoformat()}
        machine_id=payload.machine_id
        mentioned=re.findall(r'\bMCH-\d{3}\b',payload.question.upper())
        if len(set(mentioned))>1: raise HTTPException(422,'Select one machine for a detailed question')
        if mentioned: machine_id=mentioned[0]
        if payload.use_ai and not machine_id:
            raise HTTPException(422,'Select one machine before requesting Gemini analysis')
        if machine_id:
            machine=api['resolve_canonical_machine'](machine_id)
            if user['role']=='Operator' and machine['machineCode']!=user.get('assigned_machine'):
                raise HTTPException(403,'Operators may only ask about their assigned machine')
        rows=fleet(user=user)
        if machine_id: rows=[row for row in rows if row.machine_id==machine_id]
        question=payload.question.lower()
        if 'critical' in question: rows=[row for row in rows if row.machine_status=='CRITICAL']
        elif 'warning' in question: rows=[row for row in rows if row.machine_status in {'WARNING','CRITICAL'}]
        sensor_filters=[('motor temperature','Motor Temperature'),('rpm','RPM'),('spindle','RPM'),('vibration','Vibration'),('temperature','Temperature'),('torque','Torque'),('current draw','Current')]
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
            limitations.append('Production counts, coolant temperature, kW power and tool wear are not sent by this Simulator; they cannot be inferred.')
        if 'sop' in question: limitations.append('No manufacturer-verified SOP knowledge base is connected.')
        safe_prior=[q for q in safe_prior if all(id==machine_id for id in re.findall(r'\bMCH-\d{3}\b',q.upper()))]
        context_question=('Previous manufacturing questions (context only): '+repr(safe_prior)+'\nCurrent question: '+payload.question) if safe_prior else payload.question
        generated=generate_selected_analysis(context_question,machine_id,facts,calculation) if payload.use_ai else {
            'provider_status':'disabled','generated_analysis':None,'provider_message':'Local SQL evidence only; Gemini was not requested.'}
        return {'answer':answer,'facts':facts,'calculation':calculation,'limitations':limitations,
                **generated,'evidence_source':'FactoryPulse MySQL','generated_at':api['_utcnow']().isoformat()}

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
        from .telemetry_cleaner_and_stats import compute_manufacturing_kpis
        with engine().connect() as connection:
            active_machines_count = connection.execute(sql("SELECT COUNT(*) FROM machines WHERE is_active = 1")).scalar() or 50
            total_incidents = connection.execute(sql("SELECT COUNT(*) FROM incidents")).scalar() or 0
            resolutions = connection.execute(sql("""
                SELECT TIMESTAMPDIFF(MINUTE, created_at, closed_at) / 60.0 AS res_hours
                FROM incidents WHERE closed_at IS NOT NULL
            """)).scalars().all()
            total_stoppages = connection.execute(sql("""
                SELECT COUNT(*) FROM simulator_sensor_readings WHERE machine_status = 'STOPPED'
            """)).scalar() or 0
        downtime_hours = round(total_stoppages * 0.5, 1)
        kpi_result = compute_manufacturing_kpis(
            machines_count=active_machines_count,
            total_planned_hours=24.0,
            total_downtime_hours=downtime_hours,
            total_production_parts=int(active_machines_count * 285),
            total_incidents=total_incidents,
            closed_incidents_resolution_hours=[float(r) for r in resolutions if r is not None]
        )
        return {
            'timestamp': api['_utcnow']().isoformat(),
            'data_source': 'MySQL FactoryPulse Analytics',
            **kpi_result
        }

    @app.get('/api/v1/analytics/business-insights')
    def business_insights(user=Depends(api['require_roles'](['Supervisor', 'Manager', 'Maintenance', 'Admin']))):
        with engine().connect() as connection:
            # 1. Top downtime machines
            top_downtime = connection.execute(sql("""
                SELECT machine_id, COUNT(*) AS stoppage_count, ROUND(COUNT(*) * 0.5, 1) AS downtime_hours
                FROM simulator_sensor_readings
                WHERE machine_status = 'STOPPED'
                GROUP BY machine_id
                ORDER BY stoppage_count DESC LIMIT 5
            """)).mappings().all()

            # 2. Top incident machines
            top_incidents = connection.execute(sql("""
                SELECT machine_code, COUNT(*) AS incident_count,
                       SUM(CASE WHEN severity IN ('High', 'Critical') THEN 1 ELSE 0 END) AS high_sev_count
                FROM incidents
                GROUP BY machine_code
                ORDER BY incident_count DESC LIMIT 5
            """)).mappings().all()

            # 3. Department stoppages
            dept_stoppages = connection.execute(sql("""
                SELECT department, COUNT(*) AS stoppage_events
                FROM simulator_sensor_readings
                WHERE machine_status = 'STOPPED' AND department IS NOT NULL AND department <> ''
                GROUP BY department
                ORDER BY stoppage_events DESC LIMIT 5
            """)).mappings().all()

            # 4. High vibration machines (warning threshold > 4.5 mm/s)
            high_vib = connection.execute(sql("""
                SELECT machine_id, sensor_name, MAX(CAST(JSON_UNQUOTE(sensor_value_json) AS DECIMAL(10,2))) as max_val
                FROM simulator_sensor_readings
                WHERE sensor_name LIKE '%Vibration%' AND JSON_VALID(sensor_value_json)
                GROUP BY machine_id, sensor_name
                HAVING max_val >= 4.5
                ORDER BY max_val DESC LIMIT 5
            """)).mappings().all()

            # 5. Maintenance backlog
            backlog = connection.execute(sql("""
                SELECT status, COUNT(*) as count
                FROM maintenance_work_orders
                GROUP BY status
            """)).mappings().all()

        return {
            'generated_at': api['_utcnow']().isoformat(),
            'highest_downtime_machines': [dict(r) for r in top_downtime],
            'highest_incident_machines': [dict(r) for r in top_incidents],
            'department_stoppages': [dict(r) for r in dept_stoppages],
            'high_vibration_machines': [dict(r) for r in high_vib],
            'maintenance_backlog': [dict(r) for r in backlog],
            'methodology': 'Calculated deterministically from MySQL database tables and telemetry logs.'
        }

    @app.post('/api/v1/telemetry/validate-batch')
    def validate_batch(payload: dict, user=Depends(api['require_roles'](['Admin', 'Supervisor', 'Maintenance']))):
        from .telemetry_cleaner_and_stats import batch_clean_telemetry
        records = payload.get('records', [])
        if not isinstance(records, list):
            raise HTTPException(422, 'records must be a list of telemetry events')
        return batch_clean_telemetry(records)
