# Hosted FactoryPulse API and AI Simulator setup

This deploys the FastAPI API as a Railway service and keeps the React website runnable on the local PC. MySQL remains the operational system of record. The AI Simulator sends each reading to the API's public HTTPS URL; database credentials and the simulator key remain server-side.

## 1. Deploy the API and MySQL

1. Push the FactoryPulse repository to GitHub, then create a Railway project from that repository. Railway's official FastAPI guide supports deployment from GitHub and Dockerfile-based builds.
2. Add a MySQL service in the same Railway project. Leave MySQL private; the API connects to it through Railway's private service variables.
3. Configure the API service variables:

   ```text
   APP_ENV=production
   DEMO_AUTH_ENABLED=false
   DATABASE_URL=${{MySQL.MYSQL_URL}}
   SIMULATOR_API_KEY=<generate a long random secret in Railway Variables>
   FACTORY_TIMEZONE=Asia/Kolkata
   CORS_ORIGINS=https://aistudio.google.com,http://127.0.0.1:3000,http://localhost:3000
   ```

   Replace `MySQL` with the exact name of your Railway MySQL service. If you publish the frontend at a separate URL, add that exact origin to `CORS_ORIGINS`. Never set the database URL or simulator key in a `VITE_*` variable.

4. Generate a public HTTPS domain for the **API service only**. Do not expose MySQL publicly for this setup.
5. Before the first production login, apply the schema in order:
   - Fresh database: `scripts/export_mysql_schema.sql`.
   - Existing database only if the sensor table is absent: `scripts/migrations/20261026_create_simulator_sensor_readings.sql`.
   - Authentication and audit tables: `scripts/migrations/20261026_add_auth_sessions_activity_log.sql` (once).

   The base schema already includes `simulator_sensor_readings`; the additive telemetry migration is for databases created before that table was added. Do not run the `ALTER TABLE users` authentication migration more than once.

6. Provision the first Admin after the schema is applied and the API service has deployed. From a trusted PC terminal, use Railway CLI to open a shell command inside the API service:

   ```text
   railway ssh --service <your-api-service-name> -- python /app/scripts/provision_initial_admin.py
   ```

   The command prompts for a unique employee ID, name, email, and a new strong password. It refuses to create a second initial Admin, writes only a PBKDF2 hash, and records the bootstrap in `activity_log`. Do not use the development demo password in production. Keep at least one active Admin. Railway SSH runs the command inside the deployed service, where the private MySQL hostname is reachable; do not expose MySQL publicly just to create this account.

## 2. Point FactoryPulse at the hosted API

In the AI Studio frontend environment, set only:

```text
VITE_API_BASE_URL=https://<your-generated-api-domain>
```

For local React development, create a local `.env.local` containing `VITE_API_BASE_URL=https://<your-generated-api-domain>`. Restart Vite after changing it. Do not put `DATABASE_URL`, `SIMULATOR_API_KEY`, or MySQL credentials in AI Studio frontend variables or client code.

## 3. Configure the AI Simulator backend

In the separate AI Simulator backend environment (not its frontend), set:

```text
TELEMETRY_PUSH_ENABLED=true
TELEMETRY_RECEIVER_URL=https://<your-generated-api-domain>/api/v1/telemetry
TELEMETRY_AUTH_HEADER=X-Simulator-API-Key
TELEMETRY_API_KEY=<the same secret configured as FactoryPulse SIMULATOR_API_KEY>
TELEMETRY_CONNECT_TIMEOUT=3
TELEMETRY_MAX_RETRIES=3
```

The simulator and API can then run independently, while MySQL remains private to Railway. Start the simulator only after the API health endpoint is available, the schema is applied, and a real production Admin account can sign in.

## Local demonstration

The local website still runs at `http://127.0.0.1:3000`; point it to the hosted API using `.env.local`. The local API's development/demo mode is not suitable for ingestion because database access is deliberately disabled there.

## Cost and operational notes

Railway currently bills by plan and resource usage. Its published pricing lists a Free plan with limited included resources and Hobby at a $5 monthly minimum with usage credits; review current plan details before enabling paid services. The default Railway MySQL service is a single node; backups and high availability are separate configuration choices. See [Railway pricing](https://railway.com/pricing), [MySQL service docs](https://docs.railway.com/databases/mysql), and [FastAPI deployment docs](https://docs.railway.com/guides/fastapi).
