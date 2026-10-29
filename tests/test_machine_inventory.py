import datetime as dt
import unittest
from api_server.machine_inventory import build_inventory


class InventoryEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.now=dt.datetime(2026,10,28,tzinfo=dt.timezone.utc)
        self.catalog={'MCH-001':{'machineId':'MCH-001','machineCode':'CNC-5AX-001',
            'displayName':'Catalog machine','model':'Model A','machineType':'5 Axis',
            'productionLine':'Line A','plant':'Plant A','shopFloor':'Floor A'}}

    def reading(self,status='NORMAL',age=0):
        return {'machine_id':'MCH-001','timestamp':(self.now-dt.timedelta(seconds=age)).isoformat(),
                'sensor_name':'RPM','sensor_value':2400,'machine_status':status}

    def test_catalog_is_not_falsely_sql_registered_or_running(self):
        row=build_inventory(self.catalog,[],[],self.now)[0]
        self.assertFalse(row['registered_in_sql'])
        self.assertEqual(row['registry_source'],'REFERENCE_CATALOG')
        self.assertEqual(row['connection_status'],'WAITING')
        self.assertEqual(row['operating_status'],'UNKNOWN')

    def test_recent_warning_is_not_hidden_by_another_normal_sensor(self):
        row=build_inventory(self.catalog,[],[self.reading(),self.reading('CRITICAL')],self.now)[0]
        self.assertEqual(row['connection_status'],'RECEIVING')
        self.assertEqual(row['operating_status'],'CRITICAL')

    def test_idle_snapshot_supersedes_normal_but_not_a_fault(self):
        row=build_inventory(self.catalog,[],[self.reading(),self.reading('IDLE')],self.now)[0]
        self.assertEqual(row['operating_status'],'IDLE')
        faulted=build_inventory(self.catalog,[],[self.reading('IDLE'),self.reading('WARNING')],self.now)[0]
        self.assertEqual(faulted['operating_status'],'WARNING')

    def test_stale_source_does_not_become_a_physical_stop(self):
        row=build_inventory(self.catalog,[],[self.reading('NORMAL',age=90)],self.now)[0]
        self.assertEqual(row['connection_status'],'STALE')
        self.assertEqual(row['operating_status'],'NORMAL')

    def test_unknown_sql_machine_requires_configuration(self):
        saved={'id':41,'machine_code':'NEW-CNC','name':'New machine','model':'Model B','line_id':'Line B'}
        row=build_inventory(self.catalog,[saved],[],self.now)[1]
        self.assertTrue(row['registered_in_sql'])
        self.assertEqual(row['machine_id'],'DB-41')
        self.assertEqual(row['connection_status'],'CONFIGURATION_REQUIRED')

    def test_existing_sql_name_is_preserved_over_catalog_label(self):
        saved={'id':1,'machine_code':'CNC-5AX-001','name':'User edited name','model':'Model B','line_id':'Line B'}
        row=build_inventory(self.catalog,[saved],[],self.now)[0]
        self.assertEqual(row['name'],'User edited name')
        self.assertTrue(row['registered_in_sql'])


if __name__=='__main__': unittest.main()


class RegistrationValidationTests(unittest.TestCase):
    def test_blank_name_rejected(self):
        from api_server.machine_inventory import MachineRegistration
        from fastapi import HTTPException
        with self.assertRaises(HTTPException):
            MachineRegistration(name=' ',model='Model',last_inspection_date=dt.date(2020,1,1)).checked()

    def test_future_inspection_rejected(self):
        from api_server.machine_inventory import MachineRegistration
        from fastapi import HTTPException
        with self.assertRaises(HTTPException):
            MachineRegistration(name='Machine',model='Model',last_inspection_date=dt.date.today()+dt.timedelta(days=2)).checked()

    def test_real_historical_date_accepted(self):
        from api_server.machine_inventory import MachineRegistration
        payload=MachineRegistration(name='Machine',model='Model',last_inspection_date=dt.date(2020,1,1))
        self.assertIs(payload.checked(),payload)
