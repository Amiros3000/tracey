'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCAD } from '@/lib/utils'
import { useTip } from '@/lib/tips'

interface RewardProfile {
  id: number
  account_id: number
  account_name: string
  reward_type: string
  program_name: string
  base_earn_rate: number
  bonus_rates: Record<string, number> | null
  point_value_cents: number
  known_balance: number
  estimated_balance: number
  last_manual_update: string | null
}

interface Summary {
  total_cash_value: number
  cards: { account_name: string; program_name: string; balance: number; cash_value: number; reward_type: string }[]
}

interface Account {
  id: number
  name: string
  type: string
}

export default function RewardsPage() {
  const { visible: tipVisible, dismiss: dismissTip } = useTip('rewards')
  const [profiles, setProfiles]   = useState<RewardProfile[]>([])
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [accounts, setAccounts]   = useState<Account[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [estimating, setEstimating] = useState<number | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [profRes, sumRes, acctRes] = await Promise.allSettled([
      api.get<RewardProfile[]>('/rewards'),
      api.get<Summary>('/rewards/summary'),
      api.get<Account[]>('/accounts'),
    ])
    if (profRes.status === 'fulfilled') setProfiles(profRes.value)
    if (sumRes.status  === 'fulfilled') setSummary(sumRes.value)
    if (acctRes.status === 'fulfilled') setAccounts(acctRes.value)
    setLoading(false)
  }

  async function refreshEstimate(profileId: number) {
    setEstimating(profileId)
    try {
      await api.post(`/rewards/${profileId}/estimate`, {})
      loadAll()
    } catch {}
    setEstimating(null)
  }

  async function deleteProfile(profileId: number) {
    if (!confirm('Remove this rewards profile?')) return
    await api.delete(`/rewards/${profileId}`)
    loadAll()
  }

  const rewardCards = accounts.filter(a => a.type === 'credit_card')
  const linkedIds   = new Set(profiles.map(p => p.account_id))

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--primary-light-bg)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div className="page-content">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Rewards</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: tipVisible ? 12 : 20 }}>Points & cashback across your cards</p>

      {tipVisible && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12, borderLeft: '3px solid var(--primary)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Maximize every dollar you spend</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Link your credit cards and tracey estimates your points/cashback earned based on your spending. Use AI lookup to find the best card for each category.
            </p>
          </div>
          <button onClick={dismissTip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Total value */}
      {summary && summary.total_cash_value > 0 && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)' }}>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Total rewards value
          </p>
          <p className="mono" style={{ color: 'white', fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>
            {formatCAD(summary.total_cash_value)}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            Across {profiles.length} card{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Profiles */}
      {profiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          {profiles.map(profile => {
            const balance  = Math.max(profile.known_balance, profile.estimated_balance)
            const cashVal  = (balance * profile.point_value_cents) / 100
            const isPoints = profile.reward_type === 'points' || profile.reward_type === 'miles'
            return (
              <div key={profile.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{profile.account_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{profile.program_name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                      {formatCAD(cashVal)}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>est. value</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ backgroundColor: 'var(--surface)', borderRadius: 10, padding: '8px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>Balance</p>
                    <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isPoints ? `${Math.round(balance).toLocaleString()} pts` : formatCAD(balance)}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                      {profile.known_balance > profile.estimated_balance ? 'manual' : 'estimated'}
                    </p>
                  </div>
                  <div style={{ backgroundColor: 'var(--surface)', borderRadius: 10, padding: '8px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>Base earn</p>
                    <p className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                      {profile.base_earn_rate}{isPoints ? 'x' : '%'}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>per $1 spent</p>
                  </div>
                </div>

                {/* Bonus rates */}
                {profile.bonus_rates && Object.keys(profile.bonus_rates).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>Category bonuses</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(profile.bonus_rates).map(([cat, rate]) => (
                        <span key={cat} style={{ fontSize: 12, backgroundColor: 'var(--primary-light-bg)', color: 'var(--primary)', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>
                          {cat.split(' ')[0]} {rate}{isPoints ? 'x' : '%'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => refreshEstimate(profile.id)}
                    disabled={estimating === profile.id}
                    style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700, padding: 0 }}
                  >
                    {estimating === profile.id ? 'Recalculating…' : '↻ Refresh estimate'}
                  </button>
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', padding: 0, marginLeft: 'auto' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {profiles.length === 0 && rewardCards.length > 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0 20px' }}>
          <p style={{ fontSize: 28, marginBottom: 10 }}>💳</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 4 }}>No rewards profiles yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Add a profile for your credit cards to track points and cashback.</p>
        </div>
      )}

      {profiles.length === 0 && rewardCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0 20px' }}>
          <p style={{ fontSize: 28, marginBottom: 10 }}>💳</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Add a credit card in Accounts first, then set up its rewards profile here.</p>
        </div>
      )}

      <button className="btn-primary" onClick={() => setShowAdd(true)} disabled={rewardCards.length === 0} style={{ marginBottom: 24, opacity: rewardCards.length === 0 ? 0.5 : 1 }}>
        + Add rewards profile
      </button>

      {showAdd && (
        <AddRewardModal
          cards={rewardCards.filter(c => !linkedIds.has(c.id))}
          onClose={() => { setShowAdd(false); loadAll() }}
        />
      )}
    </div>
  )
}

function AddRewardModal({ cards, onClose }: { cards: Account[]; onClose: () => void }) {
  const [accountId, setAccountId] = useState<number | ''>(cards[0]?.id || '')
  const [programName, setProg]    = useState('')
  const [rewardType, setType]     = useState('points')
  const [baseRate, setBaseRate]   = useState('1')
  const [bonusRates, setBonusRates] = useState('')
  const [pointValue, setPointValue] = useState('1')
  const [knownBal, setKnownBal]   = useState('0')
  const [looking, setLooking]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [lookupName, setLookupName] = useState('')

  async function lookupProduct() {
    if (!lookupName.trim()) return
    setLooking(true)
    try {
      const result = await api.post<any>('/ai/lookup', { product_name: lookupName, product_type: 'credit_card' })
      if (result.program_name) setProg(result.program_name)
      if (result.reward_type)  setType(result.reward_type)
      if (result.base_earn_rate != null) setBaseRate(String(result.base_earn_rate))
      if (result.bonus_rates)  setBonusRates(JSON.stringify(result.bonus_rates, null, 2))
    } catch {
      setError('Lookup failed')
    }
    setLooking(false)
  }

  async function handleSave() {
    if (!accountId || !programName.trim()) { setError('Select a card and enter program name'); return }
    let parsedBonus: Record<string, number> | null = null
    if (bonusRates.trim()) {
      try { parsedBonus = JSON.parse(bonusRates) } catch { setError('Invalid bonus rates JSON'); return }
    }
    setSaving(true)
    try {
      await api.post('/rewards', {
        account_id: accountId, program_name: programName.trim(),
        reward_type: rewardType, base_earn_rate: parseFloat(baseRate) || 1,
        bonus_rates: parsedBonus, point_value_cents: parseFloat(pointValue) || 1,
        known_balance: parseFloat(knownBal) || 0,
      })
      onClose()
    } catch {
      setError('Failed to save')
    }
    setSaving(false)
  }

  if (cards.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
        onClick={onClose}>
        <div style={{ backgroundColor: 'var(--card)', borderRadius: 20, padding: 28, maxWidth: 320, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>All cards already have profiles</p>
          <button className="btn-primary" onClick={onClose} style={{ fontSize: 14 }}>OK</button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet" style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Add rewards profile</h3>

        {/* AI lookup */}
        <div style={{ backgroundColor: 'var(--primary-light-bg)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>✨ Look up with AI</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={lookupName} onChange={e => setLookupName(e.target.value)} placeholder="e.g. Scotiabank Gold Amex" style={{ flex: 1, fontSize: 14 }} />
            <button onClick={lookupProduct} disabled={looking || !lookupName.trim()}
              style={{ padding: '10px 14px', borderRadius: 10, border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', whiteSpace: 'nowrap' }}>
              {looking ? '…' : 'Look up'}
            </button>
          </div>
        </div>

        <select value={accountId} onChange={e => setAccountId(Number(e.target.value))}>
          <option value="">Select card</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <input type="text" value={programName} onChange={e => setProg(e.target.value)} placeholder="Program name (e.g. Scene+, Aeroplan)" />

        <select value={rewardType} onChange={e => setType(e.target.value)}>
          {['points','cashback','miles','hybrid'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Base earn rate</label>
            <input type="number" step="0.1" value={baseRate} onChange={e => setBaseRate(e.target.value)} placeholder="1.0" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Point value (¢)</label>
            <input type="number" step="0.01" value={pointValue} onChange={e => setPointValue(e.target.value)} placeholder="1.0" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Category bonus rates (JSON) — optional
          </label>
          <textarea value={bonusRates} onChange={e => setBonusRates(e.target.value)}
            placeholder={'{"🛒 Groceries": 3, "🍔 Eating Out": 2}'}
            rows={3}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical' }} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Current balance (optional)</label>
          <input type="number" value={knownBal} onChange={e => setKnownBal(e.target.value)} placeholder="0" style={{ fontFamily: 'ui-monospace, monospace' }} />
        </div>

        {error && <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add profile'}</button>
        </div>
      </div>
    </div>
  )
}
