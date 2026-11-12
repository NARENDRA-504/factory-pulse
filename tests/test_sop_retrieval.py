import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch,MagicMock
from fastapi import FastAPI,HTTPException
from api_server.sop_retrieval import retrieve_sop
from api_server.sop_guidance import register
from api_server.operational_insights import FactoryQuestion,register as register_chat

NOW=dt.datetime(2026,11,11,10,tzinfo=dt.timezone.utc)
class SopRetrievalTests(unittest.TestCase):
    def test_role_steps_and_specific_document(self):
        result=retrieve_sop('temperature SOP','Operator','MCH-001',now=NOW)
        self.assertEqual(result['status'],'training_only')
        self.assertEqual(result['sources'][0]['document_id'],'FP-TEMP-001')
        self.assertIn('safe-stop',result['sources'][0]['excerpt'])
        self.assertNotIn('Close the incident',result['sources'][0]['excerpt'])
        self.assertFalse(result['notifications_sent'])

    def test_no_reading_or_stale_reading_is_not_normal(self):
        fact={'machine_id':'MCH-001','sensor_name':'Temperature','sensor_value':70.,'data_quality':'GOOD',
              'machine_status':'CRITICAL','timestamp':(NOW-dt.timedelta(seconds=31)).isoformat()}
        self.assertEqual(retrieve_sop('temperature','Operator','MCH-001',[fact],NOW)['level'],'Unavailable')
        fact['timestamp']=NOW.isoformat()
        self.assertEqual(retrieve_sop('temperature','Operator','MCH-001',[fact],NOW)['level'],'Critical')
        fact['machine_status']='WARNING'
        self.assertEqual(retrieve_sop('temperature','Operator','MCH-001',[fact],NOW)['level'],'Suspect')
        fact['machine_id']='MCH-002'
        self.assertEqual(retrieve_sop('temperature','Operator','MCH-001',[fact],NOW)['level'],'Unavailable')

    def test_approved_document_requires_identity_dates_and_role(self):
        document={'id':'APPROVED-TEMP','title':'Approved temperature response','revision':'1',
            'category':'temperature','keywords':['temperature'],'status':'approved','machine_ids':['MCH-001'],
            'approved_by':'Test fixture owner','manual_reference':'Test fixture manual',
            'effective_date':'2026-01-01','review_due':'2026-12-31','scope_notice':'Test fixture only.',
            'roles':{'Maintenance':['Fixture maintenance instruction.']}}
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'catalog.json'
            def retrieve(role='Maintenance',mid='MCH-001'):
                path.write_text(json.dumps({'documents':[document]}))
                with patch('api_server.sop_retrieval.CATALOG',path):
                    return retrieve_sop('temperature',role,mid,now=NOW)
            self.assertEqual(retrieve()['status'],'approved')
            self.assertEqual(retrieve('Operator')['status'],'missing')
            self.assertEqual(retrieve(mid='MCH-002')['status'],'missing')
            document['review_due']='2026-01-02'
            self.assertEqual(retrieve()['status'],'missing')
            document['review_due']='2026-12-31';document['approved_by']=None
            self.assertEqual(retrieve()['status'],'missing')

    def test_unavailable_catalog_has_explicit_fallback(self):
        with patch('api_server.sop_retrieval.CATALOG',Path('/does-not-exist/catalog.json')):
            self.assertEqual(retrieve_sop('temperature','Operator')['status'],'unavailable')

    def test_machine_authorization_precedes_fleet_read(self):
        app=FastAPI();fleet=MagicMock()
        register(app,{'get_current_user':lambda:None,'resolve_canonical_machine':lambda mid:{'machineCode':'OTHER'},
            'get_simulator_fleet_latest_readings':fleet})
        route=next(r.endpoint for r in app.routes if r.path=='/api/v1/guidance/sop')
        with self.assertRaises(HTTPException) as raised:
            route(module='machines',machine_id='MCH-002',question='temperature',user={'role':'Operator','assigned_machine':'OWN'})
        self.assertEqual(raised.exception.status_code,403);fleet.assert_not_called()

    def test_sop_chat_uses_retrieval_without_generative_rewrite(self):
        app=FastAPI();current=lambda:None
        register_chat(app,{'get_current_user':current,'_sql_text':lambda s:s,'get_telemetry_engine':MagicMock(),
            'get_simulator_fleet_latest_readings':lambda user:[], 'require_roles':lambda roles:current,
            '_utcnow':lambda:NOW,'resolve_canonical_machine':lambda mid:{'machineCode':'CNC-001'}})
        route=next(r.endpoint for r in app.routes if r.path=='/api/v1/intelligence/query')
        with patch('api_server.operational_insights.generate_selected_analysis') as generate:
            result=route(FactoryQuestion(question='Show temperature SOP',machine_id='MCH-001',use_ai=True),user={'role':'Operator','assigned_machine':'CNC-001'})
            self.assertEqual(result['procedure']['status'],'training_only')
            self.assertIn('FP-TEMP-001',result['answer']);generate.assert_not_called()

if __name__=='__main__':unittest.main()
