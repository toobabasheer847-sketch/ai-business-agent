import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { WhatsAppChannelAdapter } from './whatsapp-channel.adapter';

describe('channel adapters', () => {
  const gmail = {
    findActiveCredentialsForTenant: jest.fn(),
    refreshAndSave: jest.fn(),
    mailOperations: { sendEmail: jest.fn() },
  };
  const smtp = { isReady: false, sendEmail: jest.fn() };
  const sms = { sendSms: jest.fn() };
  const records = { whatsAppSecrets: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    smtp.isReady = false;
  });

  it('records Gmail acceptance as sent without a delivery confirmation', async () => {
    gmail.findActiveCredentialsForTenant.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      tokenExpiry: null,
    });
    gmail.mailOperations.sendEmail.mockResolvedValue({ messageId: 'gmail-1' });
    const adapter = new EmailChannelAdapter(gmail as never, smtp as never);
    const result = await adapter.send({ tenantId: 'tenant-1', to: 'ada@example.com', body: 'Hello', subject: 'Hi' });
    expect(result).toMatchObject({
      outcome: 'sent',
      provider: 'gmail',
      providerMessageId: 'gmail-1',
      deliveryConfirmed: false,
      permanent: false,
    });
  });

  it('falls back to SMTP acceptance and reports missing transports as not configured', async () => {
    gmail.findActiveCredentialsForTenant.mockResolvedValue(null);
    smtp.isReady = true;
    smtp.sendEmail.mockResolvedValue({ messageId: 'smtp-1' });
    const adapter = new EmailChannelAdapter(gmail as never, smtp as never);
    const sent = await adapter.send({ tenantId: 'tenant-1', to: 'ada@example.com', body: 'Hello' });
    expect(sent).toMatchObject({ outcome: 'sent', provider: 'smtp', deliveryConfirmed: false });

    smtp.isReady = false;
    const missing = await adapter.send({ tenantId: 'tenant-1', to: 'ada@example.com', body: 'Hello' });
    expect(missing).toMatchObject({ outcome: 'not_configured', permanent: true, errorCode: 'provider_not_configured' });
  });

  it('sends SMS with a provider id and does not confirm delivery from the send response', async () => {
    sms.sendSms.mockResolvedValue({ messageSid: 'SM1', status: 'queued' });
    const adapter = new SmsChannelAdapter(sms as never);
    const result = await adapter.send({
      tenantId: 'tenant-1',
      to: '+15550001111',
      body: 'Hello',
      fromPhoneNumberId: 'phone-1',
    });
    expect(result).toMatchObject({
      outcome: 'sent',
      provider: 'twilio',
      providerMessageId: 'SM1',
      providerStatus: 'sent',
      deliveryConfirmed: false,
    });
  });

  it('treats a permanent Twilio rejection as non-retryable', async () => {
    sms.sendSms.mockRejectedValue(new Error('Twilio 21610 recipient opted out'));
    const adapter = new SmsChannelAdapter(sms as never);
    const result = await adapter.send({
      tenantId: 'tenant-1',
      to: '+15550001111',
      body: 'Hello',
      fromPhoneNumberId: 'phone-1',
    });
    expect(result.permanent).toBe(true);
    expect(result.errorCode).toBe('21610');
  });

  it('requires a tenant phone number before calling Twilio', async () => {
    const adapter = new SmsChannelAdapter(sms as never);
    const result = await adapter.send({ tenantId: 'tenant-1', to: '+15550001111', body: 'Hello' });
    expect(result).toMatchObject({ outcome: 'failed', permanent: true, errorCode: 'invalid_recipient' });
    expect(sms.sendSms).not.toHaveBeenCalled();
  });

  it('keeps WhatsApp unverified until a configured Graph API call returns a message id', async () => {
    records.whatsAppSecrets.mockResolvedValue(null);
    const adapter = new WhatsAppChannelAdapter(records as never);
    const missing = await adapter.send({ tenantId: 'tenant-1', to: '+15550001111', body: 'Hello' });
    expect(missing).toMatchObject({ outcome: 'not_configured', provider: 'meta_cloud', permanent: true });

    records.whatsAppSecrets.mockResolvedValue({ accessToken: 'token', phoneNumberId: '123' });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.1' }] }),
    } as Response);
    const sent = await adapter.send({ tenantId: 'tenant-1', to: '+15550001111', body: 'Hello' });
    expect(sent).toMatchObject({
      outcome: 'sent',
      providerMessageId: 'wamid.1',
      deliveryConfirmed: false,
    });
    const requestedUrl = fetchMock.mock.calls[0]?.[0];
    expect(typeof requestedUrl === 'string' ? requestedUrl : '').toContain('/123/messages');
    fetchMock.mockRestore();
  });
});
