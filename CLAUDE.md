# Tracey — personal finance PWA

## What this is
Full personal finance platform. Expense tracking, multi-bank account management,
loan tracking (including OSAP), reward points/cashback optimization, AI-powered
insights, net worth dashboard, calendar history. Serious daily-use tool, not a demo.

## Core philosophy
- User controls privacy — share as much or little as they want
- App never connects to banks directly — CSV/PDF import only
- All estimates clearly labeled, user can override anything
- AI gives advice based on real personal numbers, not generic tips
- No social features, no budget envelopes, no investing — stay focused

## Brand
Name: "tracey" (always lowercase)
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
Sidebar (desktop): Home, Accounts, Spending, Bills, Rewards, Calendar + Settings at bottom
Bottom nav (mobile): Home, Accounts, Spending, Bills, Rewards (5 items — no Settings, no Calendar)
Settings on mobile: gear icon in dashboard header (top right, mobile only)

| Label     | Route        | File                        |
|-----------|--------------|------------------------------|
| Home      | /dashboard   | (app)/dashboard/page.tsx     |
| Accounts  | /accounts    | (app)/accounts/page.tsx      |
| Spending  | /overview    | (app)/overview/page.tsx      |
| Bills     | /recurring   | (app)/recurring/page.tsx     |
| Rewards   | /rewards     | (app)/rewards/page.tsx       |
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
- CSV/PDF import: PDF text extracted locally with pdfplumber (free), sent as text to Gemini 2.5 Flash via OpenRouter (max_tokens=8192); scanned/image PDFs fall back to Claude native PDF. JSON extracted from anywhere in model response (not just start of string).
- AI model routing: insights + product lookup → OpenRouter (Gemini 2.5 Flash / DeepSeek free); day-insight → OpenRouter; chat → Claude Sonnet 4.6 direct; PDF → pdfplumber + OpenRouter (Claude fallback)
- Safe-to-spend: shown when income > 0 for current cycle; hasCycle-but-no-income shows "Log your paycheck" link; no cycle shows "Set up pay cycle" link. Currently = (income − spent) ÷ days remaining. Next: deduct upcoming recurring bills + savings target.
- Reward tracking estimated from spend + known rates
- Streak tracking: GET /expenses/streak counts consecutive days with expense OR daily check-in; POST /expenses/check-in creates a daily_checkins row to keep streak alive on zero-expense days
- CORS: `ALLOWED_ORIGINS` env var + `allow_origin_regex` for all `*.vercel.app`

## Key decisions — Frontend
- Log page: mobile scrolls naturally (no fixed height), desktop two-column fixed height. Date navigation (← day →), tap date label to open native date picker (showPicker()), category grid (4-col emoji grid), two-column desktop layout.
- Amount input: monospace, inputMode="none" on mobile (prevents device keyboard), inputMode="decimal" on desktop; numpad handles mobile, keyboard handles desktop
- Dashboard: two-column desktop layout (left: safe-to-spend + this cycle + recent; right: net worth + tracey thinks + check-in); streak counter in header (🔥 = logged today, 💤 = at risk); gear icon for Settings (mobile only)
- Import: CSV file stored in state (not ref) to survive re-renders. Dates normalized from MM/DD/YYYY → YYYY-MM-DD. Inline error messages (no alerts). Account not created if PDF has 0 transactions.
- Page first-time tips: useTip() hook (lib/tips.ts), localStorage key per page, dismissible × banner on Accounts, Spending, Bills, Rewards
- PIN login: tab switcher on login page; defaults to PIN tab if localStorage.tracey_has_pin is set
- Email banner: dismissible × (localStorage key tracey_email_dismissed)
- Modals: `.modal-overlay` + `.modal-sheet` CSS classes — mobile: slide-up sheet from bottom; desktop: centered dialog with fadeScaleIn, accounts for sidebar via `padding-left: var(--sidebar-width)` on overlay.
- Safe area: `--bottom-nav-height: calc(64px + env(safe-area-inset-bottom))` — accounts for iPhone home bar
- Auth context: exposes `refreshUser()` to re-fetch /auth/me after profile changes

## Current backend routes
auth_routes: register, login, pin-login, refresh, logout, change-password, change-pin, change-email, change-username, resend-verification, verify-email, me, data (DELETE all)
accounts: CRUD (including DELETE /{id}), balance update, balance history, net-worth, net-worth/history
expenses: list, summary, create, batch, parse-pdf (PDF import), streak, check-in, /{id} CRUD
income: list, summary, create, sources, settings (pay_cycle/cycle_start_date), /{id} CRUD
recurring: CRUD, upcoming, summary, mark-paid
rewards: CRUD, estimate, summary
ai: insights (dashboard), day-insight (calendar), lookup (product), chat

## Commands
Backend:  cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
Frontend: cd frontend && npm run dev
Deploy:   ./deploy.sh  (syncs code + missing env keys, installs deps, restarts PM2)

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
- Phase 5 🔜 Smart safe-to-spend (deduct recurring bills + savings target), goals system

## Next up — Phase 5 (safe-to-spend improvement)
Safe-to-spend currently = (income − spent) ÷ days left.
Planned improvements (agreed with user):
- Layer 1: deduct upcoming recurring bills this cycle (no new UI needed)
- Layer 2: add "savings target per cycle" field in Settings
- Layer 3: goals system (short/long-term goals with required monthly contribution)
Start with Layer 1 + 2.
