import unittest
from fastapi import FastAPI, HTTPException
from api_server.sop_guidance import ALLOWED, guidance, register
from api_server.rag import retrieve_context

class SopGuidanceTests(unittest.TestCase):
    def test_every_role_module_has_steps_and_training_notice(self):
        for role, modules in ALLOWED.items():
            for module in modules:
                with self.subTest(role=role,module=module):
                    result=guidance(role,module)
                    self.assertEqual(result['approval_status'],'training_pending_site_approval')
                    self.assertTrue(all(len(s['steps'])==3 for s in result['sections']))

    def test_operator_cannot_load_admin_module(self):
        with self.assertRaises(HTTPException) as raised: guidance('Operator','users')
        self.assertEqual(raised.exception.status_code,403)

    def test_endpoint_requires_auth_and_uses_server_role(self):
        app=FastAPI()
        def current(): raise HTTPException(401,'Sign in required')
        register(app,{'get_current_user':current})
        route=next(r for r in app.routes if getattr(r,'path',None)=='/api/v1/guidance/sop')
        self.assertIs(route.dependant.dependencies[0].call,current)
        with self.assertRaises(HTTPException) as auth: current()
        self.assertEqual(auth.exception.status_code,401)
        with self.assertRaises(HTTPException) as denied:
            route.endpoint(module='users',user={'role':'Operator'})
        self.assertEqual(denied.exception.status_code,403)
        result=route.endpoint(module='machines',user={'role':'Operator'})
        self.assertEqual(result['role'],'Operator')

    def test_sop_is_available_to_retrieval(self):
        result=retrieve_context('SOP Operator assigned machine safety procedure',[])
        self.assertTrue(any(s['source']=='knowledge/assistant/sop.md' for s in result['sources']))

if __name__=='__main__':unittest.main()
