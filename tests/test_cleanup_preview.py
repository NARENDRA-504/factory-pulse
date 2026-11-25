import datetime as dt
import unittest
from sqlalchemy import create_engine,text,event
from api_server.storage_management import preview_compaction,Policy

class CleanupPreviewTests(unittest.TestCase):
 def setUp(self):
  self.db=create_engine('sqlite://')
  with self.db.begin() as c:
   c.execute(text('CREATE TABLE simulator_sensor_latest(machine_id TEXT,sensor_name TEXT,reading_row_id INT)'))
   c.execute(text('CREATE TABLE simulator_sensor_readings(id INT,machine_id TEXT,sensor_name TEXT,reading_timestamp DATETIME)'))
   c.execute(text("INSERT INTO simulator_sensor_latest VALUES('M1','RPM',151)"))
   c.execute(text("INSERT INTO simulator_sensor_readings VALUES(:id,'M1','RPM','2026-01-01 00:00:00')"),[{'id':i} for i in range(1,152)])
  self.statements=[]
  def observe(conn,cursor,statement,parameters,context,executemany):
   self.assertTrue(statement.lstrip().upper().startswith('SELECT'),statement)
   self.statements.append(statement)
  event.listen(self.db,'before_cursor_execute',observe)
 def tearDown(self):self.db.dispose()
 def test_preview_is_read_only_and_bounded_even_when_policy_disabled(self):
  r=preview_compaction(self.db,text,Policy(batch_size=50),dt.datetime(2026,11,22,tzinfo=dt.timezone.utc))
  self.assertEqual(r['candidate_rows'],50);self.assertTrue(r['more_candidates_in_sample'])
  self.assertEqual(r['deletes_performed'],0);self.assertFalse(r['policy_enabled'])
  self.assertEqual(r['streams_checked'],1)
  with self.db.connect() as c:self.assertEqual(c.execute(text('SELECT COUNT(*) FROM simulator_sensor_readings')).scalar(),151)
 def test_latest_pointer_is_excluded_and_recent_rows_not_candidates(self):
  # A cutoff before the data produces no candidates.
  r=preview_compaction(self.db,text,Policy(),dt.datetime(2026,1,2,tzinfo=dt.timezone.utc))
  self.assertEqual(r['candidate_rows'],0)
  r=preview_compaction(self.db,text,Policy(batch_size=500),dt.datetime(2026,11,22,tzinfo=dt.timezone.utc))
  self.assertEqual(r['candidate_rows'],150) # old latest pointer (151) protected
  self.assertFalse(r['more_candidates_in_sample'])
