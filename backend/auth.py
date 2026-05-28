"""
auth.py — Authentication utilities: bcrypt, JWT, PIN, FastAPI dependency.

Design decisions:
- Access tokens expire in 15 minutes — short enough to limit exposure if
  a token is stolen, long enough not to annoy during normal use.
- PIN access tokens expire in 30 minutes — slightly longer for the daily
  quick-access flow.
- Refresh tokens expire in 7 days and are stored (hashed) in the DB so
  they can be revoked individually (logout, password change, breach).
- PINs are 4-digit integers, bcrypt-hashed like passwords.  Never stored
  in plain text.
- The get_current_user dependency is used by all protected routes.
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import get_db

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SECRET_KEY  = os.getenv("SECRET_KEY", "")
ALGORITHM   = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES         = 15
PIN_ACCESS_TOKEN_EXPIRE_MINUTES     = 30
REFRESH_TOKEN_EXPIRE_DAYS           = 7

security = HTTPBearer()

# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """
    Hash a password with bcrypt.  Work factor 12 is the current recommended
    minimum for bcrypt — enough to be slow for attackers, imperceptible for
    users on login.
    """
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Compare a plaintext password against its bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_pin(pin: str) -> str:
    """
    Hash a 4-digit PIN with bcrypt.
    PINs are short so we hash them the same way as passwords — bcrypt adds
    a random salt so two users with the same PIN get different hashes.
    """
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_pin(plain: str, hashed: str) -> bool:
    """Compare a plaintext PIN against its bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _create_token(payload: dict, expire_delta: timedelta) -> str:
    """
    Internal helper — build a signed JWT with an expiry claim.
    All times are UTC to avoid timezone confusion.
    """
    if not SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY is not set in .env  "
            "Generate one with: openssl rand -hex 32"
        )
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + expire_delta
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: int) -> str:
    """Create a short-lived access token for standard (password) login."""
    return _create_token(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_pin_access_token(user_id: int) -> str:
    """
    Create a slightly longer access token for PIN login.
    PINs are used for the daily quick-access flow where re-entering every
    15 minutes would be frustrating.
    """
    return _create_token(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=PIN_ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    """
    Create a long-lived refresh token.
    Refresh tokens are opaque random strings (not JWTs) so they must be
    looked up in the database — this makes per-token revocation possible.
    """
    return secrets.token_urlsafe(64)


def _hash_refresh_token(token: str) -> str:
    """
    SHA-256 hash of a refresh token for DB storage.
    We don't need bcrypt here because refresh tokens are long random strings
    (256 bits of entropy) — a preimage attack is not feasible.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def store_refresh_token(db, user_id: int, token: str) -> None:
    """
    Persist a hashed refresh token.  Old expired tokens for this user are
    cleaned up at the same time to keep the table tidy.
    """
    db.execute(
        "DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < CURRENT_TIMESTAMP",
        (user_id,),
    )
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (user_id, _hash_refresh_token(token), expires_at.isoformat()),
    )


def verify_refresh_token(db, token: str) -> Optional[int]:
    """
    Validate a refresh token and return the user_id it belongs to.
    Returns None if the token is missing, expired, or already revoked.
    """
    token_hash = _hash_refresh_token(token)
    row = db.execute(
        "SELECT user_id FROM refresh_tokens WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP",
        (token_hash,),
    ).fetchone()
    return row["user_id"] if row else None


def revoke_refresh_token(db, token: str) -> None:
    """Delete one specific refresh token (used on logout)."""
    db.execute(
        "DELETE FROM refresh_tokens WHERE token_hash = ?",
        (_hash_refresh_token(token),),
    )


def revoke_all_refresh_tokens(db, user_id: int) -> None:
    """
    Revoke every refresh token for a user.
    Called on password change so that other devices/sessions are forced
    to re-authenticate — important if the password change was triggered
    by a suspected breach.
    """
    db.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (user_id,))


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises HTTPException on any failure so callers can propagate it directly.
    """
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not set in .env")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired — please log in again",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
) -> dict:
    """
    FastAPI dependency — validates the Bearer token in every protected route.

    Usage:
        @router.get("/")
        def protected_route(current_user: dict = Depends(get_current_user)):
            return {"user_id": current_user["id"]}

    Returns the full user row as a dict so routes can access any user field.
    """
    payload = decode_access_token(credentials.credentials)
    user_id = int(payload["sub"])

    user = db.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return dict(user)
