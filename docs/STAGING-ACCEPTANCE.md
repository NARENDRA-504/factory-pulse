# Local container staging and final acceptance

This staging environment uses the existing MySQL records and account hashes, with
separate runtime/SQLite volumes and newly generated private staging delivery keys.
It is not an independent backup or public production deployment. Existing demo ports
3000/5174 and both original `.env` files are unchanged. No Gemini credentials are copied.

## Start and stop

Once the four verification images are built, run `scripts/prepare_local_staging.py`
with the project Python interpreter once. It refuses to overwrite existing staging
configuration. Build the separate Simulator web image with
`--build-arg VITE_FACTORYPULSE_URL=http://127.0.0.1:18080/ -t ai-simulator-web:staging`.
Then use `docker compose -f compose.staging.yaml up -d --wait`.

- FactoryPulse: http://127.0.0.1:18080/
- Simulator: http://127.0.0.1:15175/
- Stop only staging: `docker compose -f compose.staging.yaml stop`
- Never add `down -v` to routine shutdown; it deletes persistent staging state.

Container database connectivity and both web/API routes have been verified. Sender
configuration is ready but paused, with zero running machines. This does not certify
a new end-to-end delivery or incident mutation test.

## After a fresh full backup

1. Record the backup hash and cutoff, and restore it with the isolated recovery helper.
2. Sign in using the existing account credentials locally. Verify each role's scope;
   Operator must not read another station, Supervisor must stay within its team,
   and Admin endpoints must reject ordinary roles.
3. In staging Simulator explicitly send one finite normal scenario for an assigned
   machine. Compare reading IDs, units, values and timestamps in SQLite delivery,
   MySQL and the authorized dashboard. Repeating an ID must not duplicate a reading.
4. Send one finite fault. Confirm one incident, role-specific visibility and the
   authorized assignment -> repair -> resolution workflow. Record the created IDs
   as test evidence; do not silently delete business/audit records afterward.
5. Press STOP ALL; verify zero running machines and paused delivery. Observe that
   stored timestamps stop advancing. Historical charts should remain historical,
   not animate invented new values.
6. Test real microphone questions in English, Telugu and Hindi; confirm transcription,
   text response and audible reply. Typed prompts should remain silent. Browser audio
   permission and actual sound confirmation require the person at the computer.
7. Refresh the local Power BI Import report explicitly; it is not a one-second live
   streaming report. Compare equivalent reading IDs/timestamps at the same cutoff.

## Public hosting

Choose a host and owned DNS name first. Supply `.env.deploy` privately, with the
container-reachable MySQL URL and HTTPS CORS origin. `compose.https.yaml` provides
an optional Caddy gateway for an appropriate Docker host; it is not started locally.
Set `FACTORYPULSE_DOMAIN` to a real hostname, point DNS at the host, allow inbound
80/443 and verify certificate issuance before acceptance. Keep the Simulator private.
Existing runtime database privileges must not be widened to make deployment work.
No hosted domain, billing account, public TLS, gateway or cloud Power BI deployment
has been supplied or certified. ML stays shadow-only pending real-data validation.
