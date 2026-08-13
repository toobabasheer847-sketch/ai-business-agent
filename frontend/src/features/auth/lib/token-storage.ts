import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/lib/constants/app'
import type { AuthUserSummary } from '@/features/auth/types/auth.types'

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getStoredUser(): AuthUserSummary | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUserSummary
  } catch {
    return null
  }
}

export function setStoredUser(user: AuthUserSummary): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem(AUTH_USER_KEY)
}

export function clearSession(): void {
  clearAccessToken()
  clearStoredUser()
}
