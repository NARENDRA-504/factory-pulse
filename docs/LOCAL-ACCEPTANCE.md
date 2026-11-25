# Repeatable local acceptance

From the FactoryPulse folder in PowerShell:

```powershell
& ".\.venv\Scripts\python.exe" scripts/accept_local_release.py
```

Checks local app/API availability, MySQL read access, configured sender, required tables, active administrator, targeted backend tests in temporary databases, frontend types and production build. It does not start streams, send readings, delete data, change accounts or activate a model. Both apps must already be running. Intentionally paused generation is reported as READY_IDLE, not LIVE.

Timestamped results are saved under ignored `.local/acceptance/local-acceptance-*.json`; individual logs remain private beside them. A nonzero exit code means at least one automated check failed. The JSON intentionally excludes command output, credentials, employee records and database connection strings. Inspect private logs locally to troubleshoot.

Passing this command is not full workplace approval. Perform separate device microphone/speaker checks, authorized browser role workflows, a bounded live fault-to-resolution demonstration, Power BI refreshed-model comparison, applicable site SOP approval and independent real-machine model validation. The report lists these exclusions explicitly. Previous evidence is not silently rerun or marked current.

Admin Guidance & ML Review now displays a separate AI4I practice benchmark when its local evaluation exists. These figures are never substituted for deployed-model validation gates; missing or invalid evaluation files show no practice results. Current source artifacts remain local and ignored.
