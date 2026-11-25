import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from api_server.rag import retrieve_context
from api_server.sop_evidence import assess
from api_server.sop_retrieval import retrieve_sop

NOW = dt.datetime(2026, 11, 12, 15, tzinfo=dt.timezone.utc)


def reading(name='Temperature', **changes):
    return {'machine_id': 'MCH-001', 'reading_id': 'R-' + name, 'sensor_name': name,
            'sensor_value': 90., 'sensor_unit': '°C', 'data_quality': 'GOOD',
            'timestamp': NOW.isoformat(), 'expected_min': 25., 'expected_max': 70.,
            'machine_status': 'CRITICAL', **changes}


class SopResponsePlanTests(unittest.TestCase):
    def test_auto_topic_uses_individual_excursion_not_round_wide_status(self):
        facts = [reading(), reading('Pressure', sensor_unit='bar', sensor_value=5., expected_min=2., expected_max=8.)]
        response = retrieve_sop('general SOP machine response', 'Operator', 'MCH-001', facts, NOW)
        self.assertEqual(response['sources'][0]['document_id'], 'FP-TEMP-001')
        self.assertEqual(response['assessment']['suggested_topics'], ['temperature'])
        self.assertEqual(len(response['assessment']['excursions']), 1)
        self.assertFalse(response['response_plan']['automatic_actions'])
        self.assertIn('supervisor', response['response_plan']['owner'])

    def test_stale_bad_unit_and_nonfinite_data_do_not_establish_current_condition(self):
        for override in [{'sensor_unit': 'F'}, {'sensor_value': float('nan')},
                         {'data_quality': 'NOISY'}, {'timestamp': (NOW - dt.timedelta(minutes=2)).isoformat()},
                         {'timestamp': (NOW + dt.timedelta(seconds=2)).isoformat()}]:
            with self.subTest(override=override):
                result = retrieve_sop('general SOP machine response', 'Operator', 'MCH-001', [reading(**override)], NOW)
                self.assertEqual(result['level'], 'Unavailable')
                self.assertEqual(result['assessment']['fresh_valid'], 0)
                self.assertEqual(result['sources'][0]['document_id'], 'FP-DATA-001')
                self.assertIn('No verified current', result['response_plan']['summary'])

    def test_latest_bad_sample_is_not_hidden_by_older_good_sample(self):
        values = [reading(timestamp=(NOW - dt.timedelta(seconds=5)).isoformat()), reading(data_quality='NOISY')]
        result = assess(values, 'MCH-001', NOW)
        self.assertEqual(result['fresh_valid'], 0)
        self.assertEqual(len(result['checks']), 1)

    def test_combined_event_retrieves_two_topics_with_bounded_steps(self):
        result = retrieve_sop('general SOP machine response', 'Maintenance', 'MCH-001',
                              [reading(), reading('Vibration', sensor_unit='mm/s', sensor_value=8., expected_min=.5, expected_max=5.)], NOW)
        self.assertEqual({s['document_id'] for s in result['sources']}, {'FP-TEMP-001', 'FP-VIB-001'})
        self.assertTrue(all(len(s['steps']) <= 8 for s in result['sources']))
        self.assertIn('release', result['response_plan']['release_gate'])

    def test_new_topics_are_specific_and_role_actions_differ(self):
        for question, expected in [('coolant flow', 'FP-COOLANT-001'), ('voltage', 'FP-ELECTRICAL-001'),
                                   ('torque load', 'FP-LOAD-001'), ('missing sensor', 'FP-DATA-001')]:
            result = retrieve_sop(question, 'Operator', 'MCH-001', now=NOW)
            self.assertEqual(result['sources'][0]['document_id'], expected)
            self.assertEqual(result['sources'][0]['revision'], '0.2')
            self.assertEqual(result['status'], 'training_only')
        operator = retrieve_sop('voltage', 'Operator', now=NOW)['sources'][0]['steps']
        maintenance = retrieve_sop('voltage', 'Maintenance', now=NOW)['sources'][0]['steps']
        self.assertNotEqual(operator, maintenance)
        self.assertIn('panels closed', ' '.join(operator))

    def test_no_other_machine_evidence_or_personnel_is_included(self):
        result = retrieve_sop('temperature', 'Operator', 'MCH-001',
                              [reading(machine_id='MCH-002', employee_name='PRIVATE')], NOW)
        self.assertEqual(result['assessment']['checks'], [])
        self.assertNotIn('PRIVATE', str(result))

    def test_approved_applicable_procedure_beats_training_in_same_category(self):
        common = {'title': 'Temperature response', 'revision': '1', 'category': 'temperature', 'machine_ids': ['MCH-001'],
                  'approved_by': 'Fixture owner', 'manual_reference': 'Fixture manual', 'effective_date': '2026-01-01',
                  'review_due': '2026-12-31', 'scope_notice': 'Test only', 'roles': {'Operator': ['Approved fixture step']}}
        docs = [{**common, 'id': 'TRAINING', 'status': 'training', 'keywords': ['temperature', 'hot']},
                {**common, 'id': 'APPROVED', 'status': 'approved', 'keywords': ['temperature']}]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'catalog.json'; path.write_text(json.dumps({'documents': docs}), encoding='utf-8')
            with patch('api_server.sop_retrieval.CATALOG', path):
                self.assertEqual(retrieve_sop('hot temperature', 'Operator', 'MCH-001', now=NOW)['status'], 'approved')

    def test_rag_discloses_lexical_limits_and_rejects_wrong_physical_unit(self):
        result = retrieve_context('temperature', [reading(sensor_unit='F')], 'MCH-001', NOW)
        self.assertEqual(result['fresh_good_measurements'], 0)
        self.assertEqual(result['version'], 4)
        self.assertIn(result['vector_search']['status'], ('ready', 'unavailable'))
        self.assertTrue(any('confidence' in item or 'fallback' in item for item in result['limitations']))


if __name__ == '__main__': unittest.main()
