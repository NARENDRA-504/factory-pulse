"""Configure the two separate local apps without printing credentials or sending data."""
import argparse
import os
from pathlib import Path
import re
import secrets
import tempfile

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def simulator_root(root=ROOT, supplied=None):
    value = supplied or os.environ.get('SIMULATOR_PROJECT_PATH') or dotenv_values(root / '.env').get('SIMULATOR_PROJECT_PATH')
    path = Path(value).expanduser() if value else root.parent / 'AI Simulator'
    return (path if path.is_absolute() else root / path).resolve()


def valid_secret(value):
    return bool(value and len(value) >= 32 and not re.search(r'[\s<>\r\n]', value)
                and not any(word in value.lower() for word in ('replace', 'placeholder', 'your_generated', 'my_secret')))


def update_env(path, changes):
    """Preserve unrelated configuration/comments; reject ambiguous duplicate settings."""
    original = path.read_text(encoding='utf-8-sig') if path.exists() else ''
    lines = original.splitlines()
    for key, value in changes.items():
        matches = [i for i, line in enumerate(lines) if re.match(r'^\s*(?:export\s+)?' + re.escape(key) + r'\s*=', line)]
        if len(matches) > 1:
            raise ValueError('Duplicate setting: ' + key + '. Remove duplicate lines locally and retry.')
        # Generated values have no quotes/newlines; paths use forward slashes.
        if any(c in value for c in ('"', '\n', '\r')):
            raise ValueError('Unsupported configuration character in ' + key)
        line = key + '="' + value + '"'
        if matches:
            lines[matches[0]] = line
        else:
            lines.append(line)
    return '\n'.join(lines) + '\n'


def write_atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n', dir=path.parent, delete=False) as f:
            name = f.name
            f.write(content)
        os.replace(name, path)
    finally:
        if name and Path(name).exists():
            Path(name).unlink()


def configure(root=ROOT, supplied=None, apply=False):
    root = Path(root).resolve()
    sim = simulator_root(root, supplied)
    if sim == root or root in sim.parents or sim in root.parents:
        raise ValueError('Keep FactoryPulse and AI Simulator in separate sibling folders.')
    if not (sim / 'backend/app/main.py').is_file() or not (sim / 'frontend/package.json').is_file():
        raise ValueError('Simulator folder must contain backend/app/main.py and frontend/package.json.')
    main_path, sim_path = root / '.env', sim / 'backend/.env'
    main_cfg, sim_cfg = dotenv_values(main_path), dotenv_values(sim_path)
    existing = main_cfg.get('SIMULATOR_API_KEY', '')
    # Never silently rotate a configured receiver key.
    placeholder = not existing or any(word in existing.lower() for word in ('replace', 'placeholder', 'your_generated'))
    if not placeholder and not valid_secret(existing):
        raise ValueError('Receiver key is configured but not a valid 32+ character secret. Review it locally; it was not changed.')
    key = existing if not placeholder else secrets.token_urlsafe(32)
    incoming = sim_cfg.get('SIMULATOR_API_KEY')
    main_changes = {'VITE_API_BASE_URL': 'http://127.0.0.1:8001', 'SIMULATOR_API_KEY': key,
                    'SIMULATOR_PROJECT_PATH': sim.as_posix()}
    sim_changes = {'TELEMETRY_PUSH_ENABLED': 'true',
                   'TELEMETRY_RECEIVER_URL': 'http://127.0.0.1:8001/api/v1/telemetry',
                   'TELEMETRY_AUTH_HEADER': 'X-Simulator-API-Key', 'TELEMETRY_API_KEY': key}
    if not incoming:
        sim_changes['SIMULATOR_API_KEY'] = secrets.token_urlsafe(32)
    main_changes['SIMULATOR_CONTROL_API_KEY'] = incoming or sim_changes['SIMULATOR_API_KEY']
    if not sim_cfg.get('DATABASE_PATH'):
        sim_changes['DATABASE_PATH'] = (sim / 'data/simulator.db').as_posix()
    # Prepare both files before writing either, including duplicate-line validation.
    prepared = [(main_path, update_env(main_path, main_changes)), (sim_path, update_env(sim_path, sim_changes))]
    if apply:
        for path, content in prepared:
            write_atomic(path, content)
        if 'DATABASE_PATH' in sim_changes:
            (sim / 'data').mkdir(exist_ok=True)
    return {'applied': apply, 'receiver_key_preserved': not placeholder,
            'mysql_configured': bool(main_cfg.get('DATABASE_URL') and '<' not in main_cfg['DATABASE_URL']),
            'restart_required': apply}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator-path', help='Separate Simulator project folder (default: sibling AI Simulator).')
    parser.add_argument('--apply', action='store_true', help='Write local backend settings. Default only previews readiness.')
    args = parser.parse_args()
    try:
        result = configure(supplied=args.simulator_path, apply=args.apply)
    except (ValueError, OSError):
        # Do not expose exception text that could include secrets from third-party libraries.
        raise SystemExit('Connection setup could not complete. Check the separate folder, .env permissions, duplicate settings and receiver key format. No credentials are printed.')
    print('Local connection settings saved.' if result['applied'] else 'Preview passed. Add --apply to save local connection settings.')
    print('Existing receiver key preserved.' if result['receiver_key_preserved'] else 'A new receiver key will be generated locally.' if not result['applied'] else 'A new receiver key was generated locally.')
    print('MySQL URL present; connection not tested.' if result['mysql_configured'] else 'Set DATABASE_URL in FactoryPulse .env before launching.')
    print('Restart both backends after applying. No telemetry was generated, sent or deleted. Existing passwords, database URL and Gemini settings are preserved.')


if __name__ == '__main__':
    main()
