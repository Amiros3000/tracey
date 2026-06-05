'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import TraceyLogo from '@/components/TraceyLogo'
import {
  formatCAD, formatDate, getCycleEndDate, daysRemainingInCycle,
  totalDaysInCycle, calcSafeToSpend, today,
} from '@/lib/utils'

interface Expense      { id: number; amount: number; category: string; note: string | null; date: string }
interface NetWorth     { total_assets: number; total_liabilities: number; net_worth: number }
interface IncomeSettings { pay_cycle: string; cycle_start_date: string }
interface Summary      { total: number; by_category: Record<string, number> }
interface Insight      { text: string; type: 'positive' | 'warning' | 'info' }

const INSIGHT_CACHE_KEY = 'tracey_insights_cache'
const INSIGHT_CACHE_TTL = 60 * 60 * 1000

function getCachedInsights(): Insight[] | null {
  try {
    const raw = sessionStorage.getItem(INSIGHT_CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > INSIGHT_CACHE_TTL) return null
    return data
  } catch { return null }
}
function cacheInsights(i: Insight[]) {
  try { sessionStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: i })) } catch {}
}

export default function DashboardPage() {
  const { user } = useAuth()

  const [isDesktop, setIsDesktop]           = useState(false)
  const [loading, setLoading]               = useState(true)
  const [cycleSettings, setCycleSettings]   = useState<IncomeSettings | null>(null)
  const [incomeTotal, setIncomeTotal]       = useState(0)
  const [expenseTotal, setExpenseTotal]     = useState(0)
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [netWorth, setNetWorth]             = useState<NetWorth | null>(null)
  const [nwHistory, setNwHistory]           = useState<{ date: string; net_worth: number }[]>([])
  const [insights, setInsights]             = useState<Insight[] | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [hasAccounts, setHasAccounts]       = useState(false)
  const [streak, setStreak]                 = useState<{ streak: number; today_logged: boolean } | null>(null)
  const [checkedIn, setCheckedIn]           = useState(false)
  const [emailDismissed, setEmailDismissed] = useState(false)
  const [resendSent, setResendSent]         = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setEmailDismissed(!!localStorage.getItem('tracey_email_dismissed'))
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const settings = await api.get<IncomeSettings>('/income/settings')
        setCycleSettings(settings)
        const startDate = settings.cycle_start_date || today()
        const endDate   = getCycleEndDate(startDate, settings.pay_cycle as any)

        const [incomeRes, expenseRes, expensesRes, nwRes, streakRes] = await Promise.allSettled([
          api.get<Summary>(`/income/summary?start_date=${startDate}&end_date=${endDate}`),
          api.get<Summary>(`/expenses/summary?start_date=${startDate}&end_date=${endDate}`),
          api.get<Expense[]>('/expenses?limit=8'),
          api.get<NetWorth>('/accounts/net-worth'),
          api.get<{ streak: number; today_logged: boolean }>('/expenses/streak'),
        ])

        if (incomeRes.status  === 'fulfilled') setIncomeTotal(incomeRes.value.total)
        if (expenseRes.status === 'fulfilled') setExpenseTotal(expenseRes.value.total)
        if (expensesRes.status === 'fulfilled') setRecentExpenses(expensesRes.value)
        if (nwRes.status === 'fulfilled') {
          setNetWorth(nwRes.value)
          setHasAccounts(nwRes.value.total_assets > 0 || nwRes.value.total_liabilities > 0)
        }
        if (streakRes.status === 'fulfilled') setStreak(streakRes.value)

        api.get<{ date: string; net_worth: number }[]>('/accounts/net-worth/history?days=90')
          .then(setNwHistory).catch(() => {})
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (loading) return
    const cached = getCachedInsights()
    if (cached) { setInsights(cached); return }
    setInsightsLoading(true)
    api.get<Insight[]>('/ai/insights')
      .then(data => { setInsights(data); cacheInsights(data) })
      .catch(() => setInsights([]))
      .finally(() => setInsightsLoading(false))
  }, [loading])

  const hasCycle        = !!(cycleSettings?.cycle_start_date)
  const hasTransactions = recentExpenses.length > 0 || incomeTotal > 0
  const checklistDone   = hasCycle && hasAccounts && hasTransactions
  const cycleStart      = cycleSettings?.cycle_start_date || today()
  const cycleEnd        = getCycleEndDate(cycleStart, (cycleSettings?.pay_cycle || 'biweekly') as any)
  const daysLeft        = daysRemainingInCycle(cycleEnd)
  const totalDays       = totalDaysInCycle(cycleStart, cycleEnd)
  const daysElapsed     = totalDays - daysLeft
  const hasIncome       = incomeTotal > 0
  const isOverBudget    = hasIncome && expenseTotal > incomeTotal
  const safePerDay      = hasIncome ? calcSafeToSpend(incomeTotal, expenseTotal, daysLeft) : null
  const remaining       = Math.max(incomeTotal - expenseTotal, 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="spinner" />
      </div>
    )
  }

  /* ── Reusable card sections ── */

  const SafeToSpend = (
    <div className="card" style={{
      padding: '22px 22px',
      background: isOverBudget ? 'var(--danger)' : hasIncome ? 'var(--primary)' : 'var(--card)',
      borderColor: hasIncome ? 'transparent' : undefined,
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
        color: hasIncome ? 'rgba(255,255,255,0.65)' : 'var(--text-secondary)',
      }}>
        Safe to spend today
      </p>

      {hasIncome ? (
        <>
          <p className="mono" style={{ color: 'white', fontSize: 46, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 6 }}>
            {formatCAD(safePerDay!)}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {isOverBudget
              ? `${formatCAD(expenseTotal - incomeTotal)} over budget`
              : `${formatCAD(remaining)} left · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} to go`}
          </p>
        </>
      ) : hasCycle ? (
        /* Cycle set but no income logged yet */
        <div>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.2 }}>
            Log your paycheck
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Your pay cycle is set. Log your paycheck for this cycle to calculate your safe-to-spend.
          </p>
          <Link href="/log?type=income" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none',
            backgroundColor: 'var(--primary-light-bg)', padding: '8px 14px', borderRadius: 8,
          }}>
            + Log paycheck
          </Link>
        </div>
      ) : (
        /* No cycle set at all */
        <div>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.2 }}>
            Set up your pay cycle
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Tell tracey when you get paid and it will calculate your safe daily spending.
          </p>
          <Link href="/settings" style={{
            fontSize: 13, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none',
            backgroundColor: 'var(--primary-light-bg)', padding: '8px 14px', borderRadius: 8,
          }}>
            Go to settings →
          </Link>
        </div>
      )}
    </div>
  )

  const ThisCycle = (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          This cycle
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>
          {formatDate(cycleStart)} – {formatDate(cycleEnd)}
        </p>
      </div>

      {/* Spend bar */}
      <div style={{ height: 6, backgroundColor: 'var(--surface)', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${hasIncome ? Math.min((expenseTotal / Math.max(incomeTotal, 1)) * 100, 100) : 0}%`,
          backgroundColor: isOverBudget ? 'var(--danger)' : hasIncome && expenseTotal / incomeTotal > 0.8 ? 'var(--warning)' : 'var(--primary)',
          borderRadius: 3, transition: 'width 0.6s ease',
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Income', value: incomeTotal, color: 'var(--success)' },
          { label: 'Spent',  value: expenseTotal, color: expenseTotal > 0 ? 'var(--danger)' : 'var(--text-primary)' },
          { label: 'Left',   value: remaining, color: isOverBudget ? 'var(--danger)' : 'var(--primary)' },
        ].map(item => (
          <div key={item.label}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 3 }}>{item.label}</p>
            <p className="mono" style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{formatCAD(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const Recent = (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent transactions</p>
        <Link href="/overview" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>See all →</Link>
      </div>
      {recentExpenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 10 }}>No transactions yet</p>
          <Link href="/log" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13, textDecoration: 'none',
            backgroundColor: 'var(--primary-light-bg)', padding: '8px 14px', borderRadius: 8 }}>
            Log your first →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recentExpenses.map((e, i) => (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < recentExpenses.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, backgroundColor: 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  {e.category.split(' ')[0]}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.note || e.category.replace(/^\S+\s/, '')}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{formatDate(e.date)}</p>
                </div>
              </div>
              <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', flexShrink: 0, marginLeft: 12 }}>
                −{formatCAD(e.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const NetWorthCard = netWorth && (netWorth.total_assets > 0 || netWorth.total_liabilities > 0) ? (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Net Worth</p>
        <Link href="/accounts" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Accounts →</Link>
      </div>
      <p className="mono" style={{ fontSize: 32, fontWeight: 800, color: netWorth.net_worth >= 0 ? 'var(--text-primary)' : 'var(--danger)', letterSpacing: '-0.02em', marginBottom: 8 }}>
        {formatCAD(netWorth.net_worth)}
      </p>
      <div style={{ display: 'flex', gap: 20, marginBottom: nwHistory.length > 1 ? 12 : 0 }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 1 }}>Assets</p>
          <p className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{formatCAD(netWorth.total_assets)}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 1 }}>Liabilities</p>
          <p className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{formatCAD(netWorth.total_liabilities)}</p>
        </div>
      </div>
      {nwHistory.length > 1 && (
        <div style={{ height: 52, marginTop: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={nwHistory} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: number) => [formatCAD(v), 'Net worth']}
                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="net_worth" stroke="var(--primary)" strokeWidth={2} fill="url(#nwGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  ) : null

  const TraceyThinks = (insightsLoading || (insights && insights.length > 0)) ? (
    <div className="card">
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        tracey thinks
      </p>
      {insightsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[82, 95, 68].map(w => <div key={w} className="shimmer" style={{ height: 13, width: `${w}%` }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights!.map((ins, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                backgroundColor: ins.type === 'positive' ? 'var(--success)' : ins.type === 'warning' ? 'var(--warning)' : 'var(--border)',
              }} />
              <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {ins.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null

  const CheckInCard = streak && streak.streak > 0 && !streak.today_logged && !checkedIn ? (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Nothing to log today?</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {streak.streak > 0 ? `Keep your ${streak.streak}-day streak alive.` : 'Check in to start a streak.'}
        </p>
      </div>
      <button
        onClick={async () => {
          try {
            await api.post('/expenses/check-in', {})
            setCheckedIn(true)
            setStreak(s => s ? { ...s, today_logged: true } : s)
          } catch {}
        }}
        style={{
          padding: '8px 14px', borderRadius: 10, border: 'none',
          backgroundColor: 'var(--primary)', color: 'white',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Nunito, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        ✓ Check in
      </button>
    </div>
  ) : null

  return (
    <div className="page-content">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TraceyLogo size="sm" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {streak && streak.streak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              backgroundColor: streak.today_logged ? 'var(--primary-light-bg)' : 'var(--surface)',
              borderRadius: 20, padding: '5px 11px',
            }}>
              <span style={{ fontSize: 13 }}>{streak.today_logged ? '🔥' : '💤'}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: streak.today_logged ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {streak.streak}d streak
              </span>
            </div>
          )}
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Hey, {user?.username}
          </span>
        </div>
      </div>

      {/* Email banner — dismissible */}
      {user && user.email && !user.email_verified && !emailDismissed && (
        <div style={{
          backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              Verify your email
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {resendSent
                ? 'Sent! Check your inbox and spam folder.'
                : `A verification link was sent to ${user.email}. Check your inbox or spam folder.`}
            </p>
          </div>
          {!resendSent && (
            <button
              onClick={async () => {
                try { await api.post('/auth/resend-verification', {}); setResendSent(true) } catch {}
              }}
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, textDecoration: 'underline' }}
            >
              Resend
            </button>
          )}
          <button
            onClick={() => { localStorage.setItem('tracey_email_dismissed', '1'); setEmailDismissed(true) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Getting started checklist */}
      {!checklistDone && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--primary)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Getting started
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { done: hasCycle,        label: 'Set your pay cycle',            sub: 'Powers safe-to-spend',        href: '/settings' },
              { done: hasAccounts,     label: 'Add an account',                sub: 'Track balances & net worth',  href: '/accounts' },
              { done: hasTransactions, label: 'Log or import a transaction',   sub: 'Start tracking spending',     href: '/log' },
            ].map(item => (
              <Link key={item.label} href={item.done ? '#' : item.href}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', opacity: item.done ? 0.45 : 1 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: item.done ? 'var(--primary)' : 'transparent',
                  border: `2px solid ${item.done ? 'var(--primary)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.done && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{item.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.sub}</p>
                </div>
                {!item.done && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Two-column on desktop, single column on mobile */}
      {isDesktop ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
          {/* Left: main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SafeToSpend}
            {ThisCycle}
            {Recent}
          </div>
          {/* Right: supporting content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {NetWorthCard}
            {TraceyThinks}
            {CheckInCard}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SafeToSpend}
          {NetWorthCard}
          {ThisCycle}
          {TraceyThinks}
          {Recent}
          {CheckInCard}
        </div>
      )}
    </div>
  )
}
