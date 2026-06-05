interface TraceyLogoProps {
  size?: 'sm' | 'md' | 'lg'
  wordmark?: boolean
  className?: string
}

const SIZES = {
  sm: { icon: 28, text: 17 },
  md: { icon: 44, text: 26 },
  lg: { icon: 68, text: 40 },
}

export default function TraceyLogo({ size = 'md', wordmark = true, className = '' }: TraceyLogoProps) {
  const { icon, text } = SIZES[size]
  const rx = Math.round(icon * 0.22)

  return (
    <div className={`flex items-center ${className}`} style={{ gap: Math.round(icon * 0.18) }}>
      <svg width={icon} height={icon} viewBox="0 0 40 40" fill="none" aria-hidden style={{ flexShrink: 0 }}>
        <rect width="40" height="40" rx={rx * (40 / icon)} style={{ fill: 'var(--primary)' }} />
        <line x1="8" y1="13" x2="32" y2="13" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <circle cx="8"  cy="13" r="2.5" fill="white" />
        <circle cx="32" cy="13" r="2.5" fill="white" />
        <line x1="20" y1="13" x2="20" y2="31" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </svg>

      {wordmark && (
        <span style={{ fontSize: text, fontFamily: 'Nunito, sans-serif', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }} aria-label="tracey">
          <span style={{ color: 'var(--text-primary)' }}>trace</span>
          <span style={{ color: 'var(--primary)' }}>y</span>
        </span>
      )}
    </div>
  )
}
