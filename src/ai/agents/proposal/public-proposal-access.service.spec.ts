import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';

import {
  generateProposalAccessToken,
  hashProposalAccessToken,
} from './proposal-access-token';
import { PublicProposalAccessService } from './public-proposal-access.service';

describe('PublicProposalAccessService', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const proposalId = '11111111-1111-4111-8111-111111111111';
  const otherProposalId = '33333333-3333-4333-8333-333333333333';
  const token = generateProposalAccessToken();
  const otherToken = generateProposalAccessToken();

  const baseProposal = {
    id: proposalId,
    tenantId: tenantA,
    prospectId: '22222222-2222-4222-8222-222222222222',
    title: 'Harbor rollout',
    description: 'Replace the intake desk.',
    requirements: 'Train the front desk.',
    status: 'sent' as const,
    price: '4800',
    currency: 'USD',
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    content: '## Services\nOn-site training\n\n## Timeline\nThree weeks\n\n## Payment terms\nHalf on acceptance',
    viewedAt: null as string | null,
    acceptedAt: null as string | null,
    rejectedAt: null as string | null,
    rejectionReason: null as string | null,
  };

  const otherProposal = {
    ...baseProposal,
    id: otherProposalId,
    tenantId: tenantB,
    title: 'Other tenant proposal',
  };

  let proposal = { ...baseProposal };
  let access = {
    id: 'access-1',
    tenantId: tenantA,
    proposalId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null as Date | null,
  };
  let otherAccess = {
    id: 'access-2',
    tenantId: tenantB,
    proposalId: otherProposalId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null as Date | null,
  };

  const repository = {
    issueProposalAccessToken: jest.fn(),
    findProposalAccessByHash: jest.fn(),
    revokeProposalAccessToken: jest.fn(),
    getProposal: jest.fn(),
    markProposalViewedIfFirst: jest.fn(),
    markProposalAcceptedIfOpen: jest.fn(),
    markProposalRejectedIfOpen: jest.fn(),
    writeAuditLog: jest.fn(),
    getBrand: jest.fn(),
    getProspectCompanyId: jest.fn(),
    getCompany: jest.fn(),
    getProspect: jest.fn(),
  };

  const pdfService = { generateProposalPdf: jest.fn() };
  const configService = { get: jest.fn() };
  let service: PublicProposalAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    proposal = { ...baseProposal };
    access = {
      id: 'access-1',
      tenantId: tenantA,
      proposalId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      revokedAt: null,
    };
    otherAccess = {
      id: 'access-2',
      tenantId: tenantB,
      proposalId: otherProposalId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      revokedAt: null,
    };
    configService.get.mockReturnValue('http://localhost:5173');
    repository.writeAuditLog.mockResolvedValue(undefined);
    repository.revokeProposalAccessToken.mockResolvedValue(undefined);
    repository.getBrand.mockImplementation(async (tenantId: string) => {
      if (tenantId === tenantA) {
        return { name: 'Harbor Studio', logoUrl: null, domain: 'harbor.example', phone: '+15550001', apiUrl: 'https://internal.example' };
      }
      return { name: 'Other Brand', logoUrl: null, domain: 'other.example', phone: null, apiUrl: 'https://secret.example' };
    });
    repository.getProspectCompanyId.mockResolvedValue('company-1');
    repository.getCompany.mockImplementation(async (_companyId: string, tenantId: string) => {
      if (tenantId !== tenantA) {
        return { name: 'Other Co' };
      }
      return { name: 'Northwind' };
    });
    repository.getProspect.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' });
    repository.findProposalAccessByHash.mockImplementation(async (hash: string) => {
      if (hash === hashProposalAccessToken(token)) return access;
      if (hash === hashProposalAccessToken(otherToken)) return otherAccess;
      return null;
    });
    repository.getProposal.mockImplementation(async (id: string, tenantId: string) => {
      if (id === proposal.id && tenantId === proposal.tenantId) return proposal;
      if (id === otherProposal.id && tenantId === otherProposal.tenantId) return otherProposal;
      return null;
    });
    repository.markProposalViewedIfFirst.mockImplementation(async (id: string, tenantId: string) => {
      if (id !== proposal.id || tenantId !== proposal.tenantId) return null;
      if (proposal.status !== 'sent' || proposal.viewedAt) return null;
      proposal = { ...proposal, status: 'viewed', viewedAt: new Date().toISOString() };
      return proposal;
    });
    repository.markProposalAcceptedIfOpen.mockImplementation(async (id: string, tenantId: string) => {
      if (id !== proposal.id || tenantId !== proposal.tenantId) return null;
      if (proposal.status !== 'sent' && proposal.status !== 'viewed') return null;
      if (proposal.acceptedAt || proposal.rejectedAt) return null;
      proposal = { ...proposal, status: 'accepted', acceptedAt: new Date().toISOString() };
      return proposal;
    });
    repository.markProposalRejectedIfOpen.mockImplementation(
      async (id: string, tenantId: string, reason: string) => {
        if (id !== proposal.id || tenantId !== proposal.tenantId) return null;
        if (proposal.status !== 'sent' && proposal.status !== 'viewed') return null;
        if (proposal.acceptedAt || proposal.rejectedAt) return null;
        proposal = {
          ...proposal,
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason,
        };
        return proposal;
      },
    );
    repository.issueProposalAccessToken.mockImplementation(async (input: { tokenHash: string; expiresAt: Date }) => ({
      id: 'issued-1',
      expiresAt: input.expiresAt,
      tokenHash: input.tokenHash,
    }));
    pdfService.generateProposalPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      filename: 'harbor-rollout.pdf',
      contentType: 'application/pdf',
    });
    service = new PublicProposalAccessService(
      repository as any,
      pdfService as any,
      configService as any,
    );
  });

  it('stores only a hash and puts the raw token in the public URL', async () => {
    const issued = await service.issueForDelivery(baseProposal as any, tenantA);
    const raw = issued.url.split('/p/')[1];
    const saved = repository.issueProposalAccessToken.mock.calls[0][0];

    expect(issued.url.startsWith('http://localhost:5173/p/')).toBe(true);
    expect(saved.tokenHash).toBe(hashProposalAccessToken(raw));
    expect(saved.tokenHash).not.toBe(raw);
    expect(saved.tenantId).toBe(tenantA);
    expect(JSON.stringify(repository.writeAuditLog.mock.calls[0][0].metadata)).not.toContain(raw);
  });

  it('returns 404 for unknown tokens and does not accept a proposal id', async () => {
    await expect(service.getProposal(generateProposalAccessToken())).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getProposal(proposalId)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.markProposalViewedIfFirst).not.toHaveBeenCalled();
  });

  it('returns 410 for expired and revoked links without changing status', async () => {
    access.expiresAt = new Date(Date.now() - 1000);
    await expect(service.getProposal(token)).rejects.toBeInstanceOf(GoneException);

    access.expiresAt = new Date(Date.now() + 60_000);
    access.revokedAt = new Date();
    await expect(service.accept(token)).rejects.toBeInstanceOf(GoneException);
    expect(repository.markProposalViewedIfFirst).not.toHaveBeenCalled();
    expect(repository.markProposalAcceptedIfOpen).not.toHaveBeenCalled();
    expect(proposal.status).toBe('sent');
  });

  it('returns 410 when the proposal validity date has passed and does not mark viewed', async () => {
    proposal.validUntil = new Date(Date.now() - 1000).toISOString();
    await expect(service.getProposal(token)).rejects.toBeInstanceOf(GoneException);
    expect(repository.markProposalViewedIfFirst).not.toHaveBeenCalled();
    expect(proposal.status).toBe('sent');
  });

  it('records viewedAt only on the first open', async () => {
    const first = await service.getProposal(token);
    const second = await service.getProposal(token);

    expect(first.status).toBe('viewed');
    expect(first.viewedAt).toEqual(expect.any(String));
    expect(second.status).toBe('viewed');
    expect(repository.markProposalViewedIfFirst).toHaveBeenCalledTimes(1);
    const viewedAudits = repository.writeAuditLog.mock.calls.filter(
      (call) => call[0].action === 'proposal.public_viewed',
    );
    expect(viewedAudits).toHaveLength(1);
  });

  it('accepts an open proposal and rejects a second decision', async () => {
    const accepted = await service.accept(token);
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedAt).toEqual(expect.any(String));

    await expect(service.accept(token)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.reject(token, 'Changed our mind')).rejects.toBeInstanceOf(ConflictException);
    expect(proposal.status).toBe('accepted');
  });

  it('rejects with a reason and blocks a later accept', async () => {
    const rejected = await service.reject(token, '  Budget is frozen.  ');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Budget is frozen.');
    await expect(service.accept(token)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a rejection reason', async () => {
    await expect(service.reject(token, '   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.markProposalRejectedIfOpen).not.toHaveBeenCalled();
  });

  it('lets only one of two overlapping accepts win', async () => {
    const [first, second] = await Promise.allSettled([service.accept(token), service.accept(token)]);
    const fulfilled = [first, second].filter((result) => result.status === 'fulfilled');
    const rejected = [first, second].filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(proposal.status).toBe('accepted');
  });

  it('resolves each token only inside its own tenant', async () => {
    const own = await service.getProposal(token);
    const foreign = await service.getProposal(otherToken);

    expect(own.title).toBe('Harbor rollout');
    expect(own.companyName).toBe('Northwind');
    expect(foreign.title).toBe('Other tenant proposal');
    expect(foreign.companyName).toBe('Other Co');
    expect(JSON.stringify(own)).not.toContain(tenantA);
    expect(JSON.stringify(own)).not.toContain(proposalId);
    expect(JSON.stringify(own)).not.toContain('ada@example.com');
    expect(JSON.stringify(own)).not.toContain('internal.example');
    expect(repository.markProposalAcceptedIfOpen).not.toHaveBeenCalledWith(proposalId, tenantB);
  });

  it('omits the internal reference when building the public PDF', async () => {
    await service.downloadPdf(token);
    expect(pdfService.generateProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: proposalId }),
      expect.objectContaining({ includeReference: false, companyName: 'Northwind' }),
    );
  });
});
