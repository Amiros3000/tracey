'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import TraceyLogo from '@/components/TraceyLogo'
import { today } from '@/lib/utils'

const TOTAL_STEPS = 4
type PayCycle = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

const PAY_CYCLE_OPTIONS: { value: PayCycle; label: string; desc: string }[] = [
  { value: 'weekly',      label: 'Weekly',       desc: 'Every week' },
  { value: 'biweekly',    label: 'Bi-weekly',    desc: 'Every 2 weeks — most common' },
  { value: 'semimonthly', label: 'Semi-monthly', desc: '1st and 15th of each month' },
  { value: 'monthly',     label: 'Monthly',      desc: 'Once a month' },
]

const ACCOUNT_TYPES = [
  { value: 'chequing',    label: 'Chequing' },
  { value: 'savings',     label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan',        label: 'Loan / OSAP' },
  { value: 'investment',  label: 'Investment' },
]

function calcNextPay(lastPayStr: string, cycle: PayCycle): string {
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

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [step, setStep]               = useState(1)
  const [payCycle, setPayCycle]       = useState<PayCycle>('biweekly')
  const [cycleStart, setCycleStart]   = useState(today())
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('chequing')
  const [institution, setInstitution] = useState('')
  const [balance, setBalance]         = useState('')
  const [saving, setSaving]           = useState(false)

  const nextPay = cycleStart ? calcNextPay(cycleStart, payCycle) : '—'

  async function handleFinish() {
    setSaving(true)
    try {
      await Promise.allSettled([
        api.put('/income/settings/pay_cycle', { value: payCycle }),
        api.put('/income/settings/cycle_start_date', { value: cycleStart }),
      ])
      if (accountName.trim()) {
        await api.post('/accounts', {
          name:        accountName.trim(),
          type:        accountType,
          institution: institution.trim() || undefined,
          balance:     parseFloat(balance) || 0,
        })
      }
    } finally {
      localStorage.setItem('onboarding_complete', '1')
      setSaving(false)
      setStep(4)
    }
  }

  const progress = (step / TOTAL_STEPS) * 100

  return (
    <>
      <style>{`
        .ob-outer {
          min-height: 100dvh;
          background-color: var(--bg);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 0 16px 48px;
        }
        .ob-card {
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 768px) {
          .ob-outer {
            align-items: center;
            padding: 48px 24px;
          }
          .ob-card {
            background-color: var(--card);
            border: 1px solid var(--border);
            border-radius: 24px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.08);
            max-width: 520px;
          }
          .ob-body {
            padding: 36px 40px 40px !important;
          }
          .ob-progress {
            padding: 32px 40px 0 !important;
          }
        }
      `}</style>

      <div className="ob-outer">
        <div className="ob-card">

          {/* Progress bar + step dots */}
          <div className="ob-progress" style={{ padding: '24px 24px 0' }}>
            <div style={{ height: 3, backgroundColor: 'var(--surface)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                backgroundColor: 'var(--primary)', transition: 'width 0.35s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {[1, 2, 3, 4].map(n => (
                <div key={n} style={{
                  width: n === step ? 20 : 6, height: 6, borderRadius: 3,
                  backgroundColor: n <= step ? 'var(--primary)' : 'var(--border)',
                  transition: 'all 0.3s ease',
                }} />
              ))}
            </div>
          </div>

          <div className="ob-body" style={{ padding: '28px 24px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* ── Step 1: Welcome ── */}
            {step === 1 && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <TraceyLogo size="md" />
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.2 }}>
                  Welcome{user?.username ? `, ${user.username}` : ''}!
                </h1>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
                  Let&apos;s get tracey set up. Takes less than 2 minutes.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
                  {[
                    {
                      icon: (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--primary)" strokeWidth="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ),
                      title: 'Your data stays yours',
                      desc: 'Stored locally, encrypted at rest. No cloud sync, no third-party access.',
                    },
                    {
                      icon: (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ),
                      title: 'Import from any bank',
                      desc: 'Upload CSV or PDF statements. No account linking required.',
                    },
                    {
                      icon: (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="var(--primary)" strokeWidth="2" />
                          <path d="M12 7v5l3 3" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ),
                      title: 'Know exactly what to spend',
                      desc: 'Safe-to-spend updates daily based on your pay cycle and real expenses.',
                    },
                  ].map(item => (
                    <div key={item.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, backgroundColor: 'var(--primary-light-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn-primary" onClick={() => setStep(2)}>
                  Get started
                </button>
              </div>
            )}

            {/* ── Step 2: Pay cycle ── */}
            {step === 2 && (
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  How often do you get paid?
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
                  This powers your safe-to-spend number on the dashboard.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {PAY_CYCLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPayCycle(opt.value)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        border: `2px solid ${payCycle === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                        backgroundColor: payCycle === opt.value ? 'var(--primary-light-bg)' : 'var(--surface)',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{opt.desc}</div>
                      </div>
                      {payCycle === opt.value && (
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', backgroundColor: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    When did your last paycheck arrive?
                  </label>
                  <input
                    type="date" value={cycleStart}
                    onChange={e => setCycleStart(e.target.value)}
                    style={{ fontFamily: 'ui-monospace, monospace' }}
                  />
                  {cycleStart && (
                    <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 6 }}>
                      Your next pay: {nextPay}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-ghost" style={{ width: 'auto', minWidth: 80 }} onClick={() => setStep(1)}>Back</button>
                  <button className="btn-primary" onClick={() => setStep(3)}>Continue</button>
                </div>
              </div>
            )}

            {/* ── Step 3: Add first account ── */}
            {step === 3 && (
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Add your first account
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
                  Optional — tracey never connects to your bank. You enter balances manually.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {ACCOUNT_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setAccountType(t.value)}
                      style={{
                        padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                        border: `2px solid ${accountType === t.value ? 'var(--primary)' : 'var(--border)'}`,
                        backgroundColor: accountType === t.value ? 'var(--primary-light-bg)' : 'var(--surface)',
                        fontSize: 13, fontWeight: 700,
                        color: accountType === t.value ? 'var(--primary)' : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      Account name
                    </label>
                    <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="e.g. TD Chequing" />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      Institution <span style={{ fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="e.g. TD Bank" />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      Current balance
                    </label>
                    <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" style={{ fontFamily: 'ui-monospace, monospace' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-ghost" style={{ width: 'auto', minWidth: 80 }} onClick={() => setStep(2)}>Back</button>
                  <button className="btn-primary" onClick={handleFinish} disabled={saving}>
                    {saving ? 'Saving…' : accountName.trim() ? 'Add & continue' : 'Skip for now'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Done ── */}
            {step === 4 && (
              <div style={{ textAlign: 'center', paddingTop: 16 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--primary-light-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
                  You&apos;re all set!
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 28, maxWidth: 320, margin: '0 auto 28px' }}>
                  tracey is ready. Want to jump straight in or import your bank transactions?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      localStorage.setItem('onboarding_complete', '1')
                      router.replace('/accounts?import=1')
                    }}
                  >
                    Import a bank statement
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      localStorage.setItem('onboarding_complete', '1')
                      router.replace('/dashboard')
                    }}
                  >
                    Go to dashboard
                  </button>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 20, lineHeight: 1.6 }}>
                  You can import statements anytime from the Accounts page.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
