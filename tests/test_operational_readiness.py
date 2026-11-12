import datetime as dt
import unittest
import sqlite3,tempfile
from contextlib import closing
from pathlib import Path
from fastapi import HTTPException
from api_server.team_access import machine_codes,check_machine,sql_scope
from api_server.shift_tracking import shift_window,counter_output
from api_server.storage_management import summarize,reading_fingerprint,Policy,prune_sender
from api_server.fault_automation import SustainedAlerts

UTC=dt.timezone.utc

class TeamAccessTests(unittest.TestCase):
    def test_supervisor_gets_only_configured_four(self):
        user={'role':'Supervisor','work_id':'SUP-A01','department':'Plant A / Team A01'}
        self.assertEqual(len(machine_codes(user)),4)
        check_machine(user,'CNC-5AX-001')
        with self.assertRaises(HTTPException):check_machine(user,'CNC-VMC-001')
    def test_unallocated_or_changed_department_fail_closed(self):
        for badge,dept in [('SUP-001','Old team'),('SUP-A01','Plant B / Team B01')]:
            self.assertEqual(machine_codes({'role':'Supervisor','work_id':badge,'department':dept}),set())
    def test_sql_filter_uses_parameters(self):
        params={};where=sql_scope({'role':'Operator','assigned_machine':'CNC-5AX-001'},'machine_code',params)
        self.assertIn(':scope_0',where);self.assertNotIn('CNC-',where)
        self.assertEqual(params,{'scope_0':'CNC-5AX-001'})

class ShiftTests(unittest.TestCase):
    def test_factory_timezone_day_night_boundaries(self):
        before=dt.datetime(2026,11,2,0,29,tzinfo=UTC) # 05:59 local
        start,end,name=shift_window(before)
        self.assertEqual(name,'Shift B');self.assertEqual(start.day,1)
        start,end,name=shift_window(before+dt.timedelta(minutes=1))
        self.assertEqual(name,'Shift A');self.assertEqual(start.hour,6)
        self.assertEqual((end-start).total_seconds(),43200)
    def test_reset_counts_only_new_parts(self):
        result=counter_output([{'value':102},{'value':104},{'value':1},{'value':3}],100)
        self.assertEqual(result,{'parts':7,'counter_resets':1})
    def test_no_baseline_does_not_count_prior_shift(self):
        self.assertEqual(counter_output([{'value':100},{'value':102}])['parts'],2)
    def test_bad_samples_do_not_create_output(self):
        self.assertEqual(counter_output([{'value':105},{'value':999,'quality':'NOISY'},{'value':108},{'value':109}],100)['parts'],6)

class StorageTests(unittest.TestCase):
    def row(self,value,quality='GOOD'):
        return {'machine_id':'MCH-001','machine_code':'CNC-5AX-001','machine_type':'CNC','department':'A','production_line':'1',
                'sensor_name':'RPM','sensor_unit':'RPM','reading_timestamp':dt.datetime(2026,11,1,1,15),
                'sensor_value_json':str(value),'data_quality':quality,'expected_min':1000,'expected_max':5000,'machine_status':'NORMAL','fault_mode':None}
    def test_rollup_does_not_average_bad_quality(self):
        group=next(iter(summarize([self.row(2000),self.row(3000),self.row(9999,'NOISY'),self.row('null')]).values()))
        self.assertEqual(group,{'count':4,'numeric':2,'sum':5000.,'min':2000,'max':3000})
    def test_fingerprint_supports_sql_timestamp_and_number_formats(self):
        a=self.row(2400);b={**a,'reading_timestamp':'2026-11-01 01:15:00','sensor_value_json':'2400.0'}
        self.assertEqual(reading_fingerprint(a),reading_fingerprint(b))
        self.assertNotEqual(reading_fingerprint(a),reading_fingerprint({**a,'sensor_value_json':'2500'}))
    def test_cleanup_default_is_disabled_and_minimum_retention(self):
        self.assertFalse(Policy().enabled)
        with self.assertRaises(ValueError):Policy(raw_days=0)

class SenderRetentionTests(unittest.TestCase):
    def test_delivered_confirmed_old_only_and_latest_pending_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'sender.db'
            with closing(sqlite3.connect(path)) as c:
                c.executescript('CREATE TABLE machine_telemetry(id INTEGER PRIMARY KEY,reading_id TEXT,machine_id TEXT,sensor_name TEXT,timestamp TEXT); CREATE TABLE telemetry_delivery(reading_id TEXT,status TEXT);')
                samples=[(1,'confirmed','M1','RPM','2026-01-01'),(2,'not-in-mysql','M1','RPM','2026-01-01'),(3,'pending','M1','RPM','2026-01-01'),(4,'failed','M1','RPM','2026-01-01'),(5,'latest','M1','RPM','2026-02-01')]
                c.executemany('INSERT INTO machine_telemetry VALUES(?,?,?,?,?)',samples)
                c.executemany('INSERT INTO telemetry_delivery VALUES(?,?)',[(r[1],'PENDING' if r[1]=='pending' else 'FAILED' if r[1]=='failed' else 'DELIVERED') for r in samples])
                c.commit()
            self.assertEqual(prune_sender(path,lambda ids:{'confirmed','pending','failed','latest'},'2026-03-01'),1)
            with closing(sqlite3.connect(path)) as c:
                self.assertEqual({r[0] for r in c.execute('SELECT reading_id FROM machine_telemetry')},{'not-in-mysql','pending','failed','latest'})
                self.assertEqual(c.execute('SELECT COUNT(*) FROM telemetry_delivery').fetchone()[0],4)

class SustainedFaultTests(unittest.TestCase):
    def row(self,at,value=90,quality='GOOD'):
        return {'machine_id':'MCH-001','sensor_name':'Temperature','sensor_unit':'\u00b0C','timestamp':at.isoformat(),'sensor_value':value,'data_quality':quality,'expected_min':25,'expected_max':70}
    def test_one_poll_is_not_three_samples(self):
        t=dt.datetime.now(UTC);tracker=SustainedAlerts();r=self.row(t)
        for _ in range(5):self.assertEqual(tracker.observe([r],t),[])
        self.assertEqual(tracker.observe([self.row(t+dt.timedelta(seconds=15))],t+dt.timedelta(seconds=15)),[])
        self.assertEqual(len(tracker.observe([self.row(t+dt.timedelta(seconds=30))],t+dt.timedelta(seconds=30))),1)
    def test_noise_stale_and_recovery_reset(self):
        t=dt.datetime.now(UTC);tracker=SustainedAlerts();tracker.observe([self.row(t)],t)
        tracker.observe([self.row(t+dt.timedelta(seconds=15),quality='NOISY')],t+dt.timedelta(seconds=15))
        self.assertFalse(tracker.states)
        tracker.observe([self.row(t)],t+dt.timedelta(seconds=45));self.assertFalse(tracker.states)
        tracker.observe([self.row(t,value=50)],t);self.assertFalse(tracker.states)

if __name__=='__main__':unittest.main()
