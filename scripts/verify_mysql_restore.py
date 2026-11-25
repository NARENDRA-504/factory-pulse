"""Restore a checksum-verified dump ONLY into a newly created network-isolated container.

No host ports, mounts, live credentials or existing databases are used. The isolated
container is retained for inspection; its name is recorded in the private report.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]


def verify_dump(path):
    path = Path(path).resolve(strict=True)
    if path.suffix.lower() != '.sql' or not path.is_file() or not path.stat().st_size:
        raise ValueError('Choose a completed, nonempty .sql backup, not a .partial file.')
    manifest = json.loads(Path(str(path) + '.manifest.json').read_text(encoding='utf-8-sig'))
    schema = manifest.get('database', '')
    if not re.fullmatch(r'[A-Za-z0-9_]+', schema):
        raise ValueError('Backup manifest has an invalid database name.')
    with path.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if digest.lower() != str(manifest.get('sha256', '')).lower() or path.stat().st_size != manifest.get('bytes'):
        raise ValueError('Backup checksum/size mismatch; restore refused.')
    return path, schema, digest


def docker_cli():
    found = shutil.which('docker')
    if found:
        return found
    for path in (Path(os.getenv('LOCALAPPDATA', '')) / 'Programs/DockerDesktop/resources/bin/docker.exe',
                 Path('C:/Program Files/Docker/Docker/resources/bin/docker.exe')):
        if path.is_file():
            return str(path)
    raise RuntimeError('Docker CLI is not installed.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup', type=Path, required=True)
    parser.add_argument('--check-only', action='store_true', help='Verify the backup checksum without starting a container.')
    args = parser.parse_args(argv)
    backup, schema, digest = verify_dump(args.backup)
    if args.check_only:
        print('PASS: completed backup checksum and size match. Restore has not been tested.')
        return 0
    cli = docker_cli()
    env = {**os.environ, 'PATH': str(Path(cli).parent) + os.pathsep + os.environ.get('PATH', '')}
    name = 'factorypulse-restore-' + uuid.uuid4().hex[:12]
    private = ROOT / '.local' / 'recovery'
    private.mkdir(parents=True, exist_ok=True)
    report = {'container': name, 'backup_sha256': digest, 'database': schema,
              'restore_verified': False, 'live_database_touched': False}
    started = time.monotonic()

    def run(command, **kwargs):
        return subprocess.run([cli, *command], env=env, capture_output=True, **kwargs)

    def sql(statement=None, source=None):
        # Password expansion occurs inside the isolated container, never in argv.
        command = ['exec', '-i', name, 'sh', '-c',
                   'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --batch --raw --skip-column-names']
        if source is not None:
            return run(command, stdin=source, timeout=3600)
        return run(command, input=statement.encode(), timeout=180)

    try:
        with tempfile.TemporaryDirectory(prefix='restore-', dir=private) as folder:
            credentials = Path(folder) / 'mysql.env'
            credentials.write_text('MYSQL_ROOT_PASSWORD=' + secrets.token_urlsafe(32) + '\n', encoding='utf-8')
            created = run(['run', '-d', '--name', name, '--network', 'none', '--restart', 'no',
                           '--label', 'factorypulse.purpose=isolated-restore', '--env-file', str(credentials),
                           'mysql:8.0'], timeout=300)
        if created.returncode:
            raise RuntimeError('Could not start isolated MySQL. Check Docker and image download access.')
        for _ in range(90):
            result = sql('SELECT 1;')
            if result.returncode == 0:
                break
            time.sleep(2)
        else:
            raise RuntimeError('Isolated MySQL did not become ready.')
        if sql(f'CREATE DATABASE `{schema}`; USE `{schema}`;').returncode:
            raise RuntimeError('Could not create isolated target schema.')
        # A new connection must select the target itself; no rewriting of view definitions.
        command = ['exec', '-i', name, 'sh', '-c',
                   f'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --database={schema}']
        with backup.open('rb') as source:
            result = run(command, stdin=source, timeout=3600)
        if result.returncode:
            raise RuntimeError('Restore failed. Isolated container retained; output withheld because dumps can contain private records.')
        tables = sql(f"SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.tables WHERE TABLE_SCHEMA='{schema}' ORDER BY TABLE_NAME;")
        if tables.returncode:
            raise RuntimeError('Could not enumerate restored objects.')
        objects = [line.split('\t') for line in tables.stdout.decode().splitlines()]
        report['objects'] = objects
        required = {'users', 'machines', 'incidents', 'maintenance_work_orders', 'simulator_sensor_readings', 'simulator_sensor_latest'}
        if required - {item[0] for item in objects}:
            raise RuntimeError('Required application tables are missing from the restored backup.')
        counts = {}
        for table, kind in objects:
            if kind == 'BASE TABLE' and re.fullmatch(r'[A-Za-z0-9_]+', table):
                result = sql(f'SELECT COUNT(*) FROM `{schema}`.`{table}`;')
                if result.returncode:
                    raise RuntimeError('A restored table could not be read.')
                counts[table] = int(result.stdout.strip())
        report.update(row_counts=counts, dump_restore_verified=True,
                      source_row_parity_verified=False, application_workflow_verified=False)
        print('PASS: dump restored and required tables readable in isolated container ' + name)
        print('Source snapshot parity and staging workflow still require separate checks.')
        return 0
    except (RuntimeError, subprocess.TimeoutExpired) as exc:
        report['failure'] = str(exc) if isinstance(exc, RuntimeError) else 'Docker operation timed out.'
        print('NOT VERIFIED: ' + report['failure'])
        return 1
    finally:
        report['elapsed_seconds'] = round(time.monotonic() - started, 2)
        (private / (name + '.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    raise SystemExit(main())
