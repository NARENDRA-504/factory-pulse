"""Explicit hosted deployment gates; no schema, account or operational writes."""
from urllib.parse import urlparse
import json
import re


def validate_hosted_environment(env):
    if env.get('DEPLOYMENT_MODE', 'local').lower() != 'hosted':
        return
    errors = []
    if env.get('APP_ENV') != 'production' or env.get('DEMO_AUTH_ENABLED', 'false').lower() != 'false':
        errors.append('production authentication is required')
    database = env.get('DATABASE_URL', '')
    parsed_database = urlparse(database)
    if not database.startswith(('mysql://', 'mysql+pymysql://')) or not parsed_database.hostname or not parsed_database.username or parsed_database.path in ('', '/') or any(x in database.upper() for x in ('<', '>', 'REPLACE')):
        errors.append('a real MySQL DATABASE_URL is required')
    key = env.get('SIMULATOR_API_KEY', '')
    if len(key) < 32 or any(x in key.upper() for x in ('REPLACE', 'YOUR_', 'PLACEHOLDER')):
        errors.append('a private Simulator key of at least 32 characters is required')
    origins = [x.strip() for x in env.get('CORS_ORIGINS', '').split(',') if x.strip()]
    if not origins or any(urlparse(x).scheme != 'https' or not urlparse(x).hostname or urlparse(x).username or urlparse(x).query or urlparse(x).fragment or urlparse(x).path not in ('', '/') or '*' in x or 'REPLACE' in x.upper() for x in origins):
        errors.append('explicit HTTPS frontend CORS origins are required')
    domain = env.get('FACTORYPULSE_DOMAIN', '').strip().lower()
    if domain:
        labels = domain.split('.')
        if (len(domain) > 253 or len(labels) < 2
                or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in labels)
                or not any(urlparse(origin).hostname == domain for origin in origins)):
            errors.append('gateway domain must be a hostname matching an HTTPS frontend origin')
    if errors:
        raise RuntimeError('Hosted configuration rejected: ' + '; '.join(errors))


def database_ready(engine_factory):
    try:
        from sqlalchemy import text
        with engine_factory().connect() as connection:
            connection.execute(text('SELECT 1'))
            for table in ('users', 'auth_sessions', 'activity_log', 'machines', 'incidents',
                          'maintenance_work_orders', 'simulator_sensor_readings', 'simulator_sensor_latest'):
                connection.execute(text(f'SELECT 1 FROM {table} LIMIT 0'))
        return True
    except Exception:
        # Public readiness must never disclose DSNs, SQL details or credentials.
        return False


def assets_ready(root):
    try:
        catalog = json.loads((root / 'public/machine-name.json').read_text(encoding='utf-8'))
        master = {m['machineId']: m['machineCode'] for m in catalog}
        roster = json.loads((root / 'public/available-machine-ids.json').read_text(encoding='utf-8'))['machine_ids']
        teams = json.loads((root / 'config/workforce-teams.json').read_text(encoding='utf-8'))['teams']
        return bool(roster and teams and len(roster) == len(set(roster))
                    and all(mid in master for mid in roster)
                    and all(m['machine_code'] in master.values() for team in teams for m in team['machines'])
                    and (root / 'knowledge/assistant/sop.md').is_file()
                    and (root / 'knowledge/sop/catalog.json').is_file())
    except (OSError, ValueError, KeyError, TypeError):
        return False
