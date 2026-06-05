/**
 * lib/auth.tsx — Authentication context for the entire app.
 *
 * Wraps the app in AuthProvider (in app/layout.tsx).
 * On mount, checks localStorage for an existing token and fetches /auth/me
 * to verify it's still valid.  If it is, the user is restored without re-login.
 *
 * Usage in any client component:
 *   const { user, login, logout, isAuthenticated } = useAuth()
 */

'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { api, setTokens, clearTokens } from '@/lib/api'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface User {
  id: number
  username: string
  email: string | null
  email_verified: boolean
  privacy_level: 'simple' | 'smart' | 'full'
  created_at: string
  last_login: string | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  pinLogin: (pin: string) => Promise<void>
  logout: () => void
}

// ─── Context ───────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)

  // Restore session from localStorage on first render.
  // This runs client-side only — localStorage is not available on the server.
  useEffect(() => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null

    if (!token) {
      setLoading(false)
      return
    }

    api.get<User>('/auth/me')
      .then(setUser)
      .catch((err) => {
        // Only clear tokens if auth actually failed — server errors (5xx)
        // shouldn't log the user out
        if (!err?.status || err.status === 401 || err.status === 403) {
          clearTokens()
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ access_token: string; refresh_token: string }>(
      '/auth/login',
      { username, password },
    )
    setTokens(res.access_token, res.refresh_token)
    const me = await api.get<User>('/auth/me')
    setUser(me)
  }, [])

  const pinLogin = useCallback(async (pin: string) => {
    const res = await api.post<{ access_token: string }>(
      '/auth/pin-login',
      { pin },
    )
    setTokens(res.access_token)
    const me = await api.get<User>('/auth/me')
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        pinLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
