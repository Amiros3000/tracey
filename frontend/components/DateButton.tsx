'use client'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  min?: string
  max?: string
}

export default function DateButton({ value, onChange, placeholder = 'Pick date', min, max }: Props) {
  const label = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-CA', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : placeholder

  return (
    <div style={{ position: 'relative' }}>
      {/* Visual layer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'var(--surface)', borderRadius: 10, padding: '10px 14px',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 14, fontWeight: 600,
          color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: 'ui-monospace, monospace',
        }}>
          {label}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="17" rx="2.5" stroke="var(--text-secondary)" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {/* Full-size transparent input sits on top — works on iOS Safari + all browsers */}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          opacity: 0, cursor: 'pointer',
        }}
      />
    </div>
  )
}
