import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';

import { AvailablePhoneNumbersService } from './available-phone-numbers';
import { TwilioAppConfigurationService } from './twilio-app-configuration';

const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockIncomingPhoneNumbers = jest.fn((sid: string) => ({
  update: mockUpdate,
  sid,
}));
mockIncomingPhoneNumbers.create = mockCreate;

const mockLocalList = jest.fn().mockResolvedValue([]);
const mockTollFreeList = jest.fn().mockResolvedValue([]);

jest.mock('twilio', () => {
  return jest.fn(() => ({
    availablePhoneNumbers: jest.fn(() => ({
      local: { list: mockLocalList },
      tollFree: { list: mockTollFreeList },
    })),
    incomingPhoneNumbers: mockIncomingPhoneNumbers,
  }));
});

describe('AvailablePhoneNumbersService purchase (no automatic webhooks)', () => {
  const tenantId = 'tenant-test-1';

  let service: AvailablePhoneNumbersService;
  let twilioConfig: { resolveCredentialsForTenant: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    twilioConfig = {
      resolveCredentialsForTenant: jest.fn().mockResolvedValue({
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: 'test-auth-token-not-real',
      }),
    };

    service = new AvailablePhoneNumbersService(
      twilioConfig as unknown as TwilioAppConfigurationService,
    );

    mockCreate.mockResolvedValue({
      sid: 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      phoneNumber: '+15551234567',
      friendlyName: 'Test',
      status: 'in-use',
    });
  });

  describe('purchaseNumber (mocked Twilio — no paid calls)', () => {
    it('purchases the IncomingPhoneNumber and does not configure webhooks', async () => {
      const result = await service.purchaseNumber({
        tenantId,
        phoneNumber: '+15551234567',
        friendlyName: 'Test',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        phoneNumber: '+15551234567',
        friendlyName: 'Test',
      });
      expect(mockIncomingPhoneNumbers).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        phoneNumber: '+15551234567',
        sid: 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        friendlyName: 'Test',
        status: 'in-use',
      });
      expect(result).not.toHaveProperty('webhooks');
    });

    it('does not call IncomingPhoneNumber.update even if update would fail', async () => {
      mockUpdate.mockRejectedValue(new Error('webhook update denied'));

      await expect(
        service.purchaseNumber({
          tenantId,
          phoneNumber: '+15551234567',
        }),
      ).resolves.toMatchObject({
        sid: 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      });

      expect(mockCreate).toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('throws when Twilio credentials cannot be resolved', async () => {
      twilioConfig.resolveCredentialsForTenant.mockResolvedValue(null);

      await expect(
        service.purchaseNumber({
          tenantId,
          phoneNumber: '+15551234567',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('surfaces Twilio create failures without calling webhook update', async () => {
      mockCreate.mockRejectedValue(new Error('number not available'));

      await expect(
        service.purchaseNumber({
          tenantId,
          phoneNumber: '+15551234567',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
