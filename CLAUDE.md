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
Mode: system default (light/dark follows OS)
Aesthetic: professional fintech — clean whites/near-blacks, no emojis in navigation

## Structure
tracey/
├── backend/   FastAPI, SQLite+SQLCipher, JWT auth — port 8000
└── frontend/  Next.js 14, Tailwind, Nunito, PWA — port 3000

## Pages & Navigation

### Main navigation
Sidebar (desktop): Home, Accounts, Spending, Bills, Rewards, Calendar + Settings at bottom
Bottom nav (mobile): Home, Accounts, Spending, Bills, Rewards (5 items — no Settings, no Calendar)

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
- `/login` — Login (password tab + PIN tab; defaults to PIN if tracey_has_pin is set)
- `/register` — Registration
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
- CSV/PDF import: PDF text extracted locally with pdfplumber (free), sent as text to Gemini 2.5 Flash via OpenRouter; scanned/image PDFs fall back to Claude native PDF
- AI model routing: insights + product lookup → OpenRouter (Gemini 2.5 Flash / DeepSeek free); day-insight → OpenRouter; chat → Claude Sonnet 4.6 direct; PDF → pdfplumber + OpenRouter (Claude fallback)
- Safe-to-spend: shown when income > 0 for current cycle; hasCycle-but-no-income shows "Log your paycheck" link; no cycle shows "Set up pay cycle" link
- Reward tracking estimated from spend + known rates
- Streak tracking: GET /expenses/streak counts consecutive days with expense OR daily check-in; POST /expenses/check-in creates a daily_checkins row to keep streak alive on zero-expense days
- CORS: `ALLOWED_ORIGINS` env var (comma-separated), defaults to `http://localhost:3000`

## Key decisions — Frontend
- Log page: date navigation (← day →), tap date label to open native date picker (showPicker()), category grid (4-col emoji grid, not horizontal scroll), two-column desktop layout (left: amount/context, right: categories/numpad/submit)
- Amount input: monospace, inputMode="none" on mobile (prevents device keyboard), inputMode="decimal" on desktop; numpad handles mobile, keyboard handles desktop
- Dashboard: two-column desktop layout (left: safe-to-spend + this cycle + recent; right: net worth + tracey thinks + check-in); streak counter in header (🔥 = logged today, 💤 = at risk)
- Import: on Accounts page; accessible via FAB "Import statement" or Import button in header; auto-opens via ?import=1 query param
- Page first-time tips: useTip() hook (lib/tips.ts), localStorage key per page, dismissible × banner on Accounts, Spending, Bills, Rewards
- PIN login: tab switcher on login page; defaults to PIN tab if localStorage.tracey_has_pin is set; Settings PIN section to configure
- Email banner: dismissible × (localStorage key tracey_email_dismissed)
- Modals: `.modal-overlay` + `.modal-sheet` CSS classes — mobile: slide-up sheet from bottom; desktop: centered dialog with fadeScaleIn, accounts for sidebar via `padding-left: var(--sidebar-width)` on overlay. All modals must use these classes (not inline styles) so desktop centering is automatic.
- Onboarding: desktop gets centered card layout (ob-outer / ob-card CSS classes with media query), mobile stays full-screen

## Current backend routes
auth_routes: register, login, pin-login, refresh, logout, change-password, change-pin, resend-verification, verify-email, me, data (DELETE all)
accounts: CRUD, balance update, balance history, net-worth, net-worth/history
expenses: list, summary, create, batch, parse-pdf (PDF import), streak, check-in, /{id} CRUD
income: list, summary, create, settings (pay_cycle/cycle_start_date), /{id} CRUD
recurring: CRUD, upcoming, summary, mark-paid
rewards: CRUD, estimate, summary
ai: insights (dashboard), day-insight (calendar), lookup (product), chat

## Commands
Backend:  cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
Frontend: cd frontend && npm run dev

## Env vars
backend/.env:
  SECRET_KEY=          (JWT signing key — generate with openssl rand -hex 32)
  DATABASE_KEY=        (SQLCipher encryption key)
  ALLOWED_ORIGINS=     (optional; defaults to http://localhost:3000)
  OPENROUTER_API_KEY=  (required: insights, day-insight, product lookup, PDF parsing)
  ANTHROPIC_API_KEY=   (optional: AI chat endpoint + fallback for scanned/image PDFs)
  RESEND_API_KEY=      (optional: email verification emails)
  FROM_EMAIL=          (optional: defaults to "tracey <onboarding@resend.dev>")

frontend/.env.local:
  NEXT_PUBLIC_API_URL=http://localhost:8000

## Phase status
- Phase 1 ✅ Auth, accounts, expenses, income (backend foundation)
- Phase 2 ✅ Recurring, rewards, AI chat/lookup/insights, net worth history, CSV/PDF import
- Phase 3 ✅ Full frontend — onboarding, all pages, PWA shell
  - ✅ Landing page with features + marketing copy
  - ✅ Dashboard: two-column desktop, streak, safe-to-spend states, check-in
  - ✅ Log page: date nav, tap-to-pick-date, category grid, mobile numpad vs desktop keyboard
  - ✅ Accounts: import sheet accessible via FAB + ?import=1 param + Import button in header
  - ✅ Loans page: payoff calculator, OSAP notes, interest-free federal portion flag
  - ✅ AI chat page: full-screen Claude chat at /ai with conversation starters
  - ✅ Calendar: month grid, day drill-down, per-day AI insight on demand
  - ✅ FAB: 3 options with spring open/close animations
  - ✅ Streaks: consecutive logging days + daily check-in for zero-spend days
  - ✅ Page tips: first-visit banners on Accounts, Spending, Bills, Rewards
  - ✅ PIN: auto-selected on login if previously set
  - ✅ Favicon: SVG at /public/favicon.svg, green rounded square + white "t"
  - ✅ Modals: desktop centering fixed (.modal-overlay centers with sidebar offset on 768px+)
  - ✅ Theme color: corrected to #22c55e in manifest.json + layout.tsx viewport
- Phase 4 🔜 VPS deployment update (Hetzner), WebAuthn biometrics (requires HTTPS)

## Deployment
Frontend → Vercel
Backend → Ubuntu VPS (Hetzner), PM2 + Nginx + UFW + Fail2ban + HTTPS
Note: existing backend on Hetzner is Phase 1 — needs code update + pip install -r requirements.txt + PM2 restart
