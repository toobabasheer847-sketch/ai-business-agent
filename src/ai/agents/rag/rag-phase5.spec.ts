import { RagAgent } from './rag.agent';
import { RagTools, cosineSimilarity, toFloat8ArrayLiteral } from './rag.tools';

jest.mock('@google/adk', () => {
  class MockFunctionTool {
    constructor(public options: any) {}
  }

  class MockLlmAgent {
    constructor(public options: any) {}
  }

  class MockGemini {
    constructor(public options: any) {}

    async generateContent() {
      return {
        text: () => 'The document contains a dummy PDF file.',
      };
    }
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
      embedContent: jest.fn().mockRejectedValue(new Error('embedding failed')),
      generateContent: jest.fn().mockResolvedValue({
        text: 'The document contains a dummy PDF file.',
      }),
    },
  })),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      embedContent: jest.fn().mockRejectedValue(new Error('embedding failed')),
      generateContent: jest.fn().mockResolvedValue({
        text: 'The document contains a dummy PDF file.',
      }),
    },
  })),
}));

describe('RagAgent Phase 5', () => {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'GEMINI_MODEL') {
        return fallback ?? 'gemini-2.0-flash';
      }

      return 'test-api-key';
    }),
  } as any;

  it('returns usedKnowledge=false when no chunks are found', async () => {
    const ragTools = {
      searchKnowledge: jest.fn().mockResolvedValue([]),
    };

    const agent = new RagAgent(ragTools as any, configService);
    const response = await agent.answerQuery(
      'tenant-a',
      'What is the secret moon base password?',
    );

    expect(response.usedKnowledge).toBe(false);
    expect(response.sources).toEqual([]);
    expect(response.answer).toContain(
      "couldn't find enough relevant information",
    );
  });

  it('returns sources and usedKnowledge=true for relevant chunks', async () => {
    const ragTools = {
      searchKnowledge: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          content: 'Dummy PDF file content for testing.',
          similarity: 0.91,
          tenantId: 'tenant-a',
          chunkIndex: '0',
          documentId: 'doc-1',
          documentName: 'sample.pdf',
          sourceType: 'pdf',
        },
      ]),
    };

    const agent = new RagAgent(ragTools as any, configService);
    const response = await agent.answerQuery(
      'tenant-a',
      'What information is contained in the uploaded document?',
    );

    expect(response.usedKnowledge).toBe(true);
    expect(response.sources).toEqual([
      expect.objectContaining({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        documentName: 'sample.pdf',
      }),
    ]);
    expect(response.answer).toContain('dummy PDF file');
  });

  it('returns usedKnowledge=false when the model indicates missing knowledge', async () => {
    const ragTools = {
      searchKnowledge: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          content: 'Dummy PDF file content for testing.',
          similarity: 0.91,
          tenantId: 'tenant-a',
          chunkIndex: '0',
          documentId: 'doc-1',
          documentName: 'sample.pdf',
          sourceType: 'pdf',
        },
      ]),
    };

    const agent = new RagAgent(ragTools as any, {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'GEMINI_MODEL') {
          return fallback ?? 'gemini-2.0-flash';
        }

        return 'test-api-key';
      }),
    } as any);

    jest.spyOn(agent as any, 'indicatesNoKnowledge').mockReturnValue(true);

    const response = await agent.answerQuery(
      'tenant-a',
      'What is the secret lunar colony password?',
    );

    expect(response.usedKnowledge).toBe(false);
    expect(response.sources).toEqual([]);
    expect(response.answer).toContain(
      "couldn't find enough relevant information",
    );
  });

  it('returns usedKnowledge=false when retrieved chunks are below the answer threshold', async () => {
    const ragTools = {
      searchKnowledge: jest.fn().mockResolvedValue([
        {
          id: 'chunk-weak',
          content: 'Weakly related content.',
          similarity: 0.25,
          tenantId: 'tenant-a',
          chunkIndex: '0',
          documentId: 'doc-1',
          documentName: 'sample.pdf',
          sourceType: 'pdf',
        },
      ]),
    };

    const agent = new RagAgent(ragTools as any, configService);
    const response = await agent.answerQuery(
      'tenant-a',
      'What is the secret lunar colony password?',
    );

    expect(response.usedKnowledge).toBe(false);
    expect(response.sources).toEqual([]);
  });

  it('scopes searchKnowledge calls to the authenticated tenant', async () => {
    const ragTools = {
      searchKnowledge: jest.fn().mockResolvedValue([]),
    };

    const agent = new RagAgent(ragTools as any, configService);
    await agent.answerQuery('tenant-a', 'What is in the document?');

    expect(ragTools.searchKnowledge).toHaveBeenCalledWith(
      'tenant-a',
      'What is in the document?',
      5,
      undefined,
    );
    expect(ragTools.searchKnowledge).not.toHaveBeenCalledWith(
      'tenant-b',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('RagTools Phase 5', () => {
  it('returns an empty knowledge result when embedding generation fails', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'GOOGLE_GENAI_API_KEY') {
          return 'test-api-key';
        }
        return fallback;
      }),
    } as any;

    const tools = new RagTools(configService, { execute: jest.fn() } as any);

    await expect(
      tools.searchKnowledge('tenant-1', 'What is the company overview?'),
    ).resolves.toEqual([]);
  });

  it('filters chunks below the minimum similarity threshold', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'GOOGLE_GENAI_API_KEY') {
          return 'test-api-key';
        }
        if (key === 'RAG_MIN_SIMILARITY') {
          return '0.8';
        }
        return fallback;
      }),
    } as any;

    const db = {
      execute: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'chunk-low',
            content: 'Weak match',
            tenantId: 'tenant-1',
            documentId: 'doc-1',
            documentName: 'sample.pdf',
            similarity: 0.4,
          },
        ],
      }),
    };

    jest.spyOn(RagTools.prototype, 'embedText').mockResolvedValue(
      Array.from({ length: 3072 }, () => 0.01),
    );

    const tools = new RagTools(configService, db as any);
    const results = await tools.searchKnowledge('tenant-1', 'dummy query');

    expect(results).toEqual([]);
  });

  it('serializes embeddings for PostgreSQL float8[] literals', () => {
    expect(toFloat8ArrayLiteral([0.1, 0.2])).toBe('{0.1,0.2}');
  });

  it('computes cosine similarity for aligned vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe('RagTools tenant isolation', () => {
  it('requires tenant context before searching', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    } as any;

    const tools = new RagTools(configService, { execute: jest.fn() } as any);

    await expect(
      tools.searchKnowledge('', 'What is in the document?'),
    ).rejects.toThrow('Tenant context is required');
  });

  it('executes a tenant-scoped database search when knowledge is queried', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    } as any;

    const db = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
    };

    jest.spyOn(RagTools.prototype, 'embedText').mockResolvedValue(
      Array.from({ length: 3072 }, () => 0.01),
    );

    const tools = new RagTools(configService, db as any);
    await tools.searchKnowledge('tenant-a', 'document content', 3, 'kb-1');

    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
