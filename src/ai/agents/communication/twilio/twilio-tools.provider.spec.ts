import { UnauthorizedException } from '@nestjs/common';

jest.mock('@google/adk', () => ({
  FunctionTool: class MockFunctionTool {
    constructor(public options: any) {
      Object.assign(this, options);
    }
    execute(...args: any[]) {
      return this.options.execute(...args);
    }
  },
}));

import { runWithAiContext } from '../../../context/ai-request-context';
import { TwilioToolsProvider } from './twilio-tools.provider';

describe('TwilioToolsProvider security', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const phoneNumberId = '33333333-3333-4333-8333-333333333333';

  const smsService = {
    sendSms: jest.fn(),
  };
  const callService = {
    initiateOutboundCall: jest.fn(),
  };

  let provider: TwilioToolsProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    smsService.sendSms.mockResolvedValue({
      messageSid: 'SM123',
      from: '+15550001',
      to: '+15550002',
      body: 'Hello',
      status: 'queued',
    });
    provider = new TwilioToolsProvider(smsService as any, callService as any);
  });

  it('uses JWT tenant for send_sms and ignores injected tenantId', async () => {
    const tool = provider.createSendSmsTool();

    await runWithAiContext({ tenantId, userId }, async () => {
      await tool.execute({
        to: '+15550002',
        body: 'Hello',
        fromPhoneNumberId: phoneNumberId,
        tenantId: otherTenantId,
      } as any);

      expect(smsService.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, fromPhoneNumberId: phoneNumberId }),
      );
      expect(smsService.sendSms).not.toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: otherTenantId }),
      );
    });
  });

  it('fails closed when send_sms runs without trusted context', async () => {
    const tool = provider.createSendSmsTool();

    await expect(
      tool.execute({
        to: '+15550002',
        body: 'Hello',
        fromPhoneNumberId: phoneNumberId,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
