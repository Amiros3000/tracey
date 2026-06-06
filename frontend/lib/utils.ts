/**
 * lib/utils.ts — Shared utility functions.
 */

// ─── Currency formatting ────────────────────────────────────────────────────

/**
 * Format a number as Canadian dollars.
 * Uses monospace-friendly tabular numerals via the mono CSS class in the UI.
 */
export function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a number with a + prefix for positive values (used in net worth deltas).
 */
export function formatDelta(amount: number): string {
  const formatted = formatCAD(Math.abs(amount))
  return amount >= 0 ? `+${formatted}` : `-${formatted}`
}

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().split('T')[0]
}

/** Format a YYYY-MM-DD date as "May 28" */
export function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  })
}

/** Format a YYYY-MM-DD date as "May 28, 2026" */
export function formatDateLong(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Pay cycle calculations ─────────────────────────────────────────────────

type PayCycle = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

/**
 * Given the start of a pay cycle and the cycle type, return the end date
 * (the last day of the cycle, inclusive).
 */
export function getCycleEndDate(startDate: string, cycle: PayCycle): string {
  const start = new Date(startDate + 'T00:00:00')

  let end: Date
  switch (cycle) {
    case 'weekly':
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      break

    case 'biweekly':
      end = new Date(start)
      end.setDate(start.getDate() + 13)
      break

    case 'semimonthly':
      // 1st–15th or 16th–end of month
      if (start.getDate() <= 15) {
        end = new Date(start.getFullYear(), start.getMonth(), 15)
      } else {
        // Last day of the month
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
      }
      break

    case 'monthly':
      end = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1)
      break

    default:
      end = new Date(start)
      end.setDate(start.getDate() + 13) // fallback: biweekly
  }

  return end.toISOString().split('T')[0]
}

/**
 * Calculate how many days remain in the pay cycle from today (inclusive).
 * Returns at least 1 to prevent division by zero in safe-to-spend.
 */
export function daysRemainingInCycle(endDate: string): number {
  const end   = new Date(endDate + 'T00:00:00')
  const now   = new Date()
  now.setHours(0, 0, 0, 0)
  const diff  = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(diff + 1, 1)
}

/**
 * Calculate total days in a pay cycle.
 */
export function totalDaysInCycle(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate + 'T00:00:00')
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Calculate the safe-to-spend daily amount.
 * safe_to_spend = (income - expenses - upcoming_bills - savings_target) / days_remaining
 * Returns 0 if the result would be negative (over budget).
 */
export function calcSafeToSpend(
  income: number,
  expenses: number,
  daysRemaining: number,
  upcomingBills: number = 0,
  savingsTarget: number = 0,
): number {
  const remaining = income - expenses - upcomingBills - savingsTarget
  if (remaining <= 0) return 0
  return remaining / daysRemaining
}

// ─── Loan helpers ───────────────────────────────────────────────────────────

/**
 * Estimate months to pay off a loan given current balance, monthly payment,
 * and annual interest rate.  Returns null for interest-free loans (simple division).
 */
export function monthsToPayoff(
  balance: number,
  monthlyPayment: number,
  annualRate: number,
): number {
  if (monthlyPayment <= 0) return Infinity
  if (annualRate === 0) return Math.ceil(balance / monthlyPayment)

  const r = annualRate / 100 / 12
  // n = -ln(1 - (r * P / payment)) / ln(1 + r)
  const n = -Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r)
  return Math.ceil(n)
}

// ─── Array helpers ──────────────────────────────────────────────────────────

/** Group an array by a key function */
export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

// ─── Account helpers ────────────────────────────────────────────────────────

const LIABILITY_TYPES = new Set(['credit_card', 'loan', 'line_of_credit'])

export function isLiability(accountType: string): boolean {
  return LIABILITY_TYPES.has(accountType)
}

export function accountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    chequing:      'Chequing',
    savings:       'Savings',
    credit_card:   'Credit Card',
    loan:          'Loan',
    line_of_credit:'Line of Credit',
    investment:    'Investment',
    other:         'Other',
  }
  return labels[type] ?? type
}
