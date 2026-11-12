import unittest
from pydantic import ValidationError
from api_server.sql_incidents import Closure

class ClosureNotesTests(unittest.TestCase):
    def test_requires_actual_repair_notes(self):
        for text in ('', '  ', '   ', ' x '):
            with self.assertRaises(ValidationError):
                Closure(closure_notes=text)

    def test_normalizes_notes_and_limits_size(self):
        self.assertEqual(Closure(closure_notes='  Repaired and verified  ').closure_notes, 'Repaired and verified')
        with self.assertRaises(ValidationError):
            Closure(closure_notes='x' * 8001)
