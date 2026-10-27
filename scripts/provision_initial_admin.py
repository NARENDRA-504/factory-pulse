"""Provision the first production Admin from a trusted local terminal."""
import base64
import getpass
import hashlib
import os
import re
import secrets
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


def hash_password(password: str) -> str:
    iterations = 310_000
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    encode = lambda value: base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")
    return f"pbkdf2_sha256${iterations}${encode(salt)}${encode(digest)}"


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("Set DATABASE_URL in the backend environment before provisioning.")
    if database_url.startswith("mysql://"):
        database_url = "mysql+pymysql://" + database_url[len("mysql://"):]

    work_id = input("Initial Admin employee ID: ").strip().upper()
    full_name = input("Admin full name: ").strip()
    email = input("Admin email: ").strip()
    password = getpass.getpass("New password (minimum 12 characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9_-]{1,31}", work_id):
        raise SystemExit("Employee ID must be 2-32 characters: letters, numbers, underscore, or hyphen.")
    if not full_name or len(full_name) > 128 or not email or len(email) > 128:
        raise SystemExit("Name and email are required and must fit the users table.")
    if len(password) < 12:
        raise SystemExit("Password must be at least 12 characters.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.begin() as connection:
            if connection.execute(text("SELECT COUNT(*) FROM users WHERE role = 'Admin' AND is_active = TRUE")).scalar_one():
                raise SystemExit("An active Admin already exists; use Admin user management instead.")
            if connection.execute(text("SELECT COUNT(*) FROM users WHERE work_id = :work_id"), {"work_id": work_id}).scalar_one():
                raise SystemExit("That employee ID already exists.")
            result = connection.execute(text("""
                INSERT INTO users (work_id, full_name, password_hash, role, assigned_machine,
                                   email, department, shift, is_active)
                VALUES (:work_id, :full_name, :password_hash, 'Admin', NULL,
                        :email, 'Administration', NULL, TRUE)
            """), {"work_id": work_id, "full_name": full_name, "password_hash": hash_password(password), "email": email})
            employee_id = result.lastrowid
            connection.execute(text("""
                INSERT INTO activity_log
                    (employee_id, employee_work_id, employee_name, role_at_event,
                     event_type, occurred_at_utc, details)
                VALUES (:employee_id, :work_id, :full_name, 'Admin',
                        'initial_admin_provisioned', UTC_TIMESTAMP(6),
                        'Initial administrator provisioned by deployment bootstrap')
            """), {"employee_id": employee_id, "work_id": work_id, "full_name": full_name})
        print(f"Provisioned initial Admin account {work_id}. Password was stored as a one-way hash.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
