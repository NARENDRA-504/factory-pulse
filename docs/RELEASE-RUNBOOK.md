# FactoryPulse release runbook

## Verified local release candidate — 22 November 2026

The four application images build. The containerized main API connects to MySQL.
Separate-port local web staging is available at `http://127.0.0.1:18080/` and
Simulator staging at `http://127.0.0.1:15175/`. Staging shares the live database;
do not use it for destructive acceptance tests. Original local ports remain unchanged.
Both Simulator environments remain under manual control; starting services does not
authorize continuous generation or old outbox replay.

The fresh full SQL dump was checksum verified and restored into a network-isolated
MySQL 8 container. All 18 tables and 7 views restored, 1,280 latest readings matched
after UTC normalization, and combined history/archive totals reconciled. Full
historical payloads were not compared row by row.

The containerized API then passed 52 checks against that restored copy: six-role
login/logout, authorized telemetry, Operator station and Supervisor team restrictions,
Admin restrictions, one normal ingest, idempotent retry with exactly one stored row,
incident creation, assignment, maintenance progress, technician closure, completed
work order, and resolved-ticket visibility across all six roles. No live passwords,
accounts or records were changed. Temporary passwords and test records exist only
in the disposable restored copy. This is API recovery acceptance, not hosted/browser
acceptance or a real-machine ML validation.

## Reproduce recovery acceptance

Use the completed report from `scripts/verify_mysql_restore.py`. Start only that
isolated recovery container and run:

```powershell
.\.venv\Scripts\python.exe scripts/verify_recovery_workflows.py --restore-report ".local\recovery\YOUR_RESTORE_REPORT.json"
```

The probe refuses a non-recovery or externally networked target. It obtains only the
isolated container's generated password internally, never a live account password.
It changes passwords in the restored copy to test real authentication. Keep the
original SQL dump unchanged. Stop the recovery container afterward; retaining its
volume allows inspection without another 26-minute import. Do not delete volumes
with routine shutdown commands.

## Before public deployment

1. Choose the server/hosting account and owned domain. Confirm cost and access with
   the owner. The application cannot configure an unspecified host or DNS zone.
2. Provision private MySQL connectivity and the existing restricted application
   account. Do not expose port 3306 publicly or grant schema-owner privileges to the
   runtime account. Apply reviewed migrations separately when actually required.
3. Configure `.env.deploy` privately using `deploy/production.env.example`. Set the
   real MySQL URL, a private delivery key, HTTPS CORS origins and owned domain. Run
   `scripts/check_deployment_config.py .env.deploy`; this checks structure only.
4. Back up MySQL and `config/workforce-teams.json`. Preserve reviewed runtime settings
   and model artifacts separately. Keep credentials in private secret storage. Arrange
   encrypted off-device copies and a monitored schedule before inviting real users.
5. Build reviewed source on the target. Run Compose with the HTTPS overlay only after
   DNS points at the host and inbound 80/443 are available:

   ```sh
   docker compose --env-file .env.deploy -f compose.yaml -f compose.https.yaml up -d --build --wait
   ```

6. Verify the real certificate, `/backend/ready`, six-role browser navigation and
   authorization, then one finite Simulator scenario. Keep Simulator controls private
   (local access or VPN/private network). Match its receiver key privately; never put
   it in a public build. Verify reading IDs in MySQL and authorized dashboards.
7. Complete the browser checklist in `STAGING-ACCEPTANCE.md`: charts fresh/stale,
   incident forms, STOP ALL, physical microphone and audible alerts. Review provider
   failures, logs and disk alerts. Power BI cloud refresh needs separate gateway and
   report verification; Desktop refresh does not prove it.

## Release limits

ML remains shadow-only: it has not passed real-machine validation or Critical
precision/recall gates. Keep established threshold-based incident handling; do not
enable automatic machine control. Cost figures are editable estimates, not verified
financial results. No public URL, TLS certificate or cloud Power BI refresh is certified
by the local checks above. Frontend bundle size warnings remain.

## Rollback

Stop Simulator generation and delivery first. Keep the previous reviewed image tags
and full backup. Roll back application images without reversing migrations or deleting
volumes. If database recovery is necessary, restore onto a separate instance, run
recovery acceptance, then deliberately switch the private connection after approval.
Never overwrite the only working database as an automatic rollback action.
