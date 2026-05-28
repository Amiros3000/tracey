"""
routes/expenses.py — Expense CRUD + filtering + summary.

Endpoints:
  GET    /expenses              — paginated list with optional filters
  POST   /expenses              — log a new expense
  GET    /expenses/summary      — aggregated total + breakdown by category
  GET    /expenses/{id}         — get one expense
  PATCH  /expenses/{id}         — update expense fields
  DELETE /expenses/{id}         — hard delete (user explicitly removes a transaction)

Filters on GET /expenses:
  category, account_id, start_date, end_date, skip, limit

Summary (GET /expenses/summary):
  start_date, end_date — required query params
  Returns total and per-category breakdown for the date range.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from auth import get_current_user
from database import get_db
from models import ExpenseCreate, ExpenseResponse, ExpenseSummaryResponse, ExpenseUpdate

router = APIRouter()

# Safe patchable columns — same pattern as accounts.py
_PATCHABLE_COLUMNS = {"amount", "category", "note", "date", "account_id"}


@router.get("", response_model=list[ExpenseResponse])
def list_expenses(
    category:   Optional[str] = Query(None),
    account_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date:   Optional[str] = Query(None, description="YYYY-MM-DD"),
    skip:       int           = Query(0, ge=0),
    limit:      int           = Query(50, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Return expenses with optional filtering.

    All filters are AND'd together.  Results are ordered by date descending
    so the most recent appears first — the default view for the dashboard.
    """
    query  = "SELECT * FROM expenses WHERE user_id = ?"
    params = [current_user["id"]]

    if category:
        query += " AND category = ?"
        params.append(category)

    if account_id is not None:
        query += " AND account_id = ?"
        params.append(account_id)

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


@router.get("/summary", response_model=ExpenseSummaryResponse)
def get_summary(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date:   str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Aggregate expenses for a date range.

    Returns total spent plus a breakdown by category.  The frontend passes
    the current pay-cycle start/end dates so this shows "this cycle's spending."

    All amounts are summed from stored float values — no rounding until the
    final response so we don't accumulate small errors across many records.
    """
    rows = db.execute(
        """SELECT category, SUM(amount) as total, COUNT(*) as cnt
           FROM expenses
           WHERE user_id = ? AND date >= ? AND date <= ?
           GROUP BY category""",
        (current_user["id"], start_date, end_date),
    ).fetchall()

    by_category: dict[str, float] = {}
    total = 0.0
    count = 0

    for row in rows:
        by_category[row["category"]] = round(row["total"], 2)
        total += row["total"]
        count += row["cnt"]

    return ExpenseSummaryResponse(
        start_date=start_date,
        end_date=end_date,
        total=round(total, 2),
        by_category=by_category,
        transaction_count=count,
    )


@router.post("", response_model=ExpenseResponse, status_code=201)
def create_expense(
    body: ExpenseCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Log a new expense.

    If account_id is provided, we verify it belongs to the current user
    to prevent someone logging against another user's account.
    """
    if body.account_id is not None:
        _verify_account_ownership(db, body.account_id, current_user["id"])

    db.execute(
        "INSERT INTO expenses (user_id, amount, category, note, date, account_id) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            current_user["id"], body.amount, body.category,
            body.note, body.date, body.account_id,
        ),
    )

    expense_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = db.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()
    return dict(row)


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Fetch a single expense, enforcing ownership."""
    return _get_expense_or_404(db, expense_id, current_user["id"])


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    body: ExpenseUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Partially update an expense.  Same safe dynamic PATCH pattern as accounts.
    """
    _get_expense_or_404(db, expense_id, current_user["id"])

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    # Verify ownership of the new account_id if it's being changed
    if "account_id" in fields and fields["account_id"] is not None:
        _verify_account_ownership(db, fields["account_id"], current_user["id"])

    unknown = set(fields.keys()) - _PATCHABLE_COLUMNS
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown fields: {unknown}")

    set_clause = ", ".join(f"{col} = ?" for col in fields)
    values = list(fields.values()) + [expense_id, current_user["id"]]

    db.execute(
        f"UPDATE expenses SET {set_clause} WHERE id = ? AND user_id = ?",
        values,
    )

    row = db.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()
    return dict(row)


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Hard-delete an expense.

    Unlike accounts, expenses can be fully deleted — if you log something
    by mistake you should be able to remove it cleanly.  Associated
    reward_transactions rows are removed by CASCADE.
    """
    _get_expense_or_404(db, expense_id, current_user["id"])

    db.execute(
        "DELETE FROM expenses WHERE id = ? AND user_id = ?",
        (expense_id, current_user["id"]),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_expense_or_404(db, expense_id: int, user_id: int) -> dict:
    row = db.execute(
        "SELECT * FROM expenses WHERE id = ? AND user_id = ?",
        (expense_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    return dict(row)


def _verify_account_ownership(db, account_id: int, user_id: int) -> None:
    """Raise 403 if the account doesn't belong to this user."""
    row = db.execute(
        "SELECT id FROM accounts WHERE id = ? AND user_id = ?",
        (account_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=403, detail="Account not found or not yours")
