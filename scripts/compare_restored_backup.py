"""Compare a completed isolated restore with a private, read-only source reference.

Outputs counts and hashes only. Never connects to or alters the live database.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.verify_mysql_restore import docker_cli


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore-report', type=Path, required=True)
    parser.add_argument('--source-reference', type=Path, required=True)
    args = parser.parse_args(argv)
    report = json.loads(args.restore_report.read_text(encoding='utf-8-sig'))
    source = json.loads(args.source_reference.read_text(encoding='utf-8-sig'))
    if not report.get('dump_restore_verified'):
        raise SystemExit('Restore must finish successfully before comparison.')
    container = report['container']
    cli = docker_cli()
    env = {**os.environ, 'PATH': str(Path(cli).parent) + os.pathsep + os.environ.get('PATH', '')}
    label = subprocess.run([cli, 'inspect', '--format', '{{index .Config.Labels "factorypulse.purpose"}}', container],
                           capture_output=True, text=True, env=env, timeout=15)
    if label.returncode or label.stdout.strip() != 'isolated-restore':
        raise SystemExit('Refused: target must be a recovery-tool-created isolated container.')
    query = """SELECT JSON_ARRAY(r.reading_id,r.machine_id,r.sensor_name,r.sensor_unit,
      CAST(r.sensor_value_json AS CHAR),r.machine_status,r.data_quality,
      DATE_FORMAT(r.reading_timestamp,'%Y-%m-%d %H:%i:%s.%f'))
      FROM simulator_sensor_latest l JOIN simulator_sensor_readings r ON r.id=l.reading_row_id
      ORDER BY r.machine_id,r.sensor_name;"""
    # Manifest schema was validated before restore; validate again before shell construction.
    import re
    schema = report['database']
    if not re.fullmatch(r'[A-Za-z0-9_]+', schema):
        raise SystemExit('Invalid schema in restore report.')
    result = subprocess.run([cli, 'exec', '-i', container, 'sh', '-c',
                             f'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --database={schema} --batch --raw --skip-column-names'],
                            input=query, text=True, capture_output=True, env=env, timeout=180)
    if result.returncode:
        raise SystemExit('Could not read restored latest pointers; private SQL output withheld.')
    rows = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    for row in rows:
        if row[-1] is not None:
            row[-1] = str(datetime.datetime.fromisoformat(row[-1]))
    digest = hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()
    counts_match = report.get('row_counts') == source.get('row_counts')
    latest_match = digest == source.get('latest_readings_sha256') and len(rows) == source.get('latest_reading_rows')
    report.update(source_reference_utc=source.get('captured_utc'),
                  source_row_parity_verified=counts_match,
                  latest_reading_parity_verified=latest_match,
                  restored_latest_rows=len(rows), restored_latest_sha256=digest)
    args.restore_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'source_table_counts_match': counts_match, 'latest_readings_match': latest_match,
                      'latest_rows': len(rows), 'full_application_workflow_verified': report.get('application_workflow_verified', False)}))
    return 0 if counts_match and latest_match else 1


if __name__ == '__main__':
    raise SystemExit(main())
