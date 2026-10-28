"""Available machine roster; archived identities/history remain intact."""
import json
from pathlib import Path

ROSTER_PATH=Path(__file__).resolve().parents[1]/'public'/'available-machine-ids.json'
def available_master(master):
    config=json.loads(ROSTER_PATH.read_text(encoding='utf-8'))
    ids=config.get('machine_ids',[])
    if not ids or len(ids)!=len(set(ids)) or any(id not in master for id in ids):
        raise RuntimeError('Available machine roster is invalid')
    return {id:master[id] for id in ids}
