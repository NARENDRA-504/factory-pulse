"""Explicit local provisioning for the approved four-machine team roster.

Run with --apply to persist users. Existing passwords are never replaced.
"""
import argparse
import json
import secrets
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from api_server import main as api


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    ids = json.loads((ROOT / 'public/available-machine-ids.json').read_text())['machine_ids']
    master = {m['machineId']: m for m in json.loads((ROOT / 'public/machine-name.json').read_text(encoding='utf-8'))}
    engine = api.get_telemetry_engine()
    with engine.connect() as connection:
        users = [dict(u) for u in connection.execute(api._sql_text('SELECT id,work_id,full_name,role,assigned_machine,department,shift,is_active FROM users ORDER BY id')).mappings()]
    existing = {u['work_id']: u for u in users}
    plants = defaultdict(list)
    for mid in ids:
        plants[master[mid]['plant']].append(master[mid])
    teams = []
    creates = []
    assignments = []
    for plant, machines in sorted(plants.items()):
        letter = plant.split(':')[0].split()[-1]
        for offset in range(0, len(machines), 4):
            group = machines[offset:offset + 4]
            team_id = f'{letter}{offset // 4 + 1:02d}'
            department = f'Plant {letter} / Team {team_id}'
            supervisor = f'SUP-{team_id}'
            if supervisor in existing:
                if existing[supervisor]['role'] != 'Supervisor' or not existing[supervisor]['is_active']:
                    raise SystemExit(f'{supervisor} exists with an incompatible role/status; nothing applied.')
                assignments.append((supervisor, department))
            else:
                creates.append(dict(work_id=supervisor,full_name=f'Plant {letter} Team {team_id} Supervisor',role='Supervisor',assigned_machine=None,department=department))
            primary = {}
            operators = []
            for index, machine in enumerate(group, start=offset + 1):
                code = machine['machineCode']
                candidates = [u for u in users if u['role'] == 'Operator' and u['is_active'] and u['assigned_machine'] == code]
                if candidates:
                    candidates.sort(key=lambda u: (u['work_id'] != 'OP-001', u['id']))
                    primary[code] = candidates[0]['work_id']
                    for operator in candidates:
                        operators.append(operator['work_id'])
                        assignments.append((operator['work_id'], department))
                else:
                    badge = f'OP-{letter}{index:03d}'
                    if badge in existing:
                        raise SystemExit(f'{badge} already exists with another assignment/status; nothing applied.')
                    creates.append(dict(work_id=badge,full_name=f'Plant {letter} Machine {index:02d} Operator',role='Operator',assigned_machine=code,department=department))
                    primary[code] = badge
                    operators.append(badge)
            teams.append(dict(team_id=team_id,plant=plant,department=department,supervisor_work_id=supervisor,
                              machines=[dict(machine_id=m['machineId'],machine_code=m['machineCode']) for m in group],
                              primary_operators=primary,operator_work_ids=operators,shift='Shift A'))
    plan = dict(version=1,maximum_machines_per_supervisor=4,shift='Shift A',teams=teams)
    summary = dict(machines=len(ids),plants=len(plants),assigned_supervisors=len(teams),primary_operators=len(ids),
                   operator_accounts=sum(len(t['operator_work_ids']) for t in teams),
                   users_to_create=dict(Counter(u['role'] for u in creates)))
    print(json.dumps(summary))
    if not args.apply:
        return
    private_file = ROOT / '.local/accounts.json'
    credentials = json.loads(private_file.read_text()) if private_file.exists() else {}
    generated = {u['work_id']:dict(password=secrets.token_urlsafe(18),role=u['role']) for u in creates}
    recovery = ROOT / '.local/workforce-new-credentials.pending.json'
    recovery.write_text(json.dumps(generated,indent=2))
    with engine.begin() as connection:
        for user in creates:
            password_hash = api._hash_password(generated[user['work_id']]['password'],secrets.token_bytes(16))
            result = connection.execute(api._sql_text('''INSERT INTO users
                (work_id,full_name,password_hash,role,assigned_machine,email,department,shift,is_active)
                VALUES (:work_id,:full_name,:password_hash,:role,:assigned_machine,:email,:department,'Shift A',TRUE)'''),
                {**user,'password_hash':password_hash,'email':user['work_id'].lower()+'@factorypulse.local'})
            api._audit_insert(connection,employee_name='Authorized local workforce provisioning',event_type='user_created',
                resource_type='user',resource_id=result.lastrowid,changed_fields=['work_id','role','assigned_machine','department','shift'],
                details=f"Project owner requested team roster; created {user['work_id']} ({user['role']}). Existing passwords unchanged.")
        for badge, department in assignments:
            if existing[badge].get('department') == department:
                continue
            connection.execute(api._sql_text('UPDATE users SET department=:department WHERE work_id=:badge'),dict(department=department,badge=badge))
            api._audit_insert(connection,employee_name='Authorized local workforce provisioning',event_type='user_team_assigned',
                resource_type='user',resource_id=existing[badge]['id'],changed_fields=['department'],
                details=f'Project owner assigned {badge} to {department}; role, machine and password preserved.')
    credentials.update(generated)
    private_file.write_text(json.dumps(credentials,indent=2))
    (ROOT / 'config').mkdir(exist_ok=True)
    (ROOT / 'config/workforce-teams.json').write_text(json.dumps(plan,indent=2))
    (ROOT / '.local/workforce-plan.json').write_text(json.dumps(plan,indent=2))
    login_text = ['FactoryPulse workforce roster — private local login details',
                  'New passwords are random and unique. Keep this file out of GitHub.',
                  'Existing account passwords were preserved; unknown passwords are not recoverable.', '']
    members = {t['supervisor_work_id'] for t in teams} | {b for t in teams for b in t['operator_work_ids']}
    for badge in sorted(members):
        info = credentials.get(badge)
        login_text.append(f"{badge} | {info['role'] if info else existing[badge]['role']} | Password: {info['password'] if info else 'Existing password unchanged; use Admin reset if needed'}")
    (ROOT / '.local/WORKFORCE-LOGINS.txt').write_text('\n'.join(login_text))
    recovery.unlink()
    print('Committed workforce users and team departments to MySQL. Private login file saved; no passwords printed.')


if __name__ == '__main__':
    main()
