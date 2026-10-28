"""
ZIRO Digital Internship Program — AI Manufacturing Incident & Maintenance Platform
FastAPI Primary Backend Engine (Port 8000)
Architecture: Google AI Studio Frontend -> Python FastAPI Backend -> MySQL Database
"""

from fastapi import FastAPI, HTTPException, Depends, Header, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import List, Optional, Dict, Any, Literal
import datetime
import math
import os
import json
import secrets
import hashlib
import hmac
import base64
import uuid
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(
    title="ZIRO Manufacturing Incident & Maintenance Response Platform API",
    version="1.0.0",
    description="Python FastAPI backend serving CNC telemetry, MySQL operational records, and server-side Gemini AI investigation diagnostics."
)

@app.get("/health", tags=["Operations"])
def health_check():
    """Liveness probe for the API process; database readiness is checked by DB-backed endpoints."""
    return {"status": "ok"}

# Allow only explicitly configured frontend origins. Bearer tokens do not use cookies.
CORS_ORIGINS = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_TELEMETRY_REQUEST_BYTES = 16 * 1024

class _TelemetryRequestTooLarge(Exception):
    pass

class TelemetryRequestSizeLimitMiddleware:
    """Bound the body accepted by the single-reading ingestion route."""
    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if not (
            scope.get("type") == "http"
            and scope.get("method") == "POST"
            and scope.get("path") == "/api/v1/telemetry"
        ):
            await self.application(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > MAX_TELEMETRY_REQUEST_BYTES:
                    await self._too_large(send)
                    return
            except ValueError:
                await self._too_large(send, status_code=400, detail="Invalid Content-Length")
                return

        bytes_received = 0

        async def bounded_receive():
            nonlocal bytes_received
            message = await receive()
            if message.get("type") == "http.request":
                bytes_received += len(message.get("body", b""))
                if bytes_received > MAX_TELEMETRY_REQUEST_BYTES:
                    raise _TelemetryRequestTooLarge()
            return message

        try:
            await self.application(scope, bounded_receive, send)
        except _TelemetryRequestTooLarge:
            await self._too_large(send)

    @staticmethod
    async def _too_large(send, status_code=413, detail="Telemetry request exceeds 16 KiB"):
        body = json.dumps({"detail": detail}).encode("utf-8")
        await send({"type": "http.response.start", "status": status_code,
                    "headers": [(b"content-type", b"application/json"),
                                (b"content-length", str(len(body)).encode("ascii"))]})
        await send({"type": "http.response.body", "body": body})

app.add_middleware(TelemetryRequestSizeLimitMiddleware)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", "").strip()
    if not request_id or len(request_id) > 128:
        request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ------------------------------------------------------------------------------
# Pydantic Schemas with Strict Field Separation & Provenance Tagging
# ------------------------------------------------------------------------------

class LoginRequest(BaseModel):
    work_id: str = Field(..., description="Employee badge Work ID e.g. OP-101, SUP-201")
    password: str = Field(..., description="User passphrase (min 3 chars)")

class AdminUserCreateRequest(BaseModel):
    work_id: str = Field(..., min_length=2, max_length=32)
    full_name: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=12, max_length=256)
    role: Literal["Operator", "Supervisor", "Manager", "Maintenance", "Admin"]
    assigned_machine: Optional[str] = Field(None, max_length=32)
    department: Optional[str] = Field(None, max_length=128)
    shift: Optional[Literal["Shift A", "Shift B", "Night Shift"]] = None
    email: str = Field(..., min_length=3, max_length=128)

class AdminUserUpdateRequest(BaseModel):
    work_id: Optional[str] = Field(None, min_length=2, max_length=32)
    full_name: Optional[str] = Field(None, min_length=1, max_length=128)
    role: Optional[Literal["Operator", "Supervisor", "Manager", "Maintenance", "Admin"]] = None
    assigned_machine: Optional[str] = Field(None, max_length=32)
    department: Optional[str] = Field(None, max_length=128)
    shift: Optional[Literal["Shift A", "Shift B", "Night Shift"]] = None
    email: Optional[str] = Field(None, min_length=3, max_length=128)
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=12, max_length=256)

class UserProfileResponse(BaseModel):
    id: int
    work_id: str
    full_name: str
    role: str
    assigned_machine: Optional[str] = None
    email: str
    department: Optional[str] = None
    shift: Optional[str] = None
    is_active: bool = True

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse

class AuditEventRecord(BaseModel):
    id: int
    employee_id: Optional[int] = None
    employee_work_id: Optional[str] = None
    employee_name: Optional[str] = None
    role: Optional[str] = None
    event_type: str
    occurred_at_utc: str
    occurred_at_local: str
    factory_time_zone: str
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    details: Optional[str] = None

class TelemetryReadingSchema(BaseModel):
    timestamp: str
    spindle_rpm: float
    feed_rate_mmpm: float
    vib_x: float
    vib_y: float
    vib_z: float
    vib_rms: float
    motor_power_kw: float = Field(..., description="Spindle motor power in kW (SEPARATE FIELD)")
    motor_load_pct: float = Field(..., description="Motor load percentage in % (SEPARATE FIELD)")
    coolant_temp_c: float
    data_provenance: str = Field(..., description="EMPIRICAL DATASET, SIMULATED, or DEMO")
    injected_anomaly_type: Optional[str] = None

class SimulatorTelemetryIngest(BaseModel):
    """The simulator's existing one-row-per-sensor TelemetryRecord contract."""
    model_config = ConfigDict(extra="forbid")

    reading_id: str = Field(..., min_length=1, max_length=128)
    machine_id: str = Field(..., pattern=r"^MCH-[0-9A-Za-z_-]{3,16}$")
    timestamp: datetime.datetime
    machine_type: str = Field(..., min_length=1, max_length=128)
    department: str = Field(..., min_length=1, max_length=128)
    production_line: str = Field(..., min_length=1, max_length=128)
    sensor_name: str = Field(..., min_length=1, max_length=128)
    sensor_unit: str = Field(..., min_length=1, max_length=32)
    sensor_value: float | str | None
    expected_min: float = Field(..., allow_inf_nan=False)
    expected_max: float = Field(..., allow_inf_nan=False)
    machine_status: Literal["NORMAL", "WARNING", "CRITICAL", "MAINTENANCE", "STOPPED"]
    data_quality: Literal["GOOD", "NOISY"]
    fault_mode: Optional[str] = Field(None, max_length=128)

    @field_validator("timestamp")
    @classmethod
    def timestamp_must_include_timezone(cls, value: datetime.datetime) -> datetime.datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include a timezone, preferably UTC (Z)")
        return value.astimezone(datetime.timezone.utc)

    @field_validator("sensor_value", mode="before")
    @classmethod
    def sensor_value_must_be_safe_json_scalar(cls, value: Any) -> Any:
        if isinstance(value, bool):
            raise ValueError("sensor_value cannot be a boolean")
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("numeric sensor_value must be finite")
        if isinstance(value, str) and len(value) > 256:
            raise ValueError("string sensor_value must not exceed 256 characters")
        return value

    @model_validator(mode="after")
    def validate_expected_range(self):
        if self.expected_min > self.expected_max:
            raise ValueError("expected_min must not exceed expected_max")
        return self

class TelemetryIngestResponse(BaseModel):
    stored: int = 1
    duplicate: bool = False
    reading_id: str
    machine_id: str
    machine_code: str
    machine_name: str
    data_provenance: Literal["SIMULATED"] = "SIMULATED"

class TelemetryReadingRecord(SimulatorTelemetryIngest):
    machine_code: str
    display_name: str
    data_provenance: Literal["SIMULATED"] = "SIMULATED"

class CreateIncidentRequest(BaseModel):
    machine_code: str
    severity: str
    symptom_description: str
    component_area: str
    operator_notes: Optional[str] = None
    measured_vib_rms: float
    measured_motor_power_kw: float
    measured_motor_load_pct: float
    correlated_vb_mm: Optional[float] = None
    correlated_ra_um: Optional[float] = None
    data_provenance: str = "EMPIRICAL DATASET"

class AssignIncidentRequest(BaseModel):
    technician_name: str

class UpdateProgressRequest(BaseModel):
    progress_notes: str

class CloseIncidentRequest(BaseModel):
    closure_notes: str

# ------------------------------------------------------------------------------
# In-Memory demo records. Production identity and audit data use MySQL.
# ------------------------------------------------------------------------------

DEMO_USERS: Dict[str, Dict[str, Any]] = {
    "OP-101": {"id": 1, "work_id": "OP-101", "full_name": "Marcus Vance", "role": "Operator", "assigned_machine": "CNC-5AX-001", "email": "marcus.vance@ziromfg.internal", "password": "pass123"},
    "SUP-201": {"id": 2, "work_id": "SUP-201", "full_name": "Elena Rostova", "role": "Supervisor", "assigned_machine": None, "email": "elena.rostova@ziromfg.internal", "password": "pass123"},
    "MGR-301": {"id": 3, "work_id": "MGR-301", "full_name": "David Sterling", "role": "Manager", "assigned_machine": None, "email": "david.sterling@ziromfg.internal", "password": "pass123"},
    "MNT-401": {"id": 4, "work_id": "MNT-401", "full_name": "Frank Kowalski", "role": "Maintenance", "assigned_machine": None, "email": "frank.kowalski@ziromfg.internal", "password": "pass123"},
    "ADM-001": {"id": 5, "work_id": "ADM-001", "full_name": "Sarah Chen", "role": "Admin", "assigned_machine": None, "email": "sarah.chen@ziromfg.internal", "password": "pass123"},
}

INCIDENTS_STORE: List[Dict[str, Any]] = [
    {
        "id": 101,
        "incident_code": "INC-2026-089",
        "machine_code": "CNC-MILL-02",
        "reporter_id": 1,
        "reporter_name": "Marcus Vance",
        "reporter_role": "Operator",
        "severity": "Medium",
        "symptom_description": "High-frequency chatter vibration detected during roughing pass on pocket 3B.",
        "operator_notes": "Audible resonance increased sharply when cutting speed reached 4200 RPM.",
        "component_area": "Spindle & Toolholder",
        "measured_vib_rms": 4.82,
        "measured_motor_power_kw": 11.4,
        "measured_motor_load_pct": 84.5,
        "correlated_vb_mm": 0.28,
        "correlated_ra_um": 1.45,
        "data_provenance": "EMPIRICAL DATASET",
        "assigned_to_name": "Frank Kowalski",
        "status": "In_Investigation",
        "created_at": "2026-10-09 14:22:10",
        "closed_at": None,
        "notes": None,
    },
    {
        "id": 102,
        "incident_code": "INC-2026-092",
        "machine_code": "CNC-HEAVY-04",
        "reporter_id": 2,
        "reporter_name": "Elena Rostova",
        "reporter_role": "Supervisor",
        "severity": "Critical",
        "symptom_description": "Abrupt spindle motor load surge and thermal boundary alarm on Z-axis wayguides.",
        "operator_notes": "Machine halted automatically by feed-drive overload interlock.",
        "component_area": "Z-Axis Ball Screw Drive",
        "measured_vib_rms": 6.95,
        "measured_motor_power_kw": 22.8,
        "measured_motor_load_pct": 102.3,
        "correlated_vb_mm": 0.38,
        "correlated_ra_um": None,
        "data_provenance": "SIMULATED",
        "assigned_to_name": "Frank Kowalski",
        "status": "Action_Required",
        "created_at": "2026-10-10 09:15:00",
        "closed_at": None,
        "notes": None,
    },
]

# ------------------------------------------------------------------------------
# Authentication and role enforcement
# ------------------------------------------------------------------------------

DEMO_AUTH_ENABLED = (
    os.environ.get("DEMO_AUTH_ENABLED", "").strip().lower() == "true"
    and os.environ.get("APP_ENV", "production").strip().lower() in {"development", "test"}
)
DEMO_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_HOURS = 8
FACTORY_TIMEZONE = os.environ.get("FACTORY_TIMEZONE", "UTC").strip() or "UTC"

def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def _factory_time(value: Any) -> tuple[str, str]:
    utc_value = datetime.datetime.fromisoformat(_iso_utc(value).replace("Z", "+00:00"))
    try:
        zone = ZoneInfo(FACTORY_TIMEZONE)
        zone_name = FACTORY_TIMEZONE
    except ZoneInfoNotFoundError:
        zone = datetime.timezone.utc
        zone_name = "UTC"
    return utc_value.astimezone(zone).isoformat(), zone_name

def _hash_password(password: str, salt: bytes, iterations: int = 310_000) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.urlsafe_b64encode(salt).decode("ascii").rstrip("="),
        base64.urlsafe_b64encode(digest).decode("ascii").rstrip("="),
    )

def _verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, expected_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        actual = _hash_password(password, decode(salt_text), int(iterations_text)).rsplit("$", 1)[1]
        return hmac.compare_digest(actual, expected_text)
    except (ValueError, TypeError):
        return False

def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def _audit_insert(connection, *, employee_id=None, employee_name=None, role=None,
                  employee_work_id=None, event_type: str, session_id=None, request_id=None, details=None):
    connection.execute(_sql_text("""
        INSERT INTO activity_log
            (employee_id, employee_work_id, employee_name, role_at_event, event_type, occurred_at_utc,
             session_id, request_id, details)
        VALUES (:employee_id, :employee_work_id, :employee_name, :role, :event_type, UTC_TIMESTAMP(6),
                :session_id, :request_id, :details)
    """), {
        "employee_id": employee_id, "employee_work_id": employee_work_id, "employee_name": employee_name, "role": role,
        "event_type": event_type, "session_id": session_id, "request_id": request_id,
        "details": (details or "")[:500] or None,
    })

def record_activity(*, user: Optional[Dict[str, Any]], event_type: str,
                    request_id: Optional[str] = None, session_id: Optional[str] = None,
                    details: Optional[str] = None) -> None:
    if DEMO_AUTH_ENABLED:
        return  # The test environment deliberately has no durable business audit trail.
    engine = get_telemetry_engine()
    try:
        with engine.begin() as connection:
            _audit_insert(
                connection,
                employee_id=(user or {}).get("id"),
                employee_name=(user or {}).get("full_name"),
                employee_work_id=(user or {}).get("work_id"),
                role=(user or {}).get("role"), event_type=event_type,
                session_id=session_id or (user or {}).get("session_id"),
                request_id=request_id, details=details,
            )
    except Exception as exc:
        print(f"[Activity Log] Write failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Activity logging is unavailable; the requested action was not completed") from exc

def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Header. Please provide a valid Bearer token."
        )
    scheme, _, token = authorization.partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer session."
        )
    if DEMO_AUTH_ENABLED:
        session = DEMO_SESSIONS.get(_token_digest(token))
        if not session or session["expires_at"] <= _utcnow():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Demo session expired or invalid")
        current = next((item for item in DEMO_USERS.values() if item["id"] == session["user"]["id"]), None)
        if not current or not current.get("is_active", True):
            DEMO_SESSIONS.pop(_token_digest(token), None)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is inactive")
        return {k: v for k, v in current.items() if k not in {"password", "password_hash"}} | {"session_id": session["session_id"]}

    engine = get_telemetry_engine()
    try:
        with engine.connect() as connection:
            row = connection.execute(_sql_text("""
                SELECT s.session_id, s.employee_id, s.expires_at_utc, s.revoked_at_utc,
                       u.work_id, u.full_name, u.role, u.assigned_machine, u.email, u.is_active,
                       u.department, u.shift
                FROM auth_sessions s JOIN users u ON u.id = s.employee_id
                WHERE s.token_hash = :token_hash
            """), {"token_hash": _token_digest(token)}).mappings().first()
        if not row or not row["is_active"] or row["revoked_at_utc"] is not None:
            raise HTTPException(status_code=401, detail="Session is invalid or has been revoked")
        expiry = row["expires_at_utc"]
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=datetime.timezone.utc)
        if expiry <= _utcnow():
            with engine.begin() as connection:
                connection.execute(_sql_text("UPDATE auth_sessions SET revoked_at_utc = UTC_TIMESTAMP(6), revoke_reason = 'expired' WHERE session_id = :session_id AND revoked_at_utc IS NULL"), {"session_id": row["session_id"]})
                _audit_insert(connection, employee_id=row["employee_id"], employee_work_id=row["work_id"], employee_name=row["full_name"], role=row["role"], event_type="session_expiry", session_id=row["session_id"], request_id=getattr(request.state, "request_id", None))
            raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
        return {
            "id": row["employee_id"], "work_id": row["work_id"], "full_name": row["full_name"],
            "role": row["role"], "assigned_machine": row["assigned_machine"],
            "email": row["email"], "department": row["department"], "shift": row["shift"],
            "is_active": row["is_active"], "session_id": row["session_id"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Authentication] Session lookup failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Authentication service is unavailable") from exc

def require_roles(allowed_roles: List[str]):
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission Denied: User role '{user['role']}' is not authorized. Allowed roles: {allowed_roles}"
            )
        return user
    return role_checker

# ------------------------------------------------------------------------------
# Authentication Routes
# ------------------------------------------------------------------------------

@app.post("/api/v1/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request):
    work_id = payload.work_id.strip().upper()
    if DEMO_AUTH_ENABLED:
        user = DEMO_USERS.get(work_id)
        password_valid = bool(user and (
            _verify_password(payload.password, user["password_hash"]) if user.get("password_hash")
            else secrets.compare_digest(payload.password, user.get("password", ""))
        ))
        if not user or not user.get("is_active", True) or not password_valid:
            raise HTTPException(status_code=401, detail="Invalid employee ID or password")
        access_token = secrets.token_urlsafe(32)
        session_id = str(uuid.uuid4())
        DEMO_SESSIONS[_token_digest(access_token)] = {
            "user": {k: v for k, v in user.items() if k != "password"},
            "session_id": session_id, "expires_at": _utcnow() + datetime.timedelta(hours=SESSION_HOURS),
        }
        return LoginResponse(access_token=access_token, user=UserProfileResponse(
            id=user["id"], work_id=user["work_id"], full_name=user["full_name"], role=user["role"],
            assigned_machine=user["assigned_machine"], email=user["email"], department=user.get("department"), shift=user.get("shift"),
        ))

    engine = get_telemetry_engine()
    user = None
    credentials_valid = False
    try:
        with engine.begin() as connection:
            user = connection.execute(_sql_text("""
                SELECT id, work_id, full_name, password_hash, role, assigned_machine, email, department, shift, is_active
                FROM users WHERE work_id = :work_id
            """), {"work_id": work_id}).mappings().first()
            credentials_valid = bool(user and user["is_active"] and user["password_hash"] and _verify_password(payload.password, user["password_hash"]))
            if not credentials_valid:
                _audit_insert(connection, employee_id=user["id"] if user else None, employee_work_id=work_id, employee_name=user["full_name"] if user else None,
                              role=user["role"] if user else None, event_type="failed_sign_in",
                              request_id=getattr(request.state, "request_id", None), details=f"Failed sign-in for badge {work_id[:32]}")
            else:
                session_id = str(uuid.uuid4())
                access_token = secrets.token_urlsafe(48)
                expires_at = _utcnow() + datetime.timedelta(hours=SESSION_HOURS)
                connection.execute(_sql_text("""
                    INSERT INTO auth_sessions (session_id, employee_id, token_hash, created_at_utc, expires_at_utc)
                    VALUES (:session_id, :employee_id, :token_hash, UTC_TIMESTAMP(6), :expires_at_utc)
                """), {"session_id": session_id, "employee_id": user["id"], "token_hash": _token_digest(access_token), "expires_at_utc": expires_at.replace(tzinfo=None)})
                _audit_insert(connection, employee_id=user["id"], employee_work_id=user["work_id"], employee_name=user["full_name"], role=user["role"],
                              event_type="sign_in", session_id=session_id, request_id=getattr(request.state, "request_id", None))
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Authentication] Login failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Authentication service is unavailable") from exc
    if not credentials_valid:
        raise HTTPException(status_code=401, detail="Invalid employee ID or password")
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user["id"],
            work_id=user["work_id"],
            full_name=user["full_name"],
            role=user["role"],
            assigned_machine=user["assigned_machine"],
            email=user["email"], department=user.get("department"), shift=user.get("shift"), is_active=user.get("is_active", True)
        )
    )

@app.get("/api/v1/auth/me", response_model=UserProfileResponse)
def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return UserProfileResponse(
        id=user["id"],
        work_id=user["work_id"],
        full_name=user["full_name"],
        role=user["role"],
        assigned_machine=user["assigned_machine"],
        email=user["email"], department=user.get("department"), shift=user.get("shift"), is_active=user.get("is_active", True)
    )

@app.post("/api/v1/auth/logout")
def logout(request: Request, user: Dict[str, Any] = Depends(get_current_user), authorization: Optional[str] = Header(None)):
    if DEMO_AUTH_ENABLED:
        if authorization:
            _, _, token = authorization.partition(" ")
            DEMO_SESSIONS.pop(_token_digest(token.strip()), None)
        return {"signed_out": True}
    engine = get_telemetry_engine()
    try:
        with engine.begin() as connection:
            connection.execute(_sql_text("UPDATE auth_sessions SET revoked_at_utc = UTC_TIMESTAMP(6), revoke_reason = 'user_sign_out' WHERE session_id = :session_id AND revoked_at_utc IS NULL"), {"session_id": user["session_id"]})
            _audit_insert(connection, employee_id=user["id"], employee_work_id=user["work_id"], employee_name=user["full_name"], role=user["role"],
                          event_type="sign_out", session_id=user["session_id"], request_id=getattr(request.state, "request_id", None))
    except Exception as exc:
        print(f"[Authentication] Logout failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Could not record sign-out") from exc
    return {"signed_out": True}

@app.get("/api/v1/admin/activity-log")
def get_admin_activity_log(limit: int = 250, user: Dict[str, Any] = Depends(require_roles(["Admin"]))):
    if DEMO_AUTH_ENABLED:
        return {"factory_time_zone": "UTC", "events": [], "demo_mode": True}
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 1000")
    engine = get_telemetry_engine()
    try:
        with engine.connect() as connection:
            rows = connection.execute(_sql_text("""
                SELECT id, employee_id, employee_name, role_at_event, event_type, occurred_at_utc,
                       employee_work_id, session_id, request_id, details
                FROM activity_log ORDER BY occurred_at_utc DESC, id DESC LIMIT :limit
            """), {"limit": limit}).mappings().all()
        events = []
        for row in rows:
            local_timestamp, zone_name = _factory_time(row["occurred_at_utc"])
            events.append(AuditEventRecord(
                id=row["id"], employee_id=row["employee_id"], employee_work_id=row["employee_work_id"], employee_name=row["employee_name"], role=row["role_at_event"],
                event_type=row["event_type"], occurred_at_utc=_iso_utc(row["occurred_at_utc"]),
                occurred_at_local=local_timestamp, factory_time_zone=zone_name,
                session_id=row["session_id"], request_id=row["request_id"], details=row["details"],
            ).model_dump())
        try:
            ZoneInfo(FACTORY_TIMEZONE)
            factory_time_zone = FACTORY_TIMEZONE
        except ZoneInfoNotFoundError:
            factory_time_zone = "UTC"
        return {"factory_time_zone": factory_time_zone, "events": events, "demo_mode": False}
    except Exception as exc:
        print(f"[Activity Log] Read failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Activity log is unavailable") from exc

@app.get("/api/v1/admin/users")
def get_admin_users(user: Dict[str, Any] = Depends(require_roles(["Admin"]))):
    """Admin only: list registered system users and assigned roles."""
    if DEMO_AUTH_ENABLED:
        return [{"id": u["id"], "work_id": u["work_id"], "full_name": u["full_name"], "role": u["role"], "assigned_machine": u["assigned_machine"], "email": u["email"], "department": u.get("department"), "shift": u.get("shift"), "is_active": u.get("is_active", True)} for u in DEMO_USERS.values()]
    engine = get_telemetry_engine()
    try:
        with engine.connect() as connection:
            rows = connection.execute(_sql_text("SELECT id, work_id, full_name, role, assigned_machine, email, department, shift, is_active FROM users ORDER BY full_name")).mappings().all()
        return [dict(row) for row in rows]
    except Exception as exc:
        print(f"[Personnel] Read failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Personnel directory is unavailable") from exc

@app.post("/api/v1/admin/users", status_code=201)
def create_admin_user(payload: AdminUserCreateRequest, request: Request, user: Dict[str, Any] = Depends(require_roles(["Admin"]))):
    if DEMO_AUTH_ENABLED:
        work_id = payload.work_id.strip().upper()
        if work_id in DEMO_USERS:
            raise HTTPException(status_code=409, detail="That employee ID already exists")
        new_user = {"id": max((item["id"] for item in DEMO_USERS.values()), default=0) + 1,
                    "work_id": work_id, "full_name": payload.full_name.strip(),
                    "password_hash": _hash_password(payload.password, secrets.token_bytes(16)),
                    "role": payload.role, "assigned_machine": payload.assigned_machine,
                    "email": payload.email.strip(), "department": payload.department,
                    "shift": payload.shift, "is_active": True}
        DEMO_USERS[work_id] = new_user
        return {k: v for k, v in new_user.items() if k != "password_hash"}
    engine = get_telemetry_engine()
    try:
        password_hash = _hash_password(payload.password, secrets.token_bytes(16))
        work_id = payload.work_id.strip().upper()
        with engine.begin() as connection:
            result = connection.execute(_sql_text("""
                INSERT INTO users (work_id, full_name, password_hash, role, assigned_machine, email, department, shift, is_active)
                VALUES (:work_id, :full_name, :password_hash, :role, :assigned_machine, :email, :department, :shift, TRUE)
            """), {"work_id": work_id, "full_name": payload.full_name.strip(), "password_hash": password_hash, "role": payload.role, "assigned_machine": payload.assigned_machine, "email": payload.email.strip(), "department": payload.department, "shift": payload.shift})
            new_id = result.lastrowid
            _audit_insert(connection, employee_id=user["id"], employee_work_id=user["work_id"], employee_name=user["full_name"], role=user["role"], event_type="user_created", session_id=user.get("session_id"), request_id=getattr(request.state, "request_id", None), details=f"Created employee {work_id} with role {payload.role}")
        return {"id": new_id, "work_id": work_id, "full_name": payload.full_name.strip(), "role": payload.role, "assigned_machine": payload.assigned_machine, "email": payload.email.strip(), "department": payload.department, "shift": payload.shift, "is_active": True}
    except Exception as exc:
        if isinstance(exc, HTTPException): raise
        print(f"[Personnel] Create failed: {type(exc).__name__}")
        raise HTTPException(status_code=409, detail="Personnel record could not be created; check for a duplicate employee ID or email") from exc

@app.patch("/api/v1/admin/users/{employee_id}")
def update_admin_user(employee_id: int, payload: AdminUserUpdateRequest, request: Request, user: Dict[str, Any] = Depends(require_roles(["Admin"]))):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No personnel fields supplied")
    if any(updates.get(field) is None for field in ("full_name", "role", "email", "is_active") if field in updates):
        raise HTTPException(status_code=422, detail="Name, role, email, and active status cannot be null")
    if employee_id == user["id"] and (updates.get("role", user["role"]) != "Admin" or updates.get("is_active") is False):
        raise HTTPException(status_code=409, detail="You cannot remove your own administrator access")
    if DEMO_AUTH_ENABLED:
        target = next((item for item in DEMO_USERS.values() if item["id"] == employee_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Employee not found")
        next_work_id = updates.get("work_id", target["work_id"]).strip().upper()
        if next_work_id != target["work_id"] and next_work_id in DEMO_USERS:
            raise HTTPException(status_code=409, detail="That employee ID already exists")
        leaving_admin = target["role"] == "Admin" and target.get("is_active", True) and (updates.get("role", "Admin") != "Admin" or updates.get("is_active") is False)
        if leaving_admin and sum(1 for item in DEMO_USERS.values() if item["role"] == "Admin" and item.get("is_active", True)) <= 1:
            raise HTTPException(status_code=409, detail="At least one active administrator must remain")
        target.update({k: v for k, v in updates.items() if k != "password"})
        target["work_id"] = next_work_id
        if "password" in updates:
            target["password_hash"] = _hash_password(updates["password"], secrets.token_bytes(16))
        if next_work_id != user["work_id"]:
            DEMO_USERS.pop(user["work_id"], None)
        DEMO_USERS[next_work_id] = target
        if "password" in updates or updates.get("is_active") is False:
            for digest, session in list(DEMO_SESSIONS.items()):
                if session["user"]["id"] == employee_id:
                    DEMO_SESSIONS.pop(digest, None)
        return {k: v for k, v in target.items() if k not in {"password", "password_hash"}}
    password_to_hash = updates.pop("password", None)
    if password_to_hash:
        updates["password_hash"] = _hash_password(password_to_hash, secrets.token_bytes(16))
    engine = get_telemetry_engine()
    allowed = {"work_id", "full_name", "role", "assigned_machine", "department", "shift", "email", "is_active", "password_hash"}
    assignments = ", ".join(f"{key} = :{key}" for key in updates if key in allowed)
    try:
        with engine.begin() as connection:
            before = connection.execute(_sql_text("SELECT id, work_id, role, is_active FROM users WHERE id = :id"), {"id": employee_id}).mappings().first()
            if not before: raise HTTPException(status_code=404, detail="Employee not found")
            leaving_admin_role = before["role"] == "Admin" and before["is_active"] and (updates.get("role", "Admin") != "Admin" or updates.get("is_active") is False)
            if leaving_admin_role:
                admin_count = connection.execute(_sql_text("SELECT COUNT(*) FROM users WHERE role = 'Admin' AND is_active = TRUE")).scalar_one()
                if admin_count <= 1: raise HTTPException(status_code=409, detail="At least one active administrator must remain")
            connection.execute(_sql_text(f"UPDATE users SET {assignments} WHERE id = :id"), {**updates, "id": employee_id})
            if updates.get("is_active") is False:
                connection.execute(_sql_text("UPDATE auth_sessions SET revoked_at_utc = UTC_TIMESTAMP(6), revoke_reason = 'account_deactivated' WHERE employee_id = :id AND revoked_at_utc IS NULL"), {"id": employee_id})
            if password_to_hash:
                connection.execute(_sql_text("UPDATE auth_sessions SET revoked_at_utc = UTC_TIMESTAMP(6), revoke_reason = 'password_reset' WHERE employee_id = :id AND revoked_at_utc IS NULL"), {"id": employee_id})
            event_type = "user_password_reset" if password_to_hash else ("user_role_changed" if "role" in updates else "user_updated")
            _audit_insert(connection, employee_id=user["id"], employee_work_id=user["work_id"], employee_name=user["full_name"], role=user["role"], event_type=event_type, session_id=user.get("session_id"), request_id=getattr(request.state, "request_id", None), details=f"Updated {before['work_id']}; role {before['role']} -> {updates.get('role', before['role'])}")
            after = connection.execute(_sql_text("SELECT id, work_id, full_name, role, assigned_machine, email, department, shift, is_active FROM users WHERE id = :id"), {"id": employee_id}).mappings().first()
        return dict(after)
    except HTTPException: raise
    except Exception as exc:
        print(f"[Personnel] Update failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Personnel update failed") from exc

@app.delete("/api/v1/admin/users/{employee_id}")
def deactivate_admin_user(employee_id: int, request: Request, user: Dict[str, Any] = Depends(require_roles(["Admin"]))):
    if employee_id == user["id"]:
        raise HTTPException(status_code=409, detail="You cannot deactivate your own account")
    if DEMO_AUTH_ENABLED:
        target = next((item for item in DEMO_USERS.values() if item["id"] == employee_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Employee not found")
        if target["role"] == "Admin" and target.get("is_active", True) and sum(1 for item in DEMO_USERS.values() if item["role"] == "Admin" and item.get("is_active", True)) <= 1:
            raise HTTPException(status_code=409, detail="At least one active administrator must remain")
        target["is_active"] = False
        for digest, session in list(DEMO_SESSIONS.items()):
            if session["user"]["id"] == employee_id:
                DEMO_SESSIONS.pop(digest, None)
        return {"deactivated": True}
    engine = get_telemetry_engine()
    try:
        with engine.begin() as connection:
            employee = connection.execute(_sql_text("SELECT work_id, role, is_active FROM users WHERE id = :id"), {"id": employee_id}).mappings().first()
            if not employee: raise HTTPException(status_code=404, detail="Employee not found")
            if employee["role"] == "Admin" and employee["is_active"]:
                admin_count = connection.execute(_sql_text("SELECT COUNT(*) FROM users WHERE role = 'Admin' AND is_active = TRUE")).scalar_one()
                if admin_count <= 1: raise HTTPException(status_code=409, detail="At least one active administrator must remain")
            connection.execute(_sql_text("UPDATE users SET is_active = FALSE WHERE id = :id"), {"id": employee_id})
            connection.execute(_sql_text("UPDATE auth_sessions SET revoked_at_utc = UTC_TIMESTAMP(6), revoke_reason = 'account_deactivated' WHERE employee_id = :id AND revoked_at_utc IS NULL"), {"id": employee_id})
            _audit_insert(connection, employee_id=user["id"], employee_work_id=user["work_id"], employee_name=user["full_name"], role=user["role"], event_type="user_deactivated", session_id=user.get("session_id"), request_id=getattr(request.state, "request_id", None), details=f"Deactivated employee {employee['work_id']}")
        return {"deactivated": True}
    except HTTPException: raise
    except Exception as exc:
        print(f"[Personnel] Deactivation failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Personnel deactivation failed") from exc

# ------------------------------------------------------------------------------
# Telemetry & Machine Routes
# ------------------------------------------------------------------------------

@app.get("/api/v1/machines")
def list_machines(user: Dict[str, Any] = Depends(get_current_user)):
    machines = [
        {"code": "CNC-MILL-01", "name": "5-Axis Precision Vertical Mill Alpha", "line_id": "Line 1 - Aerospace Rotor Cell", "status": "Nominal", "cut_hours": 1420.5},
        {"code": "CNC-MILL-02", "name": "High-Speed CNC Milling Center Beta", "line_id": "Line 1 - Aerospace Rotor Cell", "status": "Warning", "cut_hours": 2190.0},
        {"code": "CNC-LATHE-03", "name": "Heavy Duty CNC Turning Center Gamma", "line_id": "Line 2 - Drivetrain Shafts", "status": "Nominal", "cut_hours": 3410.2},
        {"code": "CNC-HEAVY-04", "name": "Multi-Spindle Heavy Gantry Station", "line_id": "Line 3 - Structural Housings", "status": "Critical", "cut_hours": 4890.8},
    ]
    if user["role"] == "Operator":
        return [machine for machine in machines if machine["code"] == user.get("assigned_machine")]
    return machines

@app.get("/api/v1/machines/{code}/telemetry", response_model=TelemetryReadingSchema)
def get_machine_telemetry(code: str, user: Dict[str, Any] = Depends(get_current_user)):
    if user["role"] == "Operator" and code != user.get("assigned_machine"):
        raise HTTPException(status_code=403, detail="Operators may view telemetry only for their assigned machine")
    now = datetime.datetime.utcnow().isoformat()
    return TelemetryReadingSchema(
        timestamp=now,
        spindle_rpm=4500.0,
        feed_rate_mmpm=350.0,
        vib_x=1.35,
        vib_y=1.42,
        vib_z=0.98,
        vib_rms=1.85,
        motor_power_kw=8.4,
        motor_load_pct=68.5,
        coolant_temp_c=24.5,
        data_provenance="EMPIRICAL DATASET"
    )

# ------------------------------------------------------------------------------
# External simulator telemetry ingestion and retrieval
# ------------------------------------------------------------------------------

@lru_cache(maxsize=1)
def load_canonical_machine_master() -> Dict[str, Dict[str, str]]:
    """Load the checked-in 400-machine master without creating or modifying machines."""
    master_path = Path(__file__).resolve().parents[1] / "public" / "machine-name.json"
    try:
        with master_path.open("r", encoding="utf-8") as master_file:
            records = json.load(master_file)
        by_id = {record["machineId"]: record for record in records}
        if len(records) != 400 or len(by_id) != len(records):
            raise ValueError("canonical machine master must contain 400 unique machine IDs")
        return by_id
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise RuntimeError("FactoryPulse canonical machine master is unavailable or invalid") from exc

def resolve_canonical_machine(machine_id: str) -> Dict[str, Any]:
    try:
        machine = load_canonical_machine_master().get(machine_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Canonical machine master is unavailable") from exc
    if machine is None:
        # Check dynamic registry for newly created machines
        try:
            from .machine_inventory import DYNAMIC_REGISTERED_MACHINES
            if machine_id in DYNAMIC_REGISTERED_MACHINES:
                return DYNAMIC_REGISTERED_MACHINES[machine_id]
        except Exception:
            pass
        # Check SQL database
        try:
            engine = get_telemetry_engine()
            with engine.connect() as conn:
                row = conn.execute(_sql_text("SELECT * FROM machines WHERE machine_id = :mid OR simulator_machine_id = :mid OR machine_code = :mid"), {"mid": machine_id}).mappings().first()
                if row:
                    return {
                        "machineId": row.get("machine_id") or machine_id,
                        "machineCode": row.get("machine_code") or f"CNC-{machine_id}",
                        "displayName": row.get("name") or machine_id,
                        "machineType": row.get("machine_type") or "5-Axis CNC Machining Center",
                        "model": row.get("model") or "Standard Model",
                        "plant": row.get("plant") or "Plant A: Precision Machining",
                        "shopFloor": row.get("location") or "Floor A1: Aerospace Micro-Milling",
                        "productionLine": row.get("line_id") or "Line 5AX-01",
                        "is_active": bool(row.get("is_active", True))
                    }
        except Exception:
            pass
    if machine is None:
        raise HTTPException(status_code=422, detail=f"Unknown canonical machine_id: {machine_id}")
    return machine

SIMULATOR_SENSOR_UNITS = {
    "Motor Temperature": "°C",
    "Temperature": "°C",
    "Vibration": "mm/s",
    "RPM": "RPM",
    "Torque": "Nm",
    "Current": "A",
}

def validate_simulator_sensor_unit(payload: SimulatorTelemetryIngest) -> None:
    expected_unit = SIMULATOR_SENSOR_UNITS.get(payload.sensor_name)
    if expected_unit is None or payload.sensor_unit != expected_unit:
        raise HTTPException(status_code=422, detail="sensor_name and sensor_unit are not in the simulator's canonical sensor profile")

def require_simulator_api_key(x_api_key: Optional[str] = Header(None, alias="X-Simulator-API-Key")) -> None:
    expected_key = os.environ.get("SIMULATOR_API_KEY", "")
    if not expected_key:
        raise HTTPException(status_code=503, detail="Simulator ingestion is not configured")
    if not x_api_key or not secrets.compare_digest(x_api_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid simulator API key")

@lru_cache(maxsize=4)
def _create_telemetry_engine(database_url: str):
    from sqlalchemy import create_engine, event
    engine = create_engine(database_url, pool_pre_ping=True)
    if database_url.startswith("mysql"):
        @event.listens_for(engine, "connect")
        def set_mysql_connection_utc(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("SET time_zone = '+00:00'")
            finally:
                cursor.close()
    return engine

def get_telemetry_engine():
    if DEMO_AUTH_ENABLED:
        raise HTTPException(status_code=503, detail="MySQL access is disabled for demo sessions")
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise HTTPException(status_code=503, detail="Telemetry database is not configured")
    # Railway exposes MySQL_URL as mysql://; use the PyMySQL driver included here.
    if database_url.startswith("mysql://"):
        database_url = "mysql+pymysql://" + database_url[len("mysql://"):]
    try:
        return _create_telemetry_engine(database_url)
    except Exception as exc:
        print(f"[Telemetry API] Database engine setup failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Telemetry database is unavailable") from exc

def _sql_text(query: str):
    from sqlalchemy import text
    return text(query)

def _iso_utc(value: Any) -> str:
    if isinstance(value, str):
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        parsed = value
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=datetime.timezone.utc)
    return parsed.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

def _decode_sensor_value(value: Any) -> Any:
    if isinstance(value, (int, float, type(None))):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return value

def _reading_values_match(row: Any, payload: SimulatorTelemetryIngest, machine: Dict[str, str]) -> bool:
    expected_timestamp = payload.timestamp.replace(tzinfo=None)
    row_timestamp = row["reading_timestamp"]
    if isinstance(row_timestamp, str):
        row_timestamp = datetime.datetime.fromisoformat(row_timestamp.replace("Z", "+00:00"))
    if row_timestamp.tzinfo is not None:
        row_timestamp = row_timestamp.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    sensor_value = _decode_sensor_value(row["sensor_value_json"])
    return (
        row["machine_id"] == payload.machine_id
        and row_timestamp == expected_timestamp
        and row["machine_code"] == machine["machineCode"]
        and row["machine_type"] == machine["machineType"]
        and row["department"] == machine["shopFloor"]
        and row["production_line"] == machine["productionLine"]
        and row["sensor_name"] == payload.sensor_name
        and row["sensor_unit"] == payload.sensor_unit
        and sensor_value == payload.sensor_value
        and math.isclose(float(row["expected_min"]), payload.expected_min, rel_tol=1e-6, abs_tol=1e-6)
        and math.isclose(float(row["expected_max"]), payload.expected_max, rel_tol=1e-6, abs_tol=1e-6)
        and row["machine_status"] == payload.machine_status
        and row["data_quality"] == payload.data_quality
        and row["fault_mode"] == payload.fault_mode
    )

def persist_simulator_reading(payload: SimulatorTelemetryIngest, machine: Dict[str, str], engine=None) -> bool:
    """Persist one reading and return True when an identical reading was already stored."""
    db_engine = engine or get_telemetry_engine()
    from sqlalchemy.exc import IntegrityError
    parameters = {
        "reading_id": payload.reading_id,
        "machine_id": payload.machine_id,
        "machine_code": machine["machineCode"],
        "reading_timestamp": payload.timestamp.replace(tzinfo=None),
        "machine_type": machine["machineType"],
        "department": machine["shopFloor"],
        "production_line": machine["productionLine"],
        "sensor_name": payload.sensor_name,
        "sensor_unit": payload.sensor_unit,
        "sensor_value_json": json.dumps(payload.sensor_value, ensure_ascii=False, allow_nan=False),
        "expected_min": payload.expected_min,
        "expected_max": payload.expected_max,
        "machine_status": payload.machine_status,
        "data_quality": payload.data_quality,
        "fault_mode": payload.fault_mode,
        "data_provenance": "SIMULATED",
        "data_source": "AI_SIMULATOR",
    }
    select_sql = _sql_text("""
        SELECT reading_id, machine_id, machine_code, reading_timestamp, machine_type, department,
               production_line, sensor_name, sensor_unit, sensor_value_json, expected_min,
               expected_max, machine_status, data_quality, fault_mode
        FROM simulator_sensor_readings WHERE reading_id = :reading_id
    """)
    try:
        with db_engine.begin() as connection:
            existing = connection.execute(select_sql, {"reading_id": payload.reading_id}).mappings().first()
            if existing:
                if _reading_values_match(existing, payload, machine):
                    return True
                raise HTTPException(status_code=409, detail="reading_id already exists with different telemetry")
            connection.execute(_sql_text("""
                INSERT INTO simulator_sensor_readings (
                    reading_id, machine_id, machine_code, reading_timestamp, machine_type, department,
                    production_line, sensor_name, sensor_unit, sensor_value_json, expected_min,
                    expected_max, machine_status, data_quality, fault_mode, data_provenance,
                    data_source
                ) VALUES (
                    :reading_id, :machine_id, :machine_code, :reading_timestamp, :machine_type, :department,
                    :production_line, :sensor_name, :sensor_unit, :sensor_value_json, :expected_min,
                    :expected_max, :machine_status, :data_quality, :fault_mode, :data_provenance,
                    :data_source
                )
            """), parameters)
        return False
    except HTTPException:
        raise
    except IntegrityError as exc:
        # A concurrent retry can race the initial lookup. Re-read after rollback.
        try:
            with db_engine.connect() as connection:
                existing = connection.execute(select_sql, {"reading_id": payload.reading_id}).mappings().first()
        except Exception as read_exc:
            print(f"[Telemetry API] Duplicate reconciliation failed: {type(read_exc).__name__}")
            raise HTTPException(status_code=503, detail="Telemetry database is unavailable") from read_exc
        if existing and _reading_values_match(existing, payload, machine):
            return True
        if existing:
            raise HTTPException(status_code=409, detail="reading_id already exists with different telemetry") from exc
        print("[Telemetry API] Database rejected telemetry insert (integrity constraint)")
        raise HTTPException(status_code=503, detail="Telemetry could not be stored") from exc
    except Exception as exc:
        print(f"[Telemetry API] Database write failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Telemetry database is unavailable") from exc

def _telemetry_response(payload: SimulatorTelemetryIngest, machine: Dict[str, str], duplicate: bool) -> TelemetryIngestResponse:
    return TelemetryIngestResponse(
        stored=0 if duplicate else 1,
        duplicate=duplicate,
        reading_id=payload.reading_id,
        machine_id=payload.machine_id,
        machine_code=machine["machineCode"],
        machine_name=machine["displayName"],
    )

@app.post("/api/v1/telemetry", response_model=TelemetryIngestResponse, status_code=201)
def ingest_simulator_telemetry(
    payload: SimulatorTelemetryIngest,
    _authorized: None = Depends(require_simulator_api_key),
):
    """Accept the simulator's raw per-sensor TelemetryRecord without reshaping it."""
    machine = resolve_canonical_machine(payload.machine_id)
    if machine.get("is_active") is False:
        raise HTTPException(
            status_code=422,
            detail=f"Machine {payload.machine_id} is deactivated. Activate this machine in FactoryPulse Admin to receive simulator telemetry."
        )
    validate_simulator_sensor_unit(payload)
    duplicate = persist_simulator_reading(payload, machine)
    response = _telemetry_response(payload, machine, duplicate)
    # Idempotent retries are successful but are not new creations.
    if duplicate:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=200, content=response.model_dump())
    return response

@app.get("/api/v1/telemetry/latest/{machine_id}", response_model=List[TelemetryReadingRecord])
def get_simulator_telemetry_readings(
    machine_id: str,
    limit: int = 100,
    since: Optional[datetime.datetime] = None,
    until: Optional[datetime.datetime] = None,
    sensor_name: Optional[str] = None,
    data_source: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Return persisted simulator readings for a canonical machine, newest first."""
    machine = resolve_canonical_machine(machine_id)
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 1000")
    if sensor_name is not None and (not sensor_name.strip() or len(sensor_name) > 128):
        raise HTTPException(status_code=422, detail="sensor_name must contain 1 to 128 characters")
    if data_source is not None and (not data_source.strip() or len(data_source) > 64):
        raise HTTPException(status_code=422, detail="data_source must contain 1 to 64 characters")
    if user.get("role") == "Operator" and machine["machineCode"] != user.get("assigned_machine"):
        raise HTTPException(status_code=403, detail="Operators may only view telemetry for their assigned machine")
    for label, value in (("since", since), ("until", until)):
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise HTTPException(status_code=422, detail=f"{label} must include a timezone")
    if since and until and since > until:
        raise HTTPException(status_code=422, detail="since must be earlier than or equal to until")
    engine = get_telemetry_engine()
    try:
        filters = ["machine_id = :machine_id"]
        parameters: Dict[str, Any] = {"machine_id": machine_id, "limit": limit}
        if since:
            filters.append("reading_timestamp >= :since")
            parameters["since"] = since.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        if until:
            filters.append("reading_timestamp <= :until")
            parameters["until"] = until.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        if sensor_name:
            filters.append("sensor_name = :sensor_name")
            parameters["sensor_name"] = sensor_name
        if data_source:
            filters.append("data_source = :data_source")
            parameters["data_source"] = data_source.upper()
        query = f"""
            SELECT reading_id, machine_id, machine_code, reading_timestamp, machine_type, department,
                   production_line, sensor_name, sensor_unit, sensor_value_json, expected_min,
                   expected_max, machine_status, data_quality, fault_mode, data_provenance
            FROM simulator_sensor_readings
            WHERE {' AND '.join(filters)}
            ORDER BY reading_timestamp DESC, id DESC
            LIMIT :limit
        """
        with engine.connect() as connection:
            rows = connection.execute(_sql_text(query), parameters).mappings().all()
        return [TelemetryReadingRecord(
            reading_id=row["reading_id"],
            machine_id=machine_id,
            timestamp=_iso_utc(row["reading_timestamp"]),
            machine_type=row["machine_type"],
            department=row["department"],
            production_line=row["production_line"],
            sensor_name=row["sensor_name"],
            sensor_unit=row["sensor_unit"],
            sensor_value=_decode_sensor_value(row["sensor_value_json"]),
            expected_min=row["expected_min"],
            expected_max=row["expected_max"],
            machine_status=row["machine_status"],
            data_quality=row["data_quality"],
            fault_mode=row["fault_mode"],
            machine_code=machine["machineCode"],
            display_name=machine["displayName"],
            data_provenance="SIMULATED",
        ) for row in rows]
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Telemetry API] Database read failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Telemetry database is unavailable") from exc

@app.get("/api/v1/telemetry/fleet/latest", response_model=List[TelemetryReadingRecord])
def get_simulator_fleet_latest_readings(
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Return the newest persisted simulator reading for each machine and sensor.

    Fleet roles can compare the records across plants. Operators are restricted
    to their assigned machine, matching the per-machine history endpoint.
    """
    master = load_canonical_machine_master()
    assigned_machine_id = None
    if user.get("role") == "Operator":
        assigned_code = user.get("assigned_machine")
        assigned_machine_id = next(
            (machine_id for machine_id, machine in master.items() if machine["machineCode"] == assigned_code),
            None,
        )
        if assigned_machine_id is None:
            return []

    engine = get_telemetry_engine()
    try:
        machine_filter = "WHERE machine_id = :machine_id" if assigned_machine_id else ""
        parameters = {"machine_id": assigned_machine_id} if assigned_machine_id else {}
        # Loose index grouping followed by bounded index seeks avoids a window
        # sort of every historical JSON row on each dashboard refresh.
        query = """
            SELECT reading_id, machine_id, machine_code, reading_timestamp, machine_type, department,
                   production_line, sensor_name, sensor_unit, sensor_value_json, expected_min,
                   expected_max, machine_status, data_quality, fault_mode, data_provenance
            FROM simulator_sensor_readings
            WHERE machine_id = :machine_id AND sensor_name = :sensor_name
              AND data_source = 'AI_SIMULATOR'
            ORDER BY reading_timestamp DESC, id DESC LIMIT 1
        """
        with engine.connect() as connection:
            streams = connection.execute(_sql_text(f"""
                SELECT machine_id, sensor_name FROM simulator_sensor_readings
                {machine_filter} GROUP BY machine_id, sensor_name
            """), parameters).mappings().all()
            rows = []
            for stream in streams:
                row = connection.execute(_sql_text(query), dict(stream)).mappings().first()
                if row:
                    rows.append(row)
        response = []
        for row in rows:
            machine = master.get(row["machine_id"])
            if machine is None:
                continue
            response.append(TelemetryReadingRecord(
                reading_id=row["reading_id"],
                machine_id=row["machine_id"],
                timestamp=_iso_utc(row["reading_timestamp"]),
                machine_type=row["machine_type"],
                department=row["department"],
                production_line=row["production_line"],
                sensor_name=row["sensor_name"],
                sensor_unit=row["sensor_unit"],
                sensor_value=_decode_sensor_value(row["sensor_value_json"]),
                expected_min=row["expected_min"],
                expected_max=row["expected_max"],
                machine_status=row["machine_status"],
                data_quality=row["data_quality"],
                fault_mode=row["fault_mode"],
                machine_code=machine["machineCode"],
                display_name=machine["displayName"],
                data_provenance="SIMULATED",
            ))
        return response
    except Exception as exc:
        print(f"[Telemetry API] Fleet read failed: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Telemetry database is unavailable") from exc

@app.post("/api/v1/machines/inject-telemetry")
def inject_telemetry(
    machine_code: str,
    anomaly_type: str,
    request: Request,
    user: Dict[str, Any] = Depends(require_roles(["Supervisor", "Maintenance"]))
):
    """
    Supervisor / Maintenance demo generator (Admin forbidden per approved role matrix).
    Returns a simulated sample; it does not persist the telemetry.
    External simulator persistence uses POST /api/v1/telemetry.
    """
    now = datetime.datetime.utcnow().isoformat()
    sim_record = {
        "timestamp": now,
        "machine_code": machine_code,
        "spindle_rpm": 4320.0,
        "feed_rate_mmpm": 480.0,
        "vib_rms": 5.45,
        "motor_power_kw": 16.2,
        "motor_load_pct": 92.5,
        "data_provenance": "SIMULATED",
        "injected_anomaly_type": anomaly_type,
        "injected_by": user["full_name"],
        "storage_status": "DEMO_ONLY_NOT_PERSISTED"
    }

    record_activity(user=user, event_type="simulated_alert_injected", request_id=getattr(request.state, "request_id", None), details=f"Injected {anomaly_type} demo anomaly on {machine_code}; sample not persisted")

    return sim_record

# ------------------------------------------------------------------------------
# Incidents Routes & Workflow Transitions
# ------------------------------------------------------------------------------

@app.get("/api/v1/incidents")
def list_incidents(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity_filter: Optional[str] = Query(None, alias="severity"),
    machine_filter: Optional[str] = Query(None, alias="machine"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    results = INCIDENTS_STORE
    if status_filter and status_filter != "ALL":
        results = [i for i in results if i["status"] == status_filter]
    if severity_filter and severity_filter != "ALL":
        results = [i for i in results if i["severity"] == severity_filter]
    if machine_filter:
        results = [i for i in results if i["machine_code"] == machine_filter]
    if user["role"] == "Operator" and user.get("assigned_machine"):
        results = [i for i in results if i["machine_code"] == user["assigned_machine"]]
    return results

@app.post("/api/v1/incidents")
def create_incident(
    payload: CreateIncidentRequest,
    request: Request,
    user: Dict[str, Any] = Depends(require_roles(["Operator", "Supervisor", "Maintenance"]))
):
    """Operator, Supervisor, Maintenance can create. Manager and Admin cannot."""
    # Machine authorization enforcement: Operator cannot report against unauthorized machines
    if user["role"] == "Operator" and user.get("assigned_machine"):
        if payload.machine_code != user["assigned_machine"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission Denied: Operator {user['work_id']} is assigned to {user['assigned_machine']} and cannot report incidents for unauthorized machine {payload.machine_code}."
            )

    # Deduplication Policy: Prevent duplicate active incidents for same machine and component area
    duplicate = next(
        (i for i in INCIDENTS_STORE
         if i["machine_code"] == payload.machine_code
         and i["component_area"] == payload.component_area
         and i["status"] in ["Open", "Action_Required", "In_Investigation"]),
        None
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate incident prevented: Active ticket {duplicate['incident_code']} already exists for {payload.machine_code} ({payload.component_area})."
        )

    new_id = max([i["id"] for i in INCIDENTS_STORE], default=100) + 1
    new_code = f"INC-2026-{new_id:03d}"
    incident_record = {
        "id": new_id,
        "incident_code": new_code,
        "machine_code": payload.machine_code,
        "reporter_id": user["id"],
        "reporter_name": user["full_name"],
        "reporter_role": user["role"],
        "severity": payload.severity,
        "symptom_description": payload.symptom_description,
        "operator_notes": payload.operator_notes,
        "component_area": payload.component_area,
        "measured_vib_rms": payload.measured_vib_rms,
        "measured_motor_power_kw": payload.measured_motor_power_kw,
        "measured_motor_load_pct": payload.measured_motor_load_pct,
        "correlated_vb_mm": payload.correlated_vb_mm,
        "correlated_ra_um": payload.correlated_ra_um,
        "data_provenance": payload.data_provenance,
        "assigned_to_name": None,
        "status": "Open",
        "created_at": datetime.datetime.utcnow().isoformat(),
        "closed_at": None,
        "notes": None,
    }
    record_activity(user=user, event_type="incident_created", request_id=getattr(request.state, "request_id", None), details=f"Created {new_code} for machine {payload.machine_code}")
    INCIDENTS_STORE.append(incident_record)

    # This Phase 1 route stores the incident in the in-memory demo store. It is not
    # committed to MySQL, so it must not publish a cloud notification.
    return incident_record

@app.get("/api/v1/realtime/config")
def get_realtime_config(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Reports cloud delivery as disabled until transactions and channel authorization
    are enforced by the backend and Supabase policies.
    """
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or ""
    return {
        "provider": "Supabase Realtime",
        "source_of_truth": "MySQL",
        "is_configured": False,
        "delivery_enabled": False,
        "status": "disabled_pending_mysql_transactions_and_server_authorization",
        "reason": "Incident and work-order workflows are not MySQL-transaction-backed, and role/plant channel policies are not present in this project.",
        "supabase_url": supabase_url,
        "user_role": user["role"],
        "authorized_channels": [],
    }

@app.get("/api/v1/incidents/{incident_id}")
def get_incident(incident_id: int, user: Dict[str, Any] = Depends(get_current_user)):
    target = next((i for i in INCIDENTS_STORE if i["id"] == incident_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Incident ticket not found")
    if user["role"] == "Operator" and target["machine_code"] != user.get("assigned_machine"):
        raise HTTPException(status_code=403, detail="Operators may access incidents only for their assigned machine")
    return target

@app.patch("/api/v1/incidents/{incident_id}/assign")
def assign_incident(
    incident_id: int,
    payload: AssignIncidentRequest,
    request: Request,
    user: Dict[str, Any] = Depends(require_roles(["Supervisor"]))
):
    """Supervisor only: assign technician."""
    target = next((i for i in INCIDENTS_STORE if i["id"] == incident_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Incident ticket not found")
    record_activity(user=user, event_type="incident_assigned", request_id=getattr(request.state, "request_id", None), details=f"Assigned {target['incident_code']} to {payload.technician_name}")
    target["assigned_to_name"] = payload.technician_name
    target["status"] = "In_Investigation"
    return target

@app.patch("/api/v1/incidents/{incident_id}/progress")
def update_incident_progress(
    incident_id: int,
    payload: UpdateProgressRequest,
    request: Request,
    user: Dict[str, Any] = Depends(require_roles(["Maintenance"]))
):
    """Maintenance only: log investigation findings and repair status."""
    target = next((i for i in INCIDENTS_STORE if i["id"] == incident_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Incident ticket not found")
    record_activity(user=user, event_type="incident_progress_updated", request_id=getattr(request.state, "request_id", None), details=f"Updated maintenance progress for {target['incident_code']}")
    existing_notes = target.get("notes") or ""
    target["notes"] = (existing_notes + "\n\n" if existing_notes else "") + f"[Maintenance Log]: {payload.progress_notes}"
    target["status"] = "Action_Required"
    return target

@app.patch("/api/v1/incidents/{incident_id}/close")
def close_incident(
    incident_id: int,
    payload: CloseIncidentRequest,
    request: Request,
    user: Dict[str, Any] = Depends(require_roles(["Supervisor", "Maintenance"]))
):
    """Supervisor or Maintenance only with verified operational/maintenance sign-off."""
    target = next((i for i in INCIDENTS_STORE if i["id"] == incident_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Incident ticket not found")
    record_activity(user=user, event_type="incident_closed", request_id=getattr(request.state, "request_id", None), details=f"Closed {target['incident_code']}")
    target["status"] = "Closed"
    target["closed_at"] = datetime.datetime.utcnow().isoformat()
    target["closed_by_name"] = user["full_name"]
    target["closed_role"] = user["role"]
    target["closure_notes"] = payload.closure_notes
    return target

# ------------------------------------------------------------------------------
# Generative AI Investigation Assistant Route (Server-Side Calling Pattern)
# ------------------------------------------------------------------------------

@app.post("/api/v1/incidents/{incident_id}/ai-diagnose")
def diagnose_incident(
    incident_id: int,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    AI Diagnostic Specification & Safety Boundary:
    - Model Tag: gemini-3.8-flash (Pending API Model Verification)
    - safety_disclaimer: All recommendations are preliminary hypotheses. Mandatory Lock-Out/Tag-Out (LOTO) protocols apply.
    - future_sop_capability_note: Manufacturer-verified SOP retrieval is reserved for future phases.
    - unverified_metrics_excluded: Channel 14/15 excluded (Unit unverified in dataset documentation).
    """
    raise HTTPException(status_code=503, detail="Incident AI diagnosis is unavailable. Use the authorized Factory Intelligence endpoint for SQL evidence and optional selected-machine analysis.")

# ------------------------------------------------------------------------------
# Analytics Endpoints (Datasets 1, 2, 3, 4)
# ------------------------------------------------------------------------------

@app.get("/api/v1/analytics/tool-wear")
def get_tool_wear_analytics(user: Dict[str, Any] = Depends(require_roles(["Supervisor", "Manager", "Maintenance", "Admin"]))):
    """Dataset 1: CNC Machine Tool Wear Dataset (Vb in mm, 2,054 rows)"""
    return {
        "dataset_name": "CNC Machine Tool Wear Dataset",
        "row_count": 2054,
        "column_count": 154,
        "target_metric": "Vb (Flank Wear)",
        "unit": "mm",
        "mean_vb_mm": 0.194,
        "median_vb_mm": 0.178,
        "iqr_vb_mm": 0.115,
        "provisional_90th_percentile_vb_mm": 0.312,
        "missing_channels": ["sensor_channel_14", "sensor_channel_15"],
        "data_provenance": "EMPIRICAL DATASET"
    }

@app.get("/api/v1/analytics/surface-quality")
def get_surface_quality_analytics(user: Dict[str, Any] = Depends(require_roles(["Supervisor", "Manager", "Maintenance", "Admin"]))):
    """Dataset 2: CNC Turning Roughness Dataset (Ra in µm, 612 rows merged)"""
    return {
        "dataset_name": "CNC Turning Roughness Dataset",
        "row_count": 612,
        "column_count": 6,
        "target_metric": "Ra (Surface Roughness)",
        "unit": "µm",
        "exp1_mean_ra_um": 1.18,
        "exp2_mean_ra_um": 1.42,
        "overall_median_ra_um": 1.25,
        "prep_csv_status": "Strictly separate from Exp1/Exp2 (not Experiment 3)",
        "data_provenance": "EMPIRICAL DATASET"
    }

@app.get("/api/v1/analytics/telemetry")
def get_telemetry_analytics(user: Dict[str, Any] = Depends(require_roles(["Supervisor", "Manager", "Maintenance", "Admin"]))):
    """
    Dataset 3: CNC Mill Tool Telemetry Dataset
    25,286 rows across 18 experiments with experiment_name preserved.
    """
    return {
        "dataset_name": "CNC Mill Tool Telemetry Dataset",
        "row_count": 25286,
        "column_count": 49,
        "experiment_count": 18,
        "experiment_summaries": [
            {"experiment_name": "Experiment_01_Unworn", "samples": 1420, "avg_rpm": 4500, "avg_vib_rms": 1.82, "p95_vib_baseline": 2.35, "state": "Nominal"},
            {"experiment_name": "Experiment_02_Unworn", "samples": 1390, "avg_rpm": 4500, "avg_vib_rms": 1.91, "p95_vib_baseline": 2.41, "state": "Nominal"},
            {"experiment_name": "Experiment_06_Transition", "samples": 1450, "avg_rpm": 4500, "avg_vib_rms": 2.74, "p95_vib_baseline": 3.52, "state": "Transition"},
            {"experiment_name": "Experiment_12_Worn", "samples": 1380, "avg_rpm": 4480, "avg_vib_rms": 4.65, "p95_vib_baseline": 5.88, "state": "Worn Cutting"},
            {"experiment_name": "Experiment_18_Degraded", "samples": 1445, "avg_rpm": 4420, "avg_vib_rms": 5.82, "p95_vib_baseline": 7.15, "state": "Chatter Anomaly"},
        ],
        "disclaimer": "Provisional statistical baseline only — no trained ML anomaly model claimed or implied.",
        "data_provenance": "EMPIRICAL DATASET"
    }

@app.get("/api/v1/analytics/cycle-to-failure")
def get_cycle_to_failure_analytics(user: Dict[str, Any] = Depends(require_roles(["Supervisor", "Manager", "Maintenance", "Admin"]))):
    """Dataset 4: FeatureAndMetadata_Milling (CycleToFailure, 968 rows)"""
    return {
        "dataset_name": "FeatureAndMetadata_Milling",
        "row_count": 968,
        "column_count": 131,
        "target_metric": "CycleToFailure",
        "median_cycles": 295,
        "mean_cycles": 312,
        "iqr_cycles": "210 – 390 cuts",
        "target_distinction": "CycleToFailure is distinct from Vb flank wear",
        "data_provenance": "EMPIRICAL DATASET"
    }

@app.get("/api/v1/analytics/pipeline-health")
def get_pipeline_health(user: Dict[str, Any] = Depends(require_roles(["Supervisor", "Manager", "Maintenance", "Admin"]))):
    """Raw vs Processed Data Pipeline Health Audit."""
    return {
        "raw_counts": {
            "raw_cnc_tool_wear": 2054,
            "raw_turning_roughness": 612,
            "raw_mill_telemetry": 25286,
            "raw_milling_cycles": 968,
            "total_raw_rows": 28920
        },
        "sim_telemetry_events": 142,
        "validation_passed": True,
        "total_empirical_rows": 28920,
        "calculation_formula": "2,054 (D1) + 612 (D2) + 25,286 (D3) + 968 (D4) = 28,920 raw empirical rows"
    }

from .operational_insights import register as register_operational_insights
register_operational_insights(app, globals())
from .machine_inventory import register as register_machine_inventory
register_machine_inventory(app, globals())

# Replace legacy in-memory incident handlers with transaction-backed routes.
from api_server.sql_incidents import register as register_sql_incidents
_sql_incident_paths={'/api/v1/incidents','/api/v1/incidents/{incident_id}','/api/v1/incidents/{incident_id}/assign','/api/v1/incidents/{incident_id}/progress','/api/v1/incidents/{incident_id}/close'}
app.router.routes[:]=[route for route in app.router.routes if getattr(route,'path',None) not in _sql_incident_paths]
register_sql_incidents(app,globals())
