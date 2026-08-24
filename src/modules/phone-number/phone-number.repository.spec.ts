import { ConfigService } from '@nestjs/config';

import { IntegrationEncryptionService } from '../../infrastructure/security/integration-encryption.service.js';
import { PhoneNumberRepository } from './phone-number.repository';

describe('PhoneNumberRepository encryption', () => {
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

  it('encrypts authToken on create and returns decrypted row for internal use', async () => {
    let inserted: Record<string, unknown> | null = null;

    const db = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserted = values;
          return {
            returning: async () => [
              {
                id: 'pn-1',
                tenantId: 'tenant-a',
                phoneNumber: '+15551234567',
                label: null,
                provider: 'twilio',
                status: 'active',
                phoneSid: null,
                twilioSid: 'ACxxxx',
                authToken: values.authToken,
                appSid: null,
                webhookUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          };
        },
      }),
      select: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const repo = new PhoneNumberRepository(db as any, encryption);
    const row = await repo.create({
      tenantId: 'tenant-a',
      phoneNumber: '+15551234567',
      twilioSid: 'ACxxxx',
      authToken: 'twilio-auth-plain',
    });

    expect(encryption.isEncrypted(inserted!.authToken as string)).toBe(true);
    expect(inserted!.authToken).not.toContain('twilio-auth-plain');
    expect(row.authToken).toBe('twilio-auth-plain');
  });
});
