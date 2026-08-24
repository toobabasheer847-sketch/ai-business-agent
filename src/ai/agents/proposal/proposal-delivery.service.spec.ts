import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ProposalDeliveryService } from './proposal-delivery.service';

describe('ProposalDeliveryService', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const proposal = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId,
    prospectId: '22222222-2222-4222-8222-222222222222',
    title: 'NimbusForge Implementation',
    description: null,
    requirements: null,
    status: 'generated' as const,
    price: '1000',
    currency: 'USD',
    content: 'Full proposal markdown content.',
  };

  const proposalRepository = {
    getProspect: jest.fn(),
  };

  const gmailService = {
    findActiveCredentialsForTenant: jest.fn(),
    refreshAndSave: jest.fn(),
    mailOperations: {
      sendEmail: jest.fn(),
    },
  };

  let service: ProposalDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    proposalRepository.getProspect.mockResolvedValue({
      id: proposal.prospectId,
      tenantId,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    gmailService.findActiveCredentialsForTenant.mockResolvedValue({
      configId: 'cfg-1',
      tenantId,
      email: 'sender@tenant.com',
      accessToken: 'access-token-secret',
      refreshToken: 'refresh-token-secret',
      tokenExpiry: new Date(Date.now() + 60_000),
    });
    gmailService.mailOperations.sendEmail.mockResolvedValue({
      messageId: 'msg-1',
      to: 'ada@example.com',
      subject: proposal.title,
    });
    service = new ProposalDeliveryService(
      proposalRepository as any,
      gmailService as any,
    );
  });

  it('sends proposal email using JWT tenant Gmail and prospect email', async () => {
    const result = await service.sendProposalEmail({
      proposal: proposal as any,
      tenantId,
    });

    expect(gmailService.findActiveCredentialsForTenant).toHaveBeenCalledWith(
      tenantId,
      undefined,
    );
    expect(gmailService.mailOperations.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        subject: proposal.title,
        body: proposal.content,
      }),
    );
    expect(result).toEqual({
      messageId: 'msg-1',
      to: 'ada@example.com',
      subject: proposal.title,
      fromEmail: 'sender@tenant.com',
    });
    expect(JSON.stringify(result)).not.toContain('access-token-secret');
    expect(JSON.stringify(result)).not.toContain('refresh-token-secret');
  });

  it('rejects when proposal belongs to another tenant', async () => {
    await expect(
      service.sendProposalEmail({
        proposal: { ...proposal, tenantId: otherTenantId } as any,
        tenantId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
  });

  it('rejects when prospect has no email', async () => {
    proposalRepository.getProspect.mockResolvedValue({
      id: proposal.prospectId,
      tenantId,
      firstName: 'Ada',
      email: null,
    });

    await expect(
      service.sendProposalEmail({ proposal: proposal as any, tenantId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
  });

  it('rejects when no Gmail config exists for tenant', async () => {
    gmailService.findActiveCredentialsForTenant.mockResolvedValue(null);

    await expect(
      service.sendProposalEmail({ proposal: proposal as any, tenantId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
  });

  it('always uses trusted tenantId for Gmail lookup', async () => {
    await service.sendProposalEmail({
      proposal: proposal as any,
      tenantId,
      fromEmail: 'sender@tenant.com',
    });

    expect(gmailService.findActiveCredentialsForTenant).toHaveBeenCalledWith(
      tenantId,
      'sender@tenant.com',
    );
    expect(gmailService.findActiveCredentialsForTenant).not.toHaveBeenCalledWith(
      otherTenantId,
      expect.anything(),
    );
  });
});
