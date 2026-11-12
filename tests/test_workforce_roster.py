import unittest
from api_server.workforce_roster import build_hierarchy

class WorkforceTests(unittest.TestCase):
    def setUp(self):
        self.plan={'shift':'Shift A','maximum_machines_per_supervisor':4,'teams':[{'team_id':'A01','plant':'Plant A','department':'Plant A / Team A01','supervisor_work_id':'SUP-A01','machines':[{'machine_id':'MCH-001','machine_code':'CNC-001'}],'primary_operators':{'CNC-001':'OP-001'}}]}
        self.users=[{'work_id':'SUP-A01','full_name':'Supervisor','role':'Supervisor','department':'Plant A / Team A01','is_active':1}, {'work_id':'OP-001','full_name':'Operator','role':'Operator','department':'Plant A / Team A01','assigned_machine':'CNC-001','is_active':1}, {'work_id':'ALT-001','full_name':'Alternate','role':'Operator','department':'Plant A / Team A01','assigned_machine':'CNC-001','is_active':1}]
    def test_count_primary_and_alternate_once(self):
        result=build_hierarchy(self.plan,self.users)
        self.assertEqual((result['machine_count'],result['supervisor_count'],result['primary_operator_count'],result['operator_count']),(1,1,1,2))
        self.assertTrue(result['plants'][0]['teams'][0]['machines'][0]['operators'][0]['primary'])
    def test_inactive_moved_or_missing_accounts_are_not_claimed_assigned(self):
        self.users[0]['is_active']=0;self.users[1]['assigned_machine']='CNC-OTHER';self.users[2]['department']='Other team'
        result=build_hierarchy(self.plan,self.users)
        self.assertEqual(result['supervisor_count'],0);self.assertEqual(result['operator_count'],0);self.assertEqual(len(result['unallocated_existing_users']),2)

if __name__=='__main__':unittest.main()
