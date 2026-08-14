import { ConflictException } from '@nestjs/common';

import { AvailablePhoneNumbersService } from '../../integrations/twilio/available-phone-numbers';
import { PhoneNumberProvider, PhoneNumberStatus } from './dto/create-phone-number.dto';
import { PhoneNumberService } from './phone-number.service';

describe('PhoneNumberService.buy webhook persistence gate', () => {
  const tenantId = 'tenant-abc';

  let service: PhoneNumberService;
  let repository: {
    findByPhoneNumberAndTenant: jest.Mock;
    create: jest.Mock;
  };
  let available: {
    purchaseNumber: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findByPhoneNumberAndTenant: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'pn-local-1',
        tenantId,
        phoneNumber: '+15551234567',
        label: 'Austin, TX',
        provider: PhoneNumberProvider.TWILIO,
        status: PhoneNumberStatus.ACTIVE,
      }),
    };

    available = {
      purchaseNumber: jest.fn(),
    };

    service = new PhoneNumberService(
      repository as never,
      available as unknown as AvailablePhoneNumbersService,
    );
  });

  it('saves locally only after purchaseNumber resolves (webhooks configured)', async () => {
    available.purchaseNumber.mockResolvedValue({
      phoneNumber: '+15551234567',
      sid: 'PN111',
      friendlyName: 'Austin, TX',
      status: 'in-use',
      webhooks: {
        voiceUrl: 'https://tunnel.example/api/webhooks/twilio/call/inbound',
        smsUrl: 'https://tunnel.example/api/webhooks/twilio/sms/inbound',
        statusCallback: 'https://tunnel.example/api/webhooks/twilio/call/status',
      },
    });

    const result = await service.buy(tenantId, {
      phoneNumber: '+15551234567',
      locality: 'Austin',
      region: 'TX',
      countryCode: 'US',
    });

    expect(available.purchaseNumber).toHaveBeenCalledWith({
      tenantId,
      phoneNumber: '+15551234567',
      friendlyName: 'Austin, TX, US',
    });
    expect(repository.create).toHaveBeenCalledWith({
      tenantId,
      phoneNumber: '+15551234567',
      label: 'Austin, TX, US',
      provider: PhoneNumberProvider.TWILIO,
      status: PhoneNumberStatus.ACTIVE,
    });
    expect(result.purchase.webhooks.voiceUrl).toContain(
      '/api/webhooks/twilio/call/inbound',
    );
  });

  it('does not save when purchase/webhook step throws', async () => {
    available.purchaseNumber.mockRejectedValue(
      new Error('webhook configuration failed'),
    );

    await expect(
      service.buy(tenantId, { phoneNumber: '+15551234567' }),
    ).rejects.toThrow('webhook configuration failed');

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate before any Twilio purchase call', async () => {
    repository.findByPhoneNumberAndTenant.mockResolvedValue({
      id: 'existing',
      phoneNumber: '+15551234567',
    });

    await expect(
      service.buy(tenantId, { phoneNumber: '+15551234567' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(available.purchaseNumber).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });
});
