import axios from 'axios'

/**
 * Backend base URL.
 * - Empty string (default in .env) → relative URLs → Vite proxy → API (no CORS)
 * - Or set VITE_API_BASE_URL=http://127.0.0.1:8000 for direct calls
 */
const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
export const BASE_URL = rawBase.replace(/\/$/, '')

export const TOKEN_KEY = 'logistics_token'
export const USER_KEY = 'logistics_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setAuth(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const api = axios.create({
  baseURL: BASE_URL || '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      clearAuth()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    // Browser blocked the request, server down, or wrong URL
    if (!err.response) {
      const url = err.config?.baseURL
        ? `${err.config.baseURL}${err.config.url ?? ''}`
        : err.config?.url
      return `Network error — cannot reach API (${url || 'unknown'}). Is the backend running on port 8000?`
    }
    const detail = err.response.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((d) => (typeof d === 'string' ? d : d?.msg || JSON.stringify(d)))
        .join('; ')
    }
    if (detail && typeof detail === 'object') {
      return JSON.stringify(detail)
    }
    return err.message || 'Request failed'
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}
