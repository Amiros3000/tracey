# Tracey — personal finance PWA

## What this is
Full personal finance platform. Expense tracking, multi-bank 
account management, loan tracking (including OSAP), reward 
points/cashback optimization, AI money guide, net worth dashboard.

## Core philosophy
- User controls privacy — share as much or little as they want
- App never connects to banks directly — CSV import only
- All estimates clearly labeled, user can override anything
- AI gives advice based on real personal numbers, not generic tips

## Brand
Name: "tracey" (always lowercase)
Primary: #c94a4a (soft red)
Font: Nunito (friendly, rounded)
Logo: red rounded square icon + "trace" dark + "y" red (#c94a4a)
Mode: system default (light/dark follows phone)

## Structure
tracey/
├── backend/   FastAPI, SQLite+SQLCipher, JWT auth — port 8000
└── frontend/  Next.js 14, Tailwind, Nunito, PWA — port 3000

## Key decisions already made
- SQLite with SQLCipher (encrypted at rest)
- JWT tokens for auth, bcrypt for passwords
- CSV import for bank statements (no direct bank connection)
- AI product lookup via Claude (any bank, any country)
- Reward tracking estimated from spend + known rates

## Commands
Backend: cd backend && uvicorn main:app --reload --port 8000
Frontend: cd frontend && npm run dev

## Env vars
backend/.env:
  ANTHROPIC_API_KEY=
  SECRET_KEY=        (JWT signing key — generate with openssl rand -hex 32)
  DATABASE_KEY=      (SQLCipher encryption key)

frontend/.env.local:
  NEXT_PUBLIC_API_URL=http://localhost:8000

## Deployment
Frontend → Vercel
Backend → Ubuntu VPS, PM2 + Nginx + UFW + Fail2ban + HTTPS
