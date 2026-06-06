'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import TraceyLogo from './TraceyLogo'

const NAV = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
          fill={active ? 'var(--primary-light-bg)' : 'none'} />
      </svg>
    ),
  },
  {
    href: '/accounts',
    label: 'Accounts',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="8" width="20" height="13" rx="2.5"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <path d="M7 8V6a5 5 0 0 1 10 0v2"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'} strokeWidth="2.2" />
        <line x1="2" y1="13" x2="22" y2="13"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'} strokeWidth="2.2" />
      </svg>
    ),
  },
  {
    href: '/overview',
    label: 'Spending',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="18" height="18" rx="3"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <path d="M8 17V13M12 17V9M16 17V12"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/recurring',
    label: 'Bills',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="18" height="17" rx="2.5"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <path d="M16 2v4M8 2v4M3 10h18"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/rewards',
    label: 'Rewards',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" strokeLinejoin="round"
          fill={active ? 'var(--primary-light-bg)' : 'none'} />
      </svg>
    ),
  },
  {
    href: '/goals',
    label: 'Goals',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <circle cx="12" cy="12" r="4.5"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2" />
        <circle cx="12" cy="12" r="1.5"
          fill={active ? 'var(--primary)' : 'var(--text-secondary)'} />
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="18" height="17" rx="2.5"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" fill={active ? 'var(--primary-light-bg)' : 'none'} />
        <path d="M16 2v4M8 2v4M3 10h18"
          stroke={active ? 'var(--primary)' : 'var(--text-secondary)'}
          strokeWidth="2.2" strokeLinecap="round" />
        <rect x="7" y="14" width="3" height="3" rx="0.5"
          fill={active ? 'var(--primary)' : 'var(--text-secondary)'} />
        <rect x="14" y="14" width="3" height="3" rx="0.5"
          fill={active ? 'var(--primary)' : 'var(--text-secondary)'} />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const router = useRouter()

  function handleLogout() { logout(); router.replace('/login') }

  return (
    <aside className="app-sidebar">
      <div>
        <div style={{ marginBottom: 22 }}>
          <TraceyLogo size="sm" />
        </div>

        <nav>
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link${active ? ' active' : ''}`}>
                {item.icon(active)}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <Link href="/settings" className={`sidebar-link${pathname === '/settings' ? ' active' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3"
              stroke={pathname === '/settings' ? 'var(--primary)' : 'var(--text-secondary)'}
              strokeWidth="2.2" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              stroke={pathname === '/settings' ? 'var(--primary)' : 'var(--text-secondary)'}
              strokeWidth="2" />
          </svg>
          Settings
        </Link>

        <p style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.45, paddingLeft: 10, marginBottom: 6, letterSpacing: '0.04em' }}>v2.0</p>

        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '9px 10px', borderRadius: 8,
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)',
          fontFamily: 'Nunito, sans-serif', marginTop: 1, letterSpacing: '-0.01em',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            backgroundColor: 'var(--primary-light-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0,
          }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{user?.username}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sign out</p>
          </div>
        </button>
      </div>
    </aside>
  )
}
