import datetime as dt
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from api_server import voice_chat as voice
from api_server.operational_insights import FactoryQuestion, VoiceQuestion, register


class VoiceTests(unittest.TestCase):
 def setUp(self):
  voice._requests.clear()

 def client(self, response):
  client=Mock();client.__enter__=Mock(return_value=client);client.__exit__=Mock(return_value=False)
  client.models.generate_content.return_value=response
  client.interactions.create.return_value=response
  if hasattr(response,'output_text'):
   import json
   client.models.generate_content.return_value=NS(text=json.dumps({'text':response.output_text,'language':'en'}))
  return client

 def endpoints(self, current=lambda: {'id':1,'role':'Operator','assigned_machine':'CNC-OWN'}):
  app=FastAPI();fleet=Mock(return_value=[])
  register(app,{'get_current_user':current,'_sql_text':lambda q:q,'get_telemetry_engine':Mock(),
   'get_simulator_fleet_latest_readings':fleet,'require_roles':lambda roles:current,
   '_utcnow':lambda:dt.datetime.now(dt.timezone.utc),
   'resolve_canonical_machine':lambda mid:{'machineCode':'CNC-OTHER'}})
  routes={r.path:r.endpoint for r in app.routes if hasattr(r,'endpoint')}
  return app,routes,fleet

 def test_native_transcription_and_unknown_rejection(self):
  for lang,words in [('te','యంత్రం ఎలా ఉంది?'),('hi','मशीन कैसी है?'),('en','How is the machine?')]:
   import json
   with patch.object(voice,'_client',return_value=self.client(NS(output_text=words))):
    self.assertEqual(voice.transcribe_audio(b'example','audio/webm')['text'],words)
  with patch.object(voice,'_client',return_value=self.client(NS(output_text=''))):
   with self.assertRaises(HTTPException) as error:voice.transcribe_audio(b'noise','audio/webm')
   self.assertEqual(error.exception.status_code,422)

 def test_invalid_recording_never_reaches_provider(self):
  with patch.object(voice,'_client') as provider:
   for data,mime in [(b'','audio/webm'),(b'x','text/plain'),(b'x'*(voice.MAX_AUDIO+1),'audio/wav')]:
    with self.assertRaises(HTTPException):voice.transcribe_audio(data,mime)
   provider.assert_not_called()

 def test_romanized_hindi_is_detected_and_numbers_preserved(self):
  client=self.client(NS(output_text='MCH-001 ka temperature 40 hai'))
  import json
  client.models.generate_content.return_value=NS(text=json.dumps({'text':'MCH-001 का तापमान 40 है','language':'hi'}))
  with patch.object(voice,'_client',return_value=client):
   self.assertEqual(voice.transcribe_audio(b'audio','audio/webm')['language'],'hi')
  self.assertFalse(client.interactions.create.call_args.kwargs['store'])
  client.models.generate_content.return_value=NS(text=json.dumps({'text':'MCH-002 का तापमान 40 है','language':'hi'}))
  with patch.object(voice,'_client',return_value=client),self.assertRaises(HTTPException):
   voice.transcribe_audio(b'audio','audio/webm')

 def test_tts_verbatim_citation_removal_and_invalid_audio_fallback(self):
  response=NS(candidates=[NS(content=NS(parts=[NS(inline_data=NS(data=b'RIFF'+b'\0'*12))]))])
  client=self.client(response)
  with patch.object(voice,'_client',return_value=client):
   result=voice.spoken_audio('Temperature is 40 degrees [T1].','en')
   self.assertEqual(result['status'],'ready')
   call=client.models.generate_content.call_args.kwargs
   self.assertNotIn('[T1]',call['contents'][0].parts[0].text)
  with patch.object(voice,'_client',side_effect=RuntimeError('private provider detail')):
   self.assertEqual(voice.spoken_audio('Hello','en')['status'],'unavailable')

 def test_typed_questions_never_generate_audio_and_voice_uses_detected_language(self):
  _,routes,fleet=self.endpoints()
  user={'id':1,'role':'Operator'}
  with patch('api_server.operational_insights.generate_selected_analysis',return_value={'generated_analysis':'నమస్కారం!','provider_status':'responded'}),patch('api_server.operational_insights.spoken_audio',return_value={'status':'ready'}) as speak:
   typed=routes['/api/v1/intelligence/query'](FactoryQuestion(question='hello'),user=user)
   self.assertNotIn('audio',typed);speak.assert_not_called()
   result=routes['/api/v1/intelligence/voice-answer'](VoiceQuestion(question='మీరు ఎలా సహాయపడతారు?',response_language='te'),user=user)
   self.assertEqual(result['answer'],'నమస్కారం!');self.assertTrue(result['voice_input'])
   speak.assert_called_once_with('నమస్కారం!','te')
  fleet.assert_not_called()

 def test_voice_preserves_operator_scope_before_tts(self):
  _,routes,fleet=self.endpoints()
  with patch('api_server.operational_insights.check_machine'),patch('api_server.operational_insights.spoken_audio') as speak:
   with self.assertRaises(HTTPException) as error:
    routes['/api/v1/intelligence/voice-answer'](VoiceQuestion(question='MCH-002 machine temperature',response_language='en'),user={'id':1,'role':'Operator','assigned_machine':'CNC-OWN'})
   self.assertEqual(error.exception.status_code,403);speak.assert_not_called();fleet.assert_not_called()

 def test_device_voice_skips_cloud_speech_but_preserves_answer_and_scope(self):
  _,routes,_=self.endpoints()
  with patch('api_server.operational_insights.generate_selected_analysis',return_value={'generated_analysis':'Hello there.','provider_status':'responded'}),patch('api_server.operational_insights.spoken_audio') as speak:
   result=routes['/api/v1/intelligence/voice-answer'](VoiceQuestion(question='How are you today?',response_language='en',include_audio=False),user={'id':1,'role':'Operator'})
   self.assertEqual(result['spoken_text'],'Hello there.')
   self.assertEqual(result['audio']['status'],'device');speak.assert_not_called()
  with patch('api_server.operational_insights.check_machine'),patch('api_server.operational_insights.spoken_audio') as speak:
   with self.assertRaises(HTTPException) as error:
    routes['/api/v1/intelligence/voice-answer'](VoiceQuestion(question='MCH-002 machine temperature',response_language='en',include_audio=False),user={'id':1,'role':'Operator','assigned_machine':'CNC-OWN'})
   self.assertEqual(error.exception.status_code,403);speak.assert_not_called()

 def test_exact_greetings_are_local_but_machine_questions_never_use_shortcut(self):
  _,routes,fleet=self.endpoints()
  with patch('api_server.operational_insights.generate_selected_analysis') as generate,patch('api_server.operational_insights.spoken_audio') as speak:
   for question,language in [('Hello','en'),('నమస్కారం','te'),('नमस्ते','hi')]:
    result=routes['/api/v1/intelligence/voice-answer'](VoiceQuestion(question=question,response_language=language,include_audio=False),user={'id':1,'role':'Operator'})
    self.assertEqual(result['provider_status'],'local_conversation')
    self.assertTrue(voice.language_matches(result['answer'],language))
   generate.assert_not_called();speak.assert_not_called();fleet.assert_not_called()
  self.assertIsNone(voice.quick_voice_greeting('Hello, show MCH-002 temperature','en'))

 def test_authentication_and_upload_bound(self):
  def denied():raise HTTPException(401,'Sign in required')
  app,_,_=self.endpoints(denied)
  with TestClient(app) as client,patch.object(voice,'transcribe_audio') as provider:
   self.assertEqual(client.post('/api/v1/intelligence/transcribe',content=b'a',headers={'Content-Type':'audio/webm'}).status_code,401)
   self.assertEqual(client.post('/api/v1/intelligence/voice-answer',json={'question':'Hello','response_language':'en'}).status_code,401)
   provider.assert_not_called()
  app,_,_=self.endpoints()
  with TestClient(app) as client,patch.object(voice,'transcribe_audio') as provider:
   self.assertEqual(client.post('/api/v1/intelligence/transcribe',content=b'x'*(voice.MAX_AUDIO+1),headers={'Content-Type':'audio/webm'}).status_code,413)
   provider.assert_not_called()

 def test_rate_limit_and_native_script_checks(self):
  for _ in range(12):voice.limit_voice({'id':1})
  with self.assertRaises(HTTPException):voice.limit_voice({'id':1})
  voice.limit_voice({'id':2})
  self.assertTrue(voice.language_matches('నమస్కారం','te'))
  self.assertTrue(voice.language_matches('नमस्ते','hi'))
  self.assertFalse(voice.language_matches('Hello','te'))


if __name__=='__main__':unittest.main()
