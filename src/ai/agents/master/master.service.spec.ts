import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

const mockRunEphemeral = jest.fn();

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

  class MockRoutedAgent {
    name = 'master_agent';
    constructor(public options: any) {}
  }

  class MockInMemoryRunner {
    static lastOptions: { appName?: string; agent?: { name?: string } } | null =
      null;

    constructor(public options: any) {
      MockInMemoryRunner.lastOptions = options;
    }

    runEphemeral(input: any) {
      return mockRunEphemeral(input);
    }
  }

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
    Gemini: MockGemini,
    RoutedAgent: MockRoutedAgent,
    InMemoryRunner: MockInMemoryRunner,
  };
});

import { InMemoryRunner } from '@google/adk';
import { MasterAgentService } from './master.service';

function asyncEvents(events: any[]) {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

describe('MasterAgentService', () => {
  const tenantId = 'tenant-jwt-1';
  let service: MasterAgentService;

  const communicationAgentService = {
    getAgent: jest.fn().mockReturnValue({ name: 'communication_agent' }),
  };
  const ragAgent = {
    getAgentInstance: jest.fn().mockReturnValue({ name: 'rag_agent' }),
    answerQuery: jest.fn(),
  };
  const taskAgent = {
    getAgentInstance: jest.fn().mockReturnValue({ name: 'task_agent' }),
  };
  const proposalAgent = {
    getAgentInstance: jest.fn().mockReturnValue({ name: 'proposal_agent' }),
  };

  beforeEach(() => {
    mockRunEphemeral.mockReset();
    ragAgent.answerQuery.mockReset();
    (InMemoryRunner as any).lastOptions = null;

    service = new MasterAgentService(
      communicationAgentService as any,
      ragAgent as any,
      taskAgent as any,
      proposalAgent as any,
    );
  });

  it('routes knowledge questions through RagAgent.answerQuery with tenant context', async () => {
    ragAgent.answerQuery.mockResolvedValue({
      answer: 'The uploaded document contains a dummy PDF file.',
      sources: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          documentName: 'sample.pdf',
        },
      ],
      usedKnowledge: true,
    });

    const result = await service.invoke(
      tenantId,
      'What information is contained in the uploaded document?',
    );

    expect(ragAgent.answerQuery).toHaveBeenCalledWith(
      tenantId,
      'What information is contained in the uploaded document?',
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(result).toEqual({
      response: 'The uploaded document contains a dummy PDF file.',
      delegation: 'rag',
      sources: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          documentName: 'sample.pdf',
        },
      ],
      usedKnowledge: true,
      message: undefined,
    });
  });

  it('returns usedKnowledge=false for unknown knowledge questions', async () => {
    ragAgent.answerQuery.mockResolvedValue({
      answer:
        "I couldn't find enough relevant information in the knowledge base to answer that question.",
      sources: [],
      usedKnowledge: false,
      message: 'No relevant chunks were found.',
    });

    const result = await service.invoke(
      tenantId,
      'What is the capital of Mars colony 7?',
    );

    expect(result.delegation).toBe('rag');
    expect(result.usedKnowledge).toBe(false);
    expect(result.sources).toEqual([]);
  });

  it('invokes the existing Master RoutedAgent for non-RAG requests', async () => {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          author: 'task_agent',
          content: { parts: [{ text: 'Here are your tasks...' }] },
        },
      ]),
    );

    const result = await service.invoke(tenantId, 'Create a task for Sarah');

    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
    expect(result).toEqual({
      response: 'Here are your tasks...',
      delegation: 'task',
    });
  });

  it('rejects a missing tenant context', async () => {
    await expect(service.invoke('', 'Show me my tasks')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
  });

  it('rejects an empty message', async () => {
    await expect(service.invoke(tenantId, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
  });

  it('routes greetings through the Master RoutedAgent instead of RAG', async () => {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          author: 'master_chat_agent',
          content: { parts: [{ text: 'Hello! How can I help you today?' }] },
        },
      ]),
    );

    const result = await service.invoke(tenantId, 'hello');

    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      response: 'Hello! How can I help you today?',
      delegation: 'chat',
    });
  });

  it('hides RAG execution errors from the client', async () => {
    ragAgent.answerQuery.mockRejectedValue(
      new Error('DATABASE_URL contains secret'),
    );

    await expect(
      service.invoke(tenantId, 'What is in the uploaded document?'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    try {
      await service.invoke(tenantId, 'What is in the uploaded document?');
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('DATABASE_URL');
    }
  });

  it('hides ADK execution errors from the client', async () => {
    mockRunEphemeral.mockImplementation(() => {
      throw new Error('GOOGLE_GENAI_API_KEY missing: sk-secret');
    });

    await expect(
      service.invoke(tenantId, 'Create a task for Sarah'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
