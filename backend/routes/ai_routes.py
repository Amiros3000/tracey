"""
ai_routes.py — AI money guide powered by Claude.

The assistant receives a financial summary as system context so every
response is grounded in the user's actual numbers — not generic advice.
Context includes: accounts, net worth, current cycle income/expenses,
loans, and recent transactions.
"""

import json
import os
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

import anthropic
from openai import OpenAI

from auth import get_current_user
from database import get_db

router = APIRouter()


def _or_client() -> OpenAI:
    """OpenAI-compatible client pointed at OpenRouter."""
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY", ""),
    )


def _strip_json_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


def _build_financial_context(user_id: int, db) -> str:
    """Pull key financial data and format as a compact context block."""
    today = date.today().isoformat()
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()

    # Net worth
    rows = db.execute(
        "SELECT type, balance FROM accounts WHERE user_id = ? AND is_active = 1",
        (user_id,)
    ).fetchall()

    assets = sum(r["balance"] for r in rows if r["type"] in ("chequing", "savings", "investment"))
    liabilities = sum(r["balance"] for r in rows if r["type"] in ("credit_card", "loan", "line_of_credit"))
    net_worth = assets - liabilities

    accounts_text = "\n".join(
        f"  - {r['type'].replace('_',' ').title()}: ${r['balance']:,.2f}"
        for r in rows
    ) or "  (none)"

    # Pay cycle settings (stored as key/value rows)
    settings_rows = db.execute(
        "SELECT key, value FROM settings WHERE user_id = ? AND key IN (?, ?)",
        (user_id, "pay_cycle", "cycle_start_date")
    ).fetchall()
    settings_map = {r["key"]: r["value"] for r in settings_rows}
    pay_cycle   = settings_map.get("pay_cycle", "biweekly")
    cycle_start = settings_map.get("cycle_start_date", today)

    # Current cycle income
    income_row = db.execute(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM income WHERE user_id = ? AND date >= ?",
        (user_id, cycle_start)
    ).fetchone()
    cycle_income = income_row["total"] if income_row else 0

    # Current cycle expenses
    exp_row = db.execute(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND date >= ?",
        (user_id, cycle_start)
    ).fetchone()
    cycle_expenses = exp_row["total"] if exp_row else 0

    # Top expense categories this cycle
    cat_rows = db.execute(
        """SELECT category, SUM(amount) AS total
           FROM expenses WHERE user_id = ? AND date >= ?
           GROUP BY category ORDER BY total DESC LIMIT 5""",
        (user_id, cycle_start)
    ).fetchall()
    cat_text = "\n".join(
        f"  - {r['category']}: ${r['total']:,.2f}" for r in cat_rows
    ) or "  (no expenses yet)"

    # Loans
    loan_rows = db.execute(
        """SELECT name, balance, interest_rate, monthly_payment, is_government_loan
           FROM accounts WHERE user_id = ? AND is_active = 1
           AND type IN ('loan','line_of_credit')""",
        (user_id,)
    ).fetchall()
    loan_text = "\n".join(
        f"  - {r['name']}: ${r['balance']:,.2f} owed"
        + (f" @ {r['interest_rate']}%" if r['interest_rate'] else "")
        + (f", ${r['monthly_payment']}/mo" if r['monthly_payment'] else "")
        + (" [gov/OSAP]" if r['is_government_loan'] else "")
        for r in loan_rows
    ) or "  (none)"

    return f"""Today: {today}
Pay cycle: {pay_cycle}, started {cycle_start}

NET WORTH: ${net_worth:,.2f}
  Assets:      ${assets:,.2f}
  Liabilities: ${liabilities:,.2f}

ACCOUNTS:
{accounts_text}

THIS CYCLE:
  Income:   ${cycle_income:,.2f}
  Spent:    ${cycle_expenses:,.2f}
  Remaining:${max(cycle_income - cycle_expenses, 0):,.2f}

SPENDING BY CATEGORY (this cycle):
{cat_text}

LOANS & DEBT:
{loan_text}"""


SYSTEM_PROMPT = """You are tracey's AI Money Guide — a personal finance assistant with full access to the user's real financial data.

Your job: give honest, specific, actionable advice based on their actual numbers. Not generic tips. Real analysis.

Rules:
- Be direct and concise. No fluff.
- Reference the user's specific numbers when relevant (e.g. "You've spent $340 on eating out this cycle")
- For Canadian users: mention OSAP federal interest-free status, RRSP/TFSA when relevant
- Flag risks clearly. Don't sugarcoat overspending.
- Calculations: do the math for them (payoff dates, savings rates, etc.)
- Keep responses under 300 words unless the user asks for a detailed breakdown
- Tone: friendly but direct, like a knowledgeable friend — not a corporate advisor

Financial context (user's real data):
"""


class DayInsightRequest(BaseModel):
    date: str  # YYYY-MM-DD


@router.post("/day-insight")
def get_day_insight(
    body: DayInsightRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Return a single insight about one specific day's transactions."""
    if not os.getenv("OPENROUTER_API_KEY"):
        return {"insight": "AI insights require OPENROUTER_API_KEY to be configured."}

    expenses = db.execute(
        "SELECT category, amount, note FROM expenses WHERE user_id = ? AND date = ?",
        (user["id"], body.date),
    ).fetchall()
    income = db.execute(
        "SELECT source, amount FROM income WHERE user_id = ? AND date = ?",
        (user["id"], body.date),
    ).fetchall()

    if not expenses and not income:
        return {"insight": "Nothing was logged on this day — no transactions to analyse."}

    exp_lines = "\n".join(
        f"  - {e['category']}: ${e['amount']:.2f}" + (f" ({e['note']})" if e["note"] else "")
        for e in expenses
    ) or "  None"
    inc_lines = "\n".join(f"  - {i['source']}: ${i['amount']:.2f}" for i in income) or "  None"
    total_exp = sum(e["amount"] for e in expenses)
    total_inc = sum(i["amount"] for i in income)

    prompt = (
        f"Here are the financial transactions for {body.date}:\n"
        f"Expenses:\n{exp_lines}\n"
        f"Total spent: ${total_exp:.2f}\n"
        f"Income:\n{inc_lines}\n"
        f"Total income: ${total_inc:.2f}\n"
        f"Net: ${total_inc - total_exp:+.2f}\n\n"
        "Give one brief, specific, practical insight about this day. "
        "Reference the actual amounts. Two sentences max. "
        "Be friendly, direct, and actionable — not generic."
    )

    try:
        response = _or_client().chat.completions.create(
            model="google/gemini-2.5-flash",
            max_tokens=140,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"insight": response.choices[0].message.content.strip()}
    except Exception:
        return {"insight": "Unable to generate insight right now."}


class LookupRequest(BaseModel):
    product_name: str
    product_type: str = "credit_card"  # credit_card / bank_account / loan


@router.get("/insights")
def get_insights(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    # Returns [] on any failure so the dashboard degrades gracefully
    if not os.getenv("OPENROUTER_API_KEY"):
        return []

    context = _build_financial_context(user["id"], db)
    try:
        response = _or_client().chat.completions.create(
            model="google/gemini-2.5-flash",
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": (
                    f"Financial snapshot:\n{context}\n\n"
                    "Give exactly 3 financial insights about this person's situation.\n\n"
                    "Rules:\n"
                    "- Each must reference a specific dollar amount or number from the data\n"
                    "- One sentence each — no filler, no intro words\n"
                    "- type: 'positive' = good news, 'warning' = concern, 'info' = neutral fact\n"
                    "- If data is sparse (all zeros), return insights about what to set up\n\n"
                    "Return ONLY a JSON array:\n"
                    '[{"text":"...", "type":"positive|warning|info"}]'
                ),
            }],
        )
        raw = response.choices[0].message.content
        insights = json.loads(_strip_json_fences(raw))
        return insights[:3] if isinstance(insights, list) else []
    except Exception:
        return []


@router.post("/lookup")
def lookup_product(
    body: LookupRequest,
    user=Depends(get_current_user),
):
    if not os.getenv("OPENROUTER_API_KEY"):
        raise HTTPException(status_code=503, detail="AI lookup not configured")

    prompt = (
        f'Look up this Canadian financial product: "{body.product_name}" (type: {body.product_type})\n\n'
        "Return ONLY a JSON object (use null for unknown values):\n"
        '{"institution":"bank name","program_name":"rewards program or null",'
        '"reward_type":"points|cashback|miles|none","base_earn_rate":1.0,'
        '"bonus_rates":{"🛒 Groceries":3.0,"🍔 Eating Out":2.0},'
        '"purchase_apr":19.99,"annual_fee":120.0,"credit_limit_typical":5000.0,'
        '"interest_rate":null,"notes":"any important info"}'
    )

    try:
        response = _or_client().chat.completions.create(
            model="deepseek/deepseek-v4-flash:free",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content
        return json.loads(_strip_json_fences(raw))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not look up product")


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: Request,
    body: ChatRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return ChatResponse(reply="AI Guide is not configured. Add your ANTHROPIC_API_KEY to the backend .env file.")

    context = _build_financial_context(user["id"], db)

    client = anthropic.Anthropic(api_key=api_key)

    messages = [
        {"role": m.role, "content": m.content}
        for m in body.history
        if m.role in ("user", "assistant")
    ]
    messages.append({"role": "user", "content": body.message})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT + context,
        messages=messages,
    )

    reply = response.content[0].text
    return ChatResponse(reply=reply)
