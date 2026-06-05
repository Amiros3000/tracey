"""
routes/accounts.py — Account CRUD + balance update.

Endpoints:
  GET    /accounts              — list all accounts for current user
  POST   /accounts              — create a new account
  GET    /accounts/{id}         — get one account
  PATCH  /accounts/{id}         — update account fields
  DELETE /accounts/{id}         — deactivate (soft delete)
  PATCH  /accounts/{id}/balance — update balance + snapshot to history
  GET    /accounts/net-worth    — compute total assets, liabilities, net worth
  GET    /accounts/{id}/history — balance history for charts

Design notes:
  - DELETE is a soft-delete (sets is_active = 0) to preserve expense history.
  - PATCH uses model_dump(exclude_unset=True) so only provided fields update.
    Column names come from Pydantic model definitions (not user input) so
    building the SET clause dynamically is safe.
  - Balance updates always snapshot to balance_history unless record_history=False.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_user
from database import get_db
from models import (
    AccountCreate,
    AccountResponse,
    AccountUpdate,
    BalanceUpdateRequest,
    NetWorthResponse,
    NetWorthHistoryPoint,
)

router = APIRouter()

# Columns that belong to the accounts table — used to build safe dynamic PATCH queries.
# This is derived from AccountUpdate's fields, not from user input.
_PATCHABLE_COLUMNS = {
    "name", "institution", "balance", "currency",
    "credit_limit", "purchase_apr", "cash_apr", "annual_fee",
    "minimum_payment", "payment_due_day", "payment_source_account_id",
    "original_principal", "interest_rate", "interest_type",
    "monthly_payment", "payment_day", "loan_type", "is_government_loan",
    "repayment_plan", "monthly_fee", "fee_waiver_minimum_balance",
    "account_plan_name", "is_active", "notes",
}

# Account types classified as liabilities for net-worth calculation
_LIABILITY_TYPES = {"credit_card", "loan", "line_of_credit"}


@router.get("", response_model=list[AccountResponse])
def list_accounts(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return all active accounts for the current user, ordered by type then name."""
    rows = db.execute(
        """SELECT * FROM accounts
           WHERE user_id = ? AND is_active = 1
           ORDER BY type, name""",
        (current_user["id"],),
    ).fetchall()
    return [_row_to_account(r) for r in rows]


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(
    body: AccountCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Create a new account.

    After inserting, we immediately write the opening balance to balance_history
    so net-worth charts have a starting data point.
    """
    db.execute(
        """INSERT INTO accounts (
               user_id, name, type, institution, balance, currency,
               credit_limit, purchase_apr, cash_apr, annual_fee,
               minimum_payment, payment_due_day, payment_source_account_id,
               original_principal, interest_rate, interest_type,
               monthly_payment, payment_day, loan_type, is_government_loan,
               repayment_plan, monthly_fee, fee_waiver_minimum_balance,
               account_plan_name, notes
           ) VALUES (
               ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?,
               ?, ?, ?,
               ?, ?, ?,
               ?, ?, ?, ?,
               ?, ?, ?,
               ?, ?
           )""",
        (
            current_user["id"], body.name, body.type, body.institution,
            body.balance, body.currency,
            body.credit_limit, body.purchase_apr, body.cash_apr, body.annual_fee,
            body.minimum_payment, body.payment_due_day, body.payment_source_account_id,
            body.original_principal, body.interest_rate, body.interest_type,
            body.monthly_payment, body.payment_day, body.loan_type,
            int(body.is_government_loan),
            body.repayment_plan, body.monthly_fee, body.fee_waiver_minimum_balance,
            body.account_plan_name, body.notes,
        ),
    )

    account_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Record opening balance as first history point
    db.execute(
        "INSERT INTO balance_history (account_id, balance) VALUES (?, ?)",
        (account_id, body.balance),
    )

    row = db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
    return _row_to_account(row)


@router.get("/net-worth", response_model=NetWorthResponse)
def get_net_worth(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Compute current net worth from all active account balances.

    Assets:      chequing, savings, investment, other (positive balance)
    Liabilities: credit_card, loan, line_of_credit (balance represents what is owed)

    For liability accounts, balance is stored as a positive number representing
    the amount owed — so they are subtracted from net worth.
    """
    rows = db.execute(
        "SELECT type, balance FROM accounts WHERE user_id = ? AND is_active = 1",
        (current_user["id"],),
    ).fetchall()

    total_assets      = 0.0
    total_liabilities = 0.0
    by_type: dict[str, float] = {}

    for row in rows:
        acct_type = row["type"]
        balance   = row["balance"]

        by_type[acct_type] = by_type.get(acct_type, 0.0) + balance

        if acct_type in _LIABILITY_TYPES:
            total_liabilities += balance
        else:
            total_assets += balance

    return NetWorthResponse(
        total_assets=round(total_assets, 2),
        total_liabilities=round(total_liabilities, 2),
        net_worth=round(total_assets - total_liabilities, 2),
        by_account_type={k: round(v, 2) for k, v in by_type.items()},
    )


@router.get("/net-worth/history", response_model=list[NetWorthHistoryPoint])
def get_net_worth_history(
    days: int = 90,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Weekly net-worth snapshots for trend charts.
    Uses the most recent known balance for each account as of each target date.
    """
    from datetime import date, timedelta

    accounts = db.execute(
        "SELECT id, type FROM accounts WHERE user_id = ? AND is_active = 1",
        (current_user["id"],),
    ).fetchall()

    if not accounts:
        return []

    # Build per-account balance history: {account_id: [(date_str, balance), ...]}
    history: dict[int, list] = {}
    for acct in accounts:
        rows = db.execute(
            """SELECT date(recorded_at) as d, balance
               FROM balance_history WHERE account_id = ?
               ORDER BY recorded_at ASC""",
            (acct["id"],),
        ).fetchall()
        history[acct["id"]] = [(r["d"], r["balance"]) for r in rows]

    today = date.today()
    result = []

    # Produce one data point per week going back `days`
    for weeks_back in range(days // 7, -1, -1):
        target = (today - timedelta(weeks=weeks_back)).isoformat()
        assets = liabilities = 0.0

        for acct in accounts:
            balance = None
            for d, bal in reversed(history.get(acct["id"], [])):
                if d <= target:
                    balance = bal
                    break

            if balance is None:
                continue

            if acct["type"] in _LIABILITY_TYPES:
                liabilities += balance
            else:
                assets += balance

        if assets > 0 or liabilities > 0:
            result.append(NetWorthHistoryPoint(
                date=target,
                assets=round(assets, 2),
                liabilities=round(liabilities, 2),
                net_worth=round(assets - liabilities, 2),
            ))

    return result


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Fetch a single account by ID, enforcing ownership."""
    row = _get_account_or_404(db, account_id, current_user["id"])
    return _row_to_account(row)


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    body: AccountUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Partially update account fields.

    Uses model_dump(exclude_unset=True) to only update fields that were
    explicitly included in the request body.  Column names are sourced from
    the Pydantic model definition (_PATCHABLE_COLUMNS), not from user input,
    so building the SQL SET clause dynamically is safe — values remain
    parameterized.
    """
    _get_account_or_404(db, account_id, current_user["id"])

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    # Coerce booleans to integers for SQLite storage
    if "is_government_loan" in fields:
        fields["is_government_loan"] = int(fields["is_government_loan"])
    if "is_active" in fields:
        fields["is_active"] = int(fields["is_active"])

    # Safety check: reject any key not in the known-safe column set
    unknown = set(fields.keys()) - _PATCHABLE_COLUMNS
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown fields: {unknown}")

    set_clause = ", ".join(f"{col} = ?" for col in fields)
    values = list(fields.values()) + [account_id, current_user["id"]]

    db.execute(
        f"UPDATE accounts SET {set_clause}, updated_at = CURRENT_TIMESTAMP "
        f"WHERE id = ? AND user_id = ?",
        values,
    )

    # If balance was changed via PATCH, also snapshot the new balance
    if "balance" in fields:
        db.execute(
            "INSERT INTO balance_history (account_id, balance) VALUES (?, ?)",
            (account_id, fields["balance"]),
        )

    row = db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
    return _row_to_account(row)


@router.patch("/{account_id}/balance", response_model=AccountResponse)
def update_balance(
    account_id: int,
    body: BalanceUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Update an account's balance and optionally snapshot it to balance_history.

    This is a separate endpoint from the general PATCH so the frontend can
    provide a dedicated "reconcile balance" action with a clear UX.
    """
    _get_account_or_404(db, account_id, current_user["id"])

    db.execute(
        "UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (body.balance, account_id),
    )

    if body.record_history:
        db.execute(
            "INSERT INTO balance_history (account_id, balance) VALUES (?, ?)",
            (account_id, body.balance),
        )

    row = db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
    return _row_to_account(row)


@router.delete("/{account_id}", status_code=204)
def deactivate_account(
    account_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Soft-delete an account by setting is_active = 0.

    We never hard-delete accounts because expenses reference them via
    account_id.  Deactivated accounts disappear from the UI but remain
    in the database so historical transactions still show the account name.
    """
    _get_account_or_404(db, account_id, current_user["id"])

    db.execute(
        "UPDATE accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (account_id,),
    )


@router.get("/{account_id}/history")
def get_balance_history(
    account_id: int,
    limit: int = 90,  # default: 90 days of history
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Return balance snapshots for a given account.

    Used by net-worth trend charts.  The limit param caps how many data
    points to return to keep chart responses fast.
    """
    _get_account_or_404(db, account_id, current_user["id"])

    rows = db.execute(
        """SELECT balance, recorded_at FROM balance_history
           WHERE account_id = ?
           ORDER BY recorded_at DESC
           LIMIT ?""",
        (account_id, limit),
    ).fetchall()

    return [{"balance": r["balance"], "recorded_at": r["recorded_at"]} for r in rows]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_account_or_404(db, account_id: int, user_id: int):
    """Fetch an account and verify it belongs to this user, or raise 404."""
    row = db.execute(
        "SELECT * FROM accounts WHERE id = ? AND user_id = ?",
        (account_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Account not found")
    return row


def _row_to_account(row) -> AccountResponse:
    """
    Convert a sqlite3.Row to an AccountResponse.

    SQLite stores booleans as 0/1 integers.  Pydantic's bool type coerces
    them correctly, but we do the conversion explicitly for clarity.
    """
    d = dict(row)
    d["is_government_loan"] = bool(d.get("is_government_loan", 0))
    d["is_active"]          = bool(d.get("is_active", 1))
    return AccountResponse(**d)
