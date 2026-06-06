"""
main.py — Tracey API entry point.

Wires together:
  - FastAPI application
  - CORS middleware (origins from env, never hardcoded)
  - SlowAPI rate limiting middleware
  - Lifespan event for database initialisation
  - All route groups

Run with:
  uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from dotenv import load_dotenv

from database import init_db
from routes import auth_routes, accounts, expenses, income, ai_routes, recurring, rewards, goals

load_dotenv()


# ---------------------------------------------------------------------------
# Rate limiter — applied globally, tighter limits set per auth route
# ---------------------------------------------------------------------------

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[os.getenv("RATE_LIMIT_PER_MINUTE", "200") + "/minute"],
)


# ---------------------------------------------------------------------------
# Lifespan — runs once on startup and shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise the database schema before the first request is served."""
    init_db()
    yield
    # Nothing to clean up on shutdown — SQLite connections are request-scoped


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="tracey API",
    version="2.0.0",
    description=(
        "Personal finance API for tracey — expense tracking, account management, "
        "loan tracking, reward optimisation, and AI money guidance. "
        "Self-hosted, encrypted at rest, private by design."
    ),
    lifespan=lifespan,
    # Disable the default /docs and /redoc in production by setting these
    # to None once deployed — they expose your data model to anyone who finds
    # your server.  Leave them on for development.
    docs_url="/docs",
    redoc_url=None,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

# Global rate limit exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS — allowed origins come from the env so no code change is needed when
# moving from localhost to the Vercel production URL
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(auth_routes.router, prefix="/auth",     tags=["Auth"])
app.include_router(accounts.router,    prefix="/accounts", tags=["Accounts"])
app.include_router(expenses.router,    prefix="/expenses", tags=["Expenses"])
app.include_router(income.router,      prefix="/income",   tags=["Income"])
app.include_router(ai_routes.router,   prefix="/ai",         tags=["AI"])
app.include_router(recurring.router,   prefix="/recurring",  tags=["Recurring"])
app.include_router(rewards.router,     prefix="/rewards",    tags=["Rewards"])
app.include_router(goals.router,       prefix="/goals",       tags=["Goals"])


# ---------------------------------------------------------------------------
# Health check — no auth required, safe to expose to uptime monitors
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Health"])
def health_check():
    """
    Lightweight liveness probe.

    Returns 200 as long as the Python process is alive and FastAPI is
    responding.  Does NOT check the database — that would add latency and
    complexity for a check that runs every 30 seconds.
    """
    return {"status": "ok", "service": "tracey-api", "version": "2.0.0"}
