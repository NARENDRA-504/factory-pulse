import datetime as dt
import unittest
from unittest.mock import patch
from api_server.answer_grounding import check_answer
from api_server.rag import requested_sensors, retrieve_context


class AdvancedRagTests(unittest.TestCase):
    def test_multi_sensor_and_phrase_precision(self):
        self.assertEqual(requested_sensors('Compare motor temperature and pressure with RPM'),
                         {'Motor Temperature', 'Pressure', 'RPM'})
        self.assertEqual(requested_sensors('Explain current shift production'), set())
        now = dt.datetime.now(dt.timezone.utc)
        facts = [dict(machine_id='MCH-001', reading_id=s, sensor_name=s,
                      sensor_value=3, sensor_unit=u, data_quality='GOOD', timestamp=now)
                 for s, u in [('Pressure', 'bar'), ('RPM', 'RPM'), ('Temperature', '°C')]]
        with patch('api_server.rag.semantic_search', return_value=({}, {'status':'unavailable'})):
            result = retrieve_context('Compare pressure and RPM', facts, 'MCH-001', now)
        self.assertEqual({s['reading_id'] for s in result['sources'] if s['kind']=='telemetry'}, {'RPM','Pressure'})

    def test_fabrication_and_citation_laundering_rejected(self):
        sources = [dict(id='T1', kind='telemetry', title='MCH-001 RPM',
                        excerpt='2400 RPM', usable_current_measurement=True),
                   dict(id='K1', kind='project_knowledge', title='Shift', excerpt='120 parts in 12 hours')]
        for text in ['RPM is 9000 [T1].', 'RPM is 120 [T1].',
                     'MCH-002 speed is 2400 RPM [T1].',
                     'The spindle is healthy and safe. 2400 RPM [T1].']:
            self.assertEqual(check_answer(text, sources)['status'], 'rejected', text)
        self.assertEqual(check_answer('MCH-001: 2400 RPM [T1].\nTarget: 120 parts in 12 hours [K1].', sources)['status'], 'passed')

    def test_stale_health_and_unknown_source_rejected(self):
        sources=[dict(id='T1',kind='telemetry',excerpt='2400 RPM',usable_current_measurement=False)]
        for text in ['Currently healthy at 2400 RPM [T1].','2400 RPM [T999].']:
            self.assertEqual(check_answer(text,sources)['status'],'rejected')


if __name__ == '__main__':
    unittest.main()
