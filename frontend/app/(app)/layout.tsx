'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'
import Sidebar from '@/components/Sidebar'
import FAB from '@/components/FAB'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--primary-light-bg)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--bg)' }}>
      {/* Desktop sidebar — CSS hides it below 768px */}
      <Sidebar />

      {/* Main content area — CSS sets margin-left on desktop, padding-bottom on mobile */}
      <main className="app-main">
        {children}
      </main>

      <FAB />

      {/* Bottom nav — CSS class hides it on desktop (≥768px) */}
      <div className="bottom-nav-hide">
        <BottomNav />
      </div>
    </div>
  )
}
