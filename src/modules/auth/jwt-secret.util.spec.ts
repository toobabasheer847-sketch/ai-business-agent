import { resolveJwtSecret } from './jwt-secret.util';

describe('resolveJwtSecret', () => {
  it('returns a trimmed configured secret', () => {
    expect(resolveJwtSecret('  configured-secret  ', 'production')).toBe(
      'configured-secret',
    );
  });

  it('fails fast in production when JWT_SECRET is missing', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow(
      'JWT_SECRET must be set in production',
    );
  });

  it('fails fast in production when JWT_SECRET is blank', () => {
    expect(() => resolveJwtSecret('   ', 'production')).toThrow(
      'JWT_SECRET must be set in production',
    );
  });

  it('fails in development when JWT_SECRET is missing instead of using a default', () => {
    expect(() => resolveJwtSecret(undefined, 'development')).toThrow(
      'JWT_SECRET is not configured',
    );
  });
});
