/**
 * Gmail Configuration types based on backend GmailConfigurationSafe response.
 * Sensitive fields (clientSecret, accessToken, refreshToken) are NEVER included.
 */

export type GmailConfiguration = {
  id: string
  tenantId: string
  email: string
  clientId: string | null
  /** Token expiry timestamp — null if no tokens or not provided */
  tokenExpiry: string | null
  /** Whether the configuration is currently active */
  isActive: boolean
  /** Whether OAuth tokens are currently stored (without exposing the tokens) */
  hasTokens: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Request body for creating a Gmail configuration.
 * Sensitive fields should be handled securely by the backend.
 */
export type CreateGmailConfigurationRequest = {
  email: string
  clientId?: string
  clientSecret?: string
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: string
  isActive?: boolean
}

/**
 * Request body for updating a Gmail configuration.
 * Partial update — only provided fields are changed.
 */
export type UpdateGmailConfigurationRequest = {
  email?: string
  clientId?: string
  clientSecret?: string
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: string
  isActive?: boolean
}

/**
 * Delete response
 */
export type DeleteGmailConfigurationResponse = {
  message: string
}
