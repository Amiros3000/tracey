/**
 * Overview — spending charts and category breakdown.
 *
 * Sections:
 *   - Cycle selector (previous / current cycle)
 *   - Bar chart of daily spending (Recharts)
 *   - Category breakdown with progress bars
 *   - Income summary for the period
 */

'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '@/lib/api'
import { formatCAD, getCycleEndDate, today } from '@/lib/utils'
import { useTip } from '@/lib/tips'

interface Summary {
  total: number
  by_category: Record<string, number>
  transaction_count: number
}

interface IncomeSummary {
  total: number
  employment: number
  government: number
}

interface Settings {
  pay_cycle: string
  cycle_start_date: string
}

type PayCycle = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

function cycleLengthDays(cycle: PayCycle): number {
  return cycle === 'weekly' ? 7 : cycle === 'biweekly' ? 14 : cycle === 'semimonthly' ? 15 : 30
}

function shiftCycle(start: string, cycle: PayCycle, direction: -1 | 1): string {
  const d = new Date(start + 'T00:00:00')
  if (cycle === 'semimonthly') {
    if (direction === -1) {
      if (d.getDate() > 15) { d.setDate(1) }
      else { d.setMonth(d.getMonth() - 1); d.setDate(16) }
    } else {
      if (d.getDate() <= 15) { d.setDate(16) }
      else { d.setMonth(d.getMonth() + 1); d.setDate(1) }
    }
  } else {
    const days = cycleLengthDays(cycle)
    d.setDate(d.getDate() + direction * days)
  }
  return d.toISOString().split('T')[0]
}

function fmt(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

export default function OverviewPage() {
  const { visible: tipVisible, dismiss: dismissTip } = useTip('spending')
  const [settings, setSettings]   = useState<Settings | null>(null)
  const [expenses, setExpenses]   = useState<Summary | null>(null)
  const [income, setIncome]       = useState<IncomeSummary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [cycleOffset, setCycleOffset] = useState(0) // 0 = current, -1 = prev, etc.
  const [customRange, setCustomRange] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [baseStart, setBaseStart] = useState('') // current cycle start

  useEffect(() => {
    api.get<Settings>('/income/settings').then(s => {
      setSettings(s)
      const start = s.cycle_start_date || today()
      setBaseStart(start)
      const end = getCycleEndDate(start, s.pay_cycle as PayCycle)
      setStartDate(start)
      setEndDate(end)
    })
  }, [])

  // Recompute dates when cycle offset changes
  useEffect(() => {
    if (!settings || !baseStart || customRange) return
    const cycle = settings.pay_cycle as PayCycle
    let start = baseStart
    for (let i = 0; i < Math.abs(cycleOffset); i++) {
      start = shiftCycle(start, cycle, cycleOffset < 0 ? -1 : 1)
    }
    setStartDate(start)
    setEndDate(getCycleEndDate(start, cycle))
  }, [cycleOffset, baseStart, settings, customRange])

  useEffect(() => {
    if (!startDate || !endDate) return
    setLoading(true)
    Promise.all([
      api.get<Summary>(`/expenses/summary?start_date=${startDate}&end_date=${endDate}`),
      api.get<IncomeSummary>(`/income/summary?start_date=${startDate}&end_date=${endDate}`),
    ]).then(([exp, inc]) => {
      setExpenses(exp)
      setIncome(inc)
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [startDate, endDate])

  // Build chart data from by_category
  const chartData = expenses
    ? Object.entries(expenses.by_category)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amount]) => ({
          name: cat.split(' ')[0],   // just the emoji
          fullName: cat,
          amount,
        }))
    : []

  const totalExpenses = expenses?.total || 0
  const totalIncome   = income?.total || 0
  const savings       = totalIncome - totalExpenses

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Spending</h1>

      </div>

      {tipVisible && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12, borderLeft: '3px solid var(--primary)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Your spending breakdown</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              See where your money goes each pay cycle. Import a bank statement from the Accounts page to populate this automatically.
            </p>
          </div>
          <button onClick={dismissTip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Date range selector */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 14px' }}>
        {!customRange ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button
              onClick={() => setCycleOffset(o => o - 1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, fontFamily: 'Nunito, sans-serif' }}
            >‹</button>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {startDate && endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : '—'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {cycleOffset === 0 ? 'Current cycle' : cycleOffset === -1 ? 'Previous cycle' : `${Math.abs(cycleOffset)} cycles ago`}
                {' · '}
                <button
                  onClick={() => { setCustomRange(true) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--primary)', fontWeight: 700, padding: 0, fontFamily: 'Nunito, sans-serif' }}
                >
                  Custom
                </button>
              </p>
            </div>
            <button
              onClick={() => setCycleOffset(o => Math.min(o + 1, 0))}
              disabled={cycleOffset >= 0}
              style={{ background: 'none', border: 'none', cursor: cycleOffset >= 0 ? 'default' : 'pointer', padding: '6px 10px', borderRadius: 8, color: cycleOffset >= 0 ? 'var(--border)' : 'var(--text-secondary)', fontSize: 18, lineHeight: 1, fontFamily: 'Nunito, sans-serif' }}
            >›</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>From</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}
                  onClick={() => {
                    const d = document.getElementById('ov-start') as HTMLInputElement
                    d?.showPicker?.()
                  }}
                >
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {startDate ? fmt(startDate) : 'Pick date'}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2.5" stroke="var(--text-secondary)" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round"/></svg>
                  <input id="ov-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>To</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}
                  onClick={() => {
                    const d = document.getElementById('ov-end') as HTMLInputElement
                    d?.showPicker?.()
                  }}
                >
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {endDate ? fmt(endDate) : 'Pick date'}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2.5" stroke="var(--text-secondary)" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round"/></svg>
                  <input id="ov-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
            <button
              onClick={() => { setCustomRange(false); setCycleOffset(0) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, padding: 0, fontFamily: 'Nunito, sans-serif' }}
            >
              ← Back to cycle view
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid var(--primary-light-bg)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Income', value: totalIncome, color: 'var(--success)' },
              { label: 'Spent', value: totalExpenses, color: 'var(--text-primary)' },
              { label: savings >= 0 ? 'Saved' : 'Over', value: Math.abs(savings), color: savings >= 0 ? 'var(--success)' : 'var(--danger)' },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 4 }}>{item.label}</p>
                <p className="mono" style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{formatCAD(item.value)}</p>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {chartData.length === 0 && (
            <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: '36px 24px' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No spending data</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Log your first expense or import a bank statement to see your breakdown here.
              </p>
            </div>
          )}

          {/* Spending by category bar chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Spending by category
              </p>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 16 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value: number, _: string, props: { payload?: { fullName?: string } }) => [
                        formatCAD(value),
                        props.payload?.fullName || '',
                      ]}
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        fontFamily: 'Nunito, sans-serif',
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={index} fill={index === 0 ? 'var(--primary)' : 'var(--surface)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Category list breakdown */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Breakdown
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {chartData.map(item => (
                  <div key={item.fullName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.fullName}</span>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCAD(item.amount)}
                      </span>
                    </div>
                    <div style={{ height: 4, backgroundColor: 'var(--surface)', borderRadius: 2 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(item.amount / totalExpenses) * 100}%`,
                          backgroundColor: 'var(--primary)',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {Math.round((item.amount / totalExpenses) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Income breakdown */}
          {income && income.total > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Income
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: '💼 Employment', value: income.employment },
                  { label: '🏛️ Government', value: income.government },
                ].filter(i => i.value > 0).map(i => (
                  <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{i.label}</span>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{formatCAD(i.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expenses?.transaction_count === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              No transactions in this period.
            </div>
          )}
        </>
      )}
    </div>
  )
}
