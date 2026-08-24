import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Ciphertext prefix — distinguishes encrypted rows from legacy plaintext. */
export const INTEGRATION_SECRET_PREFIX = 'enc:v1:';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Resolve a 32-byte AES-256 key from INTEGRATION_ENCRYPTION_KEY.
 * Accepts base64 (preferred) or 64-char hex. Never invents a default key.
 */
export function resolveIntegrationEncryptionKey(
  raw: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): Buffer {
  const value = raw?.trim();

  if (!value) {
    if (nodeEnv === 'production') {
      throw new Error('INTEGRATION_ENCRYPTION_KEY must be set in production');
    }
    throw new Error('INTEGRATION_ENCRYPTION_KEY is not configured');
  }

  let key: Buffer | null = null;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    try {
      key = Buffer.from(value, 'base64');
    } catch {
      key = null;
    }
  }

  if (!key || key.length !== KEY_LENGTH) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY must be a base64-encoded or hex-encoded 32-byte key (AES-256)',
    );
  }

  return key;
}

export function isEncryptedIntegrationSecret(
  value: string | null | undefined,
): boolean {
  return typeof value === 'string' && value.startsWith(INTEGRATION_SECRET_PREFIX);
}

/**
 * Encrypt a secret with AES-256-GCM.
 * Output: enc:v1:<base64(iv || authTag || ciphertext)>
 */
export function encryptIntegrationSecret(
  plaintext: string,
  key: Buffer,
): string {
  if (plaintext === '') {
    return plaintext;
  }

  if (isEncryptedIntegrationSecret(plaintext)) {
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);

  return `${INTEGRATION_SECRET_PREFIX}${payload.toString('base64')}`;
}

/**
 * Decrypt an enc:v1: ciphertext. Throws on tamper / wrong key.
 */
export function decryptIntegrationSecret(
  ciphertext: string,
  key: Buffer,
): string {
  if (!isEncryptedIntegrationSecret(ciphertext)) {
    throw new Error('Value is not an encrypted integration secret');
  }

  const encoded = ciphertext.slice(INTEGRATION_SECRET_PREFIX.length);
  const payload = Buffer.from(encoded, 'base64');

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Encrypted integration secret is malformed');
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Decrypt if encrypted; otherwise return legacy plaintext unchanged.
 * Never logs the value.
 */
export function decryptStoredIntegrationSecret(
  value: string | null | undefined,
  key: Buffer,
): { plaintext: string | null; wasLegacy: boolean } {
  if (value == null || value === '') {
    return { plaintext: value ?? null, wasLegacy: false };
  }

  if (isEncryptedIntegrationSecret(value)) {
    return {
      plaintext: decryptIntegrationSecret(value, key),
      wasLegacy: false,
    };
  }

  return { plaintext: value, wasLegacy: true };
}
