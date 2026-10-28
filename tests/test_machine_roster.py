import json,unittest
from pathlib import Path
from api_server.machine_roster import available_master
ROOT=Path(__file__).resolve().parents[1]
class AvailableRosterTests(unittest.TestCase):
 def test_exactly40_stable_matching_catalog_ids(self):
  records=json.loads((ROOT/'public/machine-name.json').read_text(encoding='utf-8'))
  self.assertEqual(len(records),400)
  master={m['machineId']:m for m in records};available=available_master(master)
  self.assertEqual(len(available),40)
  self.assertTrue({'MCH-001','MCH-101','MCH-201','MCH-301'}.issubset(available))
  self.assertEqual(len({m['machineCode'] for m in available.values()}),40)
  self.assertEqual(len({m['plant'] for m in available.values()}),4)
  self.assertEqual(len({m['machineType'] for m in available.values()}),7)
 def test_unknown_identity_is_rejected(self):
  with self.assertRaises(RuntimeError):available_master({})
