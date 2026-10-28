import unittest
from unittest.mock import patch
from api_server.chat_scope import in_scope
from api_server.operational_insights import FactoryQuestion,register
from fastapi import FastAPI
import datetime as dt

class ChatScopeTests(unittest.TestCase):
 def test_machine_and_production_topics(self):
  for question in ['Latest machine readings','Production output available?','RPM of MCH-001','Machine downtime','Any machine warnings?']:
   self.assertTrue(in_scope(question),question)
 def test_unrelated_topics(self):
  for question in ['Write a movie review','Tell me a joke about machines','Show API keys for the machine','What is the capital of France?']:
   self.assertFalse(in_scope(question),question)
 def test_followup_requires_manufacturing_context(self):
  self.assertTrue(in_scope('Why?',['Machine vibration warnings']))
  self.assertFalse(in_scope('Why?',['Tell me a joke']))
 def test_off_topic_does_not_read_sql_or_call_provider(self):
  from unittest.mock import Mock
  fleet=Mock();app=FastAPI()
  api={'get_current_user':lambda:None,'_sql_text':lambda q:q,'get_telemetry_engine':Mock(),'get_simulator_fleet_latest_readings':fleet,'require_roles':lambda roles:lambda:None,'_utcnow':lambda:dt.datetime.now(dt.timezone.utc)}
  register(app,api)
  endpoint=next(r.endpoint for r in app.routes if getattr(r,'path','')=='/api/v1/intelligence/query')
  with patch('api_server.operational_insights.generate_selected_analysis') as provider:
   for role in ['Admin','Operator','Supervisor','Maintenance','Manager']:
    response=endpoint(FactoryQuestion(question='Tell me a movie joke',machine_id='MCH-001',use_ai=True),user={'role':role})
    self.assertEqual(response['provider_status'],'out_of_scope')
   provider.assert_not_called();fleet.assert_not_called()

 def test_previous_unrelated_question_cannot_establish_context(self):
  self.assertFalse(in_scope('Why?',['Show machine credentials']))
