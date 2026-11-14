import { ProposalAgent } from './proposal-agent';

describe('ProposalAgent Phase 22 delivery', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const prospect = {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: tenantA,
    firstName: 'Bashir',
    lastName: 'Khan',
    email: 'toobabasheer847@gmail.com',
  };
  const proposal = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: tenantA,
    prospectId: prospect.id,
    title: 'Implementation Proposal',
    status: 'generated' as const,
    content: 'Proposal content',
  };

  const proposalRepository = {
    findProspectsByEmail: jest.fn(),
    findProspectsByName: jest.fn(),
    listProposals: jest.fn(),
    updateProposal: jest.fn(),
    getProposal: jest.fn(),
    writeAuditLog: jest.fn().mockResolvedValue(undefined),
  };
  const proposalDelivery = {
    sendProposalEmail: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  let agent: ProposalAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    proposalRepository.findProspectsByEmail.mockResolvedValue([prospect]);
    proposalRepository.findProspectsByName.mockResolvedValue([prospect]);
    proposalRepository.listProposals.mockResolvedValue([proposal]);
    proposalRepository.updateProposal.mockResolvedValue({
      ...proposal,
      status: 'sent',
    });
    proposalDelivery.sendProposalEmail.mockResolvedValue({
      messageId: 'message-1',
      to: prospect.email,
      subject: proposal.title,
      fromEmail: 'sender@example.com',
    });
    agent = new ProposalAgent(
      proposalRepository as any,
      proposalDelivery as any,
      configService as any,
    );
  });

  it('resolves an email and sends the tenant proposal', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      'Send the proposal to TOOBABASHEER847@GMAIL.COM',
    );

    expect(proposalRepository.findProspectsByEmail).toHaveBeenCalledWith(
      'toobabasheer847@gmail.com',
      tenantA,
    );
    expect(proposalRepository.listProposals).toHaveBeenCalledWith(tenantA, {
      prospectId: prospect.id,
    });
    expect(proposalDelivery.sendProposalEmail).toHaveBeenCalledWith({
      proposal,
      tenantId: tenantA,
      userId: 'user-a',
    });
    expect(result.message).toContain('PDF attached');
  });

  it('ignores already-sent proposals when selecting sendable candidates', async () => {
    proposalRepository.listProposals.mockResolvedValue([
      { ...proposal, id: 'sent-1', status: 'sent' },
      proposal,
    ]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).toHaveBeenCalled();
    expect(result.message).toContain('PDF attached');
  });

  it('returns all-sent message when only sent proposals exist', async () => {
    proposalRepository.listProposals.mockResolvedValue([
      { ...proposal, status: 'sent' },
    ]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('already been sent');
  });

  it('does not resolve an email outside the trusted tenant', async () => {
    proposalRepository.findProspectsByEmail.mockResolvedValue([]);

    const result = await agent.processRequest(
      { userId: 'user-b', tenantId: tenantB },
      'Email the proposal to toobabasheer847@gmail.com',
    );

    expect(proposalRepository.findProspectsByEmail).toHaveBeenCalledWith(
      prospect.email,
      tenantB,
    );
    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain("couldn't find a prospect");
  });

  it('never returns an empty assistant message', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      'Send the proposal to unknown@example.com',
    );

    expect(typeof result.message).toBe('string');
    expect(result.message?.trim()).not.toBe('');
  });

  it('asks for clarification when multiple proposals match', async () => {
    proposalRepository.listProposals.mockResolvedValue([proposal, { ...proposal, id: '33333333-3333-4333-8333-333333333333' }]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('multiple sendable proposals');
  });

  it('does not send a proposal that is already sent', async () => {
    proposalRepository.listProposals.mockResolvedValue([{ ...proposal, status: 'sent' }]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('already been sent');
  });

  it('uses an explicit proposal ID and keeps it tenant scoped', async () => {
    proposalRepository.findProspectsByEmail.mockResolvedValue([prospect]);
    proposalRepository.getProposal = jest.fn().mockResolvedValue(proposal);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Email proposal ${proposal.id} to ${prospect.email}`,
    );

    expect(proposalRepository.getProposal).toHaveBeenCalledWith(proposal.id, tenantA);
    expect(proposalRepository.listProposals).not.toHaveBeenCalled();
    expect(result.data).toEqual({
      success: true,
      proposalId: proposal.id,
      prospectId: prospect.id,
      recipient: prospect.email,
      status: 'sent',
    });
  });

  it('does not send when an explicit proposal belongs to another prospect', async () => {
    proposalRepository.getProposal = jest.fn().mockResolvedValue({
      ...proposal,
      prospectId: '44444444-4444-4444-8444-444444444444',
    });

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Send proposal ${proposal.id} to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('for this prospect');
  });

  it('returns a safe message when Gmail delivery fails', async () => {
    proposalDelivery.sendProposalEmail.mockRejectedValue(
      new Error('OAuth refresh token secret failed'),
    );

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Send the proposal to ${prospect.email}`,
    );

    expect(result.message).toContain('not marked as sent');
    expect(result.message).not.toContain('refresh token secret');
    expect(result.data).toBeNull();
  });

  it('resolves a named prospect when no email is provided', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      'Send the proposal to Bashir Khan',
    );

    expect(proposalRepository.findProspectsByName).toHaveBeenCalledWith(
      'Bashir Khan',
      tenantA,
    );
    expect(result.message).toContain('PDF attached');
  });

  it('routes send quotation phrasing through the send flow', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      `Send quotation to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).toHaveBeenCalled();
    expect(result.message).toContain('PDF attached');
  });

  it('returns validation feedback for an invalid email', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA },
      'Send the proposal to invalid@address',
    );

    expect(proposalRepository.findProspectsByEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('valid email address');
  });
});
