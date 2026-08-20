import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

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
      return undefined;
    }
  }

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
    Gemini: MockGemini,
    InMemoryRunner: MockInMemoryRunner,
  };
});

import { RagAgent } from './rag.agent';
import { RagService } from './rag.service';

describe('RagService', () => {
  const jwtTenantId = 'tenant-jwt-1';
  const bodyTenantId = 'tenant-from-request-body';

  let ragAgent: { answerQuery: jest.Mock };
  let service: RagService;

  beforeEach(() => {
    ragAgent = {
      answerQuery: jest.fn().mockResolvedValue({
        answer: 'Pricing is listed in the knowledge base.',
        sources: [],
        usedKnowledge: true,
      }),
    };

    service = new RagService(ragAgent as unknown as RagAgent);
  });

  it('uses the authenticated tenant and ignores dto.tenantId', async () => {
    await service.query(
      {
        query: 'What is our pricing?',
        tenantId: bodyTenantId,
      },
      jwtTenantId,
    );

    expect(ragAgent.answerQuery).toHaveBeenCalledTimes(1);
    expect(ragAgent.answerQuery).toHaveBeenCalledWith(
      jwtTenantId,
      'What is our pricing?',
      expect.objectContaining({ topK: undefined, knowledgeBaseId: undefined }),
    );
    expect(ragAgent.answerQuery).not.toHaveBeenCalledWith(
      bodyTenantId,
      expect.anything(),
    );
  });

  it('throws when authenticated tenant context is missing', async () => {
    await expect(
      service.query({ query: 'What is our pricing?' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
  });

  it('throws when the query is empty', async () => {
    await expect(
      service.query({ query: '   ' }, jwtTenantId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
  });

  it('hides internal execution errors from the client', async () => {
    ragAgent.answerQuery.mockRejectedValue(
      new Error('DATABASE_URL contains secret'),
    );

    await expect(
      service.query({ query: 'What is our pricing?' }, jwtTenantId),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    try {
      await service.query({ query: 'What is our pricing?' }, jwtTenantId);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('DATABASE_URL');
    }
  });
});
