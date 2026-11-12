"""Read the approved team plan against current MySQL account assignments."""
import json
from pathlib import Path
from fastapi import Depends, HTTPException

PLAN_PATH = Path(__file__).resolve().parents[1] / 'config/workforce-teams.json'


def build_hierarchy(plan, users):
    active = {u['work_id']:u for u in users if u.get('is_active')}
    plants = {}
    allocated = set()
    for team in plan.get('teams', []):
        department = team['department']
        sup = active.get(team['supervisor_work_id'])
        supervisor = {'work_id':sup['work_id'],'full_name':sup['full_name']} if sup and sup['role']=='Supervisor' and sup.get('department')==department else None
        if supervisor:
            allocated.add(supervisor['work_id'])
        machines = []
        for machine in team['machines']:
            operators = []
            for u in active.values():
                if u['role']=='Operator' and u.get('department')==department and u.get('assigned_machine')==machine['machine_code']:
                    operators.append({'work_id':u['work_id'],'full_name':u['full_name'],'shift':u.get('shift'),
                                      'primary':team['primary_operators'].get(machine['machine_code'])==u['work_id']})
                    allocated.add(u['work_id'])
            machines.append({**machine,'operators':sorted(operators,key=lambda u:(not u['primary'],u['work_id']))})
        item={'team_id':team['team_id'],'department':department,'supervisor':supervisor,'machines':machines,
              'machine_count':len(machines),'operator_count':sum(len(m['operators']) for m in machines),
              'primary_operator_count':sum(any(u['primary'] for u in m['operators']) for m in machines)}
        plants.setdefault(team['plant'],[]).append(item)
    output=[]
    for plant,teams in plants.items():
        output.append({'plant':plant,'teams':teams,'supervisor_count':sum(t['supervisor'] is not None for t in teams),
                       'operator_count':sum(t['operator_count'] for t in teams),'primary_operator_count':sum(t['primary_operator_count'] for t in teams),
                       'machine_count':sum(t['machine_count'] for t in teams)})
    return {'plants':output,'shift':plan.get('shift'),'maximum_machines_per_supervisor':plan.get('maximum_machines_per_supervisor'),
            'supervisor_count':sum(p['supervisor_count'] for p in output),'operator_count':sum(p['operator_count'] for p in output),
            'primary_operator_count':sum(p['primary_operator_count'] for p in output),'machine_count':sum(p['machine_count'] for p in output),
            'unallocated_existing_users':[{'work_id':u['work_id'],'role':u['role']} for u in active.values() if u['role'] in ['Supervisor','Operator'] and u['work_id'] not in allocated]}


def register(app, api):
    @app.get('/api/v1/admin/workforce')
    def workforce(user=Depends(api['require_roles'](['Admin']))):
        try:
            plan=json.loads(PLAN_PATH.read_text(encoding='utf-8'))
        except (OSError,ValueError) as exc:
            raise HTTPException(503,'The workforce team plan is unavailable.') from exc
        with api['get_telemetry_engine']().connect() as connection:
            users=[dict(row) for row in connection.execute(api['_sql_text']('SELECT id,work_id,full_name,role,assigned_machine,department,shift,is_active FROM users')).mappings()]
        return build_hierarchy(plan,users)
