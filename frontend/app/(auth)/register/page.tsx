'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import TraceyLogo from '@/components/TraceyLogo'
import Link from 'next/link'

export default function RegisterPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [username, setUsername]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [agreed, setAgreed]       = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

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
      router.replace('/onboarding')
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
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="amir" autoCapitalize="none" autoCorrect="off" required
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoCapitalize="none" required
            />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Used to verify your account and for password recovery.
            </p>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 characters" required
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Confirm password
            </label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" required
            />
          </div>

          {/* T&C checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 4 }}>
            <div
              onClick={() => setAgreed(a => !a)}
              style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                border: `2px solid ${agreed ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: agreed ? 'var(--primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', cursor: 'pointer',
              }}
            >
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
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
