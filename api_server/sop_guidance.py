"""Read-only, authenticated module guidance from the same SOP file used by RAG."""
from pathlib import Path
import hashlib
import re
from fastapi import Depends, HTTPException, Query
from .sop_retrieval import retrieve_sop
from .team_access import check_machine

SOURCE = Path(__file__).resolve().parents[1] / 'knowledge/assistant/sop.md'
ALLOWED = {
    'Operator': {'dashboard', 'machines', 'incidents'},
    'Supervisor': {'dashboard', 'production', 'machines', 'reports', 'incidents', 'maintenance', 'analytics'},
    'Maintenance': {'dashboard', 'maintenance', 'machines', 'incidents', 'reports', 'analytics'},
    'Manager': {'dashboard', 'downtime', 'production', 'coverage', 'quality', 'machines', 'incidents', 'maintenance', 'analytics'},
    'Admin': {'dashboard', 'users', 'inventory', 'incidents', 'activity', 'machines', 'maintenance', 'analytics'},
}
MODULE = {'dashboard': None, 'production': 'production', 'machines': 'machines', 'incidents': 'incidents',
          'maintenance': 'maintenance', 'reports': 'analysis', 'analytics': 'analysis', 'downtime': 'analysis',
          'quality': 'analysis', 'coverage': 'analysis', 'users': 'access', 'inventory': 'access', 'activity': 'access'}

def guidance(role, module):
    display_role = role
    role = 'Admin' if role == 'Super Admin' else role
    if module == 'readiness': module = 'machines'
    if module == 'machine-changes' and role in {'Operator','Supervisor','Admin'}: module = 'users' if role == 'Admin' else 'incidents'
    allowed = set().union(*ALLOWED.values()) if display_role == 'Super Admin' else ALLOWED.get(role, set())
    if module not in allowed:
        raise HTTPException(403, 'This module is unavailable for your role')
    try:
        content = SOURCE.read_text(encoding='utf-8')
    except OSError:
        raise HTTPException(503, 'SOP guidance is unavailable') from None
    sections = {}
    for section in re.split(r'(?m)^# ', content)[1:]:
        title, _, body = section.partition('\n')
        sections[title.strip()] = re.findall(r'(?m)^\d+\. (.+)$', body)
    names = [f'SOP {role}']
    if MODULE[module]: names.append(f'SOP {MODULE[module]}')
    if any(not sections.get(name) for name in names):
        raise HTTPException(503, 'SOP guidance is incomplete')
    return {'role': display_role, 'module': module, 'approval_status': 'training_pending_site_approval',
            'notice': 'Training guidance · site approval pending. Follow approved equipment and factory procedures.',
            'source': 'knowledge/assistant/sop.md', 'revision': hashlib.sha256(content.encode()).hexdigest()[:12],
            'sections': [{'title': name.removeprefix('SOP '), 'steps': sections[name]} for name in names]}

def register(app, api):
    @app.get('/api/v1/guidance/sop')
    def get_sop(module: str = Query('dashboard', max_length=32), machine_id: str | None = None,
                question: str = Query('', max_length=500), user=Depends(api['get_current_user'])):
        result=guidance(user['role'], module)
        facts=[]; mid=None
        if machine_id:
            machine=api['resolve_canonical_machine'](machine_id)
            check_machine(user,machine['machineCode'])
            mid=machine.get('machineId',machine_id)
            try:
                rows=api['get_simulator_fleet_latest_readings'](user=user)
                facts=[row.model_dump() for row in rows if row.machine_id==mid]
            except HTTPException as exc:
                if exc.status_code not in {500,503}:raise
                result['telemetry_unavailable']=True
        prompt=question if isinstance(question,str) else ''
        if not prompt:
            # Round-wide machine status does not identify the faulty sensor.
            prompt='general SOP machine response'
        result['procedure']=retrieve_sop(prompt,user['role'],mid,facts,api['_utcnow']() if '_utcnow' in api else None)
        return result
