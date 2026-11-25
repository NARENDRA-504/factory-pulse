import unittest
import tempfile
from pathlib import Path
from sqlalchemy import create_engine, text
from api_server.deployment import validate_hosted_environment, database_ready, assets_ready


class DeploymentTests(unittest.TestCase):
    def test_packaged_roster_team_and_sop_assets(self):
        self.assertTrue(assets_ready(Path(__file__).resolve().parents[1]))

    def test_missing_assets_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertFalse(assets_ready(Path(folder)))

    def test_local_configuration_unchanged(self):
        validate_hosted_environment({})

    def test_hosted_rejects_missing_or_demo_configuration(self):
        with self.assertRaises(RuntimeError):
            validate_hosted_environment({'DEPLOYMENT_MODE': 'hosted'})

    def test_real_hosted_config_accepted(self):
        env = {'DEPLOYMENT_MODE': 'hosted', 'APP_ENV': 'production', 'DEMO_AUTH_ENABLED': 'false',
               'DATABASE_URL': 'mysql+pymysql://app:password@db/factory',
               'SIMULATOR_API_KEY': 'a' * 43, 'CORS_ORIGINS': 'https://factory.example.com'}
        validate_hosted_environment(env)
        for origin in ('*', 'http://localhost:3000', 'https://factory.example.com/path'):
            with self.subTest(origin=origin), self.assertRaises(RuntimeError):
                validate_hosted_environment({**env, 'CORS_ORIGINS': origin})

    def test_ready_checks_required_tables_without_writes(self):
        engine = create_engine('sqlite://')
        self.assertFalse(database_ready(lambda: engine))
        with engine.begin() as connection:
            for table in ('users', 'auth_sessions', 'activity_log', 'machines', 'incidents',
                          'maintenance_work_orders', 'simulator_sensor_readings', 'simulator_sensor_latest'):
                connection.execute(text(f'CREATE TABLE {table} (id INTEGER)'))
        self.assertTrue(database_ready(lambda: engine))

    def test_optional_gateway_domain_must_match_frontend(self):
        env = {'DEPLOYMENT_MODE': 'hosted', 'APP_ENV': 'production', 'DEMO_AUTH_ENABLED': 'false',
               'DATABASE_URL': 'mysql+pymysql://app:password@db/factory',
               'SIMULATOR_API_KEY': 'a' * 43, 'CORS_ORIGINS': 'https://factory.example.com'}
        validate_hosted_environment({**env, 'FACTORYPULSE_DOMAIN': 'factory.example.com'})
        for domain in ('https://factory.example.com', 'other.example.com', 'factory.example.com/path',
                       'factory.example.com\n{', '-factory.example.com'):
            with self.subTest(domain=domain), self.assertRaises(RuntimeError):
                validate_hosted_environment({**env, 'FACTORYPULSE_DOMAIN': domain})

    def test_unavailable_database_is_redacted(self):
        def fail():
            raise RuntimeError('private-secret')
        self.assertFalse(database_ready(fail))
