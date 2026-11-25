# FactoryPulse + AI Simulator: teammate setup

The GitHub code does not include your MySQL database, passwords, private keys, Python environments, Node packages, or local vector index. Each teammate configures their own PC. FactoryPulse and AI Simulator stay separate. The Simulator is supplied separately as a source ZIP; it is not published in the FactoryPulse repository.

## 1. Install tools and arrange the folders

Install Python 3.12, Node.js with npm, MySQL Server 8 and optionally MySQL Workbench, Git and VS Code. Workbench alone is not a database server. Docker and Power BI are not needed to launch the two apps locally.

Example folder structure:

```text
Projects/
  factory-pulse/       <- clone the FactoryPulse GitHub repository
  AI Simulator/       <- extract the separate Simulator source ZIP here
    backend/app/main.py
    frontend/package.json
```

Do not copy `.env`, `.local`, `.venv`, `node_modules`, SQLite databases, private account documents or database backups into a public ZIP/GitHub repository. Use the matching current Simulator source and machine roster. The launcher rejects mismatched machine IDs/codes.

## 2. Install libraries once

Open FactoryPulse in VS Code. Choose Terminal -> New Terminal (PowerShell), then run:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r api_server/requirements.txt httpx tzdata
npm install
```

These install the backend's FastAPI, Uvicorn, Pydantic, SQLAlchemy, PyMySQL/aiomysql, Pandas, NumPy, Google GenAI, authentication and dotenv libraries. `httpx` supports internal API calls; `tzdata` supports named factory timezones on Windows. npm installs React, TypeScript, Vite, Tailwind, Lucide and the other packages listed in `package.json`. Do not install each library manually.

For local vector RAG (optional, recommended for the assistant):

```powershell
.\.venv\Scripts\python.exe -m pip install -r api_server/requirements-rag.txt
.\.venv\Scripts\python.exe scripts/prepare_rag_vectors.py
```

The first vector preparation downloads public embedding weights. It indexes curated guidance, not passwords or personnel records. Without it, keyword retrieval remains available. An existing vector cache can be rebuilt with `--offline` if weights are already present.

Open a second VS Code window for AI Simulator. In its terminal:

```powershell
Set-Location backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Set-Location ..\frontend
npm install
```

Notebook work is separate: install FactoryPulse's `requirements-notebook.txt` only if running notebooks. Model training uses the requirements in the relevant practice folder; it is not required for receiving telemetry. Power BI needs its MySQL connector and reporting credentials separately; this launcher does not configure or certify report refresh.

## 3. Set up your own MySQL database and first login

Use a schema-owner connection in Workbench to prepare `ziro_manufacturing`. Read `scripts/export_mysql_schema.sql` and the migration files first. The base schema alone does not include every later feature. A fresh PC needs the current schema and the matching migrations; do not blindly rerun every migration on an existing database. The launch preflight lists required missing tables. Preserve existing databases and back up before changes.

Create a dedicated runtime account with the needed SELECT/INSERT/UPDATE/DELETE permissions for this schema. Apply schema changes with the owner account, not by granting the app broad administrative privileges.

In FactoryPulse, copy `.env.example` to `.env` if `.env` does not exist. Edit `.env` locally:

```ini
DATABASE_URL="mysql+pymysql://factorypulse_app:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:3306/ziro_manufacturing"
APP_ENV="production"
DEMO_AUTH_ENABLED="false"
FACTORY_TIMEZONE="Asia/Kolkata"
CORS_ORIGINS="http://127.0.0.1:3000,http://localhost:3000"
```

Use your teammate's actual MySQL username/password. In the URL, `@` in a password becomes `%40`, `#` becomes `%23`, and `%` becomes `%25`. This is the MySQL account password, not an employee login password.

For a new database with no Admin, run from FactoryPulse:

```powershell
.\.venv\Scripts\python.exe scripts/provision_initial_admin.py
```

Follow its private prompts and save that employee ID/password locally. An existing administrator is preserved; this command is not a password reset. Configure machines and staff through the authorized app features. Sharing code does not copy your existing accounts or assigned machines.

## 4. Connect both apps automatically

After the one-time prerequisites below, you can also double-click **Connect Local Apps.cmd** in the FactoryPulse folder. It runs the same setup and launcher. It does not bypass your PowerShell execution policy.

Stop any already-running backends first so they load the new settings. From the FactoryPulse terminal:

```powershell
& ".\scripts\Connect-LocalApps.ps1" -OpenBrowser
```

If the Simulator folder has another name or location:

```powershell
& ".\scripts\Connect-LocalApps.ps1" -SimulatorPath "D:\Projects\My Simulator" -OpenBrowser
```

This saves local settings and starts/reuses the four services. It does not install dependencies, create MySQL tables, reset accounts, generate readings, resume an old queue or delete data. A valid existing FactoryPulse receiver key is kept; otherwise a secure random key is generated locally. The connector writes that same value into the sender configuration without printing it. It preserves unrelated settings and rejects duplicate connection-setting lines.

| Location | Setting | What goes there |
| --- | --- | --- |
| FactoryPulse `.env` | `DATABASE_URL` | Your local MySQL connection; entered by you |
| FactoryPulse `.env` | `SIMULATOR_API_KEY` | Shared receiver secret; connector configures it |
| Simulator `backend/.env` | `TELEMETRY_API_KEY` | Exactly the same shared receiver secret |
| Simulator `backend/.env` | `TELEMETRY_AUTH_HEADER` | Literal `X-Simulator-API-Key`, not a secret |
| Simulator `backend/.env` | `TELEMETRY_RECEIVER_URL` | `http://127.0.0.1:8001/api/v1/telemetry` |
| Simulator `backend/.env` | `SIMULATOR_API_KEY` | Separate incoming Simulator control credential; existing value preserved |
| FactoryPulse `.env` | `SIMULATOR_CONTROL_API_KEY` | Matches that separate control credential; connector configures it |
| FactoryPulse `.env` | `SIMULATOR_PROJECT_PATH` | Separate source folder; connector saves it |
| FactoryPulse `.env` | `VITE_API_BASE_URL` | Local FactoryPulse API URL; connector configures it |

The shared telemetry key is generated by your computer. It does not come from Gemini, GitHub, Supabase or a paid API service. Never put any private key in `VITE_*` settings or browser code. Supabase is not required for this local connection.

Preview configuration without changing files:

```powershell
.\.venv\Scripts\python.exe scripts/connect_local_apps.py
```

After the first setup, launch normally using:

```powershell
& ".\scripts\Start-LocalDemo.ps1" -OpenBrowser
```

The launcher monitors stopped services and avoids duplicate listeners. If you change a key or URL while a backend is running, restart that backend; reusing a running process cannot reload its environment automatically. A readiness failure points to `.local/stack` logs and `.local/local-demo-readiness.json`.

## 5. Optional Gemini setup

Each teammate may create their own key in [Google AI Studio](https://aistudio.google.com/apikey). Add it only to FactoryPulse `.env`:

```ini
GEMINI_API_KEY="YOUR_OWN_GOOGLE_KEY"
GEMINI_MODEL="YOUR_AVAILABLE_TEXT_MODEL_ID"
```

Choose a model available to that key/project. Voice features can require additional supported model configuration; see `docs/CHAT-VOICE-LANGUAGES.md`. Restart the main backend after changes. Gemini requests need network access and provider quota. Dashboards and the local retrieval fallback do not require Gemini. `APP_URL` is for hosted links and is not needed for these local screens.

## 6. Verify one delivery, then use dashboards

1. Open FactoryPulse at `http://localhost:3000/` and sign in with an account in your MySQL database.
2. Open Simulator at `http://127.0.0.1:5174/`. Select one matching machine and explicitly send a finite scenario or selected snapshot.
3. Check that delivery is confirmed, not merely stored in SQLite. In FactoryPulse choose that authorized machine and verify its reading timestamp changes. Operators need an assignment to that machine.
4. The path is Simulator -> authenticated FactoryPulse API -> MySQL -> authorized dashboard. The Simulator never writes directly to MySQL.
5. Use Stop All when finished. Starting the launcher deliberately leaves generation and background delivery paused to avoid disk growth.

Read-only service/database check:

```powershell
.\.venv\Scripts\python.exe scripts/check_presentation.py --json
```

`READY_IDLE` is normal while stopped. This check does not prove delivery by itself. A live claim needs an actual sent reading persisted in MySQL and visible in the dashboard. No secrets should be committed or sent in chat.
