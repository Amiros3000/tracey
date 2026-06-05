'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { formatCAD, accountTypeLabel, isLiability, groupBy, today } from '@/lib/utils'
import { useTip } from '@/lib/tips'
import Papa from 'papaparse'

interface Account {
  id: number
  name: string
  type: string
  institution: string | null
  balance: number
  currency: string
  credit_limit: number | null
  purchase_apr: number | null
  minimum_payment: number | null
  interest_rate: number | null
  monthly_payment: number | null
  loan_type: string | null
  is_government_loan: boolean
  is_active: boolean
}

interface NetWorth {
  total_assets: number
  total_liabilities: number
  net_worth: number
}

interface DetectedAccount {
  institution: string
  name: string
  type: string
  last_four: string | null
  balance: number | null
}

interface ExistingAccount {
  id: number
  name: string
  type: string
  institution: string | null
  balance: number
}

const TYPE_ORDER = ['chequing', 'savings', 'credit_card', 'loan', 'line_of_credit', 'investment', 'other']
const TYPE_ICONS: Record<string, string> = {
  chequing: '🏦', savings: '💰', credit_card: '💳',
  loan: '🎓', line_of_credit: '📋', investment: '📈', other: '📁',
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '🛒 Groceries':        ['loblaws','metro','sobeys','foodbasics','freshco','farm boy','grocery','supermarket','costco','walmart'],
  '🍔 Eating Out':       ['mcdonalds','tim hortons','subway','pizza','restaurant','burger','sushi','thai','uber eats','doordash','skip'],
  '☕ Coffee':           ['starbucks','second cup','coffee','cafe','tim horton'],
  '🚗 Transportation':   ['uber','lyft','transit','ttc','go train','gas','shell','petro','esso','parking','407'],
  '🎮 Entertainment':    ['netflix','spotify','apple','steam','cinema','theatre','amazon prime','disney'],
  '📱 Subscriptions':    ['rogers','bell','telus','fido','virgin','koodo','subscription'],
  '🏥 Health':           ['pharmacy','shoppers','rexall','drugstore','clinic','dental','optometrist'],
  '🛍️ Shopping':         ['amazon','best buy','the bay','winners','homesense','ikea','h&m','zara','uniqlo'],
  '💳 Loan Payment':     ['osap','student loan','line of credit','loan payment'],
  '🏦 Savings Transfer': ['transfer','savings','tfsa','rrsp','investment'],
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  chequing: 'Chequing', savings: 'Savings', credit_card: 'Credit Card',
  loan: 'Loan', line_of_credit: 'Line of Credit', investment: 'Investment', other: 'Other',
}

function guessCategory(description: string): string {
  const lower = description.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cat
  }
  return '📦 Other'
}

function AccountsPageInner() {
  const searchParams = useSearchParams()
  const { visible: tipVisible, dismiss: dismissTip } = useTip('accounts')

  const [accounts, setAccounts]     = useState<Account[]>([])
  const [netWorth, setNetWorth]     = useState<NetWorth | null>(null)
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [showImport, setShowImport] = useState(searchParams.get('import') === '1')
  const [editId, setEditId]         = useState<number | null>(null)
  const [newBalance, setNewBalance] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [acctsResult, nwResult] = await Promise.allSettled([
      api.get<Account[]>('/accounts'),
      api.get<NetWorth>('/accounts/net-worth'),
    ])
    if (acctsResult.status === 'fulfilled') setAccounts(acctsResult.value)
    if (nwResult.status === 'fulfilled') setNetWorth(nwResult.value)
    setLoading(false)
  }

  async function updateBalance(accountId: number) {
    const b = parseFloat(newBalance)
    if (isNaN(b)) return
    try {
      await api.patch(`/accounts/${accountId}/balance`, { balance: b })
      setEditId(null); setNewBalance('')
      loadData()
    } catch (err) { console.error(err) }
  }

  const grouped = groupBy(accounts, a => a.type)
  const sortedTypes = TYPE_ORDER.filter(t => grouped[t]?.length > 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="page-content">

      {/* First-time tip */}
      {tipVisible && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12, borderLeft: '3px solid var(--primary)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Your accounts, your way</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Add your bank accounts, credit cards, and loans to track your net worth. Use <strong>Import</strong> to pull in transactions from a CSV or PDF statement.
            </p>
          </div>
          <button onClick={dismissTip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Accounts</h1>
        <button
          onClick={() => setShowImport(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            border: '1.5px solid var(--border)', backgroundColor: 'var(--card)',
            fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Import
        </button>
      </div>

      {/* Net worth */}
      {netWorth && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-pressed) 100%)' }}>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Net Worth
          </p>
          <p className="mono" style={{ color: 'white', fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 12 }}>
            {formatCAD(netWorth.net_worth)}
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Total assets</p>
              <p className="mono" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 700 }}>{formatCAD(netWorth.total_assets)}</p>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Total liabilities</p>
              <p className="mono" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 700 }}>{formatCAD(netWorth.total_liabilities)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedTypes.length === 0 && (
        <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'var(--primary-light-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="8" width="20" height="13" rx="2.5" stroke="var(--primary)" strokeWidth="2" />
              <path d="M7 8V6a5 5 0 0 1 10 0v2" stroke="var(--primary)" strokeWidth="2" />
              <line x1="2" y1="13" x2="22" y2="13" stroke="var(--primary)" strokeWidth="2" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No accounts yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Add your chequing, savings, or credit cards to track your net worth.
          </p>
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ fontSize: 14 }}>
            Add your first account
          </button>
        </div>
      )}

      {/* Accounts by type */}
      {sortedTypes.map(type => (
        <div key={type} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            {TYPE_ICONS[type]} {accountTypeLabel(type)}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grouped[type].map(account => (
              <div key={account.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{account.name}</p>
                    {account.institution && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{account.institution}</p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: isLiability(account.type) ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {formatCAD(account.balance)}
                    </p>
                    {isLiability(account.type) && (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>owed</p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  {account.credit_limit && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Limit: <span className="mono">{formatCAD(account.credit_limit)}</span>
                    </span>
                  )}
                  {account.purchase_apr && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      APR: <span className="mono">{account.purchase_apr}%</span>
                    </span>
                  )}
                  {account.interest_rate !== null && account.interest_rate !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Rate: <span className="mono">{account.interest_rate}%</span>
                    </span>
                  )}
                  {account.monthly_payment && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Payment: <span className="mono">{formatCAD(account.monthly_payment)}/mo</span>
                    </span>
                  )}
                </div>

                {editId === account.id ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                      type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)}
                      placeholder="New balance" autoFocus
                      style={{ flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 14 }}
                    />
                    <button
                      onClick={() => updateBalance(account.id)}
                      style={{ padding: '8px 14px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 13 }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditId(null); setNewBalance('') }}
                      style={{ padding: '8px 10px', backgroundColor: 'var(--surface)', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: 13, color: 'var(--text-secondary)' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditId(account.id); setNewBalance(String(account.balance)) }}
                    style={{ marginTop: 10, fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700, padding: 0 }}
                  >
                    Update balance
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ marginBottom: 24 }}>
        + Add account
      </button>

      {showAdd    && <AddAccountModal onClose={() => { setShowAdd(false); loadData() }} />}
      {showImport && <ImportSheet    onClose={() => { setShowImport(false); loadData() }} />}
    </div>
  )
}

export default function AccountsPage() {
  return <Suspense><AccountsPageInner /></Suspense>
}

// ---------------------------------------------------------------------------

function ImportSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px 20px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Import statement</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, lineHeight: 1, padding: '0 4px', fontFamily: 'Nunito, sans-serif' }}
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <CSVImport onDone={onClose} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const [name, setName]         = useState('')
  const [type, setType]         = useState('chequing')
  const [institution, setInst]  = useState('')
  const [balance, setBalance]   = useState('')
  const [saving, setSaving]     = useState(false)

  const TYPES = ['chequing','savings','credit_card','loan','line_of_credit','investment','other']

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/accounts', {
        name: name.trim(), type,
        institution: institution.trim() || undefined,
        balance: parseFloat(balance) || 0,
      })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Add account</h3>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              padding: '6px 12px', borderRadius: 16,
              border: `2px solid ${type === t ? 'var(--primary)' : 'var(--border)'}`,
              backgroundColor: type === t ? 'var(--primary-light-bg)' : 'var(--surface)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              color: type === t ? 'var(--primary)' : 'var(--text-secondary)',
              fontFamily: 'Nunito, sans-serif', transition: 'all 0.15s',
            }}>
              {accountTypeLabel(t)}
            </button>
          ))}
        </div>

        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Account name" autoFocus />
        <input type="text" value={institution} onChange={e => setInst(e.target.value)} placeholder="Institution (optional)" />
        <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="Current balance" style={{ fontFamily: 'ui-monospace, monospace' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Add account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CSVImport({ onDone }: { onDone?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [dateCol, setDateCol] = useState('')
  const [descCol, setDescCol] = useState('')
  const [amtCol, setAmtCol]   = useState('')

  const [rows, setRows]               = useState<{ date: string; note: string; amount: string; category: string }[]>([])
  const [importing, setImporting]     = useState(false)
  const [parsing, setParsing]         = useState(false)
  const [done, setDone]               = useState(0)
  const [step, setStep]               = useState<'upload' | 'account' | 'map' | 'review' | 'done'>('upload')
  const [fileType, setFileType]       = useState<'csv' | 'pdf' | null>(null)

  const [detectedAccount, setDetectedAccount]     = useState<DetectedAccount | null>(null)
  const [existingAccounts, setExistingAccounts]   = useState<ExistingAccount[]>([])
  const [accountAction, setAccountAction]         = useState<'link' | 'create' | 'skip'>('create')
  const [linkedAccountId, setLinkedAccountId]     = useState<number | null>(null)
  const [newAcctName, setNewAcctName]             = useState('')
  const [newAcctType, setNewAcctType]             = useState('chequing')
  const [newAcctBalance, setNewAcctBalance]       = useState('')
  const [creatingAccount, setCreatingAccount]     = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)

  function reset() {
    setStep('upload'); setRows([]); setHeaders([])
    setFileType(null); setDetectedAccount(null); setLinkedAccountId(null)
    setAccountAction('create'); setSelectedAccountId(null)
    setNewAcctName(''); setNewAcctBalance('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.pdf')) { setFileType('pdf'); handlePDF(file) }
    else { setFileType('csv'); handleCSV(file) }
  }

  async function handlePDF(file: File) {
    setParsing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/expenses/parse-pdf`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.detail || 'Failed to parse PDF'); return
      }
      const data = await res.json()
      const mapped = (data.transactions as { date: string; note: string; amount: number }[])
        .filter(t => t.amount > 0)
        .map(t => ({ date: t.date, note: t.note, amount: String(t.amount), category: guessCategory(t.note) }))
      setRows(mapped)

      if (data.account) {
        setDetectedAccount(data.account)
        setNewAcctName(data.account.name || data.account.institution || '')
        setNewAcctType(data.account.type || 'chequing')
        setNewAcctBalance(data.account.balance != null ? String(data.account.balance) : '')
        const accts = await api.get<ExistingAccount[]>('/accounts').catch(() => [])
        setExistingAccounts(accts)
        const match = accts.find(a =>
          a.institution?.toLowerCase().includes(data.account.institution?.toLowerCase() || '') ||
          a.name.toLowerCase().includes(data.account.institution?.toLowerCase() || '')
        )
        if (match) { setAccountAction('link'); setSelectedAccountId(match.id) }
        else { setAccountAction('create') }
        setStep('account')
      } else {
        setStep('review')
      }
    } catch {
      alert('Failed to parse PDF — make sure the backend is running')
    } finally {
      setParsing(false)
    }
  }

  async function confirmAccount() {
    let accountId: number | null = null
    if (accountAction === 'link' && selectedAccountId) {
      accountId = selectedAccountId
    } else if (accountAction === 'create') {
      if (!newAcctName.trim()) { alert('Account name is required'); return }
      setCreatingAccount(true)
      try {
        const created = await api.post<{ id: number }>('/accounts', {
          name: newAcctName.trim(), type: newAcctType,
          institution: detectedAccount?.institution || undefined,
          balance: parseFloat(newAcctBalance) || 0,
        })
        accountId = created.id
      } catch {
        alert('Failed to create account'); setCreatingAccount(false); return
      }
      setCreatingAccount(false)
    }
    setLinkedAccountId(accountId)
    setStep('review')
  }

  function handleCSV(file: File) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const hdrs = result.meta.fields || []
        setHeaders(hdrs)
        setDateCol(hdrs.find(h => /date/i.test(h)) || hdrs[0] || '')
        setDescCol(hdrs.find(h => /desc|memo|narr/i.test(h)) || hdrs[1] || '')
        setAmtCol(hdrs.find(h => /amount|debit|credit/i.test(h)) || hdrs[2] || '')
        setStep('map')
      },
    })
  }

  function buildCSVRows() {
    Papa.parse(fileRef.current!.files![0], {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const mapped = (result.data as any[]).map(row => {
          const rawAmt = String(row[amtCol] || '0').replace(/[$,]/g, '')
          const amt = Math.abs(parseFloat(rawAmt) || 0)
          const desc = String(row[descCol] || '')
          return { date: String(row[dateCol] || today()).slice(0, 10), note: desc, amount: String(amt), category: guessCategory(desc) }
        }).filter(r => parseFloat(r.amount) > 0)
        setRows(mapped); setStep('review')
      },
    })
  }

  async function importAll() {
    setImporting(true)
    try {
      const res = await api.post<{ created: number }>('/expenses/batch', {
        expenses: rows.map(r => ({
          amount: parseFloat(r.amount), category: r.category,
          note: r.note || undefined, date: r.date,
          account_id: linkedAccountId || undefined,
        })),
      })
      setDone(res.created); setStep('done')
    } catch {
      alert('Import failed')
    }
    setImporting(false)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Upload a CSV or PDF bank statement. Works with any Canadian bank.
      </p>

      {step === 'upload' && (
        <div>
          <input ref={fileRef} type="file" accept=".csv,.pdf" onChange={handleFile} style={{ display: 'none' }} />
          {parsing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Reading statement with AI…</p>
            </div>
          ) : (
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} style={{ fontSize: 14 }}>
              Choose file
            </button>
          )}
        </div>
      )}

      {step === 'account' && detectedAccount && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ backgroundColor: 'var(--primary-light-bg)', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Statement detected
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {detectedAccount.institution}{detectedAccount.last_four ? ` ···${detectedAccount.last_four}` : ''}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {ACCOUNT_TYPE_LABELS[detectedAccount.type] || detectedAccount.type}
              {detectedAccount.balance != null ? ` · Balance: $${detectedAccount.balance.toFixed(2)}` : ''}
            </p>
          </div>

          <div style={{ display: 'flex', backgroundColor: 'var(--surface)', borderRadius: 10, padding: 3 }}>
            {(['create', 'link', 'skip'] as const).map(val => (
              <button key={val} onClick={() => setAccountAction(val)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12,
                backgroundColor: accountAction === val ? 'var(--card)' : 'transparent',
                color: accountAction === val ? 'var(--primary)' : 'var(--text-secondary)',
              }}>
                {val === 'create' ? 'Create account' : val === 'link' ? 'Link existing' : 'Skip'}
              </button>
            ))}
          </div>

          {accountAction === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={newAcctName} onChange={e => setNewAcctName(e.target.value)} placeholder="Account name" style={{ fontSize: 14 }} />
              <select value={newAcctType} onChange={e => setNewAcctType(e.target.value)} style={{ fontSize: 14 }}>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="number" value={newAcctBalance} onChange={e => setNewAcctBalance(e.target.value)}
                placeholder="Current balance" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Balance pre-filled from statement — verify it matches your actual balance.
              </p>
            </div>
          )}

          {accountAction === 'link' && (
            existingAccounts.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No accounts yet — use "Create account" instead.</p>
              : <select value={selectedAccountId ?? ''} onChange={e => setSelectedAccountId(Number(e.target.value))} style={{ fontSize: 14 }}>
                  <option value="">Select account…</option>
                  {existingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({ACCOUNT_TYPE_LABELS[a.type] || a.type})</option>)}
                </select>
          )}

          {accountAction === 'skip' && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Transactions will be imported without linking to an account.</p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 14 }}>Back</button>
            <button className="btn-primary" onClick={confirmAccount} disabled={creatingAccount} style={{ fontSize: 14 }}>
              {creatingAccount ? 'Creating…' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {step === 'map' && fileType === 'csv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Map your CSV columns:</p>
          {[
            { label: 'Date column', value: dateCol, set: setDateCol },
            { label: 'Description column', value: descCol, set: setDescCol },
            { label: 'Amount column', value: amtCol, set: setAmtCol },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
              <select value={value} onChange={e => set(e.target.value)}>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 14 }}>Back</button>
            <button className="btn-primary" onClick={buildCSVRows} style={{ fontSize: 14 }}>Preview →</button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {rows.length} transactions found. Categories auto-detected — editable after import.
          </p>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
            {rows.slice(0, 20).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>{r.date}</span>
                  {' · '}
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.note.slice(0, 28)}</span>
                </div>
                <span className="mono" style={{ fontWeight: 700 }}>${parseFloat(r.amount).toFixed(2)}</span>
              </div>
            ))}
            {rows.length > 20 && <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0' }}>+{rows.length - 20} more</p>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 14 }}>Back</button>
            <button className="btn-primary" onClick={importAll} disabled={importing} style={{ fontSize: 14 }}>
              {importing ? 'Importing…' : `Import ${rows.length} transactions`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'var(--primary-light-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Imported {done} transactions</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>They'll appear in Spending now.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 14 }}>Import another</button>
            {onDone && <button className="btn-primary" onClick={onDone} style={{ fontSize: 14 }}>Done</button>}
          </div>
        </div>
      )}
    </div>
  )
}
