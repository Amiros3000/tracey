"""
routes/income.py — Income CRUD + filtering + summary.

Endpoints:
  GET    /income              — paginated list with optional filters
  POST   /income              — log a new income entry
  GET    /income/summary      — total by type for a date range
  GET    /income/{id}         — get one income entry
  PATCH  /income/{id}         — update income fields
  DELETE /income/{id}         — hard delete
  GET    /income/settings     — read pay-cycle config
  PUT    /income/settings     — write pay-cycle config

Pay-cycle config is intentionally managed through the income routes rather
than a separate settings router — it's always accessed in the context of
income analysis and onboarding, so co-locating it reduces cognitive overhead.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from auth import get_current_user
from database import get_db
from models import (
    IncomeCreate,
    IncomeResponse,
    IncomeSummaryResponse,
    IncomeUpdate,
    SettingUpdate,
)

router = APIRouter()

_PATCHABLE_COLUMNS = {"amount", "source", "income_type", "date", "note"}

# Valid pay cycles for the settings endpoint
_VALID_PAY_CYCLES = {"weekly", "biweekly", "semimonthly", "monthly"}


@router.get("/settings")
def get_income_settings(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Return the user's pay-cycle configuration.

    pay_cycle:        weekly / biweekly / semimonthly / monthly
    cycle_start_date: YYYY-MM-DD — first day of the current or most recent cycle

    The frontend uses these to compute "this cycle" date ranges for summaries.
    """
    rows = db.execute(
        "SELECT key, value FROM settings WHERE user_id = ? AND key IN (?, ?)",
        (current_user["id"], "pay_cycle", "cycle_start_date"),
    ).fetchall()

    result = {row["key"]: row["value"] for row in rows}

    # Return defaults in case settings were never seeded (defensive)
    return {
        "pay_cycle":        result.get("pay_cycle", "biweekly"),
        "cycle_start_date": result.get("cycle_start_date", ""),
    }


@router.put("/settings/{key}", status_code=204)
def update_income_setting(
    key: str,
    body: SettingUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Update a single pay-cycle setting.

    Valid keys: pay_cycle, cycle_start_date
    Uses INSERT OR REPLACE so this works for both initial setup and updates.
    """
    allowed_keys = {"pay_cycle", "cycle_start_date"}
    if key not in allowed_keys:
        raise HTTPException(status_code=400, detail=f"key must be one of {allowed_keys}")

    if key == "pay_cycle" and body.value not in _VALID_PAY_CYCLES:
        raise HTTPException(
            status_code=400,
            detail=f"pay_cycle must be one of {_VALID_PAY_CYCLES}",
        )

    db.execute(
        """INSERT INTO settings (user_id, key, value, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value,
               updated_at = CURRENT_TIMESTAMP""",
        (current_user["id"], key, body.value),
    )


@router.get("", response_model=list[IncomeResponse])
def list_income(
    income_type: Optional[str] = Query(None),
    start_date:  Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date:    Optional[str] = Query(None, description="YYYY-MM-DD"),
    skip:        int           = Query(0, ge=0),
    limit:       int           = Query(50, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Return income entries with optional filtering.

    Order: most recent first.  Useful for the dashboard "last few pays" view
    and for verifying that CSV imports were categorised correctly.
    """
    query  = "SELECT * FROM income WHERE user_id = ?"
    params = [current_user["id"]]

    if income_type:
        query += " AND income_type = ?"
        params.append(income_type)

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?"
    params += [limit, skip]

    rows = db.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.get("/summary", response_model=IncomeSummaryResponse)
def get_summary(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date:   str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Aggregate income for a date range, broken down by type.

    Separating government benefits from employment income matters for the
    "safe to spend" calculation and for AI guide context — government deposits
    may not recur the same way a paycheque does.
    """
    rows = db.execute(
        """SELECT income_type, SUM(amount) as total, COUNT(*) as cnt
           FROM income
           WHERE user_id = ? AND date >= ? AND date <= ?
           GROUP BY income_type""",
        (current_user["id"], start_date, end_date),
    ).fetchall()

    totals = {"employment": 0.0, "government": 0.0, "other": 0.0}
    total_count = 0

    for row in rows:
        totals[row["income_type"]] = round(row["total"], 2)
        total_count += row["cnt"]

    grand_total = sum(totals.values())

    return IncomeSummaryResponse(
        start_date=start_date,
        end_date=end_date,
        total=round(grand_total, 2),
        employment=totals["employment"],
        government=totals["government"],
        other=totals["other"],
        transaction_count=total_count,
    )


@router.post("", response_model=IncomeResponse, status_code=201)
def create_income(
    body: IncomeCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Log a new income entry."""
    db.execute(
        "INSERT INTO income (user_id, amount, source, income_type, date, note) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            current_user["id"], body.amount, body.source,
            body.income_type, body.date, body.note,
        ),
    )

    income_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = db.execute("SELECT * FROM income WHERE id = ?", (income_id,)).fetchone()
    return dict(row)


@router.get("/{income_id}", response_model=IncomeResponse)
def get_income(
    income_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Fetch a single income entry by ID."""
    return _get_income_or_404(db, income_id, current_user["id"])


@router.patch("/{income_id}", response_model=IncomeResponse)
def update_income(
    income_id: int,
    body: IncomeUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Partially update an income entry."""
    _get_income_or_404(db, income_id, current_user["id"])

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    unknown = set(fields.keys()) - _PATCHABLE_COLUMNS
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown fields: {unknown}")

    set_clause = ", ".join(f"{col} = ?" for col in fields)
    values = list(fields.values()) + [income_id, current_user["id"]]

    db.execute(
        f"UPDATE income SET {set_clause} WHERE id = ? AND user_id = ?",
        values,
    )

    row = db.execute("SELECT * FROM income WHERE id = ?", (income_id,)).fetchone()
    return dict(row)


@router.delete("/{income_id}", status_code=204)
def delete_income(
    income_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Hard-delete an income entry (e.g., if it was imported by mistake)."""
    _get_income_or_404(db, income_id, current_user["id"])

    db.execute(
        "DELETE FROM income WHERE id = ? AND user_id = ?",
        (income_id, current_user["id"]),
    )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_income_or_404(db, income_id: int, user_id: int) -> dict:
    row = db.execute(
        "SELECT * FROM income WHERE id = ? AND user_id = ?",
        (income_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Income entry not found")
    return dict(row)
