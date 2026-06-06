"""
routes/recurring.py — Recurring transactions: bills, subscriptions, government benefits.

Endpoints:
  GET    /recurring              — list all active recurring transactions
  GET    /recurring/upcoming     — next 30 days of obligations (sorted by next_date)
  GET    /recurring/summary      — total monthly debits vs credits
  POST   /recurring              — create a recurring transaction
  PATCH  /recurring/{id}         — update fields (e.g. advance next_date after payment)
  DELETE /recurring/{id}         — soft delete (is_active = 0)
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from database import get_db
from models import RecurringCreate, RecurringUpdate, RecurringResponse

router = APIRouter()

_PATCHABLE = {
    "name", "amount", "type", "frequency", "day_of_month",
    "next_date", "category", "from_account_id", "to_account_id",
    "is_government_benefit", "is_active",
}


@router.get("/upcoming")
def get_upcoming(
    days: int = Query(30, ge=1, le=365),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Return recurring transactions whose next_date falls within the next N days
    (or up to end_date if provided).
    Sorted by next_date ascending so the user sees what hits first.
    """
    cutoff = end_date if end_date else (date.today() + timedelta(days=days)).isoformat()
    today  = date.today().isoformat()

    rows = db.execute(
        """SELECT r.*, a.name as from_account_name, b.name as to_account_name
           FROM recurring_transactions r
           LEFT JOIN accounts a ON a.id = r.from_account_id
           LEFT JOIN accounts b ON b.id = r.to_account_id
           WHERE r.user_id = ? AND r.is_active = 1
             AND r.next_date IS NOT NULL
             AND r.next_date >= ? AND r.next_date <= ?
           ORDER BY r.next_date ASC""",
        (current_user["id"], today, cutoff),
    ).fetchall()

    return [dict(r) for r in rows]


@router.get("/summary")
def get_summary(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Monthly equivalent totals for debits and credits."""
    rows = db.execute(
        """SELECT type, frequency, amount FROM recurring_transactions
           WHERE user_id = ? AND is_active = 1""",
        (current_user["id"],),
    ).fetchall()

    monthly_debit  = 0.0
    monthly_credit = 0.0

    freq_to_months = {"weekly": 52/12, "monthly": 1, "quarterly": 1/3, "annual": 1/12}

    for r in rows:
        monthly = r["amount"] * freq_to_months.get(r["frequency"], 1)
        if r["type"] == "debit":
            monthly_debit += monthly
        else:
            monthly_credit += monthly

    return {
        "monthly_debit":  round(monthly_debit, 2),
        "monthly_credit": round(monthly_credit, 2),
        "net":            round(monthly_credit - monthly_debit, 2),
    }


@router.get("", response_model=list[RecurringResponse])
def list_recurring(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = "SELECT * FROM recurring_transactions WHERE user_id = ?"
    params = [current_user["id"]]
    if not include_inactive:
        query += " AND is_active = 1"
    query += " ORDER BY type DESC, next_date ASC, name ASC"
    rows = db.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=RecurringResponse, status_code=201)
def create_recurring(
    body: RecurringCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    db.execute(
        """INSERT INTO recurring_transactions
           (user_id, name, amount, type, frequency, day_of_month, next_date,
            category, from_account_id, to_account_id, is_government_benefit)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (
            current_user["id"], body.name, body.amount, body.type,
            body.frequency, body.day_of_month, body.next_date,
            body.category, body.from_account_id, body.to_account_id,
            1 if body.is_government_benefit else 0,
        ),
    )
    row_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    return dict(db.execute("SELECT * FROM recurring_transactions WHERE id = ?", (row_id,)).fetchone())


@router.patch("/{recurring_id}", response_model=RecurringResponse)
def update_recurring(
    recurring_id: int,
    body: RecurringUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _get_or_404(db, recurring_id, current_user["id"])

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    unknown = set(fields.keys()) - _PATCHABLE
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown fields: {unknown}")

    set_clause = ", ".join(f"{col} = ?" for col in fields)
    db.execute(
        f"UPDATE recurring_transactions SET {set_clause} WHERE id = ? AND user_id = ?",
        list(fields.values()) + [recurring_id, current_user["id"]],
    )
    return dict(db.execute("SELECT * FROM recurring_transactions WHERE id = ?", (recurring_id,)).fetchone())


@router.delete("/{recurring_id}", status_code=204)
def delete_recurring(
    recurring_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    _get_or_404(db, recurring_id, current_user["id"])
    db.execute(
        "UPDATE recurring_transactions SET is_active = 0 WHERE id = ? AND user_id = ?",
        (recurring_id, current_user["id"]),
    )


def _get_or_404(db, recurring_id: int, user_id: int) -> dict:
    row = db.execute(
        "SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?",
        (recurring_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    return dict(row)
