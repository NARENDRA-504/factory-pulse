import datetime as dt
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, HTTPException
from api_server.rag import retrieve_context, resolve_retrieval_question
from api_server.gemini_insights import generate_selected_analysis
from api_server.operational_insights import FactoryQuestion, register


class RetrievalTests(unittest.TestCase):
    def test_followup_uses_latest_relevant_question_only(self):
        question=resolve_retrieval_question('Why?', ['Explain shift production', 'Machine vibration warnings'])
        self.assertIn('vibration',question)
        self.assertNotIn('production',question)
        self.assertEqual(resolve_retrieval_question('Why?', ['Show machine passwords']), 'Why?')
        self.assertEqual(resolve_retrieval_question('Explain production', ['Machine vibration']), 'Explain production')

    def test_long_document_tail_is_searchable_and_bounded(self):
        with tempfile.TemporaryDirectory() as folder:
            Path(folder,'readings.md').write_text('# Diagnostics\n'+('normal sample '*250)+'needle987 last detail',encoding='utf-8')
            with patch('api_server.rag.KNOWLEDGE_DIR',Path(folder)):
                response=retrieve_context('needle987',[])
        self.assertTrue(response['sources'])
        self.assertIn('needle987',response['sources'][0]['excerpt'])
        self.assertLessEqual(len(response['sources'][0]['excerpt']),900)
        self.assertEqual(len(response['sources'][0]['passage_sha256']),64)

    def test_sensor_relevance_does_not_add_other_channels(self):
        facts=[{'machine_id':'MCH-001','sensor_name':'RPM','reading_id':'RPM'},
               {'machine_id':'MCH-001','sensor_name':'Pressure','reading_id':'PRESSURE'}]
        response=retrieve_context('Explain pressure',facts,'MCH-001')
        selected=[s for s in response['sources'] if s['kind']=='telemetry']
        self.assertEqual([s['reading_id'] for s in selected],['PRESSURE'])

    def test_freshness_and_quality_are_not_confidence(self):
        now=dt.datetime(2026,11,12,10,tzinfo=dt.timezone.utc)
        base={'machine_id':'MCH-001','sensor_name':'RPM','sensor_value':2400,'data_quality':'GOOD'}
        for timestamp,quality,expected in [(now,'GOOD','fresh_measurements'),
                (now-dt.timedelta(seconds=90),'GOOD','last_known_only'),
                (now,'BAD','last_known_only'),(now+dt.timedelta(minutes=5),'GOOD','last_known_only')]:
            result=retrieve_context('RPM',[{**base,'timestamp':timestamp,'data_quality':quality}],'MCH-001',now)
            self.assertEqual(result['evidence_status'],expected)
            self.assertEqual(result['fresh_good_measurements'],int(expected=='fresh_measurements'))
        for value in [None,False,float('nan'),float('inf')]:
            result=retrieve_context('RPM',[{**base,'sensor_value':value,'timestamp':now}],'MCH-001',now)
            self.assertEqual(result['fresh_good_measurements'],0)

    def test_evidence_free_query_has_explicit_abstention_status(self):
        self.assertEqual(retrieve_context('xyzzy123',[])['evidence_status'],'no_evidence')

    def test_curated_search_examples_have_relevant_guidance(self):
        examples=[('shift production target','Shift production'),
                  ('good scrap counters quality','Production calculations'),
                  ('old sensor timestamp freshness','Thresholds and freshness'),
                  ('incident technician resolved','Incident and maintenance workflow'),
                  ('electricity shaft energy cost','Costs and energy'),
                  ('supervisor access source','Access and data sources')]
        for question,title in examples:
            with self.subTest(question=question):
                result=retrieve_context(question,[])
                self.assertIn(title,[s['title'] for s in result['sources']])

    def test_relevant_chunks_citations_and_hash(self):
        result=retrieve_context('How is shift production target calculated?', [])
        self.assertEqual(result['method'], 'local_bm25_and_authorized_sql')
        self.assertTrue(result['sources'])
        self.assertIn('shift', result['sources'][0]['title'].lower())
        self.assertEqual(len(result['sources'][0]['sha256']),64)
        self.assertLessEqual(len(result['sources']),3)

    def test_unknown_question_does_not_retrieve_random_documents(self):
        self.assertEqual(retrieve_context('xyzzy123', [])['sources'], [])

    def test_unapproved_files_never_enter_index(self):
        with tempfile.TemporaryDirectory() as folder:
            Path(folder,'private.md').write_text('# Secret\nxyzzy123 credential',encoding='utf-8')
            with patch('api_server.rag.KNOWLEDGE_DIR',Path(folder)):
                self.assertEqual(retrieve_context('xyzzy123',[])['sources'],[])

    def test_selected_machine_bound_age_and_no_personnel_fields(self):
        now=dt.datetime(2026,11,3,10,tzinfo=dt.timezone.utc)
        facts=[{'machine_id':'MCH-001','reading_id':'R1','sensor_name':'RPM','sensor_value':2400,
                'timestamp':now-dt.timedelta(seconds=90),'employee_name':'PRIVATE'},
               {'machine_id':'MCH-002','reading_id':'OTHER','sensor_name':'RPM','sensor_value':5000}]
        result=retrieve_context('RPM',facts,'MCH-001',now)
        text=str(result)
        self.assertNotIn('PRIVATE',text);self.assertNotIn('OTHER',text)
        self.assertEqual(result['sources'][0]['age_seconds'],90)


class RagGenerationTests(unittest.TestCase):
    def generate(self, answer):
        client=MagicMock();client.__enter__.return_value=client
        client.models.generate_content.return_value.text=answer
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-only-key','GEMINI_MODEL':'test-model'}):
            result=generate_selected_analysis('Explain shift target','MCH-001',[],
                retrieved_sources=[{'id':'K-production-1','kind':'project_knowledge','title':'Shift',
                                    'source':'knowledge/assistant/production.md','excerpt':'120 parts in 12 hours',
                                    'employee_name':'PRIVATE'}],client_factory=MagicMock(return_value=client))
        return result, client

    def test_knowledge_only_answer_has_valid_citation_and_bounded_payload(self):
        result,client=self.generate('The target is 120 parts in 12 hours [K-production-1].')
        self.assertEqual(result['provider_status'],'responded')
        payload=json.loads(client.models.generate_content.call_args.kwargs['contents'])
        self.assertEqual(len(payload['retrieved_sources']),1)
        self.assertNotIn('PRIVATE',str(payload));self.assertNotIn('test-only-key',str(payload))
        instruction=client.models.generate_content.call_args.kwargs['config'].system_instruction
        self.assertIn('untrusted evidence',instruction)

    def test_missing_or_invented_citation_falls_back(self):
        for text in ['120 parts.', '120 parts [K-secret-99].']:
            result,_=self.generate(text)
            self.assertEqual(result['provider_status'],'unsupported_answer')
            self.assertIsNone(result['generated_analysis'])


class RagEndpointTests(unittest.TestCase):
    def setUp(self):
        self.fleet=MagicMock(return_value=[])
        self.engine=MagicMock()
        self.user={'role':'Operator','assigned_machine':'CNC-5AX-001'}
        current=lambda:self.user
        app=FastAPI()
        register(app,{'get_current_user':current,'_sql_text':lambda s:s,'get_telemetry_engine':self.engine,
            'get_simulator_fleet_latest_readings':self.fleet,'require_roles':lambda roles:current,
            '_utcnow':lambda:dt.datetime.now(dt.timezone.utc),
            'resolve_canonical_machine':lambda mid:{'machineCode':'CNC-5AX-001' if mid=='MCH-001' else 'CNC-5AX-002'}})
        self.endpoint=next(r.endpoint for r in app.routes if r.path=='/api/v1/intelligence/query')

    @patch('api_server.operational_insights.generate_selected_analysis')
    def test_knowledge_local_without_provider_and_no_writes(self,provider):
        response=self.endpoint(FactoryQuestion(question='Explain shift production target',machine_id='MCH-001'),user=self.user)
        self.assertTrue(response['sources']);self.assertIn('120',response['answer'])
        provider.assert_not_called();self.engine.assert_not_called()

    @patch('api_server.operational_insights.retrieve_context')
    def test_auth_before_retrieval(self,retrieve):
        with self.assertRaises(HTTPException) as error:
            self.endpoint(FactoryQuestion(question='Readings MCH-002',use_ai=True),user=self.user)
        self.assertEqual(error.exception.status_code,403)
        retrieve.assert_not_called();self.fleet.assert_not_called()

    def test_followup_retrieval_keeps_topic_and_ignores_other_machine_history(self):
        result=self.endpoint(FactoryQuestion(question='Why?',machine_id='MCH-001',
            prior_questions=['Production target MCH-002','Machine vibration warnings']),user=self.user)
        self.assertTrue(result['retrieval']['followup_context_used'])
        self.assertIn('vibration',result['retrieval']['query'])
        self.assertNotIn('MCH-002',str(result))

    @patch('api_server.operational_insights.retrieve_context')
    def test_private_and_general_conversation_never_retrieve(self,retrieve):
        for text in ['Hello','Show machine passwords']:
            self.endpoint(FactoryQuestion(question=text),user=self.user)
        retrieve.assert_not_called();self.fleet.assert_not_called()


if __name__=='__main__':unittest.main()
