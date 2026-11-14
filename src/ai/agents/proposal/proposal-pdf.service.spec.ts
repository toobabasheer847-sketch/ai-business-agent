import {
  ProposalPdfService,
  sanitizeProposalFilename,
} from './proposal-pdf.service';

describe('ProposalPdfService', () => {
  const service = new ProposalPdfService();

  const proposal = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    prospectId: '22222222-2222-4222-8222-222222222222',
    title: 'Cyberify Business Proposal',
    description: 'Implementation overview for the client.',
    requirements: 'Secure deployment and onboarding.',
    status: 'generated' as const,
    price: '5000',
    currency: 'USD',
    content: '# Scope\n\nDeliver secure cloud onboarding.',
  };

  it('generates a PDF buffer with content', async () => {
    const result = await service.generateProposalPdf(proposal, {
      companyName: 'Cyberify',
      prospectName: 'Ada Lovelace',
      brandName: 'Cyberify Labs',
    });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(100);
    expect(result.buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(result.contentType).toBe('application/pdf');
  });

  it('sanitizes filenames and uses the correct MIME type', async () => {
    const result = await service.generateProposalPdf({
      ...proposal,
      title: 'Cyberify Business Proposal',
    });

    expect(result.filename).toBe('Cyberify-Business-Proposal.pdf');
    expect(result.contentType).toBe('application/pdf');
  });

  it('does not leak secrets in generated PDF metadata fields', async () => {
    const result = await service.generateProposalPdf({
      ...proposal,
      content: 'tenantId=user secret jwt=abc refresh_token=xyz',
    });

    const serialized = result.buffer.toString('latin1');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain('tenantId=user');
  });
});

describe('sanitizeProposalFilename', () => {
  it('removes unsafe characters and path traversal', () => {
    expect(sanitizeProposalFilename('Cyberify Business Proposal')).toBe(
      'Cyberify-Business-Proposal.pdf',
    );
    expect(sanitizeProposalFilename('../../etc/passwd')).toBe('etcpasswd.pdf');
    expect(sanitizeProposalFilename('')).toBe('Business-Proposal.pdf');
  });
});
