'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCAD, formatDateLong } from '@/lib/utils'
import DateButton from '@/components/DateButton'

interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  linked_account_id: number | null
  created_at: string
}

interface Account { id: number; name: string; type: string }

function monthsUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  return Math.max(
    0,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()),
  )
}

function monthsNeeded(remaining: number, savingsTarget: number): number | null {
  if (savingsTarget <= 0 || remaining <= 0) return null
  return Math.ceil(remaining / savingsTarget)
}

const EMPTY = { name: '', target_amount: '', current_amount: '', target_date: '', linked_account_id: '' }

export default function GoalsPage() {
  const [goals, setGoals]       = useState<Goal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [savingsTarget, setSavingsTarget] = useState(0)

  const [modal, setModal]       = useState<'add' | 'edit' | 'funds' | null>(null)
  const [editing, setEditing]   = useState<Goal | null>(null)
  const [form, setForm]         = useState(EMPTY)
  const [fundsGoal, setFundsGoal] = useState<Goal | null>(null)
  const [fundsAmount, setFundsAmount] = useState('')
  const [saving, setSaving]     = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    Promise.allSettled([
      api.get<Goal[]>('/goals'),
      api.get<Account[]>('/accounts'),
      api.get<{ savings_target: number }>('/income/settings'),
    ]).then(([goalsRes, accsRes, settingsRes]) => {
      if (goalsRes.status === 'fulfilled') setGoals(goalsRes.value)
      if (accsRes.status === 'fulfilled') setAccounts(accsRes.value)
      if (settingsRes.status === 'fulfilled') setSavingsTarget(settingsRes.value.savings_target ?? 0)
    }).finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setForm(EMPTY)
    setEditing(null)
    setFormError('')
    setModal('add')
  }

  function openEdit(g: Goal) {
    setForm({
      name: g.name,
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      target_date: g.target_date ?? '',
      linked_account_id: g.linked_account_id ? String(g.linked_account_id) : '',
    })
    setEditing(g)
    setFormError('')
    setModal('edit')
  }

  function openFunds(g: Goal) {
    setFundsGoal(g)
    setFundsAmount('')
    setModal('funds')
  }

  async function saveGoal() {
    setFormError('')
    const target = parseFloat(form.target_amount)
    const current = parseFloat(form.current_amount) || 0
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!target || target <= 0) { setFormError('Enter a valid target amount'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        target_amount: target,
        current_amount: current,
        target_date: form.target_date || null,
        linked_account_id: form.linked_account_id ? Number(form.linked_account_id) : null,
      }
      if (modal === 'edit' && editing) {
        const updated = await api.patch<Goal>(`/goals/${editing.id}`, body)
        setGoals(gs => gs.map(g => g.id === editing.id ? updated : g))
      } else {
        const created = await api.post<Goal>('/goals', body)
        setGoals(gs => [...gs, created])
      }
      setModal(null)
    } catch {
      setFormError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function addFunds() {
    if (!fundsGoal) return
    const amount = parseFloat(fundsAmount)
    if (isNaN(amount) || amount <= 0) return
    setSaving(true)
    try {
      const updated = await api.patch<Goal>(`/goals/${fundsGoal.id}`, {
        current_amount: Math.min(fundsGoal.current_amount + amount, fundsGoal.target_amount),
      })
      setGoals(gs => gs.map(g => g.id === fundsGoal.id ? updated : g))
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  async function deleteGoal() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/goals/${deleteId}`)
      setGoals(gs => gs.filter(g => g.id !== deleteId))
      setDeleteId(null)
      setModal(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Goals</h1>
        <button className="btn-primary" onClick={openAdd} style={{ fontSize: 14, padding: '8px 16px' }}>
          + New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: 'var(--primary-light-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="var(--primary)" strokeWidth="2.2" />
              <circle cx="12" cy="12" r="4.5" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="12" cy="12" r="1.5" fill="var(--primary)" />
            </svg>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No goals yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6, maxWidth: 280, margin: '0 auto 20px' }}>
            Set a savings goal — emergency fund, vacation, new laptop — and tracey will track your progress.
          </p>
          <button className="btn-primary" onClick={openAdd} style={{ fontSize: 14 }}>Create your first goal</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {goals.map(g => {
            const pct     = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0
            const done    = pct >= 100
            const left    = Math.max(g.target_amount - g.current_amount, 0)
            const mo      = g.target_date ? monthsUntil(g.target_date) : monthsNeeded(left, savingsTarget)
            const onTrack = g.target_date && mo !== null && mo > 0 && savingsTarget > 0
              ? left / mo <= savingsTarget
              : null

            const barColor = done
              ? 'var(--primary)'
              : pct > 66 ? 'var(--primary)'
              : pct > 33 ? 'var(--warning)'
              : 'var(--text-secondary)'

            return (
              <div key={g.id} className="card" style={{ padding: '18px 18px 14px' }}>
                {/* Header: name + edit button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{g.name}</p>
                      {done && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--primary)',
                          backgroundColor: 'var(--primary-light-bg)',
                          padding: '2px 8px', borderRadius: 20, letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}>Done</span>
                      )}
                    </div>

                    {/* Subtitle */}
                    {g.target_date && !done && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Target {formatDateLong(g.target_date)}
                        {mo !== null && (
                          <span style={{ marginLeft: 4, fontWeight: 700, color: onTrack ? 'var(--success)' : 'var(--warning)' }}>
                            · {mo === 0 ? 'this month' : `${mo}mo`}
                            {onTrack !== null && (onTrack ? ' on track' : ' — save more')}
                          </span>
                        )}
                      </p>
                    )}
                    {!g.target_date && mo !== null && !done && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        ~{mo} month{mo !== 1 ? 's' : ''} at current rate
                      </p>
                    )}
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(g)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-secondary)', padding: 4, flexShrink: 0,
                      display: 'flex', alignItems: 'center',
                    }}
                    aria-label="Edit goal"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ height: 8, backgroundColor: 'var(--surface)', borderRadius: 4, margin: '12px 0 8px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 4,
                    backgroundColor: barColor,
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                {/* Footer: amounts + add button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCAD(g.current_amount)}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {' '}of {formatCAD(g.target_amount)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>
                      ({pct.toFixed(pct < 1 ? 1 : 0)}%)
                    </span>
                  </div>
                  {!done && (
                    <button
                      onClick={() => openFunds(g)}
                      style={{
                        fontSize: 13, fontWeight: 700,
                        color: 'var(--primary)', backgroundColor: 'var(--primary-light-bg)',
                        border: 'none', borderRadius: 8,
                        padding: '6px 12px', cursor: 'pointer',
                        fontFamily: 'Nunito, sans-serif',
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" style={{ padding: 28, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
              {modal === 'add' ? 'New goal' : 'Edit goal'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Goal name</label>
                <input
                  type="text" value={form.name} placeholder="e.g. Emergency fund"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ fontSize: 15 }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Target amount</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>$</span>
                    <input
                      type="number" inputMode="decimal" min="1"
                      value={form.target_amount}
                      placeholder="5,000"
                      onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                      style={{ fontSize: 15, fontFamily: 'ui-monospace, monospace', paddingLeft: 28 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Saved so far</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>$</span>
                    <input
                      type="number" inputMode="decimal" min="0"
                      value={form.current_amount}
                      placeholder="0"
                      onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
                      style={{ fontSize: 15, fontFamily: 'ui-monospace, monospace', paddingLeft: 28 }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Target date <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                </label>
                <DateButton
                  value={form.target_date}
                  onChange={val => setForm(f => ({ ...f, target_date: val }))}
                  placeholder="No target date"
                />
              </div>

              {accounts.length > 0 && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Linked account <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                  </label>
                  <select
                    value={form.linked_account_id}
                    onChange={e => setForm(f => ({ ...f, linked_account_id: e.target.value }))}
                    style={{ fontSize: 14 }}
                  >
                    <option value="">None</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {formError && (
              <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, marginTop: 12 }}>{formError}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={saveGoal} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving…' : modal === 'add' ? 'Create goal' : 'Save changes'}
              </button>
            </div>

            {/* Delete — only in edit mode */}
            {modal === 'edit' && editing && (
              <button
                onClick={() => setDeleteId(editing.id)}
                style={{
                  width: '100%', marginTop: 12, padding: '10px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: 'var(--danger)',
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                Delete this goal
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add funds modal */}
      {modal === 'funds' && fundsGoal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" style={{ padding: 28, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Add funds</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              {fundsGoal.name} · {formatCAD(fundsGoal.current_amount)} of {formatCAD(fundsGoal.target_amount)} saved
            </p>
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 22, fontWeight: 700, color: 'var(--text-secondary)',
              }}>$</span>
              <input
                type="number" inputMode="decimal" min="0.01"
                value={fundsAmount} placeholder="0.00"
                onChange={e => setFundsAmount(e.target.value)}
                autoFocus
                style={{ fontSize: 22, fontFamily: 'ui-monospace, monospace', fontWeight: 700, paddingLeft: 36 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                className="btn-primary" onClick={addFunds}
                disabled={saving || !fundsAmount || parseFloat(fundsAmount) <= 0}
                style={{ flex: 2 }}
              >
                {saving ? 'Saving…' : 'Add funds'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-sheet" style={{ padding: 28, maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)', marginBottom: 10 }}>Delete goal?</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently delete the goal and its progress.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setDeleteId(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={deleteGoal} disabled={deleting}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                  backgroundColor: 'var(--danger)', color: 'white',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
