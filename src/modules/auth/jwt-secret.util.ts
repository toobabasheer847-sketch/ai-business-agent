/**
 * Resolve the JWT signing/verification secret.
 *
 * Production must fail fast when JWT_SECRET is missing or blank.
 * Local/test environments also require an explicit secret so tokens
 * cannot be minted with a shared default.
 */
export function resolveJwtSecret(
  secret: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): string {
  const value = secret?.trim();

  if (value) {
    return value;
  }

  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  throw new Error('JWT_SECRET is not configured');
}
