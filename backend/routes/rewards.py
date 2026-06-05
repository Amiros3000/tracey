"""
routes/rewards.py — Rewards profiles + automatic earn estimation.

Each credit card can have one rewards profile that stores earn rates.
When an expense is logged to a rewards card, estimated points/cashback
are auto-calculated and stored in reward_transactions.

Endpoints:
  GET    /rewards                  — list all profiles (joined with account name)
  GET    /rewards/summary          — total portfolio value
  POST   /rewards                  — create a profile for a card
  PATCH  /rewards/{id}             — update profile (e.g. update known balance)
  DELETE /rewards/{id}             — remove profile
  POST   /rewards/{id}/estimate    — recalculate estimated_balance from expenses
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from database import get_db
from models import RewardProfileCreate, RewardProfileUpdate, RewardProfileResponse

router = APIRouter()

_PATCHABLE = {
    "reward_type", "program_name", "base_earn_rate", "bonus_rates",
    "point_value_cents", "travel_value_cents", "expiry_policy", "known_balance",
}


@router.get("/summary")
def get_summary(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Aggregate known + estimated balances across all reward profiles."""
    rows = db.execute(
        """SELECT r.*, a.name as account_name, a.type as account_type
           FROM rewards r
           JOIN accounts a ON a.id = r.account_id
           WHERE a.user_id = ? AND a.is_active = 1""",
        (current_user["id"],),
    ).fetchall()

    total_cash = 0.0
    breakdown  = []

    for row in rows:
        balance = max(row["known_balance"], row["estimated_balance"])
        cash_val = (balance * row["point_value_cents"]) / 100
        total_cash += cash_val
        breakdown.append({
            "account_name": row["account_name"],
            "program_name": row["program_name"],
            "balance":      balance,
            "cash_value":   round(cash_val, 2),
            "reward_type":  row["reward_type"],
        })

    return {
        "total_cash_value": round(total_cash, 2),
        "cards": breakdown,
    }


@router.get("", response_model=list[RewardProfileResponse])
def list_rewards(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    rows = db.execute(
        """SELECT r.*, a.name as account_name
           FROM rewards r
           JOIN accounts a ON a.id = r.account_id
           WHERE a.user_id = ?
           ORDER BY a.name""",
        (current_user["id"],),
    ).fetchall()

    result = []
    for row in rows:
        d = dict(row)
        if d.get("bonus_rates") and isinstance(d["bonus_rates"], str):
            try:
                d["bonus_rates"] = json.loads(d["bonus_rates"])
            except Exception:
                d["bonus_rates"] = None
        result.append(d)
    return result


@router.post("", response_model=RewardProfileResponse, status_code=201)
def create_reward_profile(
    body: RewardProfileCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    # Verify account belongs to user
    acct = db.execute(
        "SELECT id, name FROM accounts WHERE id = ? AND user_id = ? AND is_active = 1",
        (body.account_id, current_user["id"]),
    ).fetchone()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    bonus_json = json.dumps(body.bonus_rates) if body.bonus_rates else None

    db.execute(
        """INSERT INTO rewards
           (account_id, reward_type, program_name, base_earn_rate, bonus_rates,
            point_value_cents, travel_value_cents, expiry_policy, known_balance)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            body.account_id, body.reward_type, body.program_name,
            body.base_earn_rate, bonus_json, body.point_value_cents,
            body.travel_value_cents, body.expiry_policy, body.known_balance,
        ),
    )
    row_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    return _get_profile_or_404(db, row_id, current_user["id"])


@router.patch("/{reward_id}", response_model=RewardProfileResponse)
def update_reward_profile(
    reward_id: int,
    body: RewardProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _get_profile_or_404(db, reward_id, current_user["id"])

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "bonus_rates" in fields and fields["bonus_rates"] is not None:
        fields["bonus_rates"] = json.dumps(fields["bonus_rates"])

    unknown = set(fields.keys()) - _PATCHABLE
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown fields: {unknown}")

    set_clause = ", ".join(f"{col} = ?" for col in fields)
    extra = ", last_manual_update = CURRENT_TIMESTAMP" if "known_balance" in fields else ""

    db.execute(
        f"UPDATE rewards SET {set_clause}{extra} WHERE id = ?",
        list(fields.values()) + [reward_id],
    )
    return _get_profile_or_404(db, reward_id, current_user["id"])


@router.delete("/{reward_id}", status_code=204)
def delete_reward_profile(
    reward_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _get_profile_or_404(db, reward_id, current_user["id"])
    db.execute("DELETE FROM rewards WHERE id = ?", (reward_id,))


@router.post("/{reward_id}/estimate", response_model=RewardProfileResponse)
def recalculate_estimate(
    reward_id: int,
    days: int = Query(90, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Re-estimate the rewards balance by summing earned points/cashback
    from the last N days of expenses charged to this card.
    """
    profile = _get_profile_or_404(db, reward_id, current_user["id"])
    account_id = profile["account_id"]

    bonus_rates = {}
    if profile.get("bonus_rates"):
        try:
            bonus_rates = json.loads(profile["bonus_rates"]) if isinstance(profile["bonus_rates"], str) else profile["bonus_rates"]
        except Exception:
            bonus_rates = {}

    expenses = db.execute(
        """SELECT category, SUM(amount) as total
           FROM expenses
           WHERE account_id = ? AND date >= date('now', ?)
           GROUP BY category""",
        (account_id, f"-{days} days"),
    ).fetchall()

    estimated = 0.0
    for exp in expenses:
        rate = bonus_rates.get(exp["category"], profile["base_earn_rate"])
        estimated += exp["total"] * rate

    db.execute(
        "UPDATE rewards SET estimated_balance = ? WHERE id = ?",
        (round(estimated, 2), reward_id),
    )
    return _get_profile_or_404(db, reward_id, current_user["id"])


def _get_profile_or_404(db, reward_id: int, user_id: int) -> dict:
    row = db.execute(
        """SELECT r.*, a.name as account_name
           FROM rewards r
           JOIN accounts a ON a.id = r.account_id
           WHERE r.id = ? AND a.user_id = ?""",
        (reward_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Reward profile not found")
    d = dict(row)
    if d.get("bonus_rates") and isinstance(d["bonus_rates"], str):
        try:
            d["bonus_rates"] = json.loads(d["bonus_rates"])
        except Exception:
            d["bonus_rates"] = None
    return d
