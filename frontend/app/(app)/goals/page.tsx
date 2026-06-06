'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCAD } from '@/lib/utils'
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

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })
}

const EMPTY = { name: '', target_amount: '', current_amount: '', target_date: '', linked_account_id: '' }

export default function GoalsPage() {
  const [goals, setGoals]             = useState<Goal[]>([])
  const [accounts, setAccounts]       = useState<Account[]>([])
  const [loading, setLoading]         = useState(true)
  const [savingsTarget, setSavingsTarget] = useState(0)

  const [modal, setModal]             = useState<'add' | 'edit' | 'funds' | null>(null)
  const [editing, setEditing]         = useState<Goal | null>(null)
  const [form, setForm]               = useState(EMPTY)
  const [fundsGoal, setFundsGoal]     = useState<Goal | null>(null)
  const [fundsAmount, setFundsAmount] = useState('')
  const [saving, setSaving]           = useState(false)
  const [deleteId, setDeleteId]       = useState<number | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [formError, setFormError]     = useState('')

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
    setForm(EMPTY); setEditing(null); setFormError(''); setModal('add')
  }
  function openEdit(g: Goal) {
    setForm({
      name: g.name,
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      target_date: g.target_date ?? '',
      linked_account_id: g.linked_account_id ? String(g.linked_account_id) : '',
    })
    setEditing(g); setFormError(''); setModal('edit')
  }
  function openFunds(g: Goal) {
    setFundsGoal(g); setFundsAmount(''); setModal('funds')
  }

  async function saveGoal() {
    setFormError('')
    const target = parseFloat(form.target_amount)
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!target || target <= 0) { setFormError('Enter a valid target amount'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        target_amount: target,
        current_amount: parseFloat(form.current_amount) || 0,
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
    } catch { setFormError('Failed to save. Try again.') }
    finally { setSaving(false) }
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
    } finally { setSaving(false) }
  }

  async function deleteGoal() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/goals/${deleteId}`)
      setGoals(gs => gs.filter(g => g.id !== deleteId))
      setDeleteId(null); setModal(null)
    } finally { setDeleting(false) }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
  }

  return (
    <div className="page-content">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Goals</h1>
        <button className="btn-primary" onClick={openAdd} style={{ fontSize: 14, padding: '8px 16px' }}>
          + New goal
        </button>
      </div>

      {/* Empty state */}
      {goals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '52px 24px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', backgroundColor: 'var(--primary-light-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="var(--primary)" strokeWidth="2.2" />
              <circle cx="12" cy="12" r="4" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="12" cy="12" r="1.5" fill="var(--primary)" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No goals yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>
            Track your savings toward any goal — emergency fund, vacation, new gear.
          </p>
          <button className="btn-primary" onClick={openAdd} style={{ fontSize: 14 }}>
            Create your first goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {goals.map(g => {
            const pct  = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0
            const done = pct >= 100
            const left = Math.max(g.target_amount - g.current_amount, 0)

            // ETA line
            let eta = ''
            if (!done) {
              if (g.target_date) {
                const mo = monthsUntil(g.target_date)
                eta = `${shortDate(g.target_date)} · ${mo === 0 ? 'this month' : `${mo}mo left`}`
                if (savingsTarget > 0 && mo > 0) {
                  eta += left / mo <= savingsTarget ? ' · on track' : ' · save more'
                }
              } else if (savingsTarget > 0 && left > 0) {
                const mo = Math.ceil(left / savingsTarget)
                eta = `~${mo} month${mo !== 1 ? 's' : ''} at current rate`
              }
            }

            return (
              <div key={g.id} className="card" style={{ padding: '16px 18px' }}>

                {/* Top: name + edit */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{g.name}</p>
                  <button
                    onClick={() => openEdit(g)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-secondary)', opacity: 0.6, lineHeight: 1 }}
                    aria-label="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {/* ETA subtitle */}
                {(eta || done) && (
                  <p style={{ fontSize: 12, color: done ? 'var(--primary)' : 'var(--text-secondary)', marginBottom: 10, fontWeight: done ? 700 : 400 }}>
                    {done ? 'Goal complete' : eta}
                  </p>
                )}

                {/* Progress bar */}
                <div style={{ height: 6, backgroundColor: 'var(--surface)', borderRadius: 3, margin: `${eta || done ? 0 : 10}px 0 10px`, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 3,
                    backgroundColor: done ? 'var(--primary)' : pct >= 66 ? 'var(--primary)' : pct >= 33 ? 'var(--warning)' : 'var(--text-secondary)',
                    opacity: pct === 0 ? 0 : 1,
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                {/* Bottom: amounts + pct + add button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCAD(g.current_amount)}
                    </span>
                    {' '}/{' '}{formatCAD(g.target_amount)}
                    <span style={{ marginLeft: 6, fontSize: 12 }}>
                      {pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%
                    </span>
                  </p>
                  {!done && (
                    <button onClick={() => openFunds(g)} style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                      backgroundColor: 'var(--primary-light-bg)', border: 'none',
                      borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                      fontFamily: 'Nunito, sans-serif',
                    }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Goal name</label>
                <input type="text" value={form.name} placeholder="e.g. Emergency fund" autoFocus
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ fontSize: 15 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Target ($)</label>
                  <input type="number" inputMode="decimal" min="1" placeholder="5000"
                    value={form.target_amount}
                    onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                    style={{ fontSize: 15, fontFamily: 'ui-monospace, monospace' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Saved so far ($)</label>
                  <input type="number" inputMode="decimal" min="0" placeholder="0"
                    value={form.current_amount}
                    onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
                    style={{ fontSize: 15, fontFamily: 'ui-monospace, monospace' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Target date <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                </label>
                <DateButton value={form.target_date} onChange={val => setForm(f => ({ ...f, target_date: val }))} placeholder="No target date" />
              </div>

              {accounts.length > 0 && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Linked account <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                  </label>
                  <select value={form.linked_account_id}
                    onChange={e => setForm(f => ({ ...f, linked_account_id: e.target.value }))} style={{ fontSize: 14 }}>
                    <option value="">None</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {formError && <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, marginTop: 10 }}>{formError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={saveGoal} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving…' : modal === 'add' ? 'Create goal' : 'Save changes'}
              </button>
            </div>

            {modal === 'edit' && editing && (
              <button onClick={() => setDeleteId(editing.id)} style={{
                width: '100%', marginTop: 10, padding: '8px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--danger)', fontFamily: 'Nunito, sans-serif',
              }}>
                Delete goal
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
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {fundsGoal.name} · {formatCAD(fundsGoal.current_amount)} of {formatCAD(fundsGoal.target_amount)}
            </p>
            <input type="number" inputMode="decimal" autoFocus
              value={fundsAmount} placeholder="0.00"
              onChange={e => setFundsAmount(e.target.value)}
              style={{ fontSize: 28, fontFamily: 'ui-monospace, monospace', fontWeight: 700, marginBottom: 20, textAlign: 'center' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={addFunds}
                disabled={saving || !fundsAmount || parseFloat(fundsAmount) <= 0} style={{ flex: 2 }}>
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
              <button onClick={deleteGoal} disabled={deleting} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                backgroundColor: 'var(--danger)', color: 'white',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
              }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
