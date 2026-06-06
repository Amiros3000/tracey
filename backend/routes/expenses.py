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

import base64
import io
import json
import os

import anthropic
import pdfplumber
from openai import OpenAI
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from typing import Optional
from auth import get_current_user
from database import get_db
from models import ExpenseCreate, ExpenseResponse, ExpenseSummaryResponse, ExpenseUpdate, ExpenseBatchCreate, ExpenseBatchResponse

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


@router.post("/batch", response_model=ExpenseBatchResponse, status_code=201)
def batch_create_expenses(
    body: ExpenseBatchCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Bulk-insert expenses — used by the CSV import flow.
    Each expense is validated individually; if any fail the whole batch is rejected.
    """
    if not body.expenses:
        raise HTTPException(status_code=400, detail="No expenses provided")
    if len(body.expenses) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 expenses per batch")

    created_ids = []
    for exp in body.expenses:
        if exp.account_id is not None:
            _verify_account_ownership(db, exp.account_id, current_user["id"])
        db.execute(
            "INSERT INTO expenses (user_id, amount, category, note, date, account_id) VALUES (?,?,?,?,?,?)",
            (current_user["id"], exp.amount, exp.category, exp.note, exp.date, exp.account_id),
        )
        created_ids.append(db.execute("SELECT last_insert_rowid()").fetchone()[0])

    rows = [
        dict(db.execute("SELECT * FROM expenses WHERE id = ?", (eid,)).fetchone())
        for eid in created_ids
    ]
    return ExpenseBatchResponse(created=len(rows), expenses=rows)


_PDF_PARSE_PROMPT = (
    "Parse this bank statement. Return ONLY a JSON object — no other text:\n\n"
    "{\n"
    '  "account": {\n'
    '    "institution": "TD Bank",\n'
    '    "name": "TD Every Day Chequing",\n'
    '    "type": "chequing",\n'
    '    "last_four": "1234",\n'
    '    "balance": 1234.56\n'
    "  },\n"
    '  "transactions": [\n'
    '    {"date": "YYYY-MM-DD", "note": "merchant name", "amount": 12.34}\n'
    "  ]\n"
    "}\n\n"
    "Rules:\n"
    "- account.type: chequing, savings, credit_card, loan, line_of_credit, investment, or other\n"
    "- account.balance: closing/current balance, or null if not shown\n"
    "- account.last_four: last 4 digits of account/card number, or null\n"
    "- transactions: only debits/withdrawals/purchases — skip deposits, credits, fees, balance rows\n"
    "- amounts: positive numbers only\n"
    "- dates: YYYY-MM-DD format"
)


def _extract_pdf_text(content: bytes) -> str:
    """Extract text from a digital PDF using pdfplumber. Returns '' for scanned/image PDFs."""
    try:
        parts = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                # Tables first — bank statements are mostly tabular
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        for row in table:
                            if row and any(cell for cell in row):
                                parts.append(' | '.join(str(cell or '').strip() for cell in row))
                # Plain text for headers, account info etc.
                text = page.extract_text()
                if text:
                    parts.append(text)
        return '\n'.join(parts)
    except Exception:
        return ''


def _strip_json_fences(raw: str) -> str:
    import re
    # Find JSON inside code fences anywhere in the response
    fence = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', raw, re.DOTALL)
    if fence:
        return fence.group(1).strip()
    # Find first { ... } block if no fences
    brace = re.search(r'\{[\s\S]*\}', raw, re.DOTALL)
    if brace:
        return brace.group(0).strip()
    return raw.strip()


@router.post("/parse-pdf")
def parse_pdf_statement(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    content = file.file.read()

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File must be a valid PDF")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large (max 20 MB)")

    extracted_text = _extract_pdf_text(content)

    if len(extracted_text) >= 100:
        # Digital PDF — extract text locally (free) then send text to cheap model
        or_key = os.getenv("OPENROUTER_API_KEY")
        if not or_key:
            raise HTTPException(status_code=503, detail="AI parsing not configured")

        client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=or_key)
        response = client.chat.completions.create(
            model="google/gemini-2.5-flash",
            max_tokens=8192,
            messages=[{
                "role": "user",
                "content": f"{_PDF_PARSE_PROMPT}\n\nBank statement text:\n{extracted_text[:12000]}",
            }],
        )
        raw = response.choices[0].message.content.strip()
    else:
        # Scanned/image PDF — fall back to Claude with native PDF vision
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="Scanned PDF detected — requires ANTHROPIC_API_KEY in backend/.env",
            )
        pdf_b64 = base64.standard_b64encode(content).decode("utf-8")
        claude = anthropic.Anthropic(api_key=api_key)
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64}},
                    {"type": "text", "text": _PDF_PARSE_PROMPT},
                ],
            }],
        )
        raw = response.content[0].text.strip()

    try:
        parsed = json.loads(_strip_json_fences(raw))
        if not isinstance(parsed, dict) or "transactions" not in parsed:
            raise ValueError("unexpected shape")
    except Exception:
        raise HTTPException(status_code=500, detail="Could not parse statement — try a different PDF")

    return {
        "account": parsed.get("account"),
        "transactions": parsed.get("transactions", []),
    }


@router.get("/streak")
def get_expense_streak(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return the current logging streak (consecutive days with at least one expense or check-in)."""
    import datetime

    expense_rows = db.execute(
        "SELECT DISTINCT DATE(created_at) AS d FROM expenses WHERE user_id = ? ORDER BY d DESC",
        (current_user["id"],),
    ).fetchall()
    checkin_rows = db.execute(
        "SELECT DISTINCT date AS d FROM daily_checkins WHERE user_id = ? ORDER BY d DESC",
        (current_user["id"],),
    ).fetchall()

    dates_set = {row["d"] for row in expense_rows} | {row["d"] for row in checkin_rows}
    today = datetime.date.today()
    today_str = today.isoformat()
    today_logged = today_str in dates_set

    start = today if today_logged else today - datetime.timedelta(days=1)
    streak = 0
    check = start
    while check.isoformat() in dates_set:
        streak += 1
        check -= datetime.timedelta(days=1)

    return {"streak": streak, "today_logged": today_logged}


@router.post("/check-in", status_code=204)
def daily_checkin(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Record a 'nothing to log today' check-in that keeps the streak alive."""
    import datetime
    today = datetime.date.today().isoformat()
    db.execute(
        "INSERT OR IGNORE INTO daily_checkins (user_id, date) VALUES (?, ?)",
        (current_user["id"], today),
    )


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
