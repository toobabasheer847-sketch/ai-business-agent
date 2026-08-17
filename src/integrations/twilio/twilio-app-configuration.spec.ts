import { ConfigService } from '@nestjs/config';

import { TwilioAppConfigurationService } from './twilio-app-configuration';
import type { TwilioAppRepository } from './twilio-app.repository';

describe('TwilioAppConfigurationService credential resolution', () => {
  const tenantId = 'tenant-1';

  it('uses phone_numbers-backed credentials before environment fallback', async () => {
    const repository = {
      findActiveForTenant: jest.fn().mockResolvedValue({
        id: 'pn-1',
        tenantId,
        phoneNumberId: 'pn-1',
        accountSid: 'ACfromdb',
        authToken: 'token-from-db',
        appSid: null,
        webhookUrl: null,
        status: 'active',
      }),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return 'ACenv';
        if (key === 'TWILIO_AUTH_TOKEN') return 'token-env';
        return undefined;
      }),
    };

    const service = new TwilioAppConfigurationService(
      config as unknown as ConfigService,
      repository as unknown as TwilioAppRepository,
    );

    const resolved = await service.resolveCredentialsForTenant(tenantId);
    expect(resolved).toEqual({
      accountSid: 'ACfromdb',
      authToken: 'token-from-db',
    });
    expect(repository.findActiveForTenant).toHaveBeenCalledWith(tenantId);
  });

  it('falls back to TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN when no DB credentials exist', async () => {
    const repository = {
      findActiveForTenant: jest.fn().mockResolvedValue(null),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return 'ACenv';
        if (key === 'TWILIO_AUTH_TOKEN') return 'token-env';
        return undefined;
      }),
    };

    const service = new TwilioAppConfigurationService(
      config as unknown as ConfigService,
      repository as unknown as TwilioAppRepository,
    );

    await expect(service.resolveCredentialsForTenant(tenantId)).resolves.toEqual({
      accountSid: 'ACenv',
      authToken: 'token-env',
    });
  });
});
