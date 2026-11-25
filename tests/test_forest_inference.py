import datetime as dt
import hashlib,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from api_server import health_model as health
from api_server.forest_inference import forest_scores

def model():
    return {'version':2,'features':list(health.FEATURES),'labels':['Critical','Normal','Suspect'],
            'ranges':{k:[0,10000] for k in health.FEATURES},'feature_importance':{},
            'trees':[{'left':[1,-1,-1],'right':[2,-1,-1],'feature':[0,-2,-2],
                      'threshold':[60,-2,-2],'probabilities':[[.3,.4,.3],[0,1,0],[.8,0,.2]]}]}

class ForestTests(unittest.TestCase):
    def test_prediction_and_invalid_numbers(self):
        values={k:20 for k in health.FEATURES}
        self.assertEqual(forest_scores(model(),values)['Normal'],1)
        values['temperature_c']=80
        self.assertEqual(forest_scores(model(),values)['Critical'],.8)
        for bad in [float('nan'),float('inf'),True,None]:
            values['temperature_c']=bad
            with self.assertRaises(ValueError):forest_scores(model(),values)

    def test_corrupt_artifact_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            m=Path(folder)/'model.json';r=Path(folder)/'evaluation.json'
            m.write_text(json.dumps(model()));r.write_text('{"model_sha256":"invalid"}')
            with patch.object(health,'FOREST_MODEL',m),patch.object(health,'FOREST_REPORT',r):
                health.load_forest.cache_clear()
                self.assertEqual(health.model_status()['status'],'unavailable')
        health.load_forest.cache_clear()

    def test_full_runtime_deployment_and_stale_boundary(self):
        now=dt.datetime.now(dt.timezone.utc)
        rows=[dict(machine_id='MCH-001',reading_id=k,sensor_name=s,sensor_unit=u,
                   sensor_value=20.,data_quality='GOOD',timestamp=now.isoformat()) for k,(s,u) in health.FEATURES.items()]
        report={'model_name':'fixture_forest','training_source':'test only','validation':{},'test':{},
                'majority_test_accuracy':1,'trained_at_utc':now.isoformat(),'release_gate':{}}
        with tempfile.TemporaryDirectory() as folder:
            m=Path(folder)/'model.json';r=Path(folder)/'evaluation.json';raw=json.dumps(model()).encode()
            m.write_bytes(raw);report['model_sha256']=hashlib.sha256(raw).hexdigest();r.write_text(json.dumps(report))
            with patch.object(health,'FOREST_MODEL',m),patch.object(health,'FOREST_REPORT',r):
                health.load_forest.cache_clear()
                result=health.predict_machine(rows,now)
                self.assertEqual(result['classification'],'Normal');self.assertEqual(result['version'],2)
                self.assertFalse(result['alerts_enabled'])
                rows[0]['machine_status']='STOPPED'
                self.assertEqual(health.predict_machine(rows,now)['status'],'not_applicable')
                rows[0]['machine_status']='NORMAL'
                rows[0]['timestamp']=(now-dt.timedelta(seconds=31)).isoformat()
                self.assertEqual(health.predict_machine(rows,now)['status'],'insufficient_data')
                rows[0]['timestamp']=now.isoformat();rows[0]['machine_id']='MCH-002'
                self.assertEqual(health.predict_machine(rows,now)['status'],'insufficient_data')
        health.load_forest.cache_clear()

if __name__=='__main__':unittest.main()
