import { ConfigService } from '@nestjs/config';

import { IntegrationEncryptionService } from '../../infrastructure/security/integration-encryption.service.js';
import { GmailConfigurationRepository } from './gmail-configuration.repository';

describe('GmailConfigurationRepository encryption', () => {
  const keyB64 = Buffer.from('0123456789abcdef0123456789abcdef').toString(
    'base64',
  );
  const encryption = new IntegrationEncryptionService({
    get: (name: string) => {
      if (name === 'INTEGRATION_ENCRYPTION_KEY') return keyB64;
      if (name === 'NODE_ENV') return 'test';
      return undefined;
    },
  } as unknown as ConfigService);

  it('encrypts secrets on create and returns decrypted internal row', async () => {
    let inserted: Record<string, unknown> | null = null;

    const db = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserted = values;
          return {
            returning: async () => [
              {
                id: 'cfg-1',
                tenantId: 'tenant-a',
                email: 'a@example.com',
                clientId: 'cid',
                clientSecret: values.clientSecret,
                accessToken: values.accessToken,
                refreshToken: values.refreshToken,
                tokenExpiry: null,
                smtpPassword: values.smtpPassword,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          };
        },
      }),
      query: { gmailConfigs: { findFirst: jest.fn() } },
      update: jest.fn(),
      delete: jest.fn(),
    };

    const repo = new GmailConfigurationRepository(db as any, encryption);
    const row = await repo.create({
      tenantId: 'tenant-a',
      email: 'a@example.com',
      clientId: 'cid',
      clientSecret: 'secret-value',
      accessToken: 'access-value',
      refreshToken: 'refresh-value',
      isActive: true,
    });

    expect(encryption.isEncrypted(inserted!.clientSecret as string)).toBe(true);
    expect(encryption.isEncrypted(inserted!.accessToken as string)).toBe(true);
    expect(encryption.isEncrypted(inserted!.refreshToken as string)).toBe(true);
    expect(inserted!.clientSecret).not.toContain('secret-value');
    expect(row.clientSecret).toBe('secret-value');
    expect(row.accessToken).toBe('access-value');
    expect(row.refreshToken).toBe('refresh-value');
  });

  it('re-encrypts legacy plaintext on read', async () => {
    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });

    const db = {
      query: {
        gmailConfigs: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cfg-legacy',
            tenantId: 'tenant-a',
            email: 'legacy@example.com',
            clientId: null,
            clientSecret: 'plain-client-secret',
            accessToken: 'plain-access',
            refreshToken: 'plain-refresh',
            tokenExpiry: null,
            smtpPassword: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      },
      update: jest.fn(() => ({ set: updateSet })),
      insert: jest.fn(),
      delete: jest.fn(),
    };

    const repo = new GmailConfigurationRepository(db as any, encryption);
    const row = await repo.findByTenantId('tenant-a');

    expect(row?.accessToken).toBe('plain-access');
    expect(db.update).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalled();
    const patch = updateSet.mock.calls[0][0];
    expect(encryption.isEncrypted(patch.accessToken)).toBe(true);
    expect(encryption.isEncrypted(patch.refreshToken)).toBe(true);
    expect(encryption.isEncrypted(patch.clientSecret)).toBe(true);
  });
});
