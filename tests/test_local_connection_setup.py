from pathlib import Path

import unittest
import tempfile
from dotenv import dotenv_values

from scripts.connect_local_apps import configure, simulator_root


def projects(tmp_path):
    main, sim = tmp_path / 'FactoryPulse', tmp_path / 'My Simulator'
    main.mkdir()
    (sim / 'backend/app').mkdir(parents=True)
    (sim / 'frontend').mkdir()
    (sim / 'backend/app/main.py').write_text('')
    (sim / 'frontend/package.json').write_text('{}')
    return main, sim


class LocalConnectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.tmp_path = Path(self.temp.name)

    def test_setup_preserves_private_settings_and_connects_keys(self):
        tmp_path = self.tmp_path
        main, sim = projects(tmp_path)
        key = 'existing-receiver-' + 'x' * 32
        (main / '.env').write_text(f'# keep comment\nDATABASE_URL=mysql+pymysql://private\nGEMINI_API_KEY=private-gemini\nSIMULATOR_API_KEY={key}\n')
        (sim / 'backend/.env').write_text('SIMULATOR_API_KEY=separate-incoming-key\nTELEMETRY_API_KEY=old\nOTHER=keep\n')
        result = configure(main, sim, True)
        a, b = dotenv_values(main / '.env'), dotenv_values(sim / 'backend/.env')
        assert result['receiver_key_preserved']
        assert a['SIMULATOR_API_KEY'] == b['TELEMETRY_API_KEY'] == key
        assert a['DATABASE_URL'] == 'mysql+pymysql://private'
        assert a['GEMINI_API_KEY'] == 'private-gemini'
        assert b['SIMULATOR_API_KEY'] == 'separate-incoming-key'
        assert b['OTHER'] == 'keep'
        assert b['TELEMETRY_AUTH_HEADER'] == 'X-Simulator-API-Key'
        assert Path(b['DATABASE_PATH']).parent.is_dir()
        assert simulator_root(main) == sim
        before = (main / '.env').read_bytes(), (sim / 'backend/.env').read_bytes()
        configure(main, sim, True)
        assert before == ((main / '.env').read_bytes(), (sim / 'backend/.env').read_bytes())


    def test_preview_does_not_create_files_or_directories(self):
        tmp_path = self.tmp_path
        main, sim = projects(tmp_path)
        configure(main, sim)
        assert not (main / '.env').exists()
        assert not (sim / 'backend/.env').exists()
        assert not (sim / 'data').exists()


    def test_duplicate_setting_rejects_before_either_file_changes(self):
        tmp_path = self.tmp_path
        main, sim = projects(tmp_path)
        (sim / 'backend/.env').write_text('TELEMETRY_API_KEY=a\nTELEMETRY_API_KEY=b\n')
        with self.assertRaises(ValueError):
            configure(main, sim, True)
        assert not (main / '.env').exists()


    def test_nested_projects_and_existing_weak_key_rejected(self):
        tmp_path = self.tmp_path
        main, sim = projects(tmp_path)
        with self.assertRaises(ValueError):
            configure(main, main / 'AI Simulator', True)
        (main / '.env').write_text('SIMULATOR_API_KEY=short-existing-secret\n')
        with self.assertRaises(ValueError):
            configure(main, sim, True)
        assert not (sim / 'backend/.env').exists()
