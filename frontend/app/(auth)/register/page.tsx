'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import TraceyLogo from '@/components/TraceyLogo'
import Link from 'next/link'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function RegisterPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [step, setStep]           = useState<'register' | 'pin'>('register')
  const [username, setUsername]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [agreed, setAgreed]       = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [showPw, setShowPw]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // PIN setup state
  const [pin, setPin]             = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinStage, setPinStage]   = useState<'enter' | 'confirm'>('enter')
  const [savingPin, setSavingPin] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim())    { setError('Username is required'); return }
    if (!email.trim())       { setError('Email is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (!agreed)             { setError('You must agree to the Terms and Privacy Policy'); return }

    setLoading(true)
    try {
      await api.post('/auth/register', { username: username.trim(), email: email.trim().toLowerCase(), password })
      await login(username.trim(), password)
      setStep('pin')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const msg = err.message.toLowerCase()
        setError(msg.includes('email') ? 'That email is already registered.' : 'That username is taken — try a different one.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  function tapPin(digit: string) {
    if (pinStage === 'enter') {
      if (pin.length < 4) setPin(p => p + digit)
    } else {
      if (pinConfirm.length < 4) setPinConfirm(p => p + digit)
    }
  }

  function deletePin() {
    if (pinStage === 'enter') setPin(p => p.slice(0, -1))
    else setPinConfirm(p => p.slice(0, -1))
  }

  // Auto-advance after 4 digits in first stage
  const currentPin = pinStage === 'enter' ? pin : pinConfirm
  if (pinStage === 'enter' && pin.length === 4) {
    setTimeout(() => setPinStage('confirm'), 120)
  }

  async function confirmPin() {
    if (pin !== pinConfirm) {
      setPinConfirm('')
      setPinStage('enter')
      setPin('')
      setError("PINs didn't match — try again")
      return
    }
    setSavingPin(true)
    try {
      await api.post('/auth/change-pin', { new_pin: pin })
      localStorage.setItem('tracey_has_pin', '1')
    } catch {}
    setSavingPin(false)
    router.replace('/onboarding')
  }

  // Auto-submit PIN confirm when 4 digits entered
  if (pinStage === 'confirm' && pinConfirm.length === 4 && !savingPin) {
    setTimeout(confirmPin, 120)
  }

  if (step === 'pin') {
    const dots = pinStage === 'enter' ? pin : pinConfirm
    return (
      <div style={{
        minHeight: '100dvh', backgroundColor: 'var(--bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 24px 40px', maxWidth: 390, margin: '0 auto',
      }}>
        <TraceyLogo size="lg" />

        <div style={{ width: '100%', marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
            {pinStage === 'enter' ? 'Set up a PIN' : 'Confirm your PIN'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
            {pinStage === 'enter'
              ? 'A 4-digit PIN lets you log in instantly on this device.'
              : 'Enter the same PIN again to confirm.'}
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fff1f2', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginTop: 16, width: '100%', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Dots */}
        <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: '50%',
              backgroundColor: i < dots.length ? 'var(--primary)' : 'var(--border)',
              transition: 'background-color 0.15s',
            }} />
          ))}
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 280, marginTop: 40 }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
            <button
              key={i}
              onClick={() => { if (key === '⌫') deletePin(); else if (key) tapPin(key) }}
              disabled={savingPin || key === ''}
              style={{
                height: 64, borderRadius: 16, border: 'none',
                cursor: key === '' ? 'default' : 'pointer',
                backgroundColor: key === '' ? 'transparent' : key === '⌫' ? 'var(--surface)' : 'var(--card)',
                color: key === '⌫' ? 'var(--text-secondary)' : 'var(--text-primary)',
                fontSize: key === '⌫' ? 20 : 24, fontWeight: 700,
                fontFamily: 'Nunito, sans-serif',
                boxShadow: key === '' ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >{key}</button>
          ))}
        </div>

        {savingPin && <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 16 }}>Saving…</p>}

        <button
          onClick={() => router.replace('/onboarding')}
          style={{ marginTop: 32, fontSize: 14, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}
        >
          Skip for now
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px 40px', maxWidth: 390, margin: '0 auto',
    }}>
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 32 }}>
        <TraceyLogo size="lg" />
      </Link>

      <div style={{ width: '100%' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Create your account
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28 }}>
          Free forever. Your data stays private and encrypted.
        </p>

        {error && (
          <div style={{ backgroundColor: '#fff1f2', color: 'var(--danger)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="amir" autoCapitalize="none" autoCorrect="off" required />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoCapitalize="none" required />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Used to verify your account and for password recovery.
            </p>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters" required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 0 }}>
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Confirm password</label>
            <div style={{ position: 'relative' }}>
              <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 0 }}>
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 4 }}>
            <div onClick={() => setAgreed(a => !a)} style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
              border: `2px solid ${agreed ? 'var(--primary)' : 'var(--border)'}`,
              backgroundColor: agreed ? 'var(--primary)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', cursor: 'pointer',
            }}>
              {agreed && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              I agree to the{' '}
              <Link href="/terms" target="_blank" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" target="_blank" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Privacy Policy</Link>
            </span>
          </label>

          <button type="submit" className="btn-primary" style={{ marginTop: 8 }} disabled={loading || !agreed}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 24 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
