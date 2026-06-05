/**
 * Loans page — loan and line-of-credit accounts with payoff analysis.
 *
 * Shows for each loan:
 *   - Balance, interest rate, monthly payment
 *   - Estimated months to payoff
 *   - OSAP-specific notes for government loans
 *
 * Total debt and monthly obligation summary at the top.
 */

'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCAD, monthsToPayoff } from '@/lib/utils'

interface Account {
  id: number
  name: string
  type: string
  institution: string | null
  balance: number
  interest_rate: number | null
  interest_type: string | null
  monthly_payment: number | null
  loan_type: string | null
  is_government_loan: boolean
  repayment_plan: string | null
  payment_day: number | null
}

export default function LoansPage() {
  const [loans, setLoans]   = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Account[]>('/accounts')
      .then(accounts => setLoans(accounts.filter(a => a.type === 'loan' || a.type === 'line_of_credit')))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalDebt = loans.reduce((sum, l) => sum + l.balance, 0)
  const totalMonthly = loans.reduce((sum, l) => sum + (l.monthly_payment || 0), 0)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--primary-light-bg)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div className="page-content">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Loans & Debt</h1>

      {/* Total debt summary */}
      {loans.length > 0 && (
        <div className="card" style={{ marginBottom: 20, backgroundColor: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total debt</p>
              <p className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>{formatCAD(totalDebt)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Monthly payments</p>
              <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCAD(totalMonthly)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Individual loans */}
      {loans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🎉</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>No loans tracked yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Add a loan in the Accounts tab.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loans.map(loan => {
            const months = loan.monthly_payment && loan.balance > 0
              ? monthsToPayoff(loan.balance, loan.monthly_payment, loan.interest_rate || 0)
              : null

            const isOSAP = loan.is_government_loan || loan.loan_type === 'student'
            const isFederalInterestFree = isOSAP && loan.interest_type === 'interest_free'

            return (
              <div key={loan.id} className="card">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{loan.name}</p>
                      {isOSAP && (
                        <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: 'var(--primary-light-bg)', color: 'var(--primary)', borderRadius: 6, padding: '2px 6px' }}>
                          OSAP
                        </span>
                      )}
                    </div>
                    {loan.institution && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{loan.institution}</p>
                    )}
                  </div>
                  <p className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>
                    {formatCAD(loan.balance)}
                  </p>
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ backgroundColor: 'var(--surface)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>Interest rate</p>
                    {isFederalInterestFree ? (
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>0% (interest-free)</p>
                    ) : (
                      <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {loan.interest_rate ?? 'N/A'}%
                        {loan.interest_type === 'variable' && <span style={{ fontSize: 11, color: 'var(--warning)' }}> variable</span>}
                      </p>
                    )}
                  </div>
                  <div style={{ backgroundColor: 'var(--surface)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>Monthly payment</p>
                    <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {loan.monthly_payment ? formatCAD(loan.monthly_payment) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Payoff estimate */}
                {months !== null && isFinite(months) && (
                  <div style={{ backgroundColor: 'var(--primary-light-bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                    <p style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
                      ~{months < 12
                        ? `${months} month${months !== 1 ? 's' : ''} to payoff`
                        : `${Math.floor(months / 12)}y ${months % 12}m to payoff`}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }} className="estimated-label">
                      Estimated · verify with lender
                    </p>
                  </div>
                )}

                {/* OSAP note */}
                {isOSAP && (
                  <div style={{ backgroundColor: 'var(--surface)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      💡 <strong>OSAP:</strong> Federal portion interest-free since 2023.{' '}
                      {loan.interest_type === 'variable' && 'Ontario portion has a variable rate. '}
                      Manage repayment at <strong>nslsc.canada.ca</strong>
                      {loan.repayment_plan && ` · Plan: ${loan.repayment_plan}`}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
