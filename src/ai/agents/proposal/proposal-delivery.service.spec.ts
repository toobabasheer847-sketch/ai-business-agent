import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ProposalDeliveryService } from './proposal-delivery.service';

describe('ProposalDeliveryService', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userId = 'user-1';

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
    getProspectCompanyId: jest.fn(),
    getCompany: jest.fn(),
    getBrand: jest.fn(),
    writeAuditLog: jest.fn(),
  };

  const gmailService = {
    findActiveCredentialsForTenant: jest.fn(),
    refreshAndSave: jest.fn(),
    mailOperations: {
      sendEmail: jest.fn(),
    },
  };

  const proposalPdfService = {
    generateProposalPdf: jest.fn(),
  };

  const publicProposalAccess = {
    issueForDelivery: jest.fn(),
    revokeIssued: jest.fn(),
  };

  const reviewUrl = 'http://localhost:5173/p/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN12';
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
    proposalRepository.getProspectCompanyId.mockResolvedValue('company-1');
    proposalRepository.getCompany.mockResolvedValue({ id: 'company-1', name: 'Acme Corp' });
    proposalRepository.getBrand.mockResolvedValue({ id: 'brand-1', name: 'Acme Brand' });
    proposalRepository.writeAuditLog.mockResolvedValue(undefined);
    gmailService.findActiveCredentialsForTenant.mockResolvedValue({
      configId: 'cfg-1',
      tenantId,
      email: 'sender@tenant.com',
      accessToken: 'access-token-secret',
      refreshToken: 'refresh-token-secret',
      tokenExpiry: new Date(Date.now() + 60_000),
    });
    proposalPdfService.generateProposalPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 sample'),
      filename: 'NimbusForge-Implementation.pdf',
      contentType: 'application/pdf',
    });
    gmailService.mailOperations.sendEmail.mockResolvedValue({
      messageId: 'msg-1',
      to: 'ada@example.com',
      subject: proposal.title,
    });
    publicProposalAccess.issueForDelivery.mockResolvedValue({
      url: reviewUrl,
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
      tokenId: 'token-row-1',
    });
    publicProposalAccess.revokeIssued.mockResolvedValue(undefined);
    service = new ProposalDeliveryService(
      proposalRepository as any,
      gmailService as any,
      proposalPdfService as any,
      publicProposalAccess as any,
    );
  });

  it('generates a PDF and sends Gmail with attachment', async () => {
    const result = await service.sendProposalEmail({
      proposal: proposal as any,
      tenantId,
      userId,
    });

    expect(proposalPdfService.generateProposalPdf).toHaveBeenCalled();
    expect(gmailService.mailOperations.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        subject: proposal.title,
        body: expect.stringContaining(reviewUrl),
        attachments: [
          expect.objectContaining({
            filename: 'NimbusForge-Implementation.pdf',
            contentType: 'application/pdf',
          }),
        ],
      }),
    );
    expect(result).toEqual({
      messageId: 'msg-1',
      to: 'ada@example.com',
      subject: proposal.title,
      fromEmail: 'sender@tenant.com',
      pdfFilename: 'NimbusForge-Implementation.pdf',
    });
    expect(JSON.stringify(result)).not.toContain('access-token-secret');
    expect(JSON.stringify(result)).not.toContain('refresh-token-secret');
    expect(publicProposalAccess.revokeIssued).not.toHaveBeenCalled();
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

  it('blocks duplicate sends for already-sent proposals', async () => {
    await expect(
      service.sendProposalEmail({
        proposal: { ...proposal, status: 'sent' } as any,
        tenantId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(proposalPdfService.generateProposalPdf).not.toHaveBeenCalled();
  });

  it('does not mark sent when Gmail delivery fails', async () => {
    gmailService.mailOperations.sendEmail.mockRejectedValue(new Error('Gmail API failed'));

    await expect(
      service.sendProposalEmail({ proposal: proposal as any, tenantId }),
    ).rejects.toThrow(/not marked as sent/i);
    expect(publicProposalAccess.revokeIssued).toHaveBeenCalledWith(
      'token-row-1',
      tenantId,
      proposal.id,
    );
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
    ).rejects.toThrow(/Gmail is not configured/i);
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(publicProposalAccess.issueForDelivery).not.toHaveBeenCalled();
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
