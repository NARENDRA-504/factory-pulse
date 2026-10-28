import unittest
from datetime import datetime, timedelta, timezone
from api_server.live_analytics import summarize_downtime


class RecordedDowntimeTests(unittest.TestCase):
    def setUp(self):
        self.start=datetime(2026,10,28,tzinfo=timezone.utc)

    def summary(self, points, end, since=0, rounds=30):
        return summarize_downtime([(self.start+timedelta(seconds=t),state) for t,state in points],
            self.start+timedelta(seconds=since),self.start+timedelta(seconds=end),rounds,30)

    def test_window_clips_recorded_stop_and_does_not_double_count_sensor_timestamps(self):
        result=self.summary([(0,True),(0,True),(10,True),(20,False)],30,since=5)
        self.assertEqual(result['total_seconds'],15)
        self.assertEqual(len(result['intervals']),1)

    def test_connection_loss_is_unknown_and_does_not_extend_downtime(self):
        result=self.summary([(0,True),(10,True),(100,False)],120)
        self.assertEqual(result['total_seconds'],10)
        self.assertEqual(result['current_downtime_seconds'],0)

    def test_confirmed_ongoing_stop_updates_until_current_time(self):
        result=self.summary([(0,False),(5,True),(15,True)],25)
        self.assertEqual(result['total_seconds'],20)
        self.assertEqual(result['current_downtime_seconds'],20)

    def test_round_boundaries_allocate_exact_overlap(self):
        result=self.summary([(50,True),(60,True),(70,False)],80,rounds=1)
        self.assertEqual(result['total_seconds'],20)
        self.assertEqual([row['downtime_seconds'] for row in result['rounds']],[10,10])

    def test_out_of_order_records_have_same_result(self):
        result=self.summary([(20,False),(10,True),(0,True)],30)
        self.assertEqual(result['total_seconds'],20)

    def test_missing_or_normal_history_never_fabricates_stops(self):
        self.assertEqual(self.summary([],30)['total_seconds'],0)
        self.assertEqual(self.summary([(0,False),(20,False)],30)['total_seconds'],0)


if __name__=='__main__': unittest.main()
