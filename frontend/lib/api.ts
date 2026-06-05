/**
 * lib/api.ts — Typed fetch wrapper for the tracey backend.
 *
 * All requests automatically attach the Bearer token from localStorage.
 * On 401, it tries to refresh the access token once using the refresh token.
 * If refresh fails, it clears auth state and redirects to /login.
 *
 * Usage:
 *   import { api } from '@/lib/api'
 *   const accounts = await api.get<Account[]>('/accounts')
 *   const expense  = await api.post<Expense>('/expenses', { amount: 10, ... })
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL

if (!BASE_URL) {
  console.warn('NEXT_PUBLIC_API_URL is not set — API calls will fail.')
}

// ─── Token helpers (localStorage, client-side only) ────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem('access_token', accessToken)
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// ─── API error type ────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string | object,
  ) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail))
    this.name = 'ApiError'
  }
}

// ─── Token refresh ─────────────────────────────────────────────────────────

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = typeof window !== 'undefined'
    ? localStorage.getItem('refresh_token')
    : null

  if (!refreshToken) return false

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false

    const { access_token } = await res.json()
    localStorage.setItem('access_token', access_token)
    return true
  } catch {
    return false
  }
}

// ─── Core request function ─────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Token expired — try to refresh once then retry
  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      return request<T>(path, options, true)
    }
    // Refresh failed — clear auth and send to login
    clearTokens()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new ApiError(401, 'Session expired')
  }

  // 204 No Content — return null (typed as T)
  if (res.status === 204) return null as T

  const data = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, data.detail ?? data)
  }

  return data as T
}

// ─── Public API object ─────────────────────────────────────────────────────

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' })
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },
}
