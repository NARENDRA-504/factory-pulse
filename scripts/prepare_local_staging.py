"""Create private local staging settings without changing either project's .env.

Staging shares existing MySQL records; its SQLite and delivery/control credentials
are separate. No public deployment, data generation or SQL changes occur here.
"""
import os
from pathlib import Path
import secrets
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]


def main():
    target = ROOT / '.local/staging'
    paths = [target / name for name in ('api.env', 'simulator.env', 'simulator-web.env')]
    if any(path.exists() for path in paths):
        raise SystemExit('Private staging files already exist; preserve them and review rather than overwrite.')
    source = dotenv_values(ROOT / '.env')
    if not source.get('DATABASE_URL'):
        raise SystemExit('Local MySQL configuration is missing; no values displayed.')
    database = make_url(source['DATABASE_URL'])
    if database.drivername not in ('mysql', 'mysql+pymysql'):
        raise SystemExit('Expected a MySQL connection; staging refused.')
    if database.host in ('127.0.0.1', 'localhost'):
        database = database.set(host='host.docker.internal')
    receiver, control = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    configs = [
        {'DATABASE_URL': database.render_as_string(hide_password=False),
         'SIMULATOR_API_KEY': receiver, 'FACTORY_TIMEZONE': source.get('FACTORY_TIMEZONE') or 'Asia/Kolkata',
         'CORS_ORIGINS': 'http://127.0.0.1:18080,http://localhost:18080',
         'SIMULATOR_CONTROL_URL': 'http://simulator-api:8002', 'SIMULATOR_CONTROL_API_KEY': control},
        {'SIMULATOR_API_KEY': control, 'TELEMETRY_API_KEY': receiver,
         'TELEMETRY_PUSH_ENABLED': 'true', 'TELEMETRY_AUTH_HEADER': 'X-Simulator-API-Key',
         'TELEMETRY_RECEIVER_URL': 'http://api:8000/api/v1/telemetry',
         'TELEMETRY_CONNECT_TIMEOUT': '3', 'TELEMETRY_MAX_RETRIES': '3'},
        {'SIMULATOR_API_KEY': control},
    ]
    target.mkdir(parents=True, exist_ok=True)
    for path, config in zip(paths, configs):
        if any('\n' in value or '\r' in value for value in config.values()):
            raise SystemExit('Multiline environment values are not supported; no values displayed.')
        # Exclusive creation also protects against concurrent configuration replacement.
        with path.open('x', encoding='utf-8') as stream:
            stream.write(''.join(f'{key}={value}\n' for key, value in config.items()))
        if os.name != 'nt':
            path.chmod(0o600)
    print('Private local staging settings prepared. Existing credentials unchanged; values withheld.')
    print('MySQL is shared. Back it up before any write/workflow tests. Simulator starts paused.')


if __name__ == '__main__':
    main()
