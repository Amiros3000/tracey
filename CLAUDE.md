# Tracey — personal finance PWA

## What this is
Full personal finance platform. Expense tracking, multi-bank account management,
loan tracking (including OSAP), reward points/cashback optimization, AI-powered
insights, net worth dashboard, calendar history, savings goals. Serious daily-use tool, not a demo.

## Core philosophy
- User controls privacy — share as much or little as they want
- App never connects to banks directly — CSV/PDF import only
- All estimates clearly labeled, user can override anything
- AI gives advice based on real personal numbers, not generic tips
- No social features, no budget envelopes, no investing — stay focused

## Brand
Name: "tracey" (always lowercase)
Version: v2.0
Primary: #22c55e (green — conveys positivity and growth)
Font: Nunito 400/600/700/800
Logo: rounded green square icon + "trace" dark + "y" green (#22c55e)
Favicon: SVG at /public/favicon.svg — green rounded square with white lowercase "t"
PWA icons: /public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
Mode: system default (light/dark follows OS)
Aesthetic: professional fintech — clean whites/near-blacks, no emojis in navigation

## Structure
tracey/
├── backend/   FastAPI, SQLite+SQLCipher, JWT auth — port 8000
├── frontend/  Next.js 14, Tailwind, Nunito, PWA — port 3000
└── deploy.sh  One-command backend deploy to Hetzner (rsync + env sync + pip + pm2 restart)

## Pages & Navigation

### Main navigation
Sidebar (desktop): Home, Accounts, Spending, Bills, Rewards, Goals, Calendar + Settings at bottom
Bottom nav (mobile): Home, Accounts, Spending, Bills, Rewards, Goals (6 items — no Settings, no Calendar)
Settings on mobile: gear icon in dashboard header (top right, mobile only)

| Label     | Route        | File                        |
|-----------|--------------|------------------------------|
| Home      | /dashboard   | (app)/dashboard/page.tsx     |
| Accounts  | /accounts    | (app)/accounts/page.tsx      |
| Spending  | /overview    | (app)/overview/page.tsx      |
| Bills     | /recurring   | (app)/recurring/page.tsx     |
| Rewards   | /rewards     | (app)/rewards/page.tsx       |
| Goals     | /goals       | (app)/goals/page.tsx         |
| Calendar  | /calendar    | (app)/calendar/page.tsx      |
| Settings  | /settings    | (app)/settings/page.tsx      |

### Pages not in main nav (accessible via URL)
- `/log` — Transaction logging (expense/income), reached via FAB or direct link
- `/loans` — Loans & Debt view: filters accounts of type loan/line_of_credit, shows payoff estimates, OSAP notes
- `/ai` — Full-screen AI chat (Claude Sonnet), accessed via direct URL (not in sidebar)

### Auth & public pages
- `/` — Landing page (marketing); redirects to /dashboard if logged in
- `/login` — Login (password tab + PIN tab; defaults to PIN if tracey_has_pin is set); show/hide password toggle
- `/register` — Registration with show/hide password; after success shows PIN setup step (optional, skip available)
- `/onboarding` — 4-step first-time setup (pay cycle → first account → first income → done)
- `/verify-email` — Email verification landing
- `/privacy`, `/terms` — Static pages

### FAB (floating action button)
3 options with spring pop-in (staggered bottom-to-top) / pop-out (top-to-bottom) animation:
- Expense → /log?type=expense
- Income → /log?type=income
- Import statement → /accounts?import=1

## Key decisions — Backend
- SQLite with SQLCipher (encrypted at rest), check_same_thread=False on connection
- JWT auth: 15min access tokens, 7-day refresh tokens stored hashed in DB
- All route handlers are `def` (not `async def`) — avoids SQLCipher thread mismatch
- CSV/PDF import: PDF text extracted locally with pdfplumber (free), sent as text to Gemini 2.5 Flash via OpenRouter (max_tokens=8192); scanned/image PDFs fall back to Claude native PDF. JSON extracted from anywhere in model response using regex (not just start of string) — handles thinking-model preamble.
- AI model routing: insights + product lookup + day-insight → OpenRouter (Gemini 2.5 Flash); chat → Claude Sonnet 4.6 direct; PDF → pdfplumber + OpenRouter (Claude fallback)
- Safe-to-spend = (income − spent − upcoming_bills_this_cycle − savings_target) ÷ days remaining. Shows breakdown line "X bills · Y savings reserved" when deductions are active.
- Savings target: stored as `savings_target` key in settings table, returned by GET /income/settings, updated via PUT /income/settings/savings_target
- Streak tracking: GET /expenses/streak counts consecutive days using DATE(created_at) — NOT the expense date field, so CSV imports don't inflate the streak. POST /expenses/check-in keeps streak alive on zero-expense days.
- Reward tracking estimated from spend + known rates
- CORS: `ALLOWED_ORIGINS` env var + `allow_origin_regex` for all `*.vercel.app`

## Key decisions — Frontend
- Log page: mobile scrolls naturally (no fixed height), desktop two-column fixed height. Date navigation (← day →), tap date label to open native date picker (showPicker()), category grid (4-col emoji grid), two-column desktop layout.
- Amount input: monospace, inputMode="none" on mobile (prevents device keyboard), inputMode="decimal" on desktop; numpad handles mobile, keyboard handles desktop
- Dashboard: two-column desktop layout (left: safe-to-spend + this cycle + recent; right: net worth + tracey thinks + check-in); streak counter in header (🔥 = logged today, 💤 = at risk); gear icon for Settings (mobile only). Safe-to-spend card shows deduction breakdown when upcoming bills or savings target > 0.
- Import: CSV file stored in state (not ref) to survive re-renders. Dates normalized from MM/DD/YYYY → YYYY-MM-DD. Inline error messages (no alerts). Account not created if PDF has 0 transactions.
- Page first-time tips: useTip() hook (lib/tips.ts), localStorage key per page, dismissible × banner on Accounts, Spending, Bills, Rewards
- PIN login: tab switcher on login page; defaults to PIN tab if localStorage.tracey_has_pin is set
- Email banner: dismissible × (localStorage key tracey_email_dismissed)
- Modals: `.modal-overlay` + `.modal-sheet` CSS classes — mobile: slide-up sheet from bottom; desktop: centered dialog with fadeScaleIn, accounts for sidebar via `padding-left: var(--sidebar-width)` on overlay.
- Safe area: `--bottom-nav-height: calc(64px + env(safe-area-inset-bottom))` — accounts for iPhone home bar
- Auth context: exposes `refreshUser()` to re-fetch /auth/me after profile changes
- DateButton component (`components/DateButton.tsx`): custom styled date field used everywhere instead of raw `type="date"`. Full-size transparent input overlays the button so iOS Safari taps work without showPicker(). Used in: goals modal, settings pay cycle, recurring next date, onboarding, spending custom range.
- Spending page: cycle navigation arrows (← current cycle →) instead of raw date inputs. "Custom" toggle reveals DateButton fields. Cycle offset tracked as integer (0 = current, -1 = previous, etc.).
- Goals page: card layout — name + pencil edit icon / progress bar (grey→amber→green) / amounts + Add button. Edit modal contains delete. Add funds modal is a large centered number input.

## Current backend routes
auth_routes: register, login, pin-login, refresh, logout, change-password, change-pin, change-email, change-username, resend-verification, verify-email, me, data (DELETE all)
accounts: CRUD (including DELETE /{id}), balance update, balance history, net-worth, net-worth/history
expenses: list, summary, create, batch, parse-pdf (PDF import), streak, check-in, /{id} CRUD
income: list, summary, create, sources, settings (pay_cycle/cycle_start_date/savings_target), /{id} CRUD
recurring: CRUD, upcoming (supports end_date param), summary, mark-paid
rewards: CRUD, estimate, summary
goals: list, create, /{id} PATCH, /{id} DELETE
ai: insights (dashboard), day-insight (calendar), lookup (product), chat

## Commands
Backend:  cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
Frontend: cd frontend && npm run dev
Deploy:   ./deploy.sh  (syncs code + missing env keys, installs deps, restarts PM2)
Push frontend: git push origin main  (Vercel auto-deploys — do NOT run vercel CLI manually)

## Env vars
backend/.env:
  SECRET_KEY=          (JWT signing key)
  DATABASE_KEY=        (SQLCipher encryption key)
  DATABASE_PATH=       (defaults to tracey.db)
  ALLOWED_ORIGINS=     (comma-separated; also allow_origin_regex covers *.vercel.app)
  FRONTEND_URL=        (used in verification emails — set to production URL)
  OPENROUTER_API_KEY=  (required: insights, day-insight, product lookup, PDF parsing)
  ANTHROPIC_API_KEY=   (AI chat + fallback for scanned/image PDFs)
  RESEND_API_KEY=      (email verification)
  FROM_EMAIL=          (e.g. "tracey <noreply@yourdomain.com>")
  RATE_LIMIT_PER_MINUTE= (default 200)

frontend/.env.local:
  NEXT_PUBLIC_API_URL=http://localhost:8000  (production: https://api.amiribrahim3000.com)

## Deployment — LIVE
Frontend → Vercel → https://tracey.amiribrahim3000.com
  - Auto-deploys on git push to main
  - DO NOT run `vercel --prod` manually — it queues conflicting builds
  - Vercel project root dir is `frontend/`, so push from repo root triggers correct build
Backend  → Hetzner VPS (5.161.70.14), user: amir, PM2 process: tracey-api
           SSH: ssh -i ~/.ssh/id_ed25519 amir@5.161.70.14
           Code: /home/amir/backend
           Nginx proxy: api.amiribrahim3000.com → 127.0.0.1:8000 (HTTPS via Certbot)
           PM2 startup: configured for amir user (survives reboots)

## Phase status
- Phase 1 ✅ Backend: auth, accounts, expenses, income
- Phase 2 ✅ Backend: recurring, rewards, AI, net worth history, CSV/PDF import
- Phase 3 ✅ Frontend: all pages, PWA, dashboard, log, calendar, FAB, onboarding
- Phase 4 ✅ Deployment: Vercel (frontend) + Hetzner (backend), custom domain, HTTPS
- Phase 4b ✅ Polish: show/hide password, PIN setup after register, settings (change email/username), account delete, import fixes, mobile layout, safe area, PWA icons
- Phase 5 ✅ Smart safe-to-spend + goals system:
  - Layer 1: deduct upcoming recurring bills this cycle from safe-to-spend
  - Layer 2: savings target per cycle in Settings, deducted from safe-to-spend
  - Layer 3: full goals system (/goals page, CRUD, progress bars, add-funds, ETA)
  - Streak fix: use DATE(created_at) not expense date (CSV imports no longer inflate streak)
  - Rewards lookup fix: was using nonexistent DeepSeek model, now uses Gemini 2.5 Flash
  - AI JSON fix: robust regex extraction handles thinking-model preamble in all AI routes
  - DateButton component: replaces all raw type="date" inputs app-wide
  - Spending page: cycle navigation arrows replace OS date inputs
  - Landing footer: expanded 4-column layout
  - Version bumped to v2.0

## Known gaps / next ideas
- `/loans` page is hidden (no nav link) — could surface from Accounts page
- `/ai` chat page is hidden — could link from dashboard "tracey thinks" section
- Safe-to-spend `isOverBudget` only checks spent > income, doesn't account for bills/savings reservations tipping safePerDay to 0
- Onboarding can't be re-triggered from settings
