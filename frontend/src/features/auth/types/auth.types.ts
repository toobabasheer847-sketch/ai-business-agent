/** Mirrors backend AuthenticatedUser from auth.types.ts */
export type AuthenticatedUser = {
  userId: string
  tenantId: string
  email: string
  name: string
  role?: string
}

/** Login/register response user shape from AuthService */
export type AuthUserSummary = {
  id: string
  tenantId: string
  name: string
  email: string
  isActive: boolean
}

export type LoginRequest = {
  email: string
  password: string
}

export type RegisterRequest = {
  tenantName: string
  name: string
  email: string
  password: string
}

export type LoginResponse = {
  user: AuthUserSummary
  accessToken: string
}

export type RegisterResponse = {
  user: AuthUserSummary
  tenant: {
    id: string
    name: string
  }
  accessToken: string
}
