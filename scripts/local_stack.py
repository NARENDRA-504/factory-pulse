"""Run and monitor both separate local applications. No secrets are logged."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
import urllib.request
from urllib.parse import urlparse

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
SIM = ROOT.parent / 'AI Simulator'
STATE = ROOT / '.local' / 'stack'
STATE.mkdir(parents=True, exist_ok=True)
if os.name == 'nt':
    import ctypes
    import msvcrt
    monitor_lock = open(STATE/'monitor.lock', 'a+b')
    monitor_lock.seek(0)
    if not monitor_lock.read(1):
        monitor_lock.write(b'1')
        monitor_lock.flush()
    monitor_lock.seek(0)
    try:
        msvcrt.locking(monitor_lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        raise SystemExit('The local stack monitor is already running.')
    ctypes.windll.kernel32.SetThreadExecutionState(0x80000001)
sim_env = dotenv_values(SIM / 'backend' / '.env')
key = sim_env.get('SIMULATOR_API_KEY', '')
headers = {'X-API-Key': key} if key else {}
node = shutil.which('node.exe') or shutil.which('node')
services = {
    'factorypulse-api': (ROOT, [str(ROOT/'.venv/Scripts/python.exe'), '-m', 'uvicorn', 'api_server.main:app', '--host', '127.0.0.1', '--port', '8001'], 'http://127.0.0.1:8001/health', {}),
    'simulator-api': (SIM/'backend', [str(SIM/'backend/.venv/Scripts/python.exe'), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8002'], 'http://127.0.0.1:8002/api/v1/health', headers),
    'factorypulse-web': (ROOT, [node, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3000', '--strictPort'], 'http://127.0.0.1:3000/', {}),
    'simulator-web': (SIM/'frontend', [node, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], 'http://127.0.0.1:5174/', {}),
}
processes = {}
failures = {name: 0 for name in services}
started_simulation = False

def healthy(url, auth):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=auth), timeout=8) as response:
            return response.status == 200
    except Exception:
        return False

def start(name):
    cwd, command, _, _ = services[name]
    log = open(STATE / (name+'.log'), 'ab', buffering=0)
    processes[name] = subprocess.Popen(command, cwd=cwd, stdout=log, stderr=log,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    print('Starting '+name, flush=True)

def listening(url):
    target = urlparse(url)
    try:
        with socket.create_connection((target.hostname, target.port), timeout=1):
            return True
    except OSError:
        return False

def start_streams():
    catalog = json.loads((ROOT/'public/machine-name.json').read_text())
    plants = {}
    for machine in catalog:
        plants.setdefault(machine['plant'], machine['machineId'])
    for machine_id in plants.values():
        request = urllib.request.Request('http://127.0.0.1:8002/api/v1/simulation/start',
            data=json.dumps({'machine_id': machine_id}).encode(),
            headers={**headers, 'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status != 200: raise RuntimeError('Simulation start failed')
    print('Simulator streams active: '+', '.join(plants.values()), flush=True)

if not node or not SIM.exists():
    raise SystemExit('Node.js or the separate AI Simulator folder is unavailable.')
print('FactoryPulse: http://localhost:3000 | Simulator: http://127.0.0.1:5174', flush=True)
print('Keep this launcher running. It checks the services and restarts stopped processes.', flush=True)
try:
    while True:
        status = {}
        for name, (_, _, url, auth) in services.items():
            ok = healthy(url, auth)
            status[name] = 'ready' if ok else 'starting or unavailable'
            failures[name] = 0 if ok else failures[name]+1
            process = processes.get(name)
            if not ok and not listening(url) and (process is None or process.poll() is not None):
                start(name)
                if name == 'simulator-api': started_simulation = False
            elif not ok and process and failures[name] >= 6:
                # Stop only the child launched by this supervisor.
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
                else: process.terminate()
                failures[name] = 0
        if status.get('simulator-api') == 'ready' and not started_simulation:
            try:
                start_streams()
                started_simulation = True
            except Exception:
                print('Waiting to start configured streams.', flush=True)
        (STATE/'status.json').write_text(json.dumps({'checked_at':time.time(),'services':status},indent=2))
        time.sleep(5)
except KeyboardInterrupt:
    print('Monitor stopped. Existing services remain available.', flush=True)
