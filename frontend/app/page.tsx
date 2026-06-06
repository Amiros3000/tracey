'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import TraceyLogo from '@/components/TraceyLogo'

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--primary)" strokeWidth="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Your data, your server',
    desc: 'Self-hosted and encrypted. No one — including us — can see your finances.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5Z" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'No bank connections',
    desc: 'Upload a PDF or CSV from your bank. You control what enters the app.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--primary)" strokeWidth="2" />
        <path d="M12 8v4l3 3" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Safe-to-spend, daily',
    desc: 'Based on your real income and pay cycle — not generic budget envelopes.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
    title: 'tracey thinks',
    desc: 'AI-powered insights pushed to your dashboard — no prompting required.',
  },
]

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--primary-light-bg)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isAuthenticated) return null

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100dvh' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 24px', maxWidth: 960, margin: '0 auto',
      }}>
        <TraceyLogo size="sm" />
        <Link href="/login" style={{
          fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}>
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 640, margin: '0 auto', padding: '60px 24px 72px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', backgroundColor: 'var(--primary-light-bg)',
          color: 'var(--primary)', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase',
          padding: '5px 12px', borderRadius: 20, marginBottom: 24,
        }}>
          Personal finance — private by default
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 800,
          color: 'var(--text-primary)', lineHeight: 1.1,
          letterSpacing: '-0.03em', marginBottom: 20,
        }}>
          Track your money.<br />
          <span style={{ color: 'var(--primary)' }}>Own your data.</span>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7,
          marginBottom: 40, maxWidth: 480, margin: '0 auto 40px',
        }}>
          A serious personal finance app that lives on your server.
          No subscriptions, no bank connections, no data harvesting.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{
            display: 'inline-block', padding: '14px 32px',
            backgroundColor: 'var(--primary)', color: 'white',
            borderRadius: 12, fontWeight: 700, fontSize: 16,
            textDecoration: 'none', boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
          }}>
            Get started
          </Link>
          <Link href="/login" style={{
            display: 'inline-block', padding: '14px 28px',
            backgroundColor: 'var(--card)', color: 'var(--text-primary)',
            border: '1.5px solid var(--border)',
            borderRadius: 12, fontWeight: 700, fontSize: 16,
            textDecoration: 'none',
          }}>
            Sign in
          </Link>
        </div>
      </section>

      {/* Dashboard preview card */}
      <section style={{ maxWidth: 480, margin: '0 auto 72px', padding: '0 24px' }}>
        <div style={{
          backgroundColor: 'var(--card)', borderRadius: 20,
          border: '1px solid var(--border)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {/* Mock safe-to-spend */}
          <div style={{ backgroundColor: 'var(--primary)', padding: '24px 24px 20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Safe to spend today
            </p>
            <p style={{ color: 'white', fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6, fontFamily: 'ui-monospace, monospace' }}>
              $47.20
            </p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              $612 left · 13 days remaining
            </p>
          </div>
          {/* Mock stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 20px', gap: 8, borderBottom: '1px solid var(--border)' }}>
            {[['Income', '$2,400', 'var(--success)'], ['Spent', '$1,788', 'var(--text-primary)'], ['Left', '$612', 'var(--text-primary)']].map(([label, val, color]) => (
              <div key={label}>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 3 }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'ui-monospace, monospace' }}>{val}</p>
              </div>
            ))}
          </div>
          {/* Mock insights */}
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              tracey thinks
            </p>
            {[
              { icon: '↑', text: "You're on track — spending 12% less than last cycle.", color: 'var(--success)' },
              { icon: '!', text: 'Eating out is up $80 this week. Your biggest category.', color: 'var(--warning)' },
            ].map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: ins.color, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                <p style={{ fontSize: 12, color: ins.color, fontWeight: 600, lineHeight: 1.5 }}>{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 860, margin: '0 auto 80px', padding: '0 24px' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 40, letterSpacing: '-0.02em' }}>
          Built different
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              backgroundColor: 'var(--card)', borderRadius: 16,
              border: '1px solid var(--border)', padding: '20px',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: 'var(--primary-light-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                {f.icon}
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{f.title}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section style={{
        maxWidth: 480, margin: '0 auto', padding: '0 24px 80px',
        textAlign: 'center',
      }}>
        <div style={{
          backgroundColor: 'var(--card)', borderRadius: 20,
          border: '1px solid var(--border)', padding: '40px 32px',
        }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>
            Ready to take control?
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
            Free forever. No credit card. Your money stays yours.
          </p>
          <Link href="/register" style={{
            display: 'block', padding: '15px',
            backgroundColor: 'var(--primary)', color: 'white',
            borderRadius: 12, fontWeight: 700, fontSize: 16,
            textDecoration: 'none', boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
          }}>
            Create your account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '40px 24px',
        marginTop: 20,
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 32, marginBottom: 40,
          }}>
            {/* Brand */}
            <div>
              <TraceyLogo size="sm" />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
                Your money, your rules.<br />Private by design.
              </p>
            </div>

            {/* Product */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Product</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { href: '/register', label: 'Get started' },
                  { href: '/login', label: 'Sign in' },
                ].map(l => (
                  <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>{l.label}</Link>
                ))}
              </div>
            </div>

            {/* Features */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Features</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Safe-to-spend', 'Bill tracking', 'Rewards', 'AI insights', 'Savings goals'].map(f => (
                  <span key={f} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f}</span>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Legal</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { href: '/privacy', label: 'Privacy policy' },
                  { href: '/terms', label: 'Terms of use' },
                ].map(l => (
                  <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>{l.label}</Link>
                ))}
              </div>
            </div>
          </div>

          <div style={{
            borderTop: '1px solid var(--border)', paddingTop: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 8,
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              © {new Date().getFullYear()} tracey · v2.0
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.6 }}>
              No subscriptions · No bank connections · No data harvesting
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
