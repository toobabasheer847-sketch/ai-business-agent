/**
 * Safe public shape of a Gmail configuration.
 * Sensitive fields (clientSecret, accessToken, refreshToken) are NEVER included.
 */
export interface GmailConfigurationSafe {
  id: string;
  tenantId: string;
  email: string;
  clientId: string | null;
  /** Token expiry timestamp — safe to expose so clients know when to re-auth */
  tokenExpiry: Date | null;
  /** Whether the configuration is currently active */
  isActive: boolean;
  /** Whether OAuth tokens are currently stored (without exposing the tokens) */
  hasTokens: boolean;
  createdAt: Date;
  updatedAt: Date;
}
