import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

describe('AvailablePhoneNumbersService webhook configuration', () => {
  const tenantId = 'tenant-test-1';

  let service: AvailablePhoneNumbersService;
  let nestConfig: { get: jest.Mock };
  let twilioConfig: { resolveCredentialsForTenant: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    nestConfig = {
      get: jest.fn((key: string) => {
        if (key === 'TWILIO_WEBHOOK_BASE_URL') {
          return 'https://example.ngrok-free.app/';
        }
        return undefined;
      }),
    };

    twilioConfig = {
      resolveCredentialsForTenant: jest.fn().mockResolvedValue({
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: 'test-auth-token-not-real',
      }),
    };

    service = new AvailablePhoneNumbersService(
      twilioConfig as unknown as TwilioAppConfigurationService,
      nestConfig as unknown as ConfigService,
    );

    mockCreate.mockResolvedValue({
      sid: 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      phoneNumber: '+15551234567',
      friendlyName: 'Test',
      status: 'in-use',
    });
    mockUpdate.mockResolvedValue({
      sid: 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      voiceUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/call/inbound',
      smsUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/sms/inbound',
      statusCallback:
        'https://example.ngrok-free.app/api/webhooks/twilio/call/status',
    });
  });

  describe('buildWebhookUrls', () => {
    it('builds URLs from TWILIO_WEBHOOK_BASE_URL origin (strips path/trailing slash)', () => {
      expect(service.buildWebhookUrls()).toEqual({
        voiceUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/call/inbound',
        smsUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/sms/inbound',
        statusCallback:
          'https://example.ngrok-free.app/api/webhooks/twilio/call/status',
      });
    });

    it('throws when TWILIO_WEBHOOK_BASE_URL is missing', () => {
      nestConfig.get.mockReturnValue(undefined);
      expect(() => service.buildWebhookUrls()).toThrow(ServiceUnavailableException);
    });

    it('does not hardcode localhost or ngrok production URLs in constructed paths', () => {
      nestConfig.get.mockReturnValue('https://my-tunnel.example.com');
      const urls = service.buildWebhookUrls();
      expect(urls.voiceUrl).toBe(
        'https://my-tunnel.example.com/api/webhooks/twilio/call/inbound',
      );
      expect(JSON.stringify(urls)).not.toContain('localhost');
      expect(JSON.stringify(urls)).not.toContain('ngrok-free.app');
    });
  });

  describe('purchaseNumber (mocked Twilio — no paid calls)', () => {
    it('updates IncomingPhoneNumber with expected webhook URLs after create', async () => {
      const result = await service.purchaseNumber({
        tenantId,
        phoneNumber: '+15551234567',
        friendlyName: 'Test',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        phoneNumber: '+15551234567',
        friendlyName: 'Test',
      });
      expect(mockIncomingPhoneNumbers).toHaveBeenCalledWith(
        'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      );
      expect(mockUpdate).toHaveBeenCalledWith({
        voiceUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/call/inbound',
        voiceMethod: 'POST',
        smsUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/sms/inbound',
        smsMethod: 'POST',
        statusCallback:
          'https://example.ngrok-free.app/api/webhooks/twilio/call/status',
        statusCallbackMethod: 'POST',
      });
      expect(result.webhooks).toEqual({
        voiceUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/call/inbound',
        smsUrl: 'https://example.ngrok-free.app/api/webhooks/twilio/sms/inbound',
        statusCallback:
          'https://example.ngrok-free.app/api/webhooks/twilio/call/status',
      });
      expect(result.sid).toBe('PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    it('fails before create when webhook base URL is missing', async () => {
      nestConfig.get.mockReturnValue('');

      await expect(
        service.purchaseNumber({
          tenantId,
          phoneNumber: '+15551234567',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('does not succeed when webhook update fails after create', async () => {
      mockUpdate.mockRejectedValue(new Error('webhook update denied'));

      await expect(
        service.purchaseNumber({
          tenantId,
          phoneNumber: '+15551234567',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);

      expect(mockCreate).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
