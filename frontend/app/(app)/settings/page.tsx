'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import DateButton from '@/components/DateButton'

interface PaySettings {
  pay_cycle: string
  cycle_start_date: string
  savings_target: number
}

const PAY_CYCLES = [
  { value: 'weekly',       label: 'Weekly' },
  { value: 'biweekly',    label: 'Bi-weekly (every 2 weeks)' },
  { value: 'semimonthly', label: 'Semi-monthly (1st & 15th)' },
  { value: 'monthly',     label: 'Monthly' },
]

function calcNextPay(lastPayStr: string, cycle: string): string {
  const d = new Date(lastPayStr + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  let next: Date
  if (cycle === 'weekly') {
    next = new Date(d); next.setDate(d.getDate() + 7)
  } else if (cycle === 'biweekly') {
    next = new Date(d); next.setDate(d.getDate() + 14)
  } else if (cycle === 'semimonthly') {
    const day = d.getDate()
    next = day < 15
      ? new Date(d.getFullYear(), d.getMonth(), 15)
      : new Date(d.getFullYear(), d.getMonth() + 1, 1)
  } else {
    next = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }
  return next.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth()
  const router = useRouter()

  const [paySettings, setPaySettings]   = useState<PaySettings | null>(null)
  const [payCycle, setPayCycle]         = useState('biweekly')
  const [cycleStart, setCycleStart]     = useState('')
  const [savingCycle, setSavingCycle]   = useState(false)
  const [cycleSaved, setCycleSaved]     = useState(false)

  const [savingsTarget, setSavingsTarget]       = useState('')
  const [savingTarget, setSavingTarget]         = useState(false)
  const [targetSaved, setTargetSaved]           = useState(false)
  const [targetError, setTargetError]           = useState('')

  const [currentPw, setCurrentPw]       = useState('')
  const [newPw, setNewPw]               = useState('')
  const [confirmPw, setConfirmPw]       = useState('')
  const [pwError, setPwError]           = useState('')
  const [pwSuccess, setPwSuccess]       = useState(false)
  const [savingPw, setSavingPw]         = useState(false)

  const [newPin, setNewPin]             = useState('')
  const [confirmPin, setConfirmPin]     = useState('')
  const [pinError, setPinError]         = useState('')
  const [pinSuccess, setPinSuccess]     = useState(false)
  const [savingPin, setSavingPin]       = useState(false)

  const [newEmail, setNewEmail]           = useState('')
  const [emailError, setEmailError]       = useState('')
  const [emailSuccess, setEmailSuccess]   = useState(false)
  const [savingEmail, setSavingEmail]     = useState(false)

  const [newUsername, setNewUsername]         = useState('')
  const [usernameError, setUsernameError]     = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState(false)
  const [savingUsername, setSavingUsername]   = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]                   = useState(false)

  useEffect(() => {
    api.get<PaySettings>('/income/settings').then(s => {
      setPaySettings(s)
      setPayCycle(s.pay_cycle || 'biweekly')
      setCycleStart(s.cycle_start_date || '')
      setSavingsTarget(s.savings_target > 0 ? String(s.savings_target) : '')
    }).catch(console.error)
  }, [])

  async function saveCycle() {
    setSavingCycle(true)
    try {
      await Promise.allSettled([
        api.put('/income/settings/pay_cycle',        { value: payCycle }),
        api.put('/income/settings/cycle_start_date', { value: cycleStart }),
      ])
      setCycleSaved(true)
      setTimeout(() => setCycleSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingCycle(false)
    }
  }

  async function saveTarget() {
    setTargetError('')
    const val = parseFloat(savingsTarget)
    if (savingsTarget !== '' && (isNaN(val) || val < 0)) {
      setTargetError('Enter a valid amount (0 or more)')
      return
    }
    setSavingTarget(true)
    try {
      await api.put('/income/settings/savings_target', { value: String(val || 0) })
      setTargetSaved(true)
      setTimeout(() => setTargetSaved(false), 2000)
    } catch {
      setTargetError('Failed to save')
    } finally {
      setSavingTarget(false)
    }
  }

  async function changePassword() {
    setPwError('')
    if (!currentPw || !newPw) { setPwError('Fill in all fields'); return }
    if (newPw.length < 8)     { setPwError('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw)  { setPwError('Passwords do not match'); return }
    setSavingPw(true)
    try {
      await api.post('/auth/change-password', { current_password: currentPw, new_password: newPw })
      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch {
      setPwError('Current password is incorrect')
    } finally {
      setSavingPw(false)
    }
  }

  async function changePin() {
    setPinError('')
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { setPinError('PIN must be exactly 4 digits'); return }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return }
    setSavingPin(true)
    try {
      await api.post('/auth/change-pin', { new_pin: newPin })
      localStorage.setItem('tracey_has_pin', '1')
      setPinSuccess(true)
      setNewPin(''); setConfirmPin('')
      setTimeout(() => setPinSuccess(false), 3000)
    } catch {
      setPinError('Failed to update PIN')
    } finally {
      setSavingPin(false)
    }
  }

  async function changeEmail() {
    setEmailError('')
    if (!newEmail.trim()) { setEmailError('Enter a new email'); return }
    setSavingEmail(true)
    try {
      await api.post('/auth/change-email', { new_email: newEmail.trim().toLowerCase() })
      await refreshUser()
      setEmailSuccess(true)
      setNewEmail('')
      setTimeout(() => setEmailSuccess(false), 4000)
    } catch (err: any) {
      setEmailError(err?.message || 'Failed to update email')
    } finally {
      setSavingEmail(false)
    }
  }

  async function changeUsername() {
    setUsernameError('')
    if (!newUsername.trim()) { setUsernameError('Enter a new username'); return }
    setSavingUsername(true)
    try {
      await api.post('/auth/change-username', { new_username: newUsername.trim() })
      await refreshUser()
      setUsernameSuccess(true)
      setNewUsername('')
      setTimeout(() => setUsernameSuccess(false), 3000)
    } catch (err: any) {
      setUsernameError(err?.message || 'Username already taken')
    } finally {
      setSavingUsername(false)
    }
  }

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  return (
    <div className="page-content">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Settings</h1>

      {/* Account info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Account</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'var(--primary-light-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{user?.username?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{user?.username}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>tracey account</p>
          </div>
        </div>
      </div>

      {/* Change username */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Change username</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Current: <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong></p>
        <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
          placeholder="New username" autoCapitalize="none" autoCorrect="off" style={{ marginBottom: 10, fontSize: 14 }} />
        {usernameError   && <p style={{ fontSize: 13, color: 'var(--danger)',  fontWeight: 600, marginBottom: 8 }}>{usernameError}</p>}
        {usernameSuccess && <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>✓ Username updated</p>}
        <button className="btn-primary" onClick={changeUsername} disabled={savingUsername || !newUsername.trim()} style={{ fontSize: 14 }}>
          {savingUsername ? 'Updating…' : 'Update username'}
        </button>
      </div>

      {/* Change email */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Change email</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Current: <strong style={{ color: 'var(--text-primary)' }}>{user?.email || 'not set'}</strong>
          {user?.email && !user.email_verified && <span style={{ color: 'var(--warning)', marginLeft: 6, fontWeight: 600 }}>unverified</span>}
          {user?.email && user.email_verified  && <span style={{ color: 'var(--success)', marginLeft: 6, fontWeight: 600 }}>✓ verified</span>}
        </p>
        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
          placeholder="New email address" autoCapitalize="none" style={{ marginBottom: 10, fontSize: 14 }} />
        {emailError   && <p style={{ fontSize: 13, color: 'var(--danger)',  fontWeight: 600, marginBottom: 8 }}>{emailError}</p>}
        {emailSuccess && <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>✓ Email updated — check your inbox to verify</p>}
        <button className="btn-primary" onClick={changeEmail} disabled={savingEmail || !newEmail.trim()} style={{ fontSize: 14 }}>
          {savingEmail ? 'Updating…' : 'Update email'}
        </button>
      </div>

      {/* Pay cycle */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Pay cycle</p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>How often do you get paid?</label>
          <select value={payCycle} onChange={e => setPayCycle(e.target.value)} style={{ fontSize: 14 }}>
            {PAY_CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>When did your last paycheck arrive?</label>
          <DateButton value={cycleStart} onChange={setCycleStart} placeholder="Pick date" />
          {cycleStart && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Your next pay: <strong style={{ color: 'var(--text-primary)' }}>{calcNextPay(cycleStart, payCycle)}</strong>
            </p>
          )}
        </div>

        <button className="btn-primary" onClick={saveCycle} disabled={savingCycle} style={{ fontSize: 14 }}>
          {savingCycle ? 'Saving…' : cycleSaved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Savings target */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Savings target</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          Reserve this amount each pay cycle before calculating your safe-to-spend.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>$</span>
          <input
            type="number" inputMode="decimal" min="0" step="1"
            value={savingsTarget}
            onChange={e => setSavingsTarget(e.target.value)}
            placeholder="0.00"
            style={{ fontSize: 14, fontFamily: 'ui-monospace, monospace', flex: 1 }}
          />
        </div>
        {targetError  && <p style={{ fontSize: 13, color: 'var(--danger)',  fontWeight: 600, marginBottom: 8 }}>{targetError}</p>}
        {targetSaved  && <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>✓ Saved</p>}
        <button className="btn-primary" onClick={saveTarget} disabled={savingTarget} style={{ fontSize: 14 }}>
          {savingTarget ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Change password */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Change password</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" />
          <input type="password" value={newPw}     onChange={e => setNewPw(e.target.value)}     placeholder="New password (min 8 characters)" />
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" />
        </div>
        {pwError   && <p style={{ fontSize: 13, color: 'var(--danger)',  fontWeight: 600, marginTop: 8 }}>{pwError}</p>}
        {pwSuccess && <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginTop: 8 }}>✓ Password updated</p>}
        <button className="btn-primary" onClick={changePassword} disabled={savingPw} style={{ marginTop: 12, fontSize: 14 }}>
          {savingPw ? 'Updating…' : 'Update password'}
        </button>
      </div>

      {/* Change PIN */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Quick PIN</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Set a 4-digit PIN for fast login — tap the <strong>PIN</strong> tab on the login screen to use it.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="number" value={newPin}     onChange={e => setNewPin(e.target.value.slice(0, 4))}     placeholder="New PIN (4 digits)"  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, letterSpacing: '0.2em' }} />
          <input type="number" value={confirmPin} onChange={e => setConfirmPin(e.target.value.slice(0, 4))} placeholder="Confirm PIN"          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, letterSpacing: '0.2em' }} />
        </div>
        {pinError   && <p style={{ fontSize: 13, color: 'var(--danger)',  fontWeight: 600, marginTop: 8 }}>{pinError}</p>}
        {pinSuccess && <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginTop: 8 }}>✓ PIN updated</p>}
        <button className="btn-primary" onClick={changePin} disabled={savingPin} style={{ marginTop: 12, fontSize: 14 }}>
          {savingPin ? 'Updating…' : 'Update PIN'}
        </button>
      </div>

      {/* Privacy */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Privacy</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: '🔒', label: 'All data stored locally on your server' },
            { icon: '🚫', label: 'No bank connections — CSV import only' },
            { icon: '🔐', label: 'Database encrypted with SQLCipher' },
            { icon: '✨', label: 'AI receives only what you choose to share' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Data</p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--danger)', backgroundColor: 'transparent', color: 'var(--danger)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', textAlign: 'left' }}
        >
          🗑 Delete all data
        </button>
      </div>

      {/* App info */}
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>tracey · your money, your rules</p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, opacity: 0.6 }}>v2.0 · Phase 5</p>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1.5px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', marginBottom: 32 }}
      >
        Sign out
      </button>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-sheet"
            style={{ padding: 28, maxWidth: 360 }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)', marginBottom: 10 }}>Delete all data?</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              This will permanently delete all your accounts, transactions, income records, and settings. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={async () => {
                  setDeleting(true)
                  try {
                    await api.delete('/auth/data')
                    logout()
                    router.replace('/login')
                  } catch {
                    setDeleting(false)
                    setShowDeleteConfirm(false)
                  }
                }}
                disabled={deleting}
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
