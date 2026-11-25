import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from scripts.verify_mysql_restore import verify_dump


class BackupVerificationTests(unittest.TestCase):
    def fixture(self, folder, name='backup.sql', schema='ziro_manufacturing'):
        path = Path(folder) / name
        payload = b'CREATE TABLE example (id INT);\n'
        path.write_bytes(payload)
        Path(str(path) + '.manifest.json').write_text(json.dumps({
            'database': schema, 'bytes': len(payload),
            'sha256': hashlib.sha256(payload).hexdigest()}))
        return path

    def test_modified_dump_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.fixture(folder)
            path.write_bytes(b'changed dump')
            with self.assertRaisesRegex(ValueError, 'mismatch'):
                verify_dump(path)

    def test_partial_backup_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.fixture(folder, 'backup.sql.partial')
            with self.assertRaisesRegex(ValueError, 'completed'):
                verify_dump(path)

    def test_manifest_schema_cannot_inject_sql(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.fixture(folder, schema='db`; DROP DATABASE live;')
            with self.assertRaisesRegex(ValueError, 'database name'):
                verify_dump(path)

    def test_valid_completed_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.fixture(folder)
            self.assertEqual(verify_dump(path)[1], 'ziro_manufacturing')
