import copy
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from api_server.sop_governance import approval_review
from api_server.readiness_review import model_review, register, completion_evidence

NOW = dt.datetime(2026, 11, 22, tzinfo=dt.timezone.utc)
DOCUMENT = {'id':'TEST', 'status':'approved', 'approved_by':'Fixture owner',
    'manual_reference':'Fixture manual', 'machine_ids':['MCH-001'],
    'effective_date':'2026-01-01', 'review_due':'2026-12-01',
    'roles':{'Operator':['Follow the applicable site procedure.']}}
MODEL = {'status':'ready','model':'fixture','release_gate':{'real_machine_validation':False},
    'test':{'rows':15377,'matrix_order':['Normal','Suspect','Critical'],
        'confusion_matrix':[[14060,1192,7],[7,63,16],[0,15,17]]}}

class ReadinessReviewTests(unittest.TestCase):
    def test_completion_evidence_excludes_private_container_details_and_stale_models(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'.local/recovery').mkdir(parents=True)
            (root/'.local/health-model-v2').mkdir()
            (root/'.local/recovery/factorypulse-restore-test.json').write_text(json.dumps({'dump_restore_verified':True,'container':'private-name','password':'never'}))
            path=root/'.local/health-model-v2/validation-audit.json'
            path.write_text(json.dumps({'model_sha256':'old','deployed_inference_matches':True}))
            with patch('api_server.readiness_review.ROOT',root):
                result=completion_evidence({'model_sha256':'new'})
                self.assertTrue(result['recovery']['dump_restore_verified'])
                self.assertNotIn('container',result['recovery']);self.assertNotIn('password',result['recovery'])
                self.assertFalse(result['validation_audit']['available'])
    def test_approval_requires_complete_current_metadata(self):
        result = approval_review(DOCUMENT, NOW)
        self.assertTrue(result['usable_approved'])
        self.assertTrue(result['review_due_soon'])
        for key, value in [('status','training'),('approved_by',' '),('manual_reference',None),
                           ('machine_ids',[]),('roles',{}),('review_due','2026-01-01'),
                           ('effective_date','2027-01-01')]:
            with self.subTest(key=key):
                self.assertFalse(approval_review({**DOCUMENT,key:value},NOW)['usable_approved'])

    def test_matrix_counts_and_alerts_disabled(self):
        result = model_review(MODEL)
        self.assertEqual(result['critical_detected'],17)
        self.assertEqual(result['critical_missed'],15)
        self.assertEqual(result['false_critical'],23)
        self.assertEqual(result['normal_samples_flagged'],1199)
        self.assertAlmostEqual(result['critical_recall'],17/32)
        self.assertAlmostEqual(result['critical_precision'],17/40)
        self.assertFalse(result['release_ready'])
        self.assertFalse(result['alerts_enabled'])

    def test_reordered_labels_and_success_do_not_enable_alerts(self):
        model = copy.deepcopy(MODEL)
        model['release_gate']['real_machine_validation'] = True
        model['test'] = {'rows':30,'matrix_order':['Critical','Normal','Suspect'],
                         'confusion_matrix':[[10,0,0],[0,10,0],[0,0,10]]}
        result = model_review(model)
        self.assertEqual(result['critical_detected'],10)
        self.assertTrue(result['release_ready'])
        self.assertFalse(result['alerts_enabled'])

    def test_inconsistent_evidence_never_invents_counts(self):
        for change in [{'rows':1}, {'matrix_order':['Normal','Normal','Critical']},
                       {'confusion_matrix':[[True,0,0],[0,1,0],[0,0,1]]},
                       {'confusion_matrix':[[-1,0,0],[0,1,0],[0,0,1]]}]:
            model = copy.deepcopy(MODEL)
            model['test'].update(change)
            result = model_review(model)
            self.assertFalse(result['metrics_available'])
            self.assertNotIn('critical_missed',result)
        self.assertFalse(model_review({'status':'unavailable'})['metrics_available'])

    def test_route_authorizes_before_reading_evidence(self):
        role = ['Operator']
        def require_roles(roles):
            def authorize():
                if role[0] not in roles and role[0] != 'Super Admin':
                    raise HTTPException(403,'Forbidden')
                return {'role':role[0]}
            return authorize
        app = FastAPI()
        register(app,{'require_roles':require_roles,'_utcnow':lambda:NOW})
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'catalog.json'
            path.write_text(json.dumps({'documents':[DOCUMENT]}))
            with patch('api_server.sop_retrieval.CATALOG',path), patch('api_server.readiness_review.model_status',return_value=MODEL) as status:
                with TestClient(app) as client:
                    for denied in ['Operator','Supervisor','Maintenance','Manager']:
                        role[0] = denied
                        self.assertEqual(client.get('/api/v1/admin/readiness-review').status_code,403)
                    status.assert_not_called()
                    for allowed in ['Admin','Super Admin']:
                        role[0] = allowed
                        response = client.get('/api/v1/admin/readiness-review')
                        self.assertEqual(response.status_code,200)
                        self.assertEqual(response.json()['sop']['usable_approved'],1)
                    path.write_text('{}')
                    self.assertEqual(client.get('/api/v1/admin/readiness-review').status_code,503)
