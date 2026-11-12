import json,unittest
from pathlib import Path
import pandas as pd
from fastapi.testclient import TestClient
from app import app

class PredictionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context=TestClient(app);cls.client=cls.context.__enter__()
        cls.example=json.loads((Path(__file__).parent/'example_request.json').read_text())
    @classmethod
    def tearDownClass(cls):cls.context.__exit__(None,None,None)
    def test_api_matches_pipeline(self):
        r=self.client.post('/predict',json=self.example);self.assertEqual(r.status_code,200)
        bundle=app.state.bundle
        direct=float(bundle['pipeline'].predict_proba(pd.DataFrame([self.example],columns=bundle['features']))[0,1])
        self.assertAlmostEqual(r.json()['purchase_score'],direct,places=12)
    def test_rejects_target_leakage_field(self):
        self.assertEqual(self.client.post('/predict',json={**self.example,'Revenue':True}).status_code,422)
    def test_rejects_missing_field(self):
        row=self.example.copy();row.pop('ProductRelated')
        self.assertEqual(self.client.post('/predict',json=row).status_code,422)
    def test_rejects_negative_duration(self):
        self.assertEqual(self.client.post('/predict',json={**self.example,'ProductRelated_Duration':-1}).status_code,422)
    def test_rejects_unknown_category(self):
        self.assertEqual(self.client.post('/predict',json={**self.example,'VisitorType':'unknown'}).status_code,422)
    def test_rejects_inconsistent_duration(self):
        self.assertEqual(self.client.post('/predict',json={**self.example,'ProductRelated':0,'ProductRelated_Duration':60}).status_code,422)
    def test_health(self):self.assertEqual(self.client.get('/health').json()['status'],'ok')

if __name__=='__main__':unittest.main()
