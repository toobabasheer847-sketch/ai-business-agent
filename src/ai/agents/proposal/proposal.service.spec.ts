import { BadRequestException } from '@nestjs/common';

import { ProposalService } from './proposal.service';

describe('ProposalService changeProposalStatus send path', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = '11111111-1111-4111-8111-111111111111';
  const proposalId = '22222222-2222-4222-8222-222222222222';

  const existing = {
    id: proposalId,
    tenantId,
    prospectId: '33333333-3333-4333-8333-333333333333',
    title: 'Proposal',
    status: 'generated',
    content: 'Body',
    currency: 'USD',
  };

  const proposalAgent = {};
  const proposalRepository = {
    getProposal: jest.fn(),
    updateProposal: jest.fn(),
    writeAuditLog: jest.fn(),
  };
  const proposalDelivery = {
    sendProposalEmail: jest.fn(),
  };
  const configService = { get: jest.fn() };

  let service: ProposalService;

  beforeEach(() => {
    jest.clearAllMocks();
    proposalRepository.getProposal.mockResolvedValue(existing);
    proposalRepository.updateProposal.mockResolvedValue({
      ...existing,
      status: 'sent',
      sentAt: '2026-08-22T00:00:00.000Z',
    });
    proposalDelivery.sendProposalEmail.mockResolvedValue({
      messageId: 'msg-9',
      to: 'prospect@example.com',
      subject: 'Proposal',
      fromEmail: 'me@tenant.com',
    });
    service = new ProposalService(
      proposalAgent as any,
      proposalRepository as any,
      proposalDelivery as any,
      configService as any,
    );
  });

  it('emails via Gmail before marking proposal sent', async () => {
    const result = await service.changeProposalStatus(
      proposalId,
      { status: 'sent' },
      { tenantId, userId },
    );

    expect(proposalDelivery.sendProposalEmail).toHaveBeenCalledWith({
      proposal: existing,
      tenantId,
      fromEmail: undefined,
    });
    expect(proposalRepository.updateProposal).toHaveBeenCalledWith(
      proposalId,
      tenantId,
      expect.objectContaining({ status: 'sent' }),
    );
    expect(result.status).toBe('sent');
  });

  it('does not mark sent when Gmail delivery fails', async () => {
    proposalDelivery.sendProposalEmail.mockRejectedValue(
      new BadRequestException('No active Gmail configuration for this tenant.'),
    );

    await expect(
      service.changeProposalStatus(
        proposalId,
        { status: 'sent' },
        { tenantId, userId },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(proposalRepository.updateProposal).not.toHaveBeenCalled();
  });

  it('skips email when already sent', async () => {
    proposalRepository.getProposal.mockResolvedValue({
      ...existing,
      status: 'sent',
    });

    await service.changeProposalStatus(
      proposalId,
      { status: 'sent' },
      { tenantId, userId },
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
  });

  it('does not email for non-sent status transitions', async () => {
    await service.changeProposalStatus(
      proposalId,
      { status: 'viewed' },
      { tenantId, userId },
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
  });
});
