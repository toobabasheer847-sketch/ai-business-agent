/**
 * Matches GET/POST/PATCH /api/users response — API-exposed fields only.
 * passwordHash is never returned. tenantId is response-only; never send it.
 */
export type User = {
  id: string
  tenantId: string
  name: string
  email: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Matches POST /api/users body.
 * Never include tenantId (JWT provides it) or passwordHash.
 */
export type CreateUserRequest = {
  name: string
  email: string
  password: string
  isActive?: boolean
}

/**
 * Matches PATCH /api/users/:id body.
 * Never include tenantId or passwordHash.
 */
export type UpdateUserRequest = {
  name?: string
  email?: string
  password?: string
  isActive?: boolean
}

/** Matches DELETE /api/users/:id response */
export type DeleteUserResponse = {
  message: string
  id: string
}

/** Optional filters for GET /api/users — no pagination or sort params */
export type UserListQuery = {
  isActive?: boolean
  search?: string
}
