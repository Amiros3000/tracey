"""
models.py — Pydantic request/response schemas for all API endpoints.

Pydantic validates incoming JSON and serialises outgoing data.
Optional fields use None defaults so PATCH endpoints can distinguish
between "not provided" and "explicitly set to null" via model_dump(exclude_unset=True).
"""

from typing import Optional
from pydantic import BaseModel, field_validator

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    pin: Optional[str] = None

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("pin")
    @classmethod
    def pin_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.isdigit() or len(v) != 4:
                raise ValueError("PIN must be exactly 4 digits")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class PINLoginRequest(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def pin_format(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError("PIN must be exactly 4 digits")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None  # only returned on password login
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


class ChangePINRequest(BaseModel):
    new_pin: str

    @field_validator("new_pin")
    @classmethod
    def pin_format(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError("PIN must be exactly 4 digits")
        return v


class ChangeEmailRequest(BaseModel):
    new_email: str

    @field_validator("new_email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v


class ChangeUsernameRequest(BaseModel):
    new_username: str

    @field_validator("new_username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Username must be at least 2 characters")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    email_verified: bool
    privacy_level: str
    created_at: str
    last_login: Optional[str]

# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

class AccountCreate(BaseModel):
    name: str
    type: str                           # chequing/savings/credit_card/loan/line_of_credit/investment/other
    institution: Optional[str] = None
    balance: float = 0.0
    currency: str = "CAD"
    # Credit card
    credit_limit: Optional[float] = None
    purchase_apr: Optional[float] = None
    cash_apr: Optional[float] = None
    annual_fee: Optional[float] = None
    minimum_payment: Optional[float] = None
    payment_due_day: Optional[int] = None
    payment_source_account_id: Optional[int] = None
    # Loan / line of credit
    original_principal: Optional[float] = None
    interest_rate: Optional[float] = None
    interest_type: Optional[str] = None  # fixed / variable / interest_free
    monthly_payment: Optional[float] = None
    payment_day: Optional[int] = None
    loan_type: Optional[str] = None      # student / personal / auto / mortgage / loc
    is_government_loan: bool = False
    repayment_plan: Optional[str] = None
    # Bank account
    monthly_fee: Optional[float] = None
    fee_waiver_minimum_balance: Optional[float] = None
    account_plan_name: Optional[str] = None
    # Common
    notes: Optional[str] = None

    @field_validator("type")
    @classmethod
    def valid_account_type(cls, v: str) -> str:
        allowed = {
            "chequing", "savings", "credit_card", "loan",
            "line_of_credit", "investment", "other"
        }
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v


class AccountUpdate(BaseModel):
    # All fields optional — PATCH semantics: only update what's provided
    name: Optional[str] = None
    institution: Optional[str] = None
    balance: Optional[float] = None
    currency: Optional[str] = None
    credit_limit: Optional[float] = None
    purchase_apr: Optional[float] = None
    cash_apr: Optional[float] = None
    annual_fee: Optional[float] = None
    minimum_payment: Optional[float] = None
    payment_due_day: Optional[int] = None
    payment_source_account_id: Optional[int] = None
    original_principal: Optional[float] = None
    interest_rate: Optional[float] = None
    interest_type: Optional[str] = None
    monthly_payment: Optional[float] = None
    payment_day: Optional[int] = None
    loan_type: Optional[str] = None
    is_government_loan: Optional[bool] = None
    repayment_plan: Optional[str] = None
    monthly_fee: Optional[float] = None
    fee_waiver_minimum_balance: Optional[float] = None
    account_plan_name: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class BalanceUpdateRequest(BaseModel):
    balance: float
    record_history: bool = True  # if False, silently updates without a snapshot


class AccountResponse(BaseModel):
    id: int
    name: str
    type: str
    institution: Optional[str]
    balance: float
    currency: str
    credit_limit: Optional[float]
    purchase_apr: Optional[float]
    cash_apr: Optional[float]
    annual_fee: Optional[float]
    minimum_payment: Optional[float]
    payment_due_day: Optional[int]
    payment_source_account_id: Optional[int]
    original_principal: Optional[float]
    interest_rate: Optional[float]
    interest_type: Optional[str]
    monthly_payment: Optional[float]
    payment_day: Optional[int]
    loan_type: Optional[str]
    is_government_loan: bool
    repayment_plan: Optional[str]
    monthly_fee: Optional[float]
    fee_waiver_minimum_balance: Optional[float]
    account_plan_name: Optional[str]
    is_active: bool
    notes: Optional[str]
    created_at: str
    updated_at: str

# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {
    "🛒 Groceries",
    "🍔 Eating Out",
    "☕ Coffee",
    "🚗 Transportation",
    "🎮 Entertainment",
    "🛍️ Shopping",
    "💼 Business",
    "🏦 Savings Transfer",
    "💳 Loan Payment",
    "📱 Subscriptions",
    "🏥 Health",
    "📦 Other",
}


class ExpenseCreate(BaseModel):
    amount: float
    category: str
    note: Optional[str] = None
    date: str        # YYYY-MM-DD
    account_id: Optional[int] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @field_validator("date")
    @classmethod
    def valid_date_format(cls, v: str) -> str:
        # Basic ISO date validation — YYYY-MM-DD
        from datetime import date
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("date must be in YYYY-MM-DD format")
        return v


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    note: Optional[str] = None
    date: Optional[str] = None
    account_id: Optional[int] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v


class ExpenseResponse(BaseModel):
    id: int
    amount: float
    category: str
    note: Optional[str]
    date: str
    account_id: Optional[int]
    created_at: str


class ExpenseSummaryResponse(BaseModel):
    """Aggregated spending for a date range, broken down by category."""
    start_date: str
    end_date: str
    total: float
    by_category: dict[str, float]
    transaction_count: int

# ---------------------------------------------------------------------------
# Income
# ---------------------------------------------------------------------------

VALID_INCOME_TYPES = {"employment", "government", "other"}


class IncomeCreate(BaseModel):
    amount: float
    source: str
    income_type: str = "employment"
    date: str    # YYYY-MM-DD
    note: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @field_validator("income_type")
    @classmethod
    def valid_income_type(cls, v: str) -> str:
        if v not in VALID_INCOME_TYPES:
            raise ValueError(f"income_type must be one of {VALID_INCOME_TYPES}")
        return v

    @field_validator("date")
    @classmethod
    def valid_date_format(cls, v: str) -> str:
        from datetime import date
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("date must be in YYYY-MM-DD format")
        return v


class IncomeUpdate(BaseModel):
    amount: Optional[float] = None
    source: Optional[str] = None
    income_type: Optional[str] = None
    date: Optional[str] = None
    note: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v


class IncomeResponse(BaseModel):
    id: int
    amount: float
    source: str
    income_type: str
    date: str
    note: Optional[str]
    created_at: str


class IncomeSummaryResponse(BaseModel):
    """Total income for a date range, split by type."""
    start_date: str
    end_date: str
    total: float
    employment: float
    government: float
    other: float
    transaction_count: int

# ---------------------------------------------------------------------------
# Settings (used by multiple route modules)
# ---------------------------------------------------------------------------

class SettingUpdate(BaseModel):
    value: str  # JSON-compatible string

# ---------------------------------------------------------------------------
# Net worth (computed, not stored directly)
# ---------------------------------------------------------------------------

class NetWorthResponse(BaseModel):
    """Snapshot of current net worth derived from all account balances."""
    total_assets: float
    total_liabilities: float
    net_worth: float
    by_account_type: dict[str, float]


class NetWorthHistoryPoint(BaseModel):
    date: str
    net_worth: float
    assets: float
    liabilities: float


# ---------------------------------------------------------------------------
# Recurring transactions
# ---------------------------------------------------------------------------

class RecurringCreate(BaseModel):
    name: str
    amount: float
    type: str            # debit / credit
    frequency: str       # weekly / monthly / quarterly / annual
    day_of_month: Optional[int] = None
    next_date: Optional[str] = None   # YYYY-MM-DD
    category: Optional[str] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    is_government_benefit: bool = False

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @field_validator("type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in {"debit", "credit"}:
            raise ValueError("type must be 'debit' or 'credit'")
        return v

    @field_validator("frequency")
    @classmethod
    def valid_frequency(cls, v: str) -> str:
        if v not in {"weekly", "monthly", "quarterly", "annual"}:
            raise ValueError("frequency must be weekly/monthly/quarterly/annual")
        return v


class RecurringUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    frequency: Optional[str] = None
    day_of_month: Optional[int] = None
    next_date: Optional[str] = None
    category: Optional[str] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    is_government_benefit: Optional[bool] = None
    is_active: Optional[bool] = None


class RecurringResponse(BaseModel):
    id: int
    user_id: int
    name: str
    amount: float
    type: str
    frequency: str
    day_of_month: Optional[int]
    next_date: Optional[str]
    category: Optional[str]
    from_account_id: Optional[int]
    to_account_id: Optional[int]
    is_government_benefit: bool
    is_active: bool
    created_at: str


# ---------------------------------------------------------------------------
# Rewards
# ---------------------------------------------------------------------------

class RewardProfileCreate(BaseModel):
    account_id: int
    reward_type: str      # points / cashback / miles / hybrid
    program_name: str
    base_earn_rate: float = 1.0
    bonus_rates: Optional[dict] = None   # {"🛒 Groceries": 3.0, "🍔 Eating Out": 2.0}
    point_value_cents: float = 1.0
    travel_value_cents: Optional[float] = None
    expiry_policy: Optional[str] = None
    known_balance: float = 0.0


class RewardProfileUpdate(BaseModel):
    reward_type: Optional[str] = None
    program_name: Optional[str] = None
    base_earn_rate: Optional[float] = None
    bonus_rates: Optional[dict] = None
    point_value_cents: Optional[float] = None
    travel_value_cents: Optional[float] = None
    expiry_policy: Optional[str] = None
    known_balance: Optional[float] = None


class RewardProfileResponse(BaseModel):
    id: int
    account_id: int
    account_name: str
    reward_type: str
    program_name: str
    base_earn_rate: float
    bonus_rates: Optional[dict]
    point_value_cents: float
    travel_value_cents: Optional[float]
    expiry_policy: Optional[str]
    known_balance: float
    estimated_balance: float
    last_manual_update: Optional[str]


# ---------------------------------------------------------------------------
# Expense batch (CSV import)
# ---------------------------------------------------------------------------

class ExpenseBatchCreate(BaseModel):
    expenses: list[ExpenseCreate]


class ExpenseBatchResponse(BaseModel):
    created: int
    expenses: list[ExpenseResponse]
