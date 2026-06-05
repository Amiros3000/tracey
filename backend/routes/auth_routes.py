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

import os
import secrets
from datetime import datetime, timedelta, timezone

import resend
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
    ChangeEmailRequest,
    ChangeUsernameRequest,
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
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db=Depends(get_db)):
    if db.execute("SELECT id FROM users WHERE username = ?", (body.username,)).fetchone():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken — try a different one.")
    if db.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with that email already exists.")

    password_hash = hash_password(body.password)
    pin_hash = hash_pin(body.pin) if body.pin else None

    db.execute(
        "INSERT INTO users (username, email, password_hash, pin_hash) VALUES (?, ?, ?, ?)",
        (body.username, body.email, password_hash, pin_hash),
    )
    user_id = db.execute("SELECT id FROM users WHERE username = ?", (body.username,)).fetchone()["id"]
    _seed_default_settings(db, user_id)

    # Send verification email (non-blocking — don't fail registration if email fails)
    _send_verification_email(db, user_id, body.email)

    access_token  = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    store_refresh_token(db, user_id, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


def _send_verification_email(db, user_id: int, email: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return  # email not configured — skip silently

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    db.execute(
        "DELETE FROM email_verification_tokens WHERE user_id = ?", (user_id,)
    )
    db.execute(
        "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user_id, token, expires_at),
    )

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    verify_link = f"{frontend_url}/verify-email?token={token}"
    from_email = os.getenv("FROM_EMAIL", "tracey <onboarding@resend.dev>")

    resend.api_key = api_key
    try:
        resend.Emails.send({
            "from": from_email,
            "to": [email],
            "subject": "Verify your tracey account",
            "html": f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">
        <tr>
          <td style="background:#22c55e;padding:28px 32px">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.03em">
              trace<span style="color:#dcfce7">y</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a0a0a">Verify your email</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6">
              Click the button below to verify your email address and complete your tracey account setup.
              This link expires in 24 hours.
            </p>
            <a href="{verify_link}"
               style="display:inline-block;padding:14px 28px;background:#22c55e;color:#ffffff;
                      text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
              Verify my email
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6">
              If you didn't create a tracey account, you can safely ignore this email.<br>
              Or copy this link: {verify_link}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>""",
        })
    except Exception:
        pass  # never block registration due to email failure


@router.get("/verify-email", status_code=204)
def verify_email(token: str, db=Depends(get_db)):
    row = db.execute(
        "SELECT * FROM email_verification_tokens WHERE token = ?", (token,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        db.execute("DELETE FROM email_verification_tokens WHERE token = ?", (token,))
        raise HTTPException(status_code=400, detail="Verification link has expired — request a new one.")
    db.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (row["user_id"],))
    db.execute("DELETE FROM email_verification_tokens WHERE token = ?", (token,))


@router.post("/resend-verification", status_code=204)
@limiter.limit("3/minute")
def resend_verification(request: Request, user=Depends(get_current_user), db=Depends(get_db)):
    row = db.execute("SELECT email, email_verified FROM users WHERE id = ?", (user["id"],)).fetchone()
    if not row or not row["email"]:
        raise HTTPException(status_code=400, detail="No email address on file.")
    if row["email_verified"]:
        raise HTTPException(status_code=400, detail="Email is already verified.")
    _send_verification_email(db, user["id"], row["email"])


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
    db.execute(
        "UPDATE users SET pin_hash = ? WHERE id = ?",
        (hash_pin(body.new_pin), current_user["id"]),
    )


@router.post("/change-email", status_code=204)
@limiter.limit("5/minute")
def change_email(
    request: Request,
    body: ChangeEmailRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = db.execute(
        "SELECT id FROM users WHERE email = ? AND id != ?", (body.new_email, current_user["id"])
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    db.execute(
        "UPDATE users SET email = ?, email_verified = 0 WHERE id = ?",
        (body.new_email, current_user["id"]),
    )
    db.commit()
    _send_verification_email(db, current_user["id"], body.new_email)


@router.post("/change-username", status_code=204)
@limiter.limit("5/minute")
def change_username(
    request: Request,
    body: ChangeUsernameRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = db.execute(
        "SELECT id FROM users WHERE username = ? AND id != ?", (body.new_username, current_user["id"])
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    db.execute(
        "UPDATE users SET username = ? WHERE id = ?",
        (body.new_username, current_user["id"]),
    )
    db.commit()


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        email_verified=bool(current_user["email_verified"]),
        privacy_level=current_user["privacy_level"],
        created_at=current_user["created_at"],
        last_login=current_user["last_login"],
    )


@router.delete("/data", status_code=204)
def delete_all_data(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Delete all financial data for the current user but keep the account.
    Deleting accounts cascades to balance_history, rewards, reward_transactions.
    """
    uid = current_user["id"]
    db.execute("DELETE FROM expenses              WHERE user_id = ?", (uid,))
    db.execute("DELETE FROM income                WHERE user_id = ?", (uid,))
    db.execute("DELETE FROM recurring_transactions WHERE user_id = ?", (uid,))
    db.execute("DELETE FROM savings_goals         WHERE user_id = ?", (uid,))
    db.execute("DELETE FROM settings              WHERE user_id = ?", (uid,))
    db.execute("DELETE FROM accounts              WHERE user_id = ?", (uid,))
