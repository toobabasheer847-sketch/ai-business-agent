import { ForbiddenException } from '@nestjs/common';

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
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      'Send the proposal to TOOBABASHEER847@GMAIL.COM',
    );

    expect(proposalRepository.findProspectsByEmail).toHaveBeenCalledWith(
      'toobabasheer847@gmail.com',
      tenantA,
    );
    expect(proposalRepository.listProposals).toHaveBeenCalledWith(tenantA, {
      prospectId: prospect.id,
    });
    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('not emailed');
    expect(result.message).not.toContain('access-token');
  });

  it('holds a proposal email until the approval center accepts it', async () => {
    const approvals = {
      propose: jest.fn().mockResolvedValue({
        required: true,
        approval: { id: 'approval-1', status: 'pending' },
      }),
    };
    const gated = new ProposalAgent(
      proposalRepository as any,
      proposalDelivery as any,
      configService as any,
      undefined,
      approvals as any,
    );

    const result = await gated.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      'Send the proposal to TOOBABASHEER847@GMAIL.COM',
    );

    expect(approvals.propose).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'proposal.send',
      tenantId: tenantA,
      targetEntityId: proposal.id,
    }));
    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('waiting for approval');
  });

  it('ignores already-sent proposals when selecting sendable candidates', async () => {
    proposalRepository.listProposals.mockResolvedValue([
      { ...proposal, id: 'sent-1', status: 'sent' },
      proposal,
    ]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('not emailed');
    expect(result.message).not.toContain('already been sent');
  });

  it('returns all-sent message when only sent proposals exist', async () => {
    proposalRepository.listProposals.mockResolvedValue([
      { ...proposal, status: 'sent' },
    ]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('already been sent');
  });

  it('does not resolve an email outside the trusted tenant', async () => {
    proposalRepository.findProspectsByEmail.mockResolvedValue([]);

    const result = await agent.processRequest(
      { userId: 'user-b', tenantId: tenantB, role: 'owner' },
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
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      'Send the proposal to unknown@example.com',
    );

    expect(typeof result.message).toBe('string');
    expect(result.message?.trim()).not.toBe('');
  });

  it('asks for clarification when multiple proposals match', async () => {
    proposalRepository.listProposals.mockResolvedValue([proposal, { ...proposal, id: '33333333-3333-4333-8333-333333333333' }]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('multiple sendable proposals');
  });

  it('does not send a proposal that is already sent', async () => {
    proposalRepository.listProposals.mockResolvedValue([{ ...proposal, status: 'sent' }]);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('already been sent');
  });

  it('uses an explicit proposal ID and keeps it tenant scoped', async () => {
    proposalRepository.findProspectsByEmail.mockResolvedValue([prospect]);
    proposalRepository.getProposal = jest.fn().mockResolvedValue(proposal);

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      `Email proposal ${proposal.id} to ${prospect.email}`,
    );

    expect(proposalRepository.getProposal).toHaveBeenCalledWith(proposal.id, tenantA);
    expect(proposalRepository.listProposals).not.toHaveBeenCalled();
    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.message).toContain('not emailed');
  });

  it('does not send when an explicit proposal belongs to another prospect', async () => {
    proposalRepository.getProposal = jest.fn().mockResolvedValue({
      ...proposal,
      prospectId: '44444444-4444-4444-8444-444444444444',
    });

    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
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
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      `Send the proposal to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('not emailed');
    expect(result.message).not.toContain('refresh token secret');
    expect(result.data).toBeNull();
  });

  it('resolves a named prospect when no email is provided', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      'Send the proposal to Bashir Khan',
    );

    expect(proposalRepository.findProspectsByName).toHaveBeenCalledWith(
      'Bashir Khan',
      tenantA,
    );
    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('not emailed');
  });

  it('routes send quotation phrasing through the send flow', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      `Send quotation to ${prospect.email}`,
    );

    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('not emailed');
  });

  it('returns validation feedback for an invalid email', async () => {
    const result = await agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'owner' },
      'Send the proposal to invalid@address',
    );

    expect(proposalRepository.findProspectsByEmail).not.toHaveBeenCalled();
    expect(result.message).toContain('valid email address');
  });

  it('rejects a member send before looking up the prospect', async () => {
    await expect(agent.processRequest(
      { userId: 'user-a', tenantId: tenantA, role: 'member' },
      `Send the proposal to ${prospect.email}`,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(proposalRepository.findProspectsByEmail).not.toHaveBeenCalled();
    expect(proposalDelivery.sendProposalEmail).not.toHaveBeenCalled();
  });
});
