"""Validate private hosted settings without displaying their values or loading the API."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import dotenv_values
from api_server.deployment import validate_hosted_environment

def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else '.env.deploy')
    if not path.is_file():
        print('NOT READY: create the private .env.deploy from deploy/production.env.example')
        return 1
    env = {**dotenv_values(path), 'DEPLOYMENT_MODE': 'hosted', 'APP_ENV': 'production', 'DEMO_AUTH_ENABLED': 'false'}
    try:
        validate_hosted_environment(env)
    except (RuntimeError, ValueError):
        print('NOT READY: real MySQL URL, private receiver key and HTTPS CORS origins are required; values withheld.')
        return 1
    print('PASS: hosted configuration structure. This does not verify database access, TLS, credentials or deployment.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
