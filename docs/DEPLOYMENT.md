# FactoryPulse and separate Simulator deployment

Prepared 22 November 2026. These are deployment files, not evidence of a hosted release.
Existing local ports and secrets have not been changed. Docker Desktop was installed
on 22 November 2026. All four API/web images built successfully; isolated API startup
and Nginx configuration checks passed. Hosted MySQL connectivity, TLS and end-to-end
container acceptance still require private deployment configuration and a target host.

## Architecture and boundaries

- FactoryPulse: production static frontend → same-origin `/backend` proxy → one FastAPI
  worker → existing MySQL. The API image now includes all modules, curated SOP/RAG
  guidance and the checksum-verified shadow model. MySQL remains the source of truth.
- Simulator: separate private UI → internal API → its own persistent SQLite outbox →
  authenticated FactoryPulse telemetry endpoint. Its API has no published container port.
  The UI binds **127.0.0.1 only**. It is an operator-controlled development tool, not a
  publicly authenticated multiuser service. Keep it on a PC/private host or behind a VPN/
  SSH tunnel. Never expose its key-injecting proxy directly to the Internet.
- Supabase does not replace, proxy or intercept MySQL, notebook or Power BI queries.
- One replica/one worker for both APIs: their worker policies, locks, finite scenarios
  and local runtime files are not designed for horizontal scaling.

## FactoryPulse deployment steps

For the already verified, separate-port local container staging setup and remaining
acceptance checks, see [STAGING-ACCEPTANCE.md](STAGING-ACCEPTANCE.md).
For a checksum-gated isolated MySQL recovery test, see [BACKUP-AND-RECOVERY.md](BACKUP-AND-RECOVERY.md).

1. Install Docker Engine/Desktop and Compose on the target host. Keep the current
   local demonstration running until a separate staging installation passes.
2. From the FactoryPulse folder, copy `deploy/production.env.example` to `.env.deploy`.
   Enter the real database endpoint, URL-encoded database credentials, receiver key,
   HTTPS frontend origin and timezone. Keep the file private and out of GitHub.
   No values should be placed in Vite variables except the public API path.
3. MySQL must be reachable **from the container**. `127.0.0.1` there refers to the
   container, not your PC. Docker Desktop supports `host.docker.internal`, but the
   existing account's host rules must already allow that connection. Use a dedicated
   deployment database/account with the reviewed schema; do not grant ALTER/CREATE to
   the application or broaden an existing account just to bypass an error. Use the
   database provider's verified TLS/CA configuration for remote database connections.
4. Back up the target database and apply only missing reviewed migrations using its
   schema-owner connection. Never replay the entire migration folder blindly. Existing
   users/password hashes belong to MySQL; do not reprovision or reset them.
5. Run the secret-redacting configuration check:

   ```powershell
   .\.venv\Scripts\python.exe scripts/check_deployment_config.py .env.deploy
   ```

6. On the Docker host, build and start:

   ```powershell
   docker compose build
   docker compose up -d
   docker compose ps
   ```

   Use a separate host or stop the local main API before taking its port8001. The
   production preview is `http://127.0.0.1:8080/`; this is not a public HTTPS address.
7. Configure the chosen hosting platform's HTTPS gateway to reach the web container.
   Keep the API private except the authenticated telemetry path needed by the sender.
   The default Compose bindings deliberately publish nothing to external interfaces.
   DNS, TLS certificates, external gateway routing and a target host are not configured
   by this repository. Restrict direct API ingress so it cannot bypass edge controls.
   An optional `compose.https.yaml` overlay and `deploy/Caddyfile` are now prepared
   for a Docker host with an owned domain and reachable ports80/443. Set the private
   `FACTORYPULSE_DOMAIN` hostname and matching HTTPS CORS origin. Gateway configuration
   validation passed, but public DNS and certificate issuance have not been tested.
8. `/health` checks the process; `/ready` performs read-only MySQL/table checks and
   returns503 without internal details on failure. Nginx adds security/cache headers
   and a login request throttle. It does not replace account-level abuse protection,
   an identity-provider review or a security assessment. IP auditing currently records
   the immediate proxy peer; configure a narrowly trusted gateway chain before relying
   on original-client IPs. Do not trust arbitrary incoming forwarded headers.

## Separate Simulator deployment

The files are in the separate **AI Simulator** folder and must stay out of the
FactoryPulse repository. From that folder:

1. Copy `deploy/production.env.example` to `backend/.env.deploy` and fill private values.
   The control key must be at least32 base64url/hex characters. Keep it separate from
   the receiver key where practical. The receiver key must match FactoryPulse's
   `SIMULATOR_API_KEY`; only `TELEMETRY_API_KEY` carries it in the sender.
2. Set the receiver to the actual accessible API ingestion URL, including `/backend`
   if routing through the bundled frontend proxy. Never use localhost to mean a
   different server. Leave delivery disabled until the receiver's `/ready` succeeds.
   Set `FACTORYPULSE_PUBLIC_URL` to the public website address for the Simulator's
   Open FactoryPulse link. This is a public build setting, not an API secret.
3. Run:

   ```powershell
   docker compose --env-file backend/.env.deploy build
   docker compose --env-file backend/.env.deploy up -d
   ```

4. Open `http://127.0.0.1:5175/`. Existing local UI5174 is untouched. The new named
   volume is a fresh database, not an automatic copy of your historical SQLite file.
   Startup restores no permission to generate: streams and delivery begin paused.
5. Enable delivery in the private configuration only after checking the destination,
   recreate the API service, then explicitly send **one finite scenario**. Check the
   reading IDs/values in MySQL and the authorized dashboard. Press STOP ALL afterward.
   Do not replay the old outbox into a new production database accidentally.

## Persistent features and optional providers

- Main `.local` runtime state and Simulator data have distinct named volumes. Never
  use `docker compose down -v` unless you deliberately intend to delete that state.
  MySQL requires its own backup plan, retention policy and restore test.
- The existing server-side `config/workforce-teams.json` is also copied and persisted
  in its own volume. It holds the current Supervisor scope configuration; back it up
  with MySQL. Missing team configuration fails closed rather than granting fleet access.
- Optional main backend `SIMULATOR_CONTROL_URL`/`SIMULATOR_CONTROL_API_KEY` configure
  Admin onboarding and sender-health checks over a private connection. Without that
  connection, main MySQL dashboards continue working and sender checks report unavailable.
  Do not expose the Simulator API just to make its health indicator green.
- New main volumes receive the bundled shadow model. Existing volumes keep their
  artifacts; update only the two reviewed model/evaluation JSON files together, verify
  checksums, then restart. Do not copy the entire development `.local` folder: it can
  contain accounts, logs, reports and machine-specific configuration.
- Main vector embeddings are optional. Build the API with
  `docker compose build --build-arg INSTALL_VECTOR_RAG=1 api`, then explicitly prepare
  the curated index using `scripts/prepare_rag_vectors.py` in a matching environment
  and transfer only the reviewed `rag-vectors` directory into the runtime volume.
  Model weights are not downloaded during a user question. Lexical/SOP retrieval works
  without this index; the UI should accurately show the available retrieval stages.
- Gemini/voice require valid server-side credentials, available model IDs and HTTPS
  microphone permission. No browser/API secret should be embedded in the static build.
  Provider errors remain visible. This pass has not performed a new paid provider call.
- Power BI is a separate report/refresh deployment. A Desktop MySQL connection does
  not prove an online gateway or scheduled refresh. Do not label it verified until
  the intended report refresh succeeds on the deployed data source.
- The model remains shadow-only and fails physical validation and Critical precision/
  recall gates. Deployment does not authorize automatic machine control or replacement
  of sustained threshold alerts. Cost figures remain configured estimates.

## Release acceptance and rollback

Before inviting users: test all six roles, team boundaries, sign-in/out, machine and
user administration, fault → assignment → investigation → explicit resolution, SOP,
sound opt-in, fresh/stale charts, one-round ingest, retries/dedup and STOP ALL. Compare
actual reading IDs and units in MySQL. Restore a backup on a nonproduction database.
Verify TLS, backups, retention, disk alerts and the selected AI/Power BI features.

Keep the previous image tags and database backup. Roll back application images without
automatically reversing schema changes or deleting volumes. Stop the Simulator before
maintenance. No deployment or migration is performed automatically by the CI workflow;
it only runs tests/builds. A green hosted build and the acceptance test remain release gates.

## Verification performed in this preparation pass

- FactoryPulse:292Python tests,12Node chart/data tests, TypeScript and the production
  frontend build passed. The production build was also run with `/backend` as its API path.
- Simulator:63isolated tests and its frontend production build passed. No live readings
  were generated; the current local sender remains READY_IDLE with zero machines running.
- Main API pinned dependencies resolved for Python3.12 Linux wheels without installation.
  Compose/workflow YAML parsed; bundled model checksum and shadow-only contract passed.
- Both existing app URLs and main `/ready` returned200 against local MySQL. Existing
  private database/API-key values were not found in either public frontend bundle.
- Large frontend bundle warnings remain. Actual four-image builds, separate-port local staging, and isolated MySQL/API recovery
  acceptance (52 checks) subsequently passed. Public HTTPS ingress, hosted browser
  acceptance and image rollback on a public host remain unverified. The user chose
  local operation for now. See RELEASE-RUNBOOK.md and RELEASE-VERIFICATION.md.
- The new CI workflow has been prepared locally, not executed on GitHub. No files
  were committed or pushed in this pass. No live secret files, user passwords, schema
  privileges or existing operational records were changed.
