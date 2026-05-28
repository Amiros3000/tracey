"""
routes/auth_routes.py — Authentication endpoints.

Endpoints:
  POST /auth/register        — create the single user account (first-run only)
  POST /auth/login           — full password login → access + refresh tokens
  POST /auth/pin-login       — quick PIN login → access token only
  POST /auth/refresh         — exchange refresh token for new access token
  POST /auth/logout          — revoke the current refresh token
  POST /auth/change-password — update password (requires current password)
  POST /auth/change-pin      — update PIN (requires current password)
  GET  /auth/me              — return current user profile

Security notes:
  - Register is blocked if any user already exists (single-user protection).
  - All auth endpoints have strict rate limits to slow brute-force attacks.
  - Password change revokes all refresh tokens so other sessions must re-auth.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth import (
    create_access_token,
    create_pin_access_token,
    create_refresh_token,
    hash_password,
    hash_pin,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    store_refresh_token,
    verify_password,
    verify_pin,
    verify_refresh_token,
    get_current_user,
)
from database import get_db
from models import (
    ChangePINRequest,
    ChangePasswordRequest,
    LoginRequest,
    PINLoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")  # strict: prevents automation of registration attempts
def register(request: Request, body: RegisterRequest, db=Depends(get_db)):
    """
    Create the single user account.

    Only succeeds if no users exist yet — this protects a self-hosted VPS from
    unauthorised registrations after the owner has set up their account.
    To add a second user later, remove this guard and add an invite system.
    """
    existing = db.execute("SELECT id FROM users LIMIT 1").fetchone()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is closed — an account already exists on this server.",
        )

    password_hash = hash_password(body.password)
    pin_hash = hash_pin(body.pin) if body.pin else None

    db.execute(
        """INSERT INTO users (username, password_hash, pin_hash, privacy_level)
           VALUES (?, ?, ?, ?)""",
        (body.username, password_hash, pin_hash, body.privacy_level),
    )

    user = db.execute(
        "SELECT id FROM users WHERE username = ?", (body.username,)
    ).fetchone()
    user_id = user["id"]

    # Seed default settings so the frontend always has something to read
    _seed_default_settings(db, user_id)

    access_token  = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    store_refresh_token(db, user_id, refresh_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


def _seed_default_settings(db, user_id: int) -> None:
    """
    Insert sensible defaults into the settings table for a new user.
    These can all be changed during onboarding or in the Settings page.
    """
    defaults = {
        "pay_cycle": "biweekly",         # most common Canadian pay frequency
        "cycle_start_date": __import__("datetime").date.today().isoformat(),
    }
    for key, value in defaults.items():
        db.execute(
            "INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)",
            (user_id, key, value),
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")  # tight limit to slow password brute-force
def login(request: Request, body: LoginRequest, db=Depends(get_db)):
    """
    Full password login.  Returns both access and refresh tokens.
    Updates last_login timestamp for audit purposes.
    """
    user = db.execute(
        "SELECT * FROM users WHERE username = ?", (body.username,)
    ).fetchone()

    # Use a generic error message — don't reveal whether the username exists
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    db.execute(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
        (user["id"],),
    )

    access_token  = create_access_token(user["id"])
    refresh_token = create_refresh_token(user["id"])
    store_refresh_token(db, user["id"], refresh_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/pin-login", response_model=TokenResponse)
@limiter.limit("20/minute")  # slightly looser than password — 4-digit space is small
def pin_login(request: Request, body: PINLoginRequest, db=Depends(get_db)):
    """
    Quick PIN login for daily access.  Returns an access token only —
    no new refresh token, so the session still expires after 7 days unless
    the user does a full password login again.
    """
    user = db.execute("SELECT * FROM users LIMIT 1").fetchone()

    if not user or not user["pin_hash"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN is not set up — please use password login",
        )

    if not verify_pin(body.pin, user["pin_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect PIN",
        )

    # PIN login gives a slightly longer token to avoid annoying re-prompts
    access_token = create_pin_access_token(user["id"])
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh_token(request: Request, body: RefreshRequest, db=Depends(get_db)):
    """
    Exchange a valid refresh token for a new access token.
    The refresh token itself is NOT rotated here — the same refresh token
    remains valid until it expires or is revoked.
    """
    user_id = verify_refresh_token(db, body.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token — please log in again",
        )

    return TokenResponse(access_token=create_access_token(user_id))


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    body: RefreshRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Revoke the provided refresh token so it can no longer be used.
    The access token will expire naturally; there's no server-side revocation
    for access tokens (this is a standard JWT trade-off — keep them short-lived).
    """
    revoke_refresh_token(db, body.refresh_token)


@router.post("/change-password", status_code=204)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Update the user's password.

    Requires the current password as proof of identity — so even if an
    attacker gets a valid access token, they can't change the password without
    also knowing the current one.

    Revokes all refresh tokens on success to force re-authentication on all
    other devices/sessions.
    """
    if not verify_password(body.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    new_hash = hash_password(body.new_password)
    db.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (new_hash, current_user["id"]),
    )

    # Force all other sessions to re-login — important if the password change
    # was triggered by a suspected compromise
    revoke_all_refresh_tokens(db, current_user["id"])


@router.post("/change-pin", status_code=204)
@limiter.limit("5/minute")
def change_pin(
    request: Request,
    body: ChangePINRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Update or set the quick-access PIN.
    Requires the full password as a security gate — PIN changes are sensitive
    because a PIN is the daily entry point to all financial data.
    """
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )

    db.execute(
        "UPDATE users SET pin_hash = ? WHERE id = ?",
        (hash_pin(body.new_pin), current_user["id"]),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        privacy_level=current_user["privacy_level"],
        created_at=current_user["created_at"],
        last_login=current_user["last_login"],
    )
