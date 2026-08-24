import {
  decryptIntegrationSecret,
  decryptStoredIntegrationSecret,
  encryptIntegrationSecret,
  isEncryptedIntegrationSecret,
  resolveIntegrationEncryptionKey,
} from './integration-encryption';

describe('integration-encryption', () => {
  const key = resolveIntegrationEncryptionKey(
    Buffer.from('0123456789abcdef0123456789abcdef').toString('base64'),
    'test',
  );

  it('requires INTEGRATION_ENCRYPTION_KEY', () => {
    expect(() => resolveIntegrationEncryptionKey(undefined, 'test')).toThrow(
      /INTEGRATION_ENCRYPTION_KEY is not configured/,
    );
    expect(() =>
      resolveIntegrationEncryptionKey('', 'production'),
    ).toThrow(/must be set in production/);
  });

  it('rejects non-32-byte keys', () => {
    expect(() =>
      resolveIntegrationEncryptionKey(Buffer.from('short').toString('base64')),
    ).toThrow(/32-byte/);
  });

  it('encrypts and decrypts a round trip', () => {
    const plaintext = 'ya29.secret-access-token';
    const ciphertext = encryptIntegrationSecret(plaintext, key);

    expect(isEncryptedIntegrationSecret(ciphertext)).toBe(true);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptIntegrationSecret(ciphertext, key)).toBe(plaintext);
  });

  it('fails closed on tampered ciphertext', () => {
    const ciphertext = encryptIntegrationSecret('twilio-auth-token', key);
    const tampered = ciphertext.slice(0, -4) + 'XXXX';

    expect(() => decryptIntegrationSecret(tampered, key)).toThrow();
  });

  it('fails closed on wrong key', () => {
    const ciphertext = encryptIntegrationSecret('gmail-refresh', key);
    const otherKey = resolveIntegrationEncryptionKey(
      Buffer.from('ffffffffffffffffffffffffffffffff').toString('base64'),
      'test',
    );

    expect(() => decryptIntegrationSecret(ciphertext, otherKey)).toThrow();
  });

  it('treats empty string as empty and leaves already-encrypted values alone', () => {
    expect(encryptIntegrationSecret('', key)).toBe('');
    const once = encryptIntegrationSecret('once', key);
    expect(encryptIntegrationSecret(once, key)).toBe(once);
  });

  it('supports legacy plaintext during migration', () => {
    const legacy = decryptStoredIntegrationSecret('plain-legacy-token', key);
    expect(legacy.plaintext).toBe('plain-legacy-token');
    expect(legacy.wasLegacy).toBe(true);

    const encrypted = encryptIntegrationSecret('migrated', key);
    const stored = decryptStoredIntegrationSecret(encrypted, key);
    expect(stored.plaintext).toBe('migrated');
    expect(stored.wasLegacy).toBe(false);
  });

  it('handles null and empty stored values', () => {
    expect(decryptStoredIntegrationSecret(null, key)).toEqual({
      plaintext: null,
      wasLegacy: false,
    });
    expect(decryptStoredIntegrationSecret('', key)).toEqual({
      plaintext: '',
      wasLegacy: false,
    });
  });
});
