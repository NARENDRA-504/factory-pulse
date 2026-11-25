from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from dotenv import dotenv_values
from scripts import prepare_local_staging as staging


class StagingConfigurationTests(unittest.TestCase):
    def test_preserves_source_and_separates_delivery_and_control(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = 'DATABASE_URL=mysql+pymysql://test_user:test_password@127.0.0.1/ziro_manufacturing\nGEMINI_API_KEY=test-do-not-copy\n'
            (root / '.env').write_text(source)
            with patch.object(staging, 'ROOT', root):
                staging.main()
                with self.assertRaisesRegex(SystemExit, 'already exist'):
                    staging.main()
            self.assertEqual((root / '.env').read_text(), source)
            api = dotenv_values(root / '.local/staging/api.env')
            sim = dotenv_values(root / '.local/staging/simulator.env')
            web = dotenv_values(root / '.local/staging/simulator-web.env')
            self.assertIn('@host.docker.internal/', api['DATABASE_URL'])
            self.assertNotIn('GEMINI_API_KEY', api)
            self.assertEqual(api['SIMULATOR_API_KEY'], sim['TELEMETRY_API_KEY'])
            self.assertEqual(sim['SIMULATOR_API_KEY'], web['SIMULATOR_API_KEY'])
            self.assertNotEqual(sim['SIMULATOR_API_KEY'], sim['TELEMETRY_API_KEY'])

    def test_non_mysql_source_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.env').write_text('DATABASE_URL=sqlite:///test.db\n')
            with patch.object(staging, 'ROOT', root), self.assertRaisesRegex(SystemExit, 'MySQL'):
                staging.main()
            self.assertFalse((root / '.local/staging/api.env').exists())
