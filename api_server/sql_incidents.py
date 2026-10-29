"""Transaction-backed incident workflow. MySQL remains authoritative."""
import json,uuid
from fastapi import Depends,HTTPException,Request
from pydantic import BaseModel,Field

class Report(BaseModel):
    machine_code:str=Field(min_length=1,max_length=32)
    severity:str
    symptom_description:str=Field(min_length=3,max_length=8000)
    component_area:str=Field(min_length=1,max_length=128)
    operator_notes:str=Field(default='',max_length=8000)

class Assignment(BaseModel):
    technician_name:str=Field(min_length=1,max_length=128)
class Progress(BaseModel):
    progress_notes:str=Field(min_length=3,max_length=8000)
class OrderStatus(BaseModel):
    status: str
class Closure(BaseModel):
    closure_notes:str=Field(min_length=3,max_length=8000)

SELECT="""SELECT i.*,u.full_name AS reporter_name,u.role AS reporter_role,
 a.full_name AS assigned_to_name,b.full_name AS closed_by_name,b.role AS closed_role,
 (SELECT action_taken FROM maintenance_work_orders w WHERE w.incident_id=i.id ORDER BY w.id DESC LIMIT 1) AS notes
 FROM incidents i JOIN users u ON u.id=i.reporter_id
 LEFT JOIN users a ON a.id=i.assigned_to_id LEFT JOIN users b ON b.id=i.closed_by_id"""

def register(app,api):
    sql=api['_sql_text']
    def fetch(c,incident_id,user):
        row=c.execute(sql(SELECT+' WHERE i.id=:id'),{'id':incident_id}).mappings().first()
        if not row:raise HTTPException(404,'Incident not found')
        if user['role']=='Operator' and row['machine_code']!=user.get('assigned_machine'):raise HTTPException(403,'Only assigned-machine incidents are available')
        if user['role']=='Maintenance' and row['assigned_to_id'] not in (None,user['id']):raise HTTPException(403,'This incident is assigned to another technician')
        data=dict(row)
        for field in ('created_at','closed_at'):
            if data.get(field):data[field]=api['_iso_utc'](data[field])
        data['correlated_vb_mm']=data.get('correlated_vb');data['correlated_ra_um']=data.get('correlated_ra')
        return data
    def audit(c,user,request,event,resource_type,resource_id,changed_fields=None,details=None):
        api['_audit_insert'](c,employee_id=user['id'],employee_work_id=user['work_id'],employee_name=user['full_name'],role=user['role'],session_id=user.get('session_id'),request_id=getattr(request.state,'request_id',None),request=request,event_type=event,resource_type=resource_type,resource_id=str(resource_id),changed_fields=changed_fields,details=details or f'{resource_type.replace("_", " ").title()} {resource_id}')

    @app.get('/api/v1/incidents')
    def listing(user=Depends(api['get_current_user'])):
        with api['get_telemetry_engine']().connect() as c:
            query='SELECT id FROM incidents';params={}
            if user['role']=='Operator':query+=' WHERE machine_code=:machine';params['machine']=user.get('assigned_machine') or ''
            elif user['role']=='Maintenance':query+=' WHERE assigned_to_id IS NULL OR assigned_to_id=:user';params['user']=user['id']
            ids=c.execute(sql(query+' ORDER BY created_at DESC,id DESC LIMIT 500'),params).scalars().all()
            return [fetch(c,id,user) for id in ids]

    @app.get('/api/v1/incidents/{incident_id}')
    def detail(incident_id:int,user=Depends(api['get_current_user'])):
        with api['get_telemetry_engine']().connect() as c:return fetch(c,incident_id,user)

    @app.get('/api/v1/maintenance/technicians')
    def technicians(user=Depends(api['require_roles'](['Supervisor','Admin']))):
        with api['get_telemetry_engine']().connect() as c:
            return [dict(r) for r in c.execute(sql("SELECT id,full_name,work_id FROM users WHERE role='Maintenance' AND is_active=1 ORDER BY full_name")).mappings()]

    @app.post('/api/v1/incidents')
    def create(payload:Report,request:Request,user=Depends(api['require_roles'](['Operator','Supervisor','Maintenance']))):
        if payload.severity not in ('Low','Medium','High','Critical'):raise HTTPException(422,'Invalid severity')
        if user['role']=='Operator' and payload.machine_code!=user.get('assigned_machine'):raise HTTPException(403,'Report only your assigned machine')
        machine=next((m for m in api['load_canonical_machine_master']().values() if m['machineCode']==payload.machine_code),None)
        if not machine:raise HTTPException(422,'Unknown machine code')
        # Snapshot only actual persisted readings, preserving their units.
        snapshot=api['get_simulator_telemetry_readings'](machine_id=machine['machineId'],limit=6,since=None,until=None,sensor_name=None,data_source='AI_SIMULATOR',user=user)
        with api['get_telemetry_engine']().begin() as c:
            # Serialize reports per reporter; prevents accidental double-click duplicates.
            c.execute(sql('SELECT id FROM users WHERE id=:id FOR UPDATE'),{'id':user['id']})
            duplicate=c.execute(sql("SELECT id FROM incidents WHERE machine_code=:machine AND component_area=:area AND status<>'Closed' LIMIT 1 FOR UPDATE"),{'machine':payload.machine_code,'area':payload.component_area}).first()
            if duplicate:raise HTTPException(409,'An active incident already exists for this machine and component')
            params=payload.model_dump();params.update(reporter=user['id'],code='INC-'+uuid.uuid4().hex[:20].upper(),snapshot=json.dumps([r.model_dump(mode='json') for r in snapshot]))
            result=c.execute(sql("""INSERT INTO incidents (incident_code,machine_code,reporter_id,severity,symptom_description,operator_notes,component_area,data_provenance,status,sensor_snapshot)
              VALUES (:code,:machine_code,:reporter,:severity,:symptom_description,:operator_notes,:component_area,'SIMULATED','Open',:snapshot)"""),params)
            id=result.lastrowid;audit(c,user,request,'incident_created','incident',id,['severity','symptom_description','component_area','operator_notes','sensor_snapshot']);return fetch(c,id,user)

    @app.patch('/api/v1/incidents/{incident_id}/assign')
    def assign(incident_id:int,payload:Assignment,request:Request,user=Depends(api['require_roles'](['Supervisor']))):
        with api['get_telemetry_engine']().begin() as c:
            c.execute(sql('SELECT id FROM incidents WHERE id=:id FOR UPDATE'),{'id':incident_id});row=fetch(c,incident_id,user)
            if row['status']=='Closed':raise HTTPException(409,'Closed incidents cannot be assigned')
            tech=c.execute(sql("SELECT id FROM users WHERE full_name=:name AND role='Maintenance' AND is_active=1"),{'name':payload.technician_name}).scalars().all()
            if len(tech)!=1:raise HTTPException(422,'Choose one active maintenance employee')
            c.execute(sql("UPDATE incidents SET assigned_to_id=:tech,status='In_Investigation' WHERE id=:id"),{'tech':tech[0],'id':incident_id})
            c.execute(sql("UPDATE maintenance_work_orders SET technician_id=:tech WHERE incident_id=:id AND status<>'Completed'"),{'tech':tech[0],'id':incident_id})
            orders=c.execute(sql("SELECT id FROM maintenance_work_orders WHERE incident_id=:id AND status<>'Completed'"),{'id':incident_id}).scalars().all()
            if not orders:
                created=c.execute(sql("INSERT INTO maintenance_work_orders(order_code,incident_id,machine_code,technician_id,priority,status) VALUES(:code,:id,:machine,:tech,:priority,'Pending')"),{'code':'WO-'+uuid.uuid4().hex[:20].upper(),'id':incident_id,'machine':row['machine_code'],'tech':tech[0],'priority':'Urgent' if row['severity'] in ('High','Critical') else 'Medium'})
                orders=[created.lastrowid]
            audit(c,user,request,'incident_assigned','incident',incident_id,['assigned_to_id','status'])
            for order_id in orders:audit(c,user,request,'work_order_assigned','work_order',order_id,['technician_id'])
            return fetch(c,incident_id,user)

    @app.patch('/api/v1/incidents/{incident_id}/progress')
    def progress(incident_id:int,payload:Progress,request:Request,user=Depends(api['require_roles'](['Maintenance']))):
        with api['get_telemetry_engine']().begin() as c:
            c.execute(sql('SELECT id FROM incidents WHERE id=:id FOR UPDATE'),{'id':incident_id});row=fetch(c,incident_id,user)
            if row['assigned_to_id']!=user['id']:raise HTTPException(403,'Only the assigned technician may log progress')
            if row['status']=='Closed':raise HTTPException(409,'Incident already closed')
            orders=c.execute(sql("SELECT id FROM maintenance_work_orders WHERE incident_id=:id AND status<>'Completed'"),{'id':incident_id}).scalars().all()
            c.execute(sql("UPDATE maintenance_work_orders SET action_taken=CONCAT(COALESCE(action_taken,''),:note),status='In_Progress' WHERE incident_id=:id AND status<>'Completed'"),{'note':'\n'+payload.progress_notes,'id':incident_id})
            c.execute(sql("UPDATE incidents SET status='Action_Required' WHERE id=:id"),{'id':incident_id})
            audit(c,user,request,'incident_progress_updated','incident',incident_id,['status'])
            for order_id in orders:audit(c,user,request,'work_order_progress_updated','work_order',order_id,['action_taken','status'])
            return fetch(c,incident_id,user)

    @app.patch('/api/v1/incidents/{incident_id}/close')
    def close(incident_id:int,payload:Closure,request:Request,user=Depends(api['require_roles'](['Supervisor','Maintenance']))):
        with api['get_telemetry_engine']().begin() as c:
            c.execute(sql('SELECT id FROM incidents WHERE id=:id FOR UPDATE'),{'id':incident_id});row=fetch(c,incident_id,user)
            if row['status']=='Closed':raise HTTPException(409,'Incident already closed')
            if user['role']=='Maintenance' and row['assigned_to_id']!=user['id']:raise HTTPException(403,'Only the assigned technician may close this incident')
            c.execute(sql("UPDATE incidents SET status='Closed',closed_at=UTC_TIMESTAMP(),closed_by_id=:user,closure_notes=:notes WHERE id=:id"),{'id':incident_id,'user':user['id'],'notes':payload.closure_notes})
            orders=c.execute(sql("SELECT id FROM maintenance_work_orders WHERE incident_id=:id AND status<>'Completed'"),{'id':incident_id}).scalars().all()
            c.execute(sql("UPDATE maintenance_work_orders SET status='Completed',completed_at=UTC_TIMESTAMP() WHERE incident_id=:id AND status<>'Completed'"),{'id':incident_id})
            audit(c,user,request,'incident_closed','incident',incident_id,['status','closed_at','closed_by_id','closure_notes'])
            for order_id in orders:audit(c,user,request,'work_order_completed','work_order',order_id,['status','completed_at'])
            return fetch(c,incident_id,user)

    @app.get('/api/v1/work-orders')
    def orders(user=Depends(api['require_roles'](['Admin','Supervisor','Maintenance','Manager']))):
        with api['get_telemetry_engine']().connect() as c:
            condition=' WHERE w.technician_id=:user' if user['role']=='Maintenance' else ''
            rows=c.execute(sql("SELECT w.*,i.incident_code,u.full_name AS technician_name FROM maintenance_work_orders w JOIN incidents i ON i.id=w.incident_id JOIN users u ON u.id=w.technician_id"+condition+' ORDER BY w.created_at DESC,w.id DESC LIMIT 500'),{'user':user['id']}).mappings().all()
            return [dict(row) for row in rows]

    @app.patch('/api/v1/work-orders/{order_id}')
    def change_order(order_id:int,payload:OrderStatus,request:Request,user=Depends(api['require_roles'](['Maintenance', 'Supervisor', 'Admin']))):
        if payload.status not in ('Pending', 'In_Progress','Completed'):raise HTTPException(422,'Choose Pending, In_Progress, or Completed')
        with api['get_telemetry_engine']().begin() as c:
            row=c.execute(sql('SELECT * FROM maintenance_work_orders WHERE id=:id FOR UPDATE'),{'id':order_id}).mappings().first()
            if not row:raise HTTPException(404,'Work order not found')
            if user['role']=='Maintenance' and row['technician_id']!=user['id']:raise HTTPException(403,'Only the assigned technician may update this order')
            if row['status']=='Completed' and payload.status=='Completed':raise HTTPException(409,'Work order already completed')
            c.execute(sql("UPDATE maintenance_work_orders SET status=:status,completed_at=IF(:status='Completed',UTC_TIMESTAMP(),NULL) WHERE id=:id"),{'status':payload.status,'id':order_id})
            audit(c,user,request,'work_order_updated','work_order',order_id,['status','completed_at'])
        return {'saved':True}

    @app.post('/api/v1/work-orders', status_code=201)
    def create_work_order(payload: dict, request: Request, user=Depends(api['require_roles'](['Supervisor', 'Maintenance', 'Admin']))):
        machine_code = payload.get('machine_code')
        tech_name = payload.get('technician_name')
        priority = payload.get('priority', 'Medium')
        notes = payload.get('action_notes', '')
        if not machine_code: raise HTTPException(422, 'machine_code is required')
        with api['get_telemetry_engine']().begin() as c:
            tech = c.execute(sql("SELECT id FROM users WHERE (full_name=:name OR work_id=:name) AND is_active=1 LIMIT 1"), {'name': tech_name or user['full_name']}).scalar()
            if not tech: tech = user['id']
            # Find open incident or create maintenance placeholder incident
            inc_id = c.execute(sql("SELECT id FROM incidents WHERE machine_code=:m AND status<>'Closed' ORDER BY id DESC LIMIT 1"), {'m': machine_code}).scalar()
            if not inc_id:
                code = 'INC-' + uuid.uuid4().hex[:16].upper()
                res = c.execute(sql("""INSERT INTO incidents (incident_code, machine_code, reporter_id, severity, symptom_description, component_area, data_provenance, status)
                                       VALUES (:c, :m, :r, :s, :desc, 'General Maintenance', 'SIMULATED', 'In_Investigation')"""),
                                {'c': code, 'm': machine_code, 'r': user['id'], 's': 'Medium', 'desc': notes or 'Scheduled maintenance dispatch'})
                inc_id = res.lastrowid
                audit(c,user,request,'incident_created','incident',inc_id,['severity','symptom_description','component_area'],f'Created maintenance incident for {machine_code}')
            wo_code = 'WO-' + uuid.uuid4().hex[:16].upper()
            result=c.execute(sql("""INSERT INTO maintenance_work_orders (order_code, incident_id, machine_code, technician_id, priority, action_taken, status)
                             VALUES (:wo, :inc, :m, :t, :p, :notes, 'Pending')"""),
                      {'wo': wo_code, 'inc': inc_id, 'm': machine_code, 't': tech, 'p': priority, 'notes': notes})
            order_id=result.lastrowid
            audit(c, user, request, 'work_order_created','work_order',order_id,['incident_id','machine_code','technician_id','priority','action_taken','status'])
        return {'id': order_id, 'order_code': wo_code, 'machine_code': machine_code, 'status': 'Pending'}
