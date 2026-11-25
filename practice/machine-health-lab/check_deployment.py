"""Tests a loaded model through the practice HTTP contract, without starting a port."""
import json
from pathlib import Path
from fastapi.testclient import TestClient
from serve import app

sample=json.loads((Path(__file__).parent/'artifacts/sample-request.json').read_text())
with TestClient(app) as client:
 assert client.get('/health').json()['status']=='ready'
 result=client.post('/predict',json=sample);assert result.status_code==200,result.text
 assert result.json()['prediction'] in {'Normal','Suspect','Critical'}
 assert abs(sum(result.json()['model_scores'].values())-1)<1e-8
 invalid={**sample,'machine_type':'Unknown'}
 assert client.post('/predict',json=invalid).status_code==422
 assert client.post('/predict',json={**sample,'next_failure_at_utc':'tomorrow'}).status_code==422
 print('PASS: saved model loads; prediction contract works; invalid types and leakage fields rejected.')
