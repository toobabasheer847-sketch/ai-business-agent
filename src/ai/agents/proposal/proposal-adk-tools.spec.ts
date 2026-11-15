import { ForbiddenException } from '@nestjs/common';

jest.mock('@google/adk', () => ({
  FunctionTool: class MockFunctionTool {
    name: string;
    execute: (input: unknown) => Promise<unknown>;
    constructor(public options: { name: string; execute: (input: unknown) => Promise<unknown> }) {
      this.name = options.name;
      this.execute = options.execute;
    }
  },
  LlmAgent: class MockLlmAgent {
    constructor(public options: unknown) {}
  },
  Gemini: class MockGemini {
    constructor(public options: unknown) {}
  },
}));

import { runWithAiContext } from '../../context/ai-request-context';
import { ProposalAgent } from './proposal-agent';

describe('Proposal ADK tool permissions', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = '11111111-1111-4111-8111-111111111111';
  const proposalRepository = {
    getProspect: jest.fn(),
    getProposal: jest.fn(),
    listProposals: jest.fn(),
    updateProposal: jest.fn(),
    createProposal: jest.fn(),
  };
  const proposalDelivery = { sendProposalEmail: jest.fn() };
  const configService = {
    get: (key: string) => (key === 'GOOGLE_GENAI_API_KEY' ? 'test-key' : undefined),
  };

  const agent = new ProposalAgent(
    proposalRepository as never,
    proposalDelivery as never,
    configService as never,
  );
  const tools = (agent as unknown as { adkTools: Array<{ name: string; execute: (input: unknown) => Promise<unknown> }> }).adkTools;
  const tool = (name: string) => tools.find((item) => item.name === name)!;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not let a member update, generate, or mark a proposal sent', async () => {
    await runWithAiContext({ tenantId, userId, role: 'member' }, async () => {
      await expect(tool('update_proposal').execute({ proposalId: 'proposal-1', title: 'Changed' })).rejects.toThrow(ForbiddenException);
      await expect(tool('update_proposal').execute({ proposalId: 'proposal-1', status: 'sent' })).rejects.toThrow(ForbiddenException);
      await expect(tool('generate_proposal').execute({ proposalId: 'proposal-1' })).rejects.toThrow(ForbiddenException);
    });

    expect(proposalRepository.updateProposal).not.toHaveBeenCalled();
  });

  it('lets an owner update a proposal through the tool', async () => {
    proposalRepository.updateProposal.mockResolvedValue({ id: 'proposal-1' });

    await runWithAiContext({ tenantId, userId, role: 'owner' }, async () => {
      await tool('update_proposal').execute({ proposalId: 'proposal-1', title: 'Changed' });
    });

    expect(proposalRepository.updateProposal).toHaveBeenCalledWith('proposal-1', tenantId, { title: 'Changed' });
  });
});
