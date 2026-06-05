'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatCAD } from '@/lib/utils'

interface TxExpense { id: number; amount: number; category: string; note: string | null; date: string }
interface TxIncome  { id: number; amount: number; source: string; note: string | null; date: string }
interface DaySummary { expenses: number; income: number; expCount: number; incCount: number }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendarPage() {
  const now = new Date()
  const [viewYear, setViewYear]     = useState(now.getFullYear())
  const [viewMonth, setViewMonth]   = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(isoDate(now.getFullYear(), now.getMonth(), now.getDate()))
  const [monthData, setMonthData]   = useState<Record<string, DaySummary>>({})
  const [dayExpenses, setDayExpenses] = useState<TxExpense[]>([])
  const [dayIncome, setDayIncome]   = useState<TxIncome[]>([])
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [loadingDay, setLoadingDay]   = useState(false)
  const [isDesktop, setIsDesktop]   = useState(false)
  const [insight, setInsight]       = useState<string | null>(null)
  const [loadingInsight, setLoadingInsight] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Load all transactions for the viewed month
  useEffect(() => {
    setLoadingMonth(true)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const start = isoDate(viewYear, viewMonth, 1)
    const end   = isoDate(viewYear, viewMonth, daysInMonth)

    Promise.allSettled([
      api.get<TxExpense[]>(`/expenses?start_date=${start}&end_date=${end}&limit=500`),
      api.get<TxIncome[]>(`/income?start_date=${start}&end_date=${end}&limit=500`),
    ]).then(([expRes, incRes]) => {
      const data: Record<string, DaySummary> = {}
      if (expRes.status === 'fulfilled') {
        expRes.value.forEach(e => {
          if (!data[e.date]) data[e.date] = { expenses: 0, income: 0, expCount: 0, incCount: 0 }
          data[e.date].expenses += e.amount
          data[e.date].expCount++
        })
      }
      if (incRes.status === 'fulfilled') {
        incRes.value.forEach(i => {
          if (!data[i.date]) data[i.date] = { expenses: 0, income: 0, expCount: 0, incCount: 0 }
          data[i.date].income += i.amount
          data[i.date].incCount++
        })
      }
      setMonthData(data)
    }).finally(() => setLoadingMonth(false))
  }, [viewYear, viewMonth])

  // Load day detail when selected day changes
  useEffect(() => {
    if (!selectedDay) return
    setLoadingDay(true)
    setInsight(null)
    Promise.allSettled([
      api.get<TxExpense[]>(`/expenses?start_date=${selectedDay}&end_date=${selectedDay}&limit=50`),
      api.get<TxIncome[]>(`/income?start_date=${selectedDay}&end_date=${selectedDay}&limit=50`),
    ]).then(([expRes, incRes]) => {
      setDayExpenses(expRes.status === 'fulfilled' ? expRes.value : [])
      setDayIncome(incRes.status  === 'fulfilled' ? incRes.value  : [])
    }).finally(() => setLoadingDay(false))
  }, [selectedDay])

  async function getInsight() {
    if (!selectedDay || loadingInsight) return
    setLoadingInsight(true)
    try {
      // Build a simple summary prompt and call the insights endpoint
      const res = await api.post<{ insight: string }>('/ai/day-insight', { date: selectedDay })
      setInsight(res.insight)
    } catch {
      setInsight('Unable to generate insight right now.')
    } finally {
      setLoadingInsight(false)
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    const now = new Date()
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const todayStr    = isoDate(now.getFullYear(), now.getMonth(), now.getDate())
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate()
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  // Calendar grid cells (blanks + days)
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
  const dayIncTotal = dayIncome.reduce((s, i) => s + i.amount, 0)
  const dayNet = dayIncTotal - dayTotal

  const selectedLabel = selectedDay
    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
    : null

  const DayDetail = selectedDay ? (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{selectedLabel}</p>
          {(dayExpenses.length > 0 || dayIncome.length > 0) && (
            <p style={{ fontSize: 12, color: dayNet >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginTop: 2 }}>
              {dayNet >= 0 ? '+' : ''}{formatCAD(dayNet)} net
            </p>
          )}
        </div>
        <Link href={`/log${selectedDay && selectedDay < isoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) ? `?date=${selectedDay}` : ''}`} style={{
          fontSize: 12, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none',
          backgroundColor: 'var(--primary-light-bg)', padding: '6px 12px', borderRadius: 8,
        }}>
          + Add
        </Link>
      </div>

      {loadingDay ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2].map(i => <div key={i} className="shimmer" style={{ height: 40, borderRadius: 8 }} />)}
        </div>
      ) : dayExpenses.length === 0 && dayIncome.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>Nothing logged</p>
          <Link href={`/log`} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
            Log something →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {dayIncome.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', backgroundColor: 'var(--surface)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>💰</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{i.source}</p>
                  {i.note && <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{i.note}</p>}
                </div>
              </div>
              <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>+{formatCAD(i.amount)}</p>
            </div>
          ))}
          {dayExpenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', backgroundColor: 'var(--surface)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{e.category.split(' ')[0]}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{e.note || e.category.replace(/^\S+\s/, '')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.category.replace(/^\S+\s/, '')}</p>
                </div>
              </div>
              <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>−{formatCAD(e.amount)}</p>
            </div>
          ))}

          {/* Summary row */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {dayIncTotal > 0 && (
              <div style={{ flex: 1, padding: '10px 14px', backgroundColor: 'var(--primary-light-bg)', borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, marginBottom: 2 }}>Income</p>
                <p className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)' }}>+{formatCAD(dayIncTotal)}</p>
              </div>
            )}
            {dayTotal > 0 && (
              <div style={{ flex: 1, padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 2 }}>Spent</p>
                <p className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--danger)' }}>−{formatCAD(dayTotal)}</p>
              </div>
            )}
          </div>

          {/* tracey insight for this day */}
          {!insight ? (
            <button
              onClick={getInsight}
              disabled={loadingInsight}
              style={{
                marginTop: 8, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                backgroundColor: 'var(--card)', cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {loadingInsight ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Getting insight…</>
              ) : (
                <><span>✦</span> Ask tracey about this day</>
              )}
            </button>
          ) : (
            <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10, backgroundColor: 'var(--primary-light-bg)', border: '1px solid var(--primary)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✦ tracey thinks</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{insight}</p>
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
      Select a day to see its transactions
    </div>
  )

  return (
    <div className="page-content">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Calendar</h1>

      <div style={{ display: isDesktop ? 'grid' : 'flex', gridTemplateColumns: isDesktop ? '1fr 320px' : undefined, flexDirection: isDesktop ? undefined : 'column', gap: isDesktop ? 24 : 16, alignItems: 'start' }}>

        {/* Calendar */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Month header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', backgroundColor: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="var(--text-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </p>
            <button onClick={nextMonth} disabled={isCurrentMonth} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', backgroundColor: isCurrentMonth ? 'transparent' : 'var(--surface)', cursor: isCurrentMonth ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={isCurrentMonth ? 'var(--border)' : 'var(--text-secondary)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '10px 12px 4px' }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: '4px 12px 16px' }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`blank-${idx}`} />
              const dateStr  = isoDate(viewYear, viewMonth, day)
              const summary  = monthData[dateStr]
              const isToday  = dateStr === todayStr
              const isFuture = dateStr > todayStr
              const isSelected = dateStr === selectedDay
              const hasAny   = summary && (summary.expCount > 0 || summary.incCount > 0)
              const hasInc   = summary && summary.incCount > 0
              const hasExp   = summary && summary.expCount > 0

              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && setSelectedDay(dateStr)}
                  disabled={isFuture}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '6px 2px', borderRadius: 10, border: 'none', cursor: isFuture ? 'default' : 'pointer',
                    backgroundColor: isSelected ? 'var(--primary)' : isToday ? 'var(--primary-light-bg)' : 'transparent',
                    minHeight: 48,
                    transition: 'background-color 0.12s',
                  }}
                >
                  <span style={{
                    fontSize: 14, fontWeight: isToday || isSelected ? 800 : 500,
                    color: isSelected ? 'white' : isToday ? 'var(--primary)' : isFuture ? 'var(--border)' : 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}>
                    {day}
                  </span>
                  {hasAny && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                      {hasInc && <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--success)' }} />}
                      {hasExp && <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--danger)' }} />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, padding: '10px 16px', borderTop: '1px solid var(--border)', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--success)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Income</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Expenses</span>
            </div>
          </div>
        </div>

        {/* Day detail */}
        <div className="card">
          {DayDetail}
        </div>
      </div>
    </div>
  )
}
