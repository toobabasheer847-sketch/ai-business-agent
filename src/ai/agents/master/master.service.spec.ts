import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
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
  const otherTenantId = 'tenant-jwt-2';
  const userId = 'user-jwt-1';
  const otherUserId = 'user-jwt-2';
  const conversationId = '11111111-1111-4111-8111-111111111111';

  let service: MasterAgentService;
  let conversationRepository: {
    findByIdTenantAndUser: jest.Mock;
    findRecentByUser: jest.Mock;
    findRecentMessages: jest.Mock;
    create: jest.Mock;
    createMessage: jest.Mock;
    touchUpdatedAt: jest.Mock;
    deleteByIdTenantAndUser: jest.Mock;
  };
  let configService: { get: jest.Mock };

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

  const ownedConversation = {
    id: conversationId,
    tenantId,
    userId,
    channel: 'assistant',
    status: 'active',
    title: 'hello',
  };

  function mockChatEvents() {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          author: 'master_chat_agent',
          content: { parts: [{ text: 'Hello! How can I help you today?' }] },
        },
      ]),
    );
  }

  beforeEach(() => {
    mockRunEphemeral.mockReset();
    ragAgent.answerQuery.mockReset();
    (InMemoryRunner as any).lastOptions = null;

    conversationRepository = {
      findByIdTenantAndUser: jest.fn().mockResolvedValue(ownedConversation),
      findRecentByUser: jest.fn().mockResolvedValue([]),
      findRecentMessages: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(ownedConversation),
      createMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      touchUpdatedAt: jest.fn().mockResolvedValue(undefined),
      deleteByIdTenantAndUser: jest.fn().mockResolvedValue(true),
    };
    configService = {
      get: jest.fn().mockReturnValue(20),
    };

    service = new MasterAgentService(
      communicationAgentService as any,
      ragAgent as any,
      taskAgent as any,
      proposalAgent as any,
      conversationRepository as any,
      configService as any,
    );
  });

  it('creates a conversation when conversationId is missing', async () => {
    mockChatEvents();

    const result = await service.invoke(tenantId, userId, 'hello');

    expect(conversationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        channel: 'assistant',
      }),
    );
    expect(conversationRepository.findByIdTenantAndUser).not.toHaveBeenCalled();
    expect(result.conversationId).toBe(conversationId);
  });

  it('reuses an existing conversation for the authenticated user', async () => {
    mockChatEvents();

    const result = await service.invoke(
      tenantId,
      userId,
      'hello again',
      conversationId,
    );

    expect(conversationRepository.findByIdTenantAndUser).toHaveBeenCalledWith(
      conversationId,
      tenantId,
      userId,
    );
    expect(conversationRepository.create).not.toHaveBeenCalled();
    expect(result.conversationId).toBe(conversationId);
  });

  it('rejects a missing conversation', async () => {
    conversationRepository.findByIdTenantAndUser.mockResolvedValue(undefined);

    await expect(
      service.invoke(tenantId, userId, 'hello', conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(conversationRepository.createMessage).not.toHaveBeenCalled();
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('rejects another user conversation in the same tenant', async () => {
    conversationRepository.findByIdTenantAndUser.mockResolvedValue(undefined);

    await expect(
      service.invoke(tenantId, otherUserId, 'hello', conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(conversationRepository.findByIdTenantAndUser).toHaveBeenCalledWith(
      conversationId,
      tenantId,
      otherUserId,
    );
  });

  it('rejects another tenant conversation', async () => {
    conversationRepository.findByIdTenantAndUser.mockResolvedValue(undefined);

    await expect(
      service.invoke(otherTenantId, userId, 'hello', conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(conversationRepository.findByIdTenantAndUser).toHaveBeenCalledWith(
      conversationId,
      otherTenantId,
      userId,
    );
  });

  it('loads bounded history oldest to newest for conversational chat', async () => {
    mockChatEvents();
    conversationRepository.findRecentMessages.mockResolvedValue([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ]);

    await service.invoke(tenantId, userId, 'hello', conversationId);

    expect(conversationRepository.findRecentMessages).toHaveBeenCalledWith(
      conversationId,
      tenantId,
      20,
    );
    expect(mockRunEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        newMessage: {
          parts: [
            {
              text: expect.stringMatching(
                /Previous conversation:[\s\S]*User: first[\s\S]*Assistant: second[\s\S]*Current message:\nhello/,
              ),
            },
          ],
        },
      }),
    );
  });

  it('persists the user message before generating a response', async () => {
    mockChatEvents();
    const order: string[] = [];
    conversationRepository.createMessage.mockImplementation(async (input) => {
      order.push(input.role);
      return { id: input.role };
    });
    mockRunEphemeral.mockImplementation(() => {
      order.push('ai');
      return asyncEvents([
        {
          author: 'master_chat_agent',
          content: { parts: [{ text: 'Hello!' }] },
        },
      ]);
    });

    await service.invoke(tenantId, userId, 'hello');

    expect(order).toEqual(['user', 'ai', 'assistant']);
    expect(conversationRepository.createMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId,
        userId,
        conversationId,
        role: 'user',
        content: 'hello',
      }),
    );
  });

  it('persists the assistant message and returns conversationId', async () => {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          author: 'task_agent',
          content: { parts: [{ text: 'Here are your tasks...' }] },
        },
      ]),
    );

    const result = await service.invoke(tenantId, userId, 'Create a task for Sarah');

    expect(result).toEqual({
      conversationId,
      response: 'Here are your tasks...',
      delegation: 'task',
    });
    expect(conversationRepository.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        role: 'assistant',
        content: 'Here are your tasks...',
        metadata: expect.objectContaining({
          delegation: 'task',
        }),
      }),
    );
  });

  it('stores delegation, sources, and usedKnowledge in assistant metadata', async () => {
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

    await service.invoke(
      tenantId,
      userId,
      'What information is contained in the uploaded document?',
    );

    expect(conversationRepository.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        role: 'assistant',
        metadata: {
          delegation: 'rag',
          sources: [
            {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              documentName: 'sample.pdf',
            },
          ],
          usedKnowledge: true,
        },
      }),
    );
  });

  it('returns an error when assistant persistence fails after a successful reply', async () => {
    mockChatEvents();
    conversationRepository.createMessage
      .mockResolvedValueOnce({ id: 'user-msg' })
      .mockRejectedValueOnce(new Error('disk full'));

    await expect(
      service.invoke(tenantId, userId, 'hello'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('returns an error when AI generation fails after the user message is persisted', async () => {
    mockRunEphemeral.mockImplementation(() => {
      throw new Error('model timeout');
    });

    await expect(
      service.invoke(tenantId, userId, 'hello'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(conversationRepository.createMessage).toHaveBeenCalledTimes(1);
    expect(conversationRepository.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user' }),
    );
  });

  it('routes knowledge questions through RagAgent.answerQuery with the current user query', async () => {
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
    conversationRepository.findRecentMessages.mockResolvedValue([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);

    const query = 'What information is contained in the uploaded document?';
    const result = await service.invoke(tenantId, userId, query, conversationId);

    expect(ragAgent.answerQuery).toHaveBeenCalledWith(tenantId, query);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(result).toEqual({
      conversationId,
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

  it('keeps RAG tenant isolation unchanged', async () => {
    ragAgent.answerQuery.mockResolvedValue({
      answer: 'Tenant scoped answer',
      sources: [],
      usedKnowledge: true,
    });

    await service.invoke(
      tenantId,
      userId,
      'What information is contained in the uploaded document?',
    );

    expect(ragAgent.answerQuery).toHaveBeenCalledTimes(1);
    expect(ragAgent.answerQuery.mock.calls[0][0]).toBe(tenantId);
    expect(ragAgent.answerQuery.mock.calls[0][0]).not.toBe(otherTenantId);
  });

  it('caps history loading at the maximum of 50', async () => {
    mockChatEvents();
    configService.get.mockReturnValue(999);

    await service.invoke(tenantId, userId, 'hello', conversationId);

    expect(service.getChatHistoryLimit()).toBe(50);
    expect(conversationRepository.findRecentMessages).toHaveBeenCalledWith(
      conversationId,
      tenantId,
      50,
    );
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
      userId,
      'What is the capital of Mars colony 7?',
    );

    expect(result.delegation).toBe('rag');
    expect(result.usedKnowledge).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.conversationId).toBe(conversationId);
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

    const result = await service.invoke(
      tenantId,
      userId,
      'Create a task for Sarah',
    );

    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
    expect(result).toEqual({
      conversationId,
      response: 'Here are your tasks...',
      delegation: 'task',
    });
  });

  it('rejects a missing tenant context', async () => {
    await expect(
      service.invoke('', userId, 'Show me my tasks'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
  });

  it('rejects a missing user context', async () => {
    await expect(
      service.invoke(tenantId, '', 'Show me my tasks'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an empty message', async () => {
    await expect(
      service.invoke(tenantId, userId, '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
  });

  it('routes greetings through the Master RoutedAgent instead of RAG', async () => {
    mockChatEvents();

    const result = await service.invoke(tenantId, userId, 'hello');

    expect(ragAgent.answerQuery).not.toHaveBeenCalled();
    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      conversationId,
      response: 'Hello! How can I help you today?',
      delegation: 'chat',
    });
  });

  it('hides RAG execution errors from the client', async () => {
    ragAgent.answerQuery.mockRejectedValue(
      new Error('DATABASE_URL contains secret'),
    );

    await expect(
      service.invoke(
        tenantId,
        userId,
        'What is in the uploaded document?',
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    try {
      await service.invoke(
        tenantId,
        userId,
        'What is in the uploaded document?',
      );
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('DATABASE_URL');
    }
  });

  it('hides ADK execution errors from the client', async () => {
    mockRunEphemeral.mockImplementation(() => {
      throw new Error('GOOGLE_GENAI_API_KEY missing: sk-secret');
    });

    await expect(
      service.invoke(tenantId, userId, 'Create a task for Sarah'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
