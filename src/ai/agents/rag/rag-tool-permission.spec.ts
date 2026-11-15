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
    constructor(public options: { tools?: Array<{ name: string; execute: (input: unknown) => Promise<unknown> }> }) {}
  },
  Gemini: class MockGemini {
    constructor(public options: unknown) {}
  },
}));

import { runWithAiContext, currentAiRole } from '../../context/ai-request-context';
import { RagAgent } from './rag.agent';

describe('knowledge search tool permissions', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = '11111111-1111-4111-8111-111111111111';
  const ragTools = { searchKnowledge: jest.fn().mockResolvedValue([]) };
  const configService = {
    get: (key: string) => (key === 'GOOGLE_GENAI_API_KEY' ? 'test-key' : undefined),
  };
  const agent = new RagAgent(ragTools as never, configService as never);
  const search = (agent as unknown as {
    agent: { options: { tools: Array<{ execute: (input: unknown) => Promise<unknown> }> } };
  }).agent.options.tools[0];

  beforeEach(() => {
    ragTools.searchKnowledge.mockClear();
  });

  it('does not let a member search knowledge', async () => {
    await runWithAiContext({ tenantId, userId, role: 'member' }, async () => {
      await expect(search.execute({ query: 'refund policy' })).rejects.toThrow(ForbiddenException);
    });
    expect(ragTools.searchKnowledge).not.toHaveBeenCalled();
  });

  it('keeps the caller role when knowledge search is delegated', async () => {
    const seen: Array<string | null | undefined> = [];
    jest.spyOn(agent, 'answerQuery').mockImplementation(async () => {
      seen.push(currentAiRole());
      return { answer: 'ok', sources: [], usedKnowledge: false };
    });

    await runWithAiContext({ tenantId, userId, role: 'owner' }, () =>
      agent.delegateQuery(tenantId, userId, 'refund policy'),
    );

    expect(seen).toEqual(['owner']);
  });

  it('lets an owner search knowledge', async () => {
    await runWithAiContext({ tenantId, userId, role: 'owner' }, async () => {
      await search.execute({ query: 'refund policy' });
    });

    expect(ragTools.searchKnowledge).toHaveBeenCalledWith(tenantId, 'refund policy', 5);
  });
});
