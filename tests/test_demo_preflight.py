import unittest
from scripts.check_presentation import telemetry_state

class DemoPreflightTests(unittest.TestCase):
 def test_intentionally_stopped_sender_is_idle_not_failure(self):
  self.assertEqual(telemetry_state(0,True,False,False),'READY_IDLE')
 def test_fresh_advancing_sender_is_live(self):
  self.assertEqual(telemetry_state(2,False,True,True),'LIVE')
 def test_running_without_confirmed_delivery_is_not_live(self):
  self.assertEqual(telemetry_state(2,False,False,False),'WAITING_FOR_DELIVERY')
  self.assertEqual(telemetry_state(2,True,True,True),'DELIVERY_PAUSED')
 def test_unknown_connection_is_not_idle(self):
  self.assertEqual(telemetry_state(None,None,False,False),'UNKNOWN')
