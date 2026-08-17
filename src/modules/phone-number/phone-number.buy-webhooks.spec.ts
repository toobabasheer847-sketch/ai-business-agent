import { ConflictException, NotFoundException } from '@nestjs/common';

import { AvailablePhoneNumbersService } from '../../integrations/twilio/available-phone-numbers';
import { TwilioAppConfigurationService } from '../../integrations/twilio/twilio-app-configuration';
import { PhoneNumberProvider, PhoneNumberStatus } from './dto/create-phone-number.dto';
import { PhoneNumberService } from './phone-number.service';

describe('PhoneNumberService.buy webhook persistence gate', () => {
  const tenantId = 'tenant-abc';

  let service: PhoneNumberService;
  let repository: {
    findByPhoneNumberAndTenant: jest.Mock;
    findByIdAndTenant: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    disconnectTwilio: jest.Mock;
    delete: jest.Mock;
  };
  let available: {
    purchaseNumber: jest.Mock;
  };
  let twilioConfig: {
    resolveCredentialsForTenant: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findByPhoneNumberAndTenant: jest.fn().mockResolvedValue(null),
      findByIdAndTenant: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: 'pn-local-1',
        tenantId,
        phoneNumber: '+15551234567',
        label: 'Austin, TX, US',
        provider: PhoneNumberProvider.TWILIO,
        status: PhoneNumberStatus.ACTIVE,
        phoneSid: 'PN111',
        twilioSid: 'ACxxxxxxxx',
        authToken: 'secret-token',
        appSid: null,
        webhookUrl: 'https://tunnel.example/api/webhooks/twilio/call/inbound',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn(),
      disconnectTwilio: jest.fn(),
      delete: jest.fn(),
    };

    available = {
      purchaseNumber: jest.fn(),
    };

    twilioConfig = {
      resolveCredentialsForTenant: jest.fn().mockResolvedValue({
        accountSid: 'ACxxxxxxxx',
        authToken: 'secret-token',
      }),
    };

    service = new PhoneNumberService(
      repository as never,
      available as unknown as AvailablePhoneNumbersService,
      twilioConfig as unknown as TwilioAppConfigurationService,
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
      phoneSid: 'PN111',
      webhookUrl: 'https://tunnel.example/api/webhooks/twilio/call/inbound',
      twilioSid: 'ACxxxxxxxx',
      authToken: 'secret-token',
    });
    expect(result.purchase.webhooks.voiceUrl).toContain(
      '/api/webhooks/twilio/call/inbound',
    );
    expect(result.phoneSid).toBe('PN111');
    expect(result.hasAuthToken).toBe(true);
    expect(result).not.toHaveProperty('authToken');
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

  it('does not invent appSid on buy when purchase did not use one', async () => {
    available.purchaseNumber.mockResolvedValue({
      phoneNumber: '+15551234567',
      sid: 'PN111',
      friendlyName: null,
      status: 'in-use',
      webhooks: {
        voiceUrl: 'https://tunnel.example/api/webhooks/twilio/call/inbound',
        smsUrl: 'https://tunnel.example/api/webhooks/twilio/sms/inbound',
        statusCallback: 'https://tunnel.example/api/webhooks/twilio/call/status',
      },
    });
    twilioConfig.resolveCredentialsForTenant.mockResolvedValue(null);

    await service.buy(tenantId, { phoneNumber: '+15551234567' });

    const saved = repository.create.mock.calls[0][0];
    expect(saved.appSid).toBeUndefined();
    expect(saved.twilioSid).toBeNull();
    expect(saved.authToken).toBeNull();
    expect(saved.phoneSid).toBe('PN111');
  });
});

describe('PhoneNumberService Twilio configuration', () => {
  const tenantId = 'tenant-abc';
  const existing = {
    id: 'pn-1',
    tenantId,
    phoneNumber: '+15551234567',
    label: 'Sales',
    provider: 'twilio',
    status: 'active',
    phoneSid: 'PN111',
    twilioSid: 'ACold',
    authToken: 'old-secret',
    appSid: 'APold',
    webhookUrl: 'https://old.example/voice',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let service: PhoneNumberService;
  let repository: {
    findByPhoneNumberAndTenant: jest.Mock;
    findByIdAndTenant: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    disconnectTwilio: jest.Mock;
    delete: jest.Mock;
    findAllByTenant: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findByPhoneNumberAndTenant: jest.fn(),
      findByIdAndTenant: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({
        ...existing,
        twilioSid: 'ACnew',
        authToken: 'old-secret',
      }),
      disconnectTwilio: jest.fn().mockResolvedValue({
        ...existing,
        phoneSid: null,
        twilioSid: null,
        authToken: null,
        appSid: null,
        webhookUrl: null,
      }),
      delete: jest.fn().mockResolvedValue(true),
      findAllByTenant: jest.fn().mockResolvedValue([existing]),
    };

    service = new PhoneNumberService(
      repository as never,
      { purchaseNumber: jest.fn() } as unknown as AvailablePhoneNumbersService,
      { resolveCredentialsForTenant: jest.fn() } as unknown as TwilioAppConfigurationService,
    );
  });

  it('redacts authToken from list responses and exposes Twilio fields', async () => {
    const list = await service.findAll(tenantId, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      phoneSid: 'PN111',
      twilioSid: 'ACold',
      appSid: 'APold',
      webhookUrl: 'https://old.example/voice',
      hasAuthToken: true,
    });
    expect(list[0]).not.toHaveProperty('authToken');
    expect(list[0]).not.toHaveProperty('userId');
    expect(list[0]).not.toHaveProperty('description');
    expect(list[0]).not.toHaveProperty('msg');
    expect(list[0]).not.toHaveProperty('passwordHash');
    expect(list[0]).not.toHaveProperty('createdBy');
  });

  it('redacts authToken from detail responses and exposes Twilio fields', async () => {
    const detail = await service.findOne(tenantId, 'pn-1');
    expect(detail).toMatchObject({
      phoneSid: 'PN111',
      twilioSid: 'ACold',
      appSid: 'APold',
      webhookUrl: 'https://old.example/voice',
      hasAuthToken: true,
    });
    expect(detail).not.toHaveProperty('authToken');
  });

  it('keeps the stored authToken when update sends an empty token', async () => {
    await service.update(tenantId, 'pn-1', {
      twilioSid: 'ACnew',
      authToken: '',
    });

    expect(repository.update).toHaveBeenCalledWith(
      'pn-1',
      tenantId,
      expect.objectContaining({
        twilioSid: 'ACnew',
        authToken: undefined,
      }),
    );
  });

  it('disconnects Twilio config without deleting the phone number', async () => {
    const result = await service.disconnectTwilio(tenantId, 'pn-1');

    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.disconnectTwilio).toHaveBeenCalledWith('pn-1', tenantId);
    expect(result.phoneSid).toBeNull();
    expect(result.twilioSid).toBeNull();
    expect(result.hasAuthToken).toBe(false);
    expect(result).not.toHaveProperty('authToken');
  });

  it('delete removes the phone number row', async () => {
    const result = await service.remove(tenantId, 'pn-1');
    expect(repository.delete).toHaveBeenCalledWith('pn-1', tenantId);
    expect(result).toEqual({
      message: 'Phone number deleted successfully.',
      id: 'pn-1',
    });
  });

  it('returns 404-equivalent for disconnect when the number is missing', async () => {
    repository.findByIdAndTenant.mockResolvedValue(null);
    await expect(service.disconnectTwilio(tenantId, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
