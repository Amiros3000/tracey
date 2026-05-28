"""
database.py — SQLCipher connection management and schema initialisation.

Every connection opens the encrypted database, sets the key as the very
first command (SQLCipher requirement), and enables foreign-key enforcement.
Route handlers receive connections via the get_db() FastAPI dependency.

The full schema is created here — including Phase 2 tables — so we never
need ALTER TABLE migrations.  SQLite's column addition support is limited
and migration tooling adds unnecessary complexity for a personal app.
"""

import os
import sqlcipher3
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DATABASE_PATH = os.getenv("DATABASE_PATH", "tracey.db")
DATABASE_KEY  = os.getenv("DATABASE_KEY", "")

# ---------------------------------------------------------------------------
# Schema — all tables defined upfront
# ---------------------------------------------------------------------------
SCHEMA = """
-- One user per personal instance.  user_id is carried on all tables so
-- the schema is multi-user ready if a family member needs to be added later.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    pin_hash      TEXT,
    privacy_level TEXT    NOT NULL DEFAULT 'full',  -- simple / smart / full
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login    DATETIME
);

-- Refresh tokens stored and hashed so they can be revoked individually
-- (logout, password change, suspected compromise).
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Wide accounts table covers all account types in one place.
-- Type-specific columns are nullable; only relevant ones are populated.
-- This avoids JOIN complexity for a personal app without sacrificing
-- the ability to query all accounts with one SELECT.
CREATE TABLE IF NOT EXISTS accounts (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                        TEXT    NOT NULL,
    type                        TEXT    NOT NULL,  -- chequing / savings / credit_card / loan / line_of_credit / investment / other
    institution                 TEXT,
    balance                     REAL    NOT NULL DEFAULT 0.0,
    currency                    TEXT    NOT NULL DEFAULT 'CAD',
    -- Credit card fields
    credit_limit                REAL,
    purchase_apr                REAL,
    cash_apr                    REAL,
    annual_fee                  REAL,
    minimum_payment             REAL,
    payment_due_day             INTEGER,  -- day of month (1-31)
    payment_source_account_id   INTEGER REFERENCES accounts(id),
    -- Loan / line of credit fields
    original_principal          REAL,
    interest_rate               REAL,
    interest_type               TEXT,    -- fixed / variable / interest_free
    monthly_payment             REAL,
    payment_day                 INTEGER, -- day of month (1-31)
    loan_type                   TEXT,    -- student / personal / auto / mortgage / loc
    is_government_loan          INTEGER NOT NULL DEFAULT 0,  -- boolean (0/1)
    repayment_plan              TEXT,    -- e.g. "RAP" for OSAP repayment assistance
    -- Bank account fields
    monthly_fee                 REAL,
    fee_waiver_minimum_balance  REAL,
    account_plan_name           TEXT,
    -- Universal
    is_active                   INTEGER NOT NULL DEFAULT 1,
    notes                       TEXT,
    created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Snapshot every balance change so we can plot net worth over time.
-- Inserted by the balance-update endpoint; also inserted on account creation.
CREATE TABLE IF NOT EXISTS balance_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    balance     REAL    NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Individual spending transactions.
-- account_id is nullable so expenses can be logged before accounts are set up.
CREATE TABLE IF NOT EXISTS expenses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     REAL    NOT NULL,
    category   TEXT    NOT NULL,
    note       TEXT,
    date       TEXT    NOT NULL,  -- ISO-8601 YYYY-MM-DD
    account_id INTEGER REFERENCES accounts(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Individual income deposits.
-- Pay-cycle configuration (biweekly etc.) is a user setting, not per-record.
-- Storing pay_cycle per income entry would mean updating hundreds of rows if
-- the user changes their cycle.
CREATE TABLE IF NOT EXISTS income (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      REAL    NOT NULL,
    source      TEXT    NOT NULL,
    income_type TEXT    NOT NULL DEFAULT 'employment',  -- employment / government / other
    date        TEXT    NOT NULL,  -- ISO-8601 YYYY-MM-DD
    note        TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pre-authorised debits, subscriptions, loan payments, government credits.
-- The engine that keeps "upcoming obligations" and budget math accurate.
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT    NOT NULL,
    amount              REAL    NOT NULL,
    type                TEXT    NOT NULL,     -- debit / credit
    from_account_id     INTEGER REFERENCES accounts(id),
    to_account_id       INTEGER REFERENCES accounts(id),
    frequency           TEXT    NOT NULL,     -- weekly / monthly / quarterly / annual
    day_of_month        INTEGER,
    next_date           TEXT,                 -- ISO-8601 YYYY-MM-DD
    category            TEXT,
    is_government_benefit INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-card reward programme metadata.
-- bonus_rates stores category overrides as JSON: {"Groceries": 2.0, "Travel": 3.0}
CREATE TABLE IF NOT EXISTS rewards (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    reward_type         TEXT    NOT NULL,    -- points / cashback / miles / hybrid
    program_name        TEXT    NOT NULL,
    base_earn_rate      REAL    NOT NULL DEFAULT 0.0,
    bonus_rates         TEXT,               -- JSON
    point_value_cents   REAL    DEFAULT 1.0,
    travel_value_cents  REAL,
    expiry_policy       TEXT,
    known_balance       REAL    DEFAULT 0.0,
    estimated_balance   REAL    DEFAULT 0.0,
    last_manual_update  DATETIME
);

-- Each time an expense is logged against a rewards card, an estimated
-- reward transaction is created.  is_estimated = 1 means it was calculated
-- from earn rates, not verified from the card issuer.
CREATE TABLE IF NOT EXISTS reward_transactions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id            INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    account_id            INTEGER NOT NULL REFERENCES accounts(id),
    points_earned         REAL    DEFAULT 0.0,
    cashback_earned       REAL    DEFAULT 0.0,
    category_rate_applied REAL,
    is_estimated          INTEGER NOT NULL DEFAULT 1
);

-- User-defined savings goals, optionally linked to an account.
CREATE TABLE IF NOT EXISTS savings_goals (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT    NOT NULL,
    target_amount     REAL    NOT NULL,
    current_amount    REAL    NOT NULL DEFAULT 0.0,
    target_date       TEXT,   -- ISO-8601 YYYY-MM-DD
    linked_account_id INTEGER REFERENCES accounts(id),
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Generic key/value settings store.
-- Stores: pay_cycle, cycle_start_date, and any future user preferences.
-- value is always a JSON-compatible string ("biweekly", "2024-01-01", etc.)
CREATE TABLE IF NOT EXISTS settings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT    NOT NULL,
    value      TEXT    NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
);
"""

# ---------------------------------------------------------------------------
# Connection factory
# ---------------------------------------------------------------------------

def _open_connection() -> sqlcipher3.Connection:
    """
    Open an encrypted connection and configure it.

    SQLCipher requires PRAGMA key to be the very first statement on a new
    connection — before any other queries.  Foreign keys are off by default
    in SQLite; we enable them per connection.
    """
    if not DATABASE_KEY:
        raise RuntimeError(
            "DATABASE_KEY is not set in .env  "
            "Generate one with: openssl rand -hex 32"
        )

    conn = sqlcipher3.connect(DATABASE_PATH)

    # PRAGMA key must come before ANY other SQL on this connection.
    # The key comes from an env var, never from user input, so using
    # string interpolation here is intentional and safe.
    conn.execute(f'PRAGMA key="{DATABASE_KEY}"')

    # SQLite3.Row lets us access columns by name (row["id"]) and also
    # converts rows to dict with dict(row).
    conn.row_factory = sqlcipher3.Row

    # Enforce foreign key constraints (SQLite disables them by default).
    conn.execute("PRAGMA foreign_keys = ON")

    return conn


def init_db() -> None:
    """
    Create all tables on application startup.

    Called once via FastAPI's lifespan event.  Safe to run on every startup
    because every statement uses CREATE TABLE IF NOT EXISTS.
    """
    conn = _open_connection()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_db():
    """
    FastAPI dependency that provides a database connection per request.

    Usage in a route:
        @router.get("/")
        def list_items(db = Depends(get_db)):
            rows = db.execute("SELECT * FROM items").fetchall()

    Commits on success, rolls back on exception, always closes the connection.
    """
    conn = _open_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
