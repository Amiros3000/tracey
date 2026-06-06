'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCAD, formatDateLong } from '@/lib/utils'

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

const EMPTY: Omit<Goal, 'id' | 'created_at'> = {
  name: '', target_amount: 0, current_amount: 0, target_date: null, linked_account_id: null,
}

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
    setModal('add')
  }

  function openEdit(g: Goal) {
    setForm({
      name: g.name,
      target_amount: g.target_amount,
      current_amount: g.current_amount,
      target_date: g.target_date,
      linked_account_id: g.linked_account_id,
    })
    setEditing(g)
    setModal('edit')
  }

  function openFunds(g: Goal) {
    setFundsGoal(g)
    setFundsAmount('')
    setModal('funds')
  }

  async function saveGoal() {
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount),
        target_date: form.target_date || null,
        linked_account_id: form.linked_account_id || null,
      }
      if (modal === 'edit' && editing) {
        const updated = await api.patch<Goal>(`/goals/${editing.id}`, body)
        setGoals(gs => gs.map(g => g.id === editing.id ? updated : g))
      } else {
        const created = await api.post<Goal>('/goals', body)
        setGoals(gs => [...gs, created])
      }
      setModal(null)
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
    } finally {
      setDeleting(false)
    }
  }

  const formValid = form.name.trim().length > 0 && Number(form.target_amount) > 0

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
              <circle cx="12" cy="12" r="9" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="12" cy="12" r="1.5" fill="var(--primary)" />
              <line x1="20" y1="4" x2="21" y2="3" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No goals yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Set a savings goal — emergency fund, vacation, new laptop — and tracey will track your progress.
          </p>
          <button className="btn-primary" onClick={openAdd} style={{ fontSize: 14 }}>Create your first goal</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {goals.map(g => {
            const pct     = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0
            const done    = pct >= 100
            const left    = Math.max(g.target_amount - g.current_amount, 0)
            const mo      = g.target_date ? monthsUntil(g.target_date) : monthsNeeded(left, savingsTarget)
            const onTrack = g.target_date
              ? mo !== null && savingsTarget > 0 && left / mo <= savingsTarget
              : null

            return (
              <div key={g.id} className="card" style={{ padding: '20px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{g.name}</p>
                      {done && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', backgroundColor: 'var(--primary-light-bg)', padding: '2px 8px', borderRadius: 20 }}>
                          Complete
                        </span>
                      )}
                    </div>
                    {g.target_date && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Target: {formatDateLong(g.target_date)}
                        {!done && mo !== null && (
                          <span style={{ marginLeft: 6, color: onTrack ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                            · {mo === 0 ? 'this month' : `${mo} month${mo !== 1 ? 's' : ''} away`}
                            {onTrack !== null && (onTrack ? ' · on track' : ' · needs more')}
                          </span>
                        )}
                      </p>
                    )}
                    {!g.target_date && mo !== null && !done && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        ~{mo} month{mo !== 1 ? 's' : ''} at your savings rate
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    {!done && (
                      <button onClick={() => openFunds(g)} style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                        backgroundColor: 'var(--primary-light-bg)', border: 'none',
                        borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                        fontFamily: 'Nunito, sans-serif',
                      }}>
                        + Add
                      </button>
                    )}
                    <button onClick={() => openEdit(g)} style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                      backgroundColor: 'var(--surface)', border: 'none',
                      borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                      fontFamily: 'Nunito, sans-serif',
                    }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteId(g.id)} style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--danger)',
                      backgroundColor: 'transparent', border: 'none',
                      borderRadius: 8, padding: '5px 8px', cursor: 'pointer',
                      fontFamily: 'Nunito, sans-serif',
                    }}>
                      ✕
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 8, backgroundColor: 'var(--surface)', borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 4,
                    backgroundColor: done ? 'var(--primary)' : pct > 66 ? 'var(--primary)' : pct > 33 ? 'var(--warning)' : 'var(--text-secondary)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCAD(g.current_amount)}
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}> / {formatCAD(g.target_amount)}</span>
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: done ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {pct.toFixed(pct < 1 ? 1 : 0)}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" style={{ padding: 28, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
              {modal === 'add' ? 'New goal' : 'Edit goal'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Goal name</label>
                <input
                  type="text" value={form.name} placeholder="e.g. Emergency fund"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ fontSize: 15 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Target amount</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>$</span>
                    <input
                      type="number" inputMode="decimal" min="1"
                      value={form.target_amount || ''}
                      placeholder="5,000"
                      onChange={e => setForm(f => ({ ...f, target_amount: parseFloat(e.target.value) || 0 }))}
                      style={{ fontSize: 15, fontFamily: 'ui-monospace, monospace', flex: 1 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Saved so far</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>$</span>
                    <input
                      type="number" inputMode="decimal" min="0"
                      value={form.current_amount || ''}
                      placeholder="0"
                      onChange={e => setForm(f => ({ ...f, current_amount: parseFloat(e.target.value) || 0 }))}
                      style={{ fontSize: 15, fontFamily: 'ui-monospace, monospace', flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Target date <span style={{ fontWeight: 400, color: 'var(--text-secondary)', opacity: 0.7 }}>(optional)</span>
                </label>
                <input
                  type="date" value={form.target_date || ''}
                  onChange={e => setForm(f => ({ ...f, target_date: e.target.value || null }))}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}
                />
              </div>

              {accounts.length > 0 && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Linked account <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
                  </label>
                  <select
                    value={form.linked_account_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, linked_account_id: e.target.value ? Number(e.target.value) : null }))}
                    style={{ fontSize: 14 }}
                  >
                    <option value="">No linked account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={saveGoal} disabled={saving || !formValid} style={{ flex: 2 }}>
                {saving ? 'Saving…' : modal === 'add' ? 'Create goal' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add funds modal */}
      {modal === 'funds' && fundsGoal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" style={{ padding: 28, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Add funds</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {fundsGoal.name} · {formatCAD(fundsGoal.current_amount)} of {formatCAD(fundsGoal.target_amount)} saved
            </p>

            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Amount to add</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>$</span>
              <input
                type="number" inputMode="decimal" min="0.01"
                value={fundsAmount} placeholder="0.00"
                onChange={e => setFundsAmount(e.target.value)}
                autoFocus
                style={{ fontSize: 22, fontFamily: 'ui-monospace, monospace', fontWeight: 700, flex: 1 }}
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
              This will permanently delete the goal and its progress. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setDeleteId(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={deleteGoal} disabled={deleting}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', backgroundColor: 'var(--danger)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
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
