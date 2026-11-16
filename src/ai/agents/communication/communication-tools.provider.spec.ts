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

import { runWithAiContext } from '../../context/ai-request-context';
import { CommunicationToolsProvider } from './communication-tools.provider';

describe('CommunicationToolsProvider security', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const gmailService = {
    findActiveCredentialsForTenant: jest.fn(),
    refreshAndSave: jest.fn(),
    mailOperations: {
      sendEmail: jest.fn(),
      listMessages: jest.fn(),
      createDraft: jest.fn(),
    },
  };

  let provider: CommunicationToolsProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    gmailService.findActiveCredentialsForTenant.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenExpiry: new Date(Date.now() + 60_000),
    });
    gmailService.mailOperations.sendEmail.mockResolvedValue({
      messageId: 'msg-1',
      to: 'recipient@example.com',
      subject: 'Hello',
    });
    gmailService.mailOperations.listMessages.mockResolvedValue([]);
    gmailService.mailOperations.createDraft.mockResolvedValue({
      id: 'draft-1',
      to: 'recipient@example.com',
      subject: 'Hello',
      body: 'Body',
    });
    provider = new CommunicationToolsProvider(gmailService as any);
  });

  it('uses JWT tenant for an approved email and ignores another tenant', async () => {
    const result = await provider.deliverApprovedEmail({
      tenantId,
      to: 'recipient@example.com',
      subject: 'Hello',
      body: 'Body',
    });

    expect(gmailService.findActiveCredentialsForTenant).toHaveBeenCalledWith(tenantId, undefined);
    expect(gmailService.findActiveCredentialsForTenant).not.toHaveBeenCalledWith(otherTenantId, expect.anything());
    expect(gmailService.mailOperations.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'recipient@example.com',
      accessToken: 'access-token',
    }));
    expect(result.reference).toBe('msg-1');
    expect(JSON.stringify(result)).not.toContain('refresh-token');
  });

  it('does not send mail from the tool before approval exists', async () => {
    const tool = provider.createSendMailTool();

    await runWithAiContext({ tenantId, userId, role: 'owner' }, async () => {
      const result = await tool.execute({
        to: 'recipient@example.com',
        subject: 'Hello',
        body: 'Body',
        tenantId: otherTenantId,
      } as any);
      expect(result.email.status).toBe('pending_approval');
      expect(JSON.stringify(result)).not.toContain('access-token');
    });

    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(gmailService.findActiveCredentialsForTenant).not.toHaveBeenCalled();
  });

  it('fails closed when send_mail runs without trusted context', async () => {
    const tool = provider.createSendMailTool();

    await expect(
      tool.execute({
        to: 'recipient@example.com',
        subject: 'Hello',
        body: 'Body',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a member sending or listing tenant Gmail', async () => {
    const send = provider.createSendMailTool();
    const list = provider.createListMailsTool();

    await runWithAiContext({ tenantId, userId, role: 'member' }, async () => {
      await expect(send.execute({
        to: 'recipient@example.com',
        subject: 'Hello',
        body: 'Body',
      })).rejects.toThrow(ForbiddenException);
      await expect(list.execute({ maxResults: 5 })).rejects.toThrow(ForbiddenException);
    });

    expect(gmailService.findActiveCredentialsForTenant).not.toHaveBeenCalled();
  });

  it('does not send Gmail before an approval exists', async () => {
    const approvals = {
      propose: jest.fn().mockResolvedValue({
        required: true,
        approval: { id: 'approval-1', status: 'pending' },
      }),
    };
    const gated = new CommunicationToolsProvider(gmailService as any, approvals as any);
    const tool = gated.createSendMailTool();

    await runWithAiContext({ tenantId, userId, role: 'owner' }, async () => {
      const result = await tool.execute({
        to: 'recipient@example.com',
        subject: 'Hello',
        body: 'Body',
      });
      expect(result.email.status).toBe('pending_approval');
    });

    expect(approvals.propose).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'email.send',
      tenantId,
    }));
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(gmailService.findActiveCredentialsForTenant).not.toHaveBeenCalled();
  });
});
