# Backup and recovery release gate

Checked22November2026. MySQL reports18base tables,7views and approximately10,228MiB
of table/index storage. A local dump dated28October2026 exists, but no successful
restore of a current backup has been verified. Do not treat an old file as recovery proof.

The runtime account can read operational data but lacks SHOW VIEW, TRIGGER and CREATE.
That is not a reason to broaden its privileges. A backup/schema-owner account must
perform the full backup, and an isolated restore account must perform recovery testing.

## Take a current backup

1. Stop all Simulator streams and delivery. Verify zero running machines. Temporarily
   avoid user/role, team, machine and incident edits while capturing the recovery point.
2. Ensure adequate disk space. The current database is about10GB before any compression;
   reserve space for both the dump and a separate restored instance. No files are deleted
   by the supplied script. Store backups privately, outside GitHub/public download folders.
3. In your own PowerShell terminal from the FactoryPulse folder, run:

   ```powershell
   & ".\scripts\Backup-MySQL.ps1" -User YOUR_BACKUP_OR_SCHEMA_OWNER_USERNAME
   ```

   The native MySQL client prompts for the password locally. Never put passwords in
   the command, chat, GitHub or a frontend variable. The script uses a transactional
   snapshot for InnoDB and includes views, triggers, routines and events. Permission
   errors fail the backup; `.partial` files are never marked complete.
4. A successful dump receives a SHA256 manifest with `restore_verified: false`.
   Separately back up `config/workforce-teams.json` and reviewed runtime policies and
   model artifacts. Credentials require an appropriate private secret-store backup;
   do not bundle them into public documentation. Preserve the Simulator's undelivered
   outbox if that queue is required for recovery. Do not blindly replay it into a target.

## Prove recovery

1. Use a separate MySQL instance (another host/container/VM), not the live application
   instance. Match the intended MySQL version and restore into the same schema name
   there so qualified view references cannot silently point back at live data.
2. In Workbench connected to that isolated instance, use Server → Data Import →
   Import from Self-Contained File. Choose the completed SQL dump and import into
   `ziro_manufacturing`. Inspect every reported error, including DEFINER/view/trigger issues.
3. Check table/view/trigger presence and compare exact source/restored row counts at
   the backup cutoff. Compare sample reading IDs, values, units, machine assignments,
   incident/work-order linkage and user role/active fields. Do not print password hashes
   or session tokens in evidence. Record the backup checksum and recovery duration.
4. Point a separate staging app at the restored instance. Test login, scoped dashboards,
   one bounded test ingest, deduplication and the full incident resolution workflow.
   Keep real delivery stopped and ensure the staging receiver is explicitly selected.
5. Mark restore verified only after those checks pass. Keep the old deployment image and
   backup; do not automatically reverse migrations or remove persistent volumes.

## Still requires configuration

Docker is now available. `scripts/verify_mysql_restore.py` can create a new isolated
MySQL 8 container with no host ports, no mounts and no network access. It requires a
completed dump plus its checksum manifest from the backup helper:

```powershell
.\.venv\Scripts\python.exe scripts/verify_mysql_restore.py --backup ".local\backups\YOUR_COMPLETED_BACKUP.sql"
```

It refuses incomplete/modified dumps and records restored table counts privately.
The container is retained for inspection; it does not overwrite an existing target.
A successful SQL import alone does not mark the full recovery gate complete: source
snapshot parity and application workflow checks are still required. The random
container credential is used only for that isolated database, never your live account.

On 22 November the user ran the full backup helper locally. The completed 4.35 GiB
backup passed checksum verification and restored successfully into an isolated MySQL 8
container in about 26.6 minutes. All 18 tables and 7 views restored. All 1,280 latest
readings matched after normalizing TIMESTAMP values to UTC. Live retention continued
after the snapshot: combined history/archive totals reconcile at 15,750,486, and all
20,000 IDs newly archived at comparison time remain in restored history. A follow-up container API probe passed 52 checks: six-role authentication and access
boundaries, one bounded ingestion and deduplication, incident assignment/progress/closure,
linked work-order completion and session revocation. Temporary passwords and test records
were changed only in the restored copy. The manifest now records `restore_verified: true`
for isolated data/API recovery. Full historical payloads were not compared row by row;
browser and hosted acceptance remain separate. Private aggregate evidence is under
`.local/recovery`. See [release runbook](RELEASE-RUNBOOK.md).

No backup credentials were shared. Scheduling, off-device retention, encryption and
hosted recovery acceptance remain deployment tasks. No live privileges or records
were changed by the restore checks.
