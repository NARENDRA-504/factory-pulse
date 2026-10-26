"""Generate a PBKDF2 hash accepted by the FactoryPulse authentication API."""
import base64
import getpass
import hashlib
import secrets


def main() -> None:
    password = getpass.getpass("New FactoryPulse password (12+ characters): ")
    confirm = getpass.getpass("Confirm password: ")
    if len(password) < 12:
        raise SystemExit("Password must be at least 12 characters.")
    if password != confirm:
        raise SystemExit("Passwords do not match.")
    salt = secrets.token_bytes(16)
    iterations = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    encode = lambda value: base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")
    print(f"pbkdf2_sha256${iterations}${encode(salt)}${encode(digest)}")


if __name__ == "__main__":
    main()
