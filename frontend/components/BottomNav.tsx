'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          fill={active ? 'var(--primary-light-bg)' : 'none'} />
      </svg>
    ),
  },
  {
    href: '/accounts',
    label: 'Accounts',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="8" width="20" height="13" rx="2.5"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <path d="M7 8V6a5 5 0 0 1 10 0v2"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'} strokeWidth="2" />
        <line x1="2" y1="13" x2="22" y2="13"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'} strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: '/overview',
    label: 'Spending',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <path d="M8 17V13M12 17V9M16 17V12"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/recurring',
    label: 'Bills',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="2.5"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <path d="M16 2v4M8 2v4M3 10h18"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/rewards',
    label: 'Rewards',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" strokeLinejoin="round"
          fill={active ? 'var(--primary-light-bg)' : 'none'} />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{
      backgroundColor: 'var(--card)',
      borderTop: '1px solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div className="flex items-center justify-around max-w-lg mx-auto px-1">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center py-2 px-2" style={{ minWidth: 44, minHeight: 52 }}>
              {item.icon(active)}
              <span style={{ fontSize: 10, marginTop: 2, fontWeight: active ? 700 : 600, color: active ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
