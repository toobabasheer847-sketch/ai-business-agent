import { ConfigService } from '@nestjs/config';

import { IntegrationEncryptionService } from './integration-encryption.service';

describe('IntegrationEncryptionService', () => {
  const keyB64 = Buffer.from('0123456789abcdef0123456789abcdef').toString(
    'base64',
  );

  function createService() {
    const config = {
      get: jest.fn((name: string) => {
        if (name === 'INTEGRATION_ENCRYPTION_KEY') return keyB64;
        if (name === 'NODE_ENV') return 'test';
        return undefined;
      }),
    } as unknown as ConfigService;

    return new IntegrationEncryptionService(config);
  }

  it('encrypts secrets for storage and decrypts for use', () => {
    const service = createService();
    const encrypted = service.encrypt('oauth-refresh-token');

    expect(encrypted).toBeTruthy();
    expect(service.isEncrypted(encrypted)).toBe(true);
    expect(service.decryptStored(encrypted).plaintext).toBe(
      'oauth-refresh-token',
    );
  });

  it('passes through null without inventing ciphertext', () => {
    const service = createService();
    expect(service.encrypt(null)).toBeNull();
    expect(service.encrypt(undefined)).toBeUndefined();
  });
});
