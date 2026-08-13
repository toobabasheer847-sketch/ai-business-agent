import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { authApi } from '@/features/auth/api/auth.api'
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  setAccessToken,
  setStoredUser,
} from '@/features/auth/lib/token-storage'
import type {
  AuthUserSummary,
  LoginRequest,
  RegisterRequest,
} from '@/features/auth/types/auth.types'

type AuthContextValue = {
  user: AuthUserSummary | null
  token: string | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  login: (payload: LoginRequest) => Promise<void>
  register: (payload: RegisterRequest) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUserSummary | null>(() => getStoredUser())
  const [token, setToken] = useState<string | null>(() => getAccessToken())
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setToken(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const refreshMe = useCallback(async () => {
    const me = await authApi.me()
    const summary: AuthUserSummary = {
      id: me.userId,
      tenantId: me.tenantId,
      name: me.name,
      email: me.email,
      isActive: true,
    }
    setStoredUser(summary)
    setUser(summary)
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      const existing = getAccessToken()
      if (!existing) {
        setIsBootstrapping(false)
        return
      }

      try {
        await refreshMe()
      } catch {
        clearSession()
        setUser(null)
        setToken(null)
      } finally {
        setIsBootstrapping(false)
      }
    }

    void bootstrap()
  }, [refreshMe])

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession()
      setUser(null)
      setToken(null)
      navigate('/login', { replace: true })
    }

    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [navigate])

  const login = useCallback(async (payload: LoginRequest) => {
    const result = await authApi.login(payload)
    setAccessToken(result.accessToken)
    setStoredUser(result.user)
    setToken(result.accessToken)
    setUser(result.user)
  }, [])

  const register = useCallback(async (payload: RegisterRequest) => {
    const result = await authApi.register(payload)
    setAccessToken(result.accessToken)
    setStoredUser(result.user)
    setToken(result.accessToken)
    setUser(result.user)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isBootstrapping,
      login,
      register,
      logout,
      refreshMe,
    }),
    [user, token, isBootstrapping, login, register, logout, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
