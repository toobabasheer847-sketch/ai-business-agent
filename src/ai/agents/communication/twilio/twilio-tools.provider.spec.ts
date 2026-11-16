import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

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

  it('uses JWT tenant for an approved SMS and ignores another tenant', async () => {
    await provider.deliverApprovedSms({
      tenantId,
      to: '+15550002',
      body: 'Hello',
      fromPhoneNumberId: phoneNumberId,
    });

    expect(smsService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, fromPhoneNumberId: phoneNumberId }),
    );
    expect(smsService.sendSms).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: otherTenantId }),
    );
  });

  it('does not send SMS from the tool before approval exists', async () => {
    const tool = provider.createSendSmsTool();

    await runWithAiContext({ tenantId, userId, role: 'owner' }, async () => {
      const result = await tool.execute({
        to: '+15550002',
        body: 'Hello',
        fromPhoneNumberId: phoneNumberId,
        tenantId: otherTenantId,
      } as any);
      expect(result.status).toBe('pending_approval');
    });

    expect(smsService.sendSms).not.toHaveBeenCalled();
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

  it('rejects a member sending SMS or starting a call', async () => {
    const sms = provider.createSendSmsTool();
    const call = provider.createInitiateCallTool();

    await runWithAiContext({ tenantId, userId, role: 'member' }, async () => {
      await expect(sms.execute({
        to: '+15550002',
        body: 'Hello',
        fromPhoneNumberId: phoneNumberId,
      })).rejects.toThrow(ForbiddenException);
      await expect(call.execute({
        to: '+15550002',
        fromPhoneNumberId: phoneNumberId,
      })).rejects.toThrow(ForbiddenException);
    });

    expect(smsService.sendSms).not.toHaveBeenCalled();
    expect(callService.initiateOutboundCall).not.toHaveBeenCalled();
  });

  it('does not send SMS before an approval exists', async () => {
    const approvals = {
      propose: jest.fn().mockResolvedValue({
        required: true,
        approval: { id: 'approval-1', status: 'pending' },
      }),
    };
    const gated = new TwilioToolsProvider(smsService as any, callService as any, approvals as any);
    const tool = gated.createSendSmsTool();

    await runWithAiContext({ tenantId, userId, role: 'owner' }, async () => {
      const result = await tool.execute({
        to: '+15550002',
        body: 'Hello',
        fromPhoneNumberId: phoneNumberId,
      });
      expect(result.status).toBe('pending_approval');
    });

    expect(approvals.propose).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'sms.send',
      tenantId,
    }));
    expect(smsService.sendSms).not.toHaveBeenCalled();
  });

  it('does not place a call before an approval exists', async () => {
    const approvals = {
      propose: jest.fn().mockResolvedValue({
        required: true,
        approval: { id: 'approval-call', status: 'pending' },
      }),
    };
    const gated = new TwilioToolsProvider(smsService as any, callService as any, approvals as any);
    const tool = gated.createInitiateCallTool();

    await runWithAiContext({ tenantId, userId, role: 'owner' }, async () => {
      const result = await tool.execute({
        to: '+15550002',
        fromPhoneNumberId: phoneNumberId,
      });
      expect(result.status).toBe('pending_approval');
    });

    expect(approvals.propose).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'call.initiate',
      tenantId,
    }));
    expect(callService.initiateOutboundCall).not.toHaveBeenCalled();
  });
});
