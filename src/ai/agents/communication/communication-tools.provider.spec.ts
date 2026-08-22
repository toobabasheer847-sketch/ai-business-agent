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

  it('uses JWT tenant for send_mail and ignores injected tenantId in tool args', async () => {
    const tool = provider.createSendMailTool();

    await runWithAiContext({ tenantId, userId }, async () => {
      const result = await tool.execute({
        to: 'recipient@example.com',
        subject: 'Hello',
        body: 'Body',
        tenantId: otherTenantId,
      } as any);

      expect(gmailService.findActiveCredentialsForTenant).toHaveBeenCalledWith(
        tenantId,
        undefined,
      );
      expect(gmailService.findActiveCredentialsForTenant).not.toHaveBeenCalledWith(
        otherTenantId,
        expect.anything(),
      );
      expect(result.email.status).toBe('sent');
      expect(JSON.stringify(result)).not.toContain('access-token');
      expect(JSON.stringify(result)).not.toContain('refresh-token');
    });
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
});
