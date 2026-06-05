'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import TraceyLogo from '@/components/TraceyLogo'

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found. Check the link in your email.')
      return
    }
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success')
        setTimeout(() => router.replace('/dashboard'), 2500)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err?.message || 'This link is invalid or has expired.')
      })
  }, [token, router])

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px', textAlign: 'center',
    }}>
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 40 }}>
        <TraceyLogo size="md" />
      </Link>

      {status === 'loading' && (
        <>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary-light-bg)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', marginBottom: 20 }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Verifying your email…</p>
        </>
      )}

      {status === 'success' && (
        <div style={{ maxWidth: 360 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', backgroundColor: 'var(--primary-light-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Email verified</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            Your account is confirmed. Redirecting you to the dashboard…
          </p>
          <Link href="/dashboard" style={{
            display: 'inline-block', padding: '12px 24px',
            backgroundColor: 'var(--primary)', color: 'white',
            borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Go to dashboard
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div style={{ maxWidth: 360 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', backgroundColor: '#fff1f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--danger)" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Link expired</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            {message}
          </p>
          <Link href="/dashboard" style={{
            display: 'inline-block', padding: '12px 24px',
            backgroundColor: 'var(--primary)', color: 'white',
            borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Back to dashboard
          </Link>
        </div>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  )
}
