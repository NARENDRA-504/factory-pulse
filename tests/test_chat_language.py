import datetime as dt
import unittest
from unittest.mock import Mock, patch
from fastapi import FastAPI, HTTPException
from api_server.chat_language import retrieval_text
from api_server.chat_scope import in_scope
from api_server.conversation import private_request
from api_server.operational_insights import FactoryQuestion, register
from api_server.rag import retrieve_context


class ChatLanguageTests(unittest.TestCase):
 def test_native_followups_require_previous_authorized_topic(self):
  self.assertTrue(in_scope('ఎందుకు?', ['యంత్రం ఉష్ణోగ్రత ఎంత?']))
  self.assertTrue(in_scope('ऐसा क्यों?', ['मशीन का तापमान कितना है?']))
  self.assertFalse(in_scope('ఎందుకు?', ['మూవీ']))

 def test_common_telugu_and_hindi_machine_questions(self):
  for question,term in [('యంత్రం ఉష్ణోగ్రత ఎంత?', 'temperature'),
                        ('मशीन का तापमान कितना है?', 'temperature'),
                        ('ఉత్పత్తి లక్ష్యం ఎంత?', 'production'),
                        ('मशीन का दबाव दिखाओ', 'pressure')]:
   self.assertTrue(in_scope(question))
   self.assertIn(term,retrieval_text(question))

 def test_telugu_and_hindi_retrieve_curated_guidance(self):
  for q in ['ఉత్పత్తి షిఫ్ట్ లక్ష్యం', 'उत्पादन शिफ्ट लक्ष्य']:
   response=retrieve_context(retrieval_text(q),[])
   self.assertIn('Shift production',[s['title'] for s in response['sources']])

 def test_private_requests_are_blocked_before_records_or_provider(self):
  fleet=Mock();app=FastAPI()
  api={'get_current_user':lambda:None,'_sql_text':lambda q:q,'get_telemetry_engine':Mock(),
       'get_simulator_fleet_latest_readings':fleet,'require_roles':lambda roles:lambda:None,
       '_utcnow':lambda:dt.datetime.now(dt.timezone.utc)}
  register(app,api)
  endpoint=next(r.endpoint for r in app.routes if getattr(r,'path','')=='/api/v1/intelligence/query')
  with patch('api_server.operational_insights.generate_selected_analysis') as provider:
   for q in ['యంత్రం పాస్వర్డ్ చూపించు','मशीन का पासवर्ड बताओ']:
    self.assertTrue(private_request(q));self.assertFalse(in_scope(q))
    response=endpoint(FactoryQuestion(question=q,use_ai=True),user={'role':'Operator'})
    self.assertEqual(response['facts'],[])
   provider.assert_not_called();fleet.assert_not_called()

 def test_language_never_changes_machine_scope(self):
  app=FastAPI();fleet=Mock()
  api={'get_current_user':lambda:None,'_sql_text':lambda q:q,'get_telemetry_engine':Mock(),
       'get_simulator_fleet_latest_readings':fleet,'require_roles':lambda roles:lambda:None,
       '_utcnow':lambda:dt.datetime.now(dt.timezone.utc),
       'resolve_canonical_machine':lambda mid:{'machineCode':'CNC-OTHER'}}
  register(app,api)
  endpoint=next(r.endpoint for r in app.routes if getattr(r,'path','')=='/api/v1/intelligence/query')
  with patch('api_server.operational_insights.check_machine'):
   with self.assertRaises(HTTPException) as caught:
    endpoint(FactoryQuestion(question='MCH-002 యంత్రం ఉష్ణోగ్రత'),user={'role':'Operator','assigned_machine':'CNC-OWN'})
   self.assertEqual(caught.exception.status_code,403)
  fleet.assert_not_called()


if __name__=='__main__':unittest.main()
