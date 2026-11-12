import datetime as dt
import unittest
from api_server.usage_tracking import advance,usage_summary
from api_server.machine_operations import Settings

class UsageTests(unittest.TestCase):
 def row(self,value,at,quality='GOOD',sensor='Model Run Time'):
  return {'sensor_name':sensor,'sensor_value':value,'timestamp':at.isoformat(),'data_quality':quality}
 def test_baseline_duplicate_reset_and_restart(self):
  t=dt.datetime.now(dt.timezone.utc);s=advance({},[self.row(100,t)],t)
  self.assertEqual(s['streams']['run_seconds']['total'],0)
  s=advance(s,[self.row(100,t)],t);self.assertEqual(s['streams']['run_seconds']['total'],0)
  t+=dt.timedelta(seconds=10);s=advance(s,[self.row(110,t)],t)
  self.assertEqual(s['streams']['run_seconds']['total'],10)
  t+=dt.timedelta(seconds=10);s=advance(s,[self.row(3,t)],t)
  self.assertEqual(s['streams']['run_seconds']['total'],13)
  self.assertEqual(s['streams']['run_seconds']['resets'],1)
 def test_gaps_noise_and_out_of_order_do_not_invent_usage(self):
  t=dt.datetime.now(dt.timezone.utc);s=advance({},[self.row(100,t)],t)
  later=t+dt.timedelta(seconds=90);s=advance(s,[self.row(190,later)],later)
  self.assertEqual(s['streams']['run_seconds']['total'],0)
  self.assertEqual(s['streams']['run_seconds']['gaps'],1)
  s=advance(s,[self.row(150,t+dt.timedelta(seconds=50))],later)
  self.assertEqual(s['streams']['run_seconds']['baseline'],190)
  s=advance(s,[self.row(999,later+dt.timedelta(seconds=1),'NOISY')],later+dt.timedelta(seconds=1))
  s=advance(s,[self.row(200,later+dt.timedelta(seconds=10))],later+dt.timedelta(seconds=10))
  self.assertEqual(s['streams']['run_seconds']['total'],0)
 def test_due_intervals_and_service_baseline(self):
  state={'streams':{k:{'total':v,'timestamp':'2026-11-02T00:00:00+00:00'} for k,v in [('run_seconds',7200),('good_parts',118),('scrap_parts',2)]}}
  settings=Settings(service_interval_hours=2,service_interval_cycles=120)
  self.assertTrue(usage_summary(state,settings)['due'])
  state['service_baseline']={'run_seconds':7200,'cycles':120}
  self.assertFalse(usage_summary(state,settings)['due'])
  self.assertFalse(usage_summary({},settings)['due'])
  self.assertIsNone(usage_summary({'streams':{'run_seconds':{'total':0}}},settings)['checks'][0]['observed'])
 def test_rates_reject_nan_and_unknown_provenance(self):
  for payload in [{'scrap_inr_per_part':float('nan')},{'cost_basis':'market-guaranteed'},{'service_interval_hours':0}]:
   with self.assertRaises(ValueError):Settings(**payload)

if __name__=='__main__':unittest.main()
