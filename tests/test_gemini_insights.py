import datetime as dt
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, HTTPException
from api_server.gemini_insights import generate_selected_analysis
from api_server.operational_insights import register, FactoryQuestion


class GeminiBoundaryTests(unittest.TestCase):
    def test_missing_configuration_does_not_construct_client(self):
        factory=MagicMock()
        with patch.dict(os.environ,{'GEMINI_API_KEY':'','GEMINI_MODEL':''}):
            result=generate_selected_analysis('Show readings','MCH-001',[],client_factory=factory)
        self.assertEqual(result['provider_status'],'unconfigured')
        factory.assert_not_called()

    def test_only_selected_telemetry_is_sent_and_client_is_closed(self):
        client=MagicMock(); client.__enter__.return_value=client
        client.models.generate_content.return_value.text='Observed RPM: 2400.'
        factory=MagicMock(return_value=client)
        facts=[{'machine_id':'MCH-001','sensor_name':'RPM','sensor_value':2400,'employee_name':'Private person'},
               {'machine_id':'MCH-101','sensor_name':'RPM','sensor_value':3000}]
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-only-key','GEMINI_MODEL':'test-model'}):
            result=generate_selected_analysis('Show RPM','MCH-001',facts,client_factory=factory)
        payload=json.loads(client.models.generate_content.call_args.kwargs['contents'])
        self.assertEqual(len(payload['telemetry']),1)
        self.assertNotIn('employee_name',payload['telemetry'][0])
        self.assertNotIn('test-only-key',json.dumps(payload))
        self.assertEqual(result['provider_status'],'responded')
        client.__exit__.assert_called_once()

    def test_provider_failure_keeps_safe_response_without_secret(self):
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-only-key','GEMINI_MODEL':'test-model'}):
            with self.assertLogs('api_server.gemini_insights',level='WARNING') as logs:
                result=generate_selected_analysis('Read RPM','MCH-001',
                    [{'machine_id':'MCH-001','sensor_value':2400}],
                    client_factory=MagicMock(side_effect=RuntimeError('test-only-key')))
        self.assertEqual(result['provider_status'],'unavailable')
        self.assertNotIn('test-only-key',str(result)+str(logs.output))

    def test_no_selected_evidence_never_calls_provider(self):
        factory=MagicMock()
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-only-key','GEMINI_MODEL':'test-model'}):
            result=generate_selected_analysis('Read RPM','MCH-001',[{'machine_id':'MCH-101'}],client_factory=factory)
        self.assertEqual(result['provider_status'],'no_evidence')
        factory.assert_not_called()


class IntelligenceAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.user={'role':'Operator','assigned_machine':'CNC-5AX-001'}
        def current(): return self.user
        self.fleet=MagicMock(return_value=[])
        api={'get_current_user':current,'_sql_text':lambda value:value,
             'get_telemetry_engine':MagicMock(),'get_simulator_fleet_latest_readings':self.fleet,
             'require_roles':lambda roles:current,'_utcnow':lambda:dt.datetime.now(dt.timezone.utc),
             'resolve_canonical_machine':lambda mid:{'machineCode':'CNC-5AX-001' if mid=='MCH-001' else 'CNC-TURN-001'}}
        app=FastAPI();register(app,api)
        self.endpoint=next(route.endpoint for route in app.routes if route.path=='/api/v1/intelligence/query')

    @patch('api_server.operational_insights.generate_selected_analysis')
    def test_operator_cannot_send_another_machine_to_gemini(self,provider):
        with self.assertRaises(HTTPException) as error:
            self.endpoint(FactoryQuestion(question='Latest readings',machine_id='MCH-101',use_ai=True),user=self.user)
        self.assertEqual(error.exception.status_code,403)
        provider.assert_not_called();self.fleet.assert_not_called()

    @patch('api_server.operational_insights.generate_selected_analysis')
    def test_gemini_requires_explicit_machine_selection(self,provider):
        with self.assertRaises(HTTPException) as error:
            self.endpoint(FactoryQuestion(question='Latest readings',use_ai=True),user=self.user)
        self.assertEqual(error.exception.status_code,422)
        provider.assert_not_called()

    @patch('api_server.operational_insights.generate_selected_analysis')
    def test_default_question_stays_local(self,provider):
        response=self.endpoint(FactoryQuestion(question='Latest readings',machine_id='MCH-001'),user=self.user)
        self.assertEqual(response['provider_status'],'disabled')
        provider.assert_not_called()


if __name__=='__main__': unittest.main()
