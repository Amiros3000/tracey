/**
 * Login page — password login + quick PIN login.
 *
 * Two tabs at the top: "Password" and "PIN".
 * Password tab: username + password fields.
 * PIN tab: 4 dot display + numpad.  Submits automatically when 4 digits entered.
 *
 * After successful login, redirects to dashboard (or onboarding if first time).
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import TraceyLogo from '@/components/TraceyLogo'

export default function LoginPage() {
  const { login, pinLogin, isAuthenticated } = useAuth()
  const router = useRouter()

  const [tab, setTab]           = useState<'password' | 'pin'>(() =>
    typeof window !== 'undefined' && localStorage.getItem('tracey_has_pin') ? 'pin' : 'password'
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard')
  }, [isAuthenticated, router])

  // Auto-submit PIN when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      handlePINLogin()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handlePINLogin() {
    setError('')
    setLoading(true)
    try {
      await pinLogin(pin)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Incorrect PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  function tapPin(digit: string) {
    if (pin.length < 4) setPin(p => p + digit)
  }

  function deletePin() {
    setPin(p => p.slice(0, -1))
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 40px',
        maxWidth: 390,
        margin: '0 auto',
      }}
    >
      {/* Logo */}
      <TraceyLogo size="lg" className="mb-12" />

      {/* Tab switcher */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--surface)',
          borderRadius: 12,
          padding: 4,
          width: '100%',
          marginBottom: 32,
        }}
      >
        {(['password', 'pin'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); setPin('') }}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              backgroundColor: tab === t ? 'var(--card)' : 'transparent',
              color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t === 'password' ? 'Password' : 'PIN'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--primary-light-bg)',
            color: 'var(--primary)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 600,
            width: '100%',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Password form */}
      {tab === 'password' && (
        <form onSubmit={handlePasswordLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="amir"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 0 }}>
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}

      {/* PIN form */}
      {tab === 'pin' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          {/* 4 dot display */}
          <div style={{ display: 'flex', gap: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: i < pin.length ? 'var(--primary)' : 'var(--border)',
                  transition: 'background-color 0.15s',
                }}
              />
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 280 }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
              <button
                key={i}
                onClick={() => {
                  if (key === '⌫') deletePin()
                  else if (key !== '') tapPin(key)
                }}
                disabled={loading || key === ''}
                style={{
                  height: 64,
                  borderRadius: 16,
                  border: 'none',
                  cursor: key === '' ? 'default' : 'pointer',
                  backgroundColor: key === '' ? 'transparent' : key === '⌫' ? 'var(--surface)' : 'var(--card)',
                  color: key === '⌫' ? 'var(--text-secondary)' : 'var(--text-primary)',
                  fontSize: key === '⌫' ? 20 : 24,
                  fontWeight: 700,
                  fontFamily: 'Nunito, sans-serif',
                  boxShadow: key === '' ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'background-color 0.1s',
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {loading && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Verifying…</p>
          )}
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 36 }}>
        First time?{' '}
        <Link href="/register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
          Create account
        </Link>
      </p>
    </div>
  )
}
