import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api/endpoints'
import {
  clearAuth,
  extractError,
  getStoredUser,
  getToken,
  setAuth,
} from '../api/client'
import type { User, UserRole } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (data: {
    email: string
    password: string
    full_name: string
    phone?: string
    role: UserRole
  }) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>())
  const [token, setToken] = useState<string | null>(() => getToken())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getToken()
    if (!stored) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then((res) => {
        setUser(res.data)
        setToken(stored)
        localStorage.setItem('logistics_user', JSON.stringify(res.data))
      })
      .catch(() => {
        clearAuth()
        setUser(null)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.login({ email, password })
      setAuth(res.data.access_token, res.data.user)
      setUser(res.data.user)
      setToken(res.data.access_token)
      return res.data.user
    } catch (err) {
      throw new Error(extractError(err))
    }
  }, [])

  const register = useCallback(
    async (data: {
      email: string
      password: string
      full_name: string
      phone?: string
      role: UserRole
    }) => {
      try {
        const res = await authApi.register({
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          phone: data.phone || null,
          role: data.role,
        })
        return res.data
      } catch (err) {
        throw new Error(extractError(err))
      }
    },
    [],
  )

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
    setToken(null)
    window.location.href = '/login'
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
