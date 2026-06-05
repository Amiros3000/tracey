'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { formatCAD, today } from '@/lib/utils'

const CATEGORIES = [
  { key: '🛒 Groceries',        emoji: '🛒', short: 'Groceries'  },
  { key: '🍔 Eating Out',       emoji: '🍔', short: 'Eating Out' },
  { key: '☕ Coffee',           emoji: '☕', short: 'Coffee'     },
  { key: '🚗 Transportation',   emoji: '🚗', short: 'Transport'  },
  { key: '🎮 Entertainment',    emoji: '🎮', short: 'Fun'        },
  { key: '🛍️ Shopping',         emoji: '🛍️', short: 'Shopping'   },
  { key: '💼 Business',         emoji: '💼', short: 'Business'   },
  { key: '🏦 Savings Transfer', emoji: '🏦', short: 'Savings'    },
  { key: '💳 Loan Payment',     emoji: '💳', short: 'Loan'       },
  { key: '📱 Subscriptions',    emoji: '📱', short: 'Subs'       },
  { key: '🏥 Health',           emoji: '🏥', short: 'Health'     },
  { key: '📦 Other',            emoji: '📦', short: 'Other'      },
]

const INCOME_TYPES = [
  { value: 'employment', label: 'Employment' },
  { value: 'government', label: 'Government' },
  { value: 'other',      label: 'Other'      },
]

interface Account      { id: number; name: string; type: string }
interface LogEntry     { id: number; amount: number; category: string; note: string | null }
interface IncomeSource { source: string; income_type: string; count: number }

function getDateLabel(dateStr: string): string {
  const t = today()
  const d = new Date(t + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  const yesterday = d.toISOString().slice(0, 10)
  if (dateStr === t)         return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function LogPageInner() {
  const searchParams = useSearchParams()
  const initialType  = searchParams.get('type') === 'income' ? 'income' : 'expense'
  const initialDate  = searchParams.get('date') || today()

  const [selectedDate, setSelectedDate] = useState(initialDate > today() ? today() : initialDate)
  const [logType, setLogType]           = useState<'expense' | 'income'>(initialType)
  const [amount, setAmount]             = useState('')
  const [category, setCategory]         = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('last_category') || CATEGORIES[0].key : CATEGORIES[0].key
  )
  const [note, setNote]                 = useState('')
  const [accountId, setAccountId]       = useState<number | null>(null)
  const [accounts, setAccounts]         = useState<Account[]>([])
  const [source, setSource]             = useState('')
  const [incomeType, setIncomeType]     = useState('employment')
  const [saving, setSaving]             = useState(false)
  const [success, setSuccess]           = useState(false)
  const [error, setError]               = useState('')
  const [dayEntries, setDayEntries]     = useState<LogEntry[]>([])
  const [isDesktop, setIsDesktop]       = useState(false)
  const [todayExpTotal, setTodayExpTotal] = useState(0)
  const [todayIncTotal, setTodayIncTotal] = useState(0)
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [showSources, setShowSources]   = useState(false)
  const [editEntry, setEditEntry]       = useState<LogEntry | null>(null)

  const amountInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts).catch(() => {})
    api.get<IncomeSource[]>('/income/sources').then(setIncomeSources).catch(() => {})
  }, [])

  // Refresh day entries + running totals after each save
  useEffect(() => {
    api.get<LogEntry[]>(`/expenses?start_date=${selectedDate}&end_date=${selectedDate}&limit=20`)
      .then(setDayEntries).catch(() => {})

    const t = today()
    Promise.allSettled([
      api.get<{ total: number }>(`/expenses/summary?start_date=${t}&end_date=${t}`),
      api.get<{ total: number }>(`/income/summary?start_date=${t}&end_date=${t}`),
    ]).then(([expR, incR]) => {
      if (expR.status === 'fulfilled') setTodayExpTotal(expR.value.total)
      if (incR.status === 'fulfilled') setTodayIncTotal(incR.value.total)
    })
  }, [selectedDate, success])

  function prevDay() { setSelectedDate(d => offsetDate(d, -1)) }
  function nextDay() {
    const next = offsetDate(selectedDate, 1)
    if (next <= today()) setSelectedDate(next)
  }

  function tapDigit(d: string) {
    setAmount(prev => {
      if (d === '.' && prev.includes('.')) return prev
      if (d === '.' && prev === '')        return '0.'
      const parts = (prev + d).split('.')
      if (parts[1] && parts[1].length > 2) return prev
      return prev + d
    })
  }

  function handleKeyboardAmount(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    if ((v.match(/\./g) || []).length > 1) return
    const parts = v.split('.')
    if (parts[1] && parts[1].length > 2) return
    setAmount(v)
  }

  async function handleSubmit() {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { setError('Enter an amount'); return }
    setSaving(true); setError('')
    try {
      if (logType === 'expense') {
        await api.post('/expenses', {
          amount: parsed, category,
          note: note.trim() || undefined,
          date: selectedDate,
          account_id: accountId || undefined,
        })
        localStorage.setItem('last_category', category)
      } else {
        await api.post('/income', {
          amount: parsed,
          source: source.trim() || 'Income',
          income_type: incomeType,
          note: note.trim() || undefined,
          date: selectedDate,
        })
        // Refresh sources list after new income logged
        api.get<IncomeSource[]>('/income/sources').then(setIncomeSources).catch(() => {})
      }
      setSuccess(true)
      setTimeout(() => { setAmount(''); setNote(''); setSource(''); setSuccess(false) }, 900)
    } catch {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this entry?')) return
    await api.delete(`/expenses/${id}`).catch(() => {})
    setDayEntries(prev => prev.filter(e => e.id !== id))
  }

  const isToday        = selectedDate === today()
  const accentColor    = logType === 'income' ? 'var(--success)' : 'var(--primary)'
  const amountColor    = amount
    ? (logType === 'income' ? 'var(--success)' : 'var(--text-primary)')
    : 'var(--border)'

  const NumPad = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {['7','8','9','4','5','6','1','2','3','.','0','⌫'].map((key, i) => (
        <button key={i}
          onClick={() => key === '⌫' ? setAmount(p => p.slice(0, -1)) : tapDigit(key)}
          style={{
            height: 56, borderRadius: 14, border: 'none', cursor: 'pointer',
            backgroundColor: key === '⌫' ? 'var(--surface)' : 'var(--card)',
            color: key === '⌫' ? 'var(--text-secondary)' : 'var(--text-primary)',
            fontSize: key === '⌫' ? 20 : 22, fontWeight: 700,
            fontFamily: 'Nunito, sans-serif',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'transform 0.08s',
          }}
          onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >{key}</button>
      ))}
    </div>
  )

  const CategoryGrid = (
    <div>
      {logType === 'expense' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {CATEGORIES.map(cat => {
            const active = category === cat.key
            return (
              <button key={cat.key} onClick={() => setCategory(cat.key)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '10px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                backgroundColor: active ? 'var(--primary-light-bg)' : 'var(--surface)',
                outline: active ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'all 0.15s', gap: 4,
              }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{cat.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'var(--primary)' : 'var(--text-secondary)', lineHeight: 1.2, textAlign: 'center', fontFamily: 'Nunito, sans-serif' }}>
                  {cat.short}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Source with autocomplete */}
          <div style={{ position: 'relative' }}>
            <input
              type="text" value={source}
              onChange={e => setSource(e.target.value)}
              onFocus={() => setShowSources(true)}
              onBlur={() => setTimeout(() => setShowSources(false), 180)}
              placeholder="Source (e.g. Employer, OSAP)"
              style={{ fontSize: 15 }}
            />
            {showSources && incomeSources.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, marginTop: 4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
              }}>
                {incomeSources
                  .filter(s => !source || s.source.toLowerCase().includes(source.toLowerCase()))
                  .slice(0, 6)
                  .map(s => (
                    <button key={s.source} onMouseDown={() => { setSource(s.source); setIncomeType(s.income_type); setShowSources(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '11px 14px', border: 'none', background: 'none',
                        cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.source}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', backgroundColor: 'var(--surface)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                        {s.income_type}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Income type chips (non-redundant when source selected) */}
          <div style={{ display: 'flex', backgroundColor: 'var(--surface)', borderRadius: 10, padding: 3 }}>
            {INCOME_TYPES.map(t => (
              <button key={t.value} onClick={() => setIncomeType(t.value)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
                backgroundColor: incomeType === t.value ? 'var(--card)' : 'transparent',
                color: incomeType === t.value ? 'var(--success)' : 'var(--text-secondary)',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .log-success { animation: popIn 0.2s ease; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: isDesktop ? 'calc(100dvh - 48px)' : 'auto' }}>

        {/* Date navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--card)', flexShrink: 0,
        }}>
          <button onClick={prevDay} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', backgroundColor: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="var(--text-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Tappable date — opens native calendar picker */}
          <div
            style={{ textAlign: 'center', cursor: 'pointer', position: 'relative' }}
            onClick={() => (dateInputRef.current as any)?.showPicker?.() ?? dateInputRef.current?.click()}
          >
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {getDateLabel(selectedDate)}
            </p>
            <p style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'ui-monospace, monospace', marginTop: 1, fontWeight: 600 }}>
              {selectedDate} ▾
            </p>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              max={today()}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: '50%' }}
            />
          </div>

          <button onClick={nextDay} disabled={isToday} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', backgroundColor: isToday ? 'transparent' : 'var(--surface)', cursor: isToday ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke={isToday ? 'var(--border)' : 'var(--text-secondary)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: isDesktop ? 'auto' : 'visible', display: isDesktop ? 'grid' : 'flex', gridTemplateColumns: isDesktop ? '1fr 1fr' : undefined, flexDirection: isDesktop ? undefined : 'column', gap: 0 }}>

          {/* LEFT / TOP: amount + context */}
          <div style={{ padding: isDesktop ? '28px 32px' : '20px 16px', borderRight: isDesktop ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column' }}>

            {/* Type toggle */}
            <div style={{ display: 'flex', backgroundColor: 'var(--surface)', borderRadius: 12, padding: 3, marginBottom: 20 }}>
              {(['expense', 'income'] as const).map(t => (
                <button key={t} onClick={() => { setLogType(t); setError('') }} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14,
                  backgroundColor: logType === t ? 'var(--card)' : 'transparent',
                  color: logType === t ? (t === 'income' ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  boxShadow: logType === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                  {t === 'expense' ? '− Expense' : '+ Income'}
                </button>
              ))}
            </div>

            {/* Amount display */}
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--surface)', borderRadius: 20, padding: '20px', marginBottom: 16,
                cursor: 'text', minHeight: isDesktop ? 140 : 100, overflow: 'hidden',
              }}
              onClick={() => amountInputRef.current?.focus()}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 8 }}>
                {logType === 'income' ? 'INCOME' : 'EXPENSE'} · CAD
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 4 }}>
                <span style={{ fontSize: amount ? 48 : 36, fontWeight: 700, lineHeight: 1, color: amountColor, fontFamily: 'Nunito, sans-serif', flexShrink: 0 }}>$</span>
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode={isDesktop ? 'decimal' : 'none'}
                  value={amount}
                  onChange={handleKeyboardAmount}
                  placeholder="0.00"
                  className="mono"
                  style={{
                    fontSize: amount ? 48 : 36, fontWeight: 800,
                    background: 'none', border: 'none', borderRadius: 0,
                    color: amountColor, letterSpacing: '-0.03em', padding: 0,
                    width: `${Math.max((amount || '0.00').length, 4) + 0.5}ch`,
                    caretColor: accentColor,
                  }}
                />
              </div>

              {/* Running total for today */}
              {isToday && !success && (todayExpTotal > 0 || todayIncTotal > 0) && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>
                  Today:{' '}
                  {todayExpTotal > 0 && <span style={{ color: 'var(--danger)' }}>−{formatCAD(todayExpTotal)}</span>}
                  {todayExpTotal > 0 && todayIncTotal > 0 && ' · '}
                  {todayIncTotal > 0 && <span style={{ color: 'var(--success)' }}>+{formatCAD(todayIncTotal)}</span>}
                </p>
              )}

              {isDesktop && !amount && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>Click to type, or use the numpad →</p>
              )}
              {success && (
                <div className="log-success" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>Saved!</span>
                </div>
              )}
              {error && <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, marginTop: 8 }}>{error}</p>}
            </div>

            {/* Day entries with delete */}
            {dayEntries.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {getDateLabel(selectedDate)} · {dayEntries.length} logged
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dayEntries.slice(0, isDesktop ? 6 : 3).map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', backgroundColor: 'var(--surface)', borderRadius: 10, gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.category}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', flexShrink: 0 }}>−{formatCAD(e.amount)}</span>
                      <button
                        onClick={() => handleDelete(e.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                        title="Delete"
                      >×</button>
                    </div>
                  ))}
                  {dayEntries.length > (isDesktop ? 6 : 3) && (
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', padding: '2px 0' }}>+{dayEntries.length - (isDesktop ? 6 : 3)} more</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT / BOTTOM: controls */}
          <div style={{ padding: isDesktop ? '28px 32px' : '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {CategoryGrid}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" style={{ flex: '1 1 120px', minWidth: 0, fontSize: 14 }} />
              {logType === 'expense' && accounts.length > 0 && (
                <select value={accountId ?? ''} onChange={e => setAccountId(e.target.value ? parseInt(e.target.value) : null)} style={{ flex: '1 1 110px', minWidth: 0, fontSize: 14 }}>
                  <option value="">Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>

            {NumPad}

            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={saving || !amount || success}
              style={{
                opacity: (!amount || saving || success) ? 0.55 : 1,
                fontSize: 16, fontWeight: 800,
                backgroundColor: logType === 'income' ? 'var(--success)' : accentColor,
                borderRadius: 14, minHeight: 52,
              }}
            >
              {saving ? 'Saving…' : success ? '✓ Saved!' : amount ? `Save ${formatCAD(parseFloat(amount) || 0)}` : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function LogPage() {
  return <Suspense><LogPageInner /></Suspense>
}
