"""Fail-closed machine permissions derived from the Admin-managed workforce plan."""
import json
from pathlib import Path
from fastapi import HTTPException

PLAN = Path(__file__).resolve().parents[1] / 'config/workforce-teams.json'


def machine_codes(user):
    if user.get('role') == 'Operator':
        return {user['assigned_machine']} if user.get('assigned_machine') else set()
    if user.get('role') != 'Supervisor':
        return None
    try:
        plan=json.loads(PLAN.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise HTTPException(503, 'Team assignments are unavailable; access has been restricted.')
    return {m['machine_code'] for team in plan.get('teams', [])
            if team['supervisor_work_id'] == user.get('work_id') and team['department'] == user.get('department')
            for m in team['machines']}


def check_machine(user, code):
    allowed=machine_codes(user)
    if allowed is not None and code not in allowed:
        raise HTTPException(403, 'This machine is outside your assigned team.')


def scoped_catalog(user, catalog):
    allowed=machine_codes(user)
    return catalog if allowed is None else {mid:m for mid,m in catalog.items() if m['machineCode'] in allowed}


def sql_scope(user, column, parameters):
    allowed=machine_codes(user)
    if allowed is None:
        return '1=1'
    if not allowed:
        return '1=0'
    names=[]
    for i,code in enumerate(sorted(allowed)):
        key=f'scope_{i}';parameters[key]=code;names.append(':'+key)
    return column+' IN ('+','.join(names)+')'
