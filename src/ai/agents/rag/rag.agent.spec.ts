import { RagAgent } from './rag.agent';

jest.mock('@google/adk', () => {
  class MockFunctionTool {
    constructor(public options: any) {}
  }

  class MockLlmAgent {
    constructor(public options: any) {}
  }

  class MockGemini {
    constructor(public options: any) {}
  }

  class MockInMemoryRunner {
    constructor(public options: any) {}

    async *runEphemeral() {
      throw new Error('simulated model failure');
    }
  }

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
    Gemini: MockGemini,
    InMemoryRunner: MockInMemoryRunner,
  };
});

describe('RagAgent', () => {
  it('falls back to a chunk-based answer when the model call fails', async () => {
    const ragTools = {
      searchKnowledge: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          content: 'Acme Corp is a B2B SaaS company operating in North America.',
          similarity: 0.91,
          tenantId: 'tenant-1',
          chunkIndex: 1,
          source: 's3://bucket/key.pdf',
          sourceType: 'pdf',
        },
      ]),
    };

    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'GEMINI_MODEL') {
          return fallback ?? 'gemini-2.0-flash';
        }

        return 'test-api-key';
      }),
    } as any;

    const agent = new RagAgent(ragTools as any, configService);

    const response = await agent.answerQuery('tenant-1', 'What does Acme do?');

    expect(response.usedKnowledge).toBe(true);
    expect(response.answer).toContain('Acme Corp');
    expect(response.sources).toHaveLength(1);
  });
});
