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

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
    Gemini: MockGemini,
  };
});

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockRejectedValue(
        new Error('simulated model failure'),
      ),
    },
  })),
}));

describe('RagAgent', () => {
  it('returns no-knowledge when the model call fails', async () => {
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

    expect(response.usedKnowledge).toBe(false);
    expect(response.sources).toEqual([]);
    expect(response.answer).toContain(
      "couldn't find enough relevant information",
    );
  });
});
