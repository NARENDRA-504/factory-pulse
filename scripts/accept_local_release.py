"""Repeatable local checks. No telemetry generation, cleanup or model activation."""
import datetime as dt
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = ['tests.test_prediction_monitoring', 'tests.test_forest_inference',
         'tests.test_practice_benchmark',
         'tests.test_finite_demo', 'tests.test_readiness_extensions',
         'tests.test_readiness_review', 'tests.test_sop_retrieval',
         'tests.test_backup_verification']

def main():
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    jobs = [('services_and_sql', [sys.executable, 'scripts/check_presentation.py', '--json']),
            ('targeted_backend', [sys.executable, '-m', 'unittest', *TESTS])]
    if npm:
        jobs += [('frontend_types', [npm, 'run', 'lint']), ('frontend_build', [npm, 'run', 'build'])]
    report = {'checked_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': [],
              'scope': 'Local service/SQL readiness, temporary-database tests and frontend compilation',
              'not_verified': ['Physical microphone and speakers', 'New live telemetry delivery or browser workflows',
                               'Independent Power BI refresh parity', 'Site SOP approval', 'Real-machine model validation'],
              'operational_writes': False}
    if not npm:
        report['checks'].append({'name': 'frontend_tools', 'passed': False, 'reason': 'npm unavailable'})
    folder = ROOT / '.local/acceptance'
    folder.mkdir(parents=True, exist_ok=True)
    for name, command in jobs:
        started = time.monotonic()
        try:
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
            passed = result.returncode == 0
            item = {'name': name, 'passed': passed, 'exit_code': result.returncode,
                    'seconds': round(time.monotonic() - started, 2)}
            if name == 'services_and_sql':
                data = json.loads(result.stdout)
                item['state'] = data.get('telemetry_state')
                item['checks'] = data.get('checks')
                passed = passed and data.get('ready') is True
                item['passed'] = passed
            # Logs stay private; no stdout/passwords embedded in the shareable report.
            (folder / (name + '.log')).write_text(result.stdout + result.stderr, encoding='utf-8')
        except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
            item = {'name': name, 'passed': False, 'reason': type(exc).__name__}
        report['checks'].append(item)
        print(f"{name}: {'PASS' if item['passed'] else 'FAIL'}", flush=True)
    report['automated_checks_passed'] = all(item['passed'] for item in report['checks'])
    report['workplace_approval'] = False
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d-%H%M%S')
    output = folder / f'local-acceptance-{stamp}.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('Report saved:', output)
    print('External and physical acceptance remains separate; no workplace approval is inferred.')
    return 0 if report['automated_checks_passed'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
