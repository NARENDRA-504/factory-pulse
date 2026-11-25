import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from api_server import readiness_review as review

class PracticeBenchmarkTests(unittest.TestCase):
    def evaluate(self, data):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'.local/ai4i-practice'
            path.mkdir(parents=True)
            (path/'evaluation.json').write_text(json.dumps(data),encoding='utf-8')
            with patch.object(review,'ROOT',Path(folder)):
                return review.practice_benchmark()

    def test_whitelist_and_no_release(self):
        result=self.evaluate({'secret':'not exposed','operational_deployment':True,
            'test':{'rows':10,'confusion_matrix':[[6,1],[1,2]],'precision':.67,'recall':.67,'f1':.67}})
        self.assertTrue(result['available'])
        self.assertEqual(result['missed'],1)
        self.assertNotIn('secret',result)
        self.assertFalse(result['operational_deployment'])

    def test_corrupt_metrics_unavailable(self):
        for matrix in ([[6,1],[1,-2]], [[6,1],[1,200]]):
            self.assertFalse(self.evaluate({'test':{'rows':10,'confusion_matrix':matrix,
                'precision':.5,'recall':.5,'f1':.5}})['available'])

    def test_missing_artifact(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(review,'ROOT',Path(folder)):
            self.assertFalse(review.practice_benchmark()['available'])
