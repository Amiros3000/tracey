'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCAD, today } from '@/lib/utils'
import { useTip } from '@/lib/tips'
import DateButton from '@/components/DateButton'

interface Recurring {
  id: number
  name: string
  amount: number
  type: 'debit' | 'credit'
  frequency: string
  day_of_month: number | null
  next_date: string | null
  category: string | null
  is_government_benefit: boolean
  is_active: boolean
}

interface Summary {
  monthly_debit: number
  monthly_credit: number
  net: number
}

interface Upcoming extends Recurring {
  from_account_name: string | null
  to_account_name: string | null
}

const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual']
const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
}

function daysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff} days`
}

export default function RecurringPage() {
  const { visible: tipVisible, dismiss: dismissTip } = useTip('bills')
  const [items, setItems]         = useState<Recurring[]>([])
  const [upcoming, setUpcoming]   = useState<Upcoming[]>([])
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [itemsRes, upcomingRes, summaryRes] = await Promise.allSettled([
      api.get<Recurring[]>('/recurring'),
      api.get<Upcoming[]>('/recurring/upcoming?days=30'),
      api.get<Summary>('/recurring/summary'),
    ])
    if (itemsRes.status    === 'fulfilled') setItems(itemsRes.value)
    if (upcomingRes.status === 'fulfilled') setUpcoming(upcomingRes.value)
    if (summaryRes.status  === 'fulfilled') setSummary(summaryRes.value)
    setLoading(false)
  }

  async function markPaid(item: Recurring) {
    // Advance next_date by one period
    const next = advanceDate(item.next_date, item.frequency)
    await api.patch(`/recurring/${item.id}`, { next_date: next })
    loadAll()
  }

  async function deleteItem(id: number) {
    await api.delete(`/recurring/${id}`)
    loadAll()
  }

  const debits  = items.filter(i => i.type === 'debit')
  const credits = items.filter(i => i.type === 'credit')

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--primary-light-bg)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div className="page-content">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Bills & Recurring</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: tipVisible ? 12 : 20 }}>
        Subscriptions, bills, loan payments, government deposits
      </p>

      {tipVisible && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12, borderLeft: '3px solid var(--primary)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Track everything that repeats</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Add your subscriptions, rent, loan payments, and regular income. tracey will track what&apos;s upcoming and calculate your monthly net cash flow.
            </p>
          </div>
          <button onClick={dismissTip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Monthly summary */}
      {summary && (items.length > 0) && (
        <div className="card" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Monthly out', value: summary.monthly_debit, color: 'var(--danger)' },
            { label: 'Monthly in',  value: summary.monthly_credit, color: 'var(--success)' },
            { label: 'Net',         value: summary.net, color: summary.net >= 0 ? 'var(--success)' : 'var(--danger)' },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</p>
              <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{formatCAD(Math.abs(s.value))}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming this month */}
      {upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            Coming up — next 30 days
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {upcoming.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    backgroundColor: item.type === 'credit' ? 'rgba(16,185,129,0.1)' : 'var(--primary-light-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    {item.is_government_benefit ? '🏛️' : item.type === 'credit' ? '💚' : '📅'}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {item.next_date} · {daysUntil(item.next_date!)}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="mono" style={{ fontSize: 15, fontWeight: 700, color: item.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                    {item.type === 'credit' ? '+' : '-'}{formatCAD(item.amount)}
                  </p>
                  <button
                    onClick={() => markPaid(item)}
                    style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700, padding: 0 }}
                  >
                    Mark paid ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring debits */}
      {debits.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            📤 Bills & payments
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {debits.map(item => <RecurringCard key={item.id} item={item} onDelete={deleteItem} />)}
          </div>
        </div>
      )}

      {/* Recurring credits */}
      {credits.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            📥 Income & deposits
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {credits.map(item => <RecurringCard key={item.id} item={item} onDelete={deleteItem} />)}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📅</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 4 }}>No recurring transactions yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Add your bills, subscriptions, and regular income.</p>
        </div>
      )}

      <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ marginBottom: 24 }}>
        + Add recurring transaction
      </button>

      {showAdd && <AddRecurringModal onClose={() => { setShowAdd(false); loadAll() }} />}
    </div>
  )
}

function RecurringCard({ item, onDelete }: { item: Recurring; onDelete: (id: number) => void }) {
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{item.name}</p>
            {item.is_government_benefit && (
              <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: 'var(--primary-light-bg)', color: 'var(--primary)', borderRadius: 6, padding: '2px 6px' }}>GOV</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {FREQ_LABELS[item.frequency]}
            {item.next_date && ` · next ${item.next_date}`}
            {item.category && ` · ${item.category}`}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="mono" style={{ fontSize: 16, fontWeight: 700, color: item.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
            {item.type === 'credit' ? '+' : '-'}{formatCAD(item.amount)}
          </p>
          <button
            onClick={() => onDelete(item.id)}
            style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', marginTop: 4 }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

function AddRecurringModal({ onClose }: { onClose: () => void }) {
  const [name, setName]       = useState('')
  const [amount, setAmount]   = useState('')
  const [type, setType]       = useState<'debit' | 'credit'>('debit')
  const [freq, setFreq]       = useState('monthly')
  const [nextDate, setNext]   = useState('')
  const [isGov, setIsGov]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSave() {
    if (!name.trim() || !amount) { setError('Name and amount required'); return }
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) { setError('Invalid amount'); return }
    setSaving(true)
    try {
      await api.post('/recurring', {
        name: name.trim(), amount: parsed, type, frequency: freq,
        next_date: nextDate || undefined, is_government_benefit: isGov,
      })
      onClose()
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Add recurring transaction</h3>

        {/* Debit / Credit */}
        <div style={{ display: 'flex', backgroundColor: 'var(--surface)', borderRadius: 10, padding: 4 }}>
          {(['debit', 'credit'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14,
              backgroundColor: type === t ? 'var(--card)' : 'transparent',
              color: type === t ? (t === 'credit' ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)',
            }}>
              {t === 'debit' ? '📤 Bill / Payment' : '📥 Income / Deposit'}
            </button>
          ))}
        </div>

        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Netflix, OSAP)" />
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" style={{ fontFamily: 'ui-monospace, monospace' }} />

        <select value={freq} onChange={e => setFreq(e.target.value)}>
          {FREQUENCIES.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
        </select>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Next date (optional)</label>
          <DateButton value={nextDate} onChange={setNext} placeholder="No date set" />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={isGov} onChange={e => setIsGov(e.target.checked)} style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Government benefit (OSAP, OW, EI, etc.)</span>
        </label>

        {error && <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
        </div>
      </div>
    </div>
  )
}

function advanceDate(dateStr: string | null, frequency: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  switch (frequency) {
    case 'weekly':    d.setDate(d.getDate() + 7); break
    case 'monthly':   d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'annual':    d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().split('T')[0]
}
