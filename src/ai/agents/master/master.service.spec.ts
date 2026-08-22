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
    delegateAdkQuery: jest.fn(),
  };
  const taskAgent = {
    getAgentInstance: jest.fn().mockReturnValue({ name: 'task_agent' }),
    delegateNaturalLanguage: jest.fn(),
  };
  const proposalAgent = {
    getAgentInstance: jest.fn().mockReturnValue({ name: 'proposal_agent' }),
  };
  const masterSettingsService = {
    getOrCreate: jest.fn().mockResolvedValue({ aiModel: null }),
  };
  const adkAgentFactory = {
    getMasterAgent: jest.fn().mockReturnValue({ name: 'master_agent' }),
    getRagAgent: jest.fn().mockReturnValue({ name: 'rag_agent' }),
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
    ragAgent.delegateAdkQuery.mockReset();
    masterSettingsService.getOrCreate.mockReset();
    masterSettingsService.getOrCreate.mockResolvedValue({ aiModel: null });
    adkAgentFactory.getMasterAgent.mockReset();
    adkAgentFactory.getMasterAgent.mockReturnValue({ name: 'master_agent' });
    adkAgentFactory.getRagAgent.mockReset();
    adkAgentFactory.getRagAgent.mockReturnValue({ name: 'rag_agent' });
    taskAgent.delegateNaturalLanguage.mockReset();
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
      masterSettingsService as any,
      adkAgentFactory as any,
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
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'create',
      message: 'Task created successfully.',
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Call Ahmed',
        priority: 'medium',
        status: 'pending',
        dueAt: '2026-08-21T00:00:00.000Z',
      },
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Create a task to call Ahmed tomorrow.',
    );

    expect(result.conversationId).toBe(conversationId);
    expect(result.delegation).toBe('task');
    expect(result.response).toContain('Task created successfully');
    expect(result.response).toContain('Call Ahmed');
    expect(conversationRepository.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        role: 'assistant',
        content: result.response,
        metadata: expect.objectContaining({
          delegation: 'task',
        }),
      }),
    );
  });

  it('stores delegation, sources, and usedKnowledge in assistant metadata', async () => {
    ragAgent.delegateAdkQuery.mockResolvedValue({
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
    ragAgent.delegateAdkQuery.mockResolvedValue({
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

    expect(ragAgent.delegateAdkQuery).toHaveBeenCalledWith(
      tenantId,
      userId,
      query,
      { name: 'rag_agent' },
    );
    expect(adkAgentFactory.getRagAgent).toHaveBeenCalledWith(null);
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
    ragAgent.delegateAdkQuery.mockResolvedValue({
      answer: 'Tenant scoped answer',
      sources: [],
      usedKnowledge: true,
    });

    await service.invoke(
      tenantId,
      userId,
      'What information is contained in the uploaded document?',
    );

    expect(ragAgent.delegateAdkQuery).toHaveBeenCalledTimes(1);
    expect(ragAgent.delegateAdkQuery.mock.calls[0][0]).toBe(tenantId);
    expect(ragAgent.delegateAdkQuery.mock.calls[0][1]).toBe(userId);
    expect(ragAgent.delegateAdkQuery.mock.calls[0][0]).not.toBe(otherTenantId);
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
    ragAgent.delegateAdkQuery.mockResolvedValue({
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

  it('invokes the existing Master RoutedAgent for non-RAG, non-task requests', async () => {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          author: 'communication_agent',
          content: { parts: [{ text: 'I can help draft that email.' }] },
        },
      ]),
    );

    const result = await service.invoke(
      tenantId,
      userId,
      'Send an email to Ahmed.',
    );

    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(taskAgent.delegateNaturalLanguage).not.toHaveBeenCalled();
    expect(ragAgent.delegateAdkQuery).not.toHaveBeenCalled();
    expect(result).toEqual({
      conversationId,
      response: 'I can help draft that email.',
      delegation: 'communication',
    });
  });

  it('rejects a missing tenant context', async () => {
    await expect(
      service.invoke('', userId, 'Show me my tasks'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(ragAgent.delegateAdkQuery).not.toHaveBeenCalled();
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
    expect(ragAgent.delegateAdkQuery).not.toHaveBeenCalled();
  });

  it('routes greetings through the Master RoutedAgent instead of RAG', async () => {
    mockChatEvents();

    const result = await service.invoke(tenantId, userId, 'hello');

    expect(ragAgent.delegateAdkQuery).not.toHaveBeenCalled();
    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      conversationId,
      response: 'Hello! How can I help you today?',
      delegation: 'chat',
    });
  });

  it('hides RAG execution errors from the client', async () => {
    ragAgent.delegateAdkQuery.mockRejectedValue(
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
      service.invoke(tenantId, userId, 'hello'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(taskAgent.delegateNaturalLanguage).not.toHaveBeenCalled();
  });

  it('routes task create through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'create',
      message: 'Task created successfully.',
      data: {
        title: 'Call Ahmed',
        priority: 'medium',
        status: 'pending',
        dueAt: '2026-08-21T00:00:00.000Z',
      },
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Create a task to call Ahmed tomorrow.',
    );

    expect(result.delegation).toBe('task');
    expect(result.response).toContain('Call Ahmed');
    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledTimes(1);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('routes task list through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'list',
      message: 'Tasks retrieved.',
      data: [
        {
          title: 'Call Ahmed',
          priority: 'medium',
          status: 'pending',
        },
      ],
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Show my pending tasks.',
    );

    expect(result.delegation).toBe('task');
    expect(result.response).toContain('Call Ahmed');
    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'Show my pending tasks.',
      { tenantId, userId },
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('routes CRM-aware task list through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'list',
      message: 'Tasks retrieved for ABC Technologies.',
      data: [
        {
          title: 'Follow up',
          companyId: 'company-1',
          company: { id: 'company-1', name: 'ABC Technologies' },
          priority: 'medium',
          status: 'pending',
        },
      ],
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Show my tasks for ABC',
    );

    expect(result.delegation).toBe('task');
    expect(result.response).toContain('ABC Technologies');
    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'Show my tasks for ABC',
      { tenantId, userId },
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('routes task complete through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'complete',
      message: 'Task completed.',
      data: { title: 'ABC follow-up', status: 'completed', priority: 'medium' },
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Mark my ABC follow-up task as completed.',
    );

    expect(result.delegation).toBe('task');
    expect(result.response).toContain('completed');
    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledTimes(1);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('routes task priority updates through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'update',
      message: 'Task updated.',
      data: { title: 'ABC', priority: 'high', status: 'pending' },
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Change my ABC task priority to high.',
    );

    expect(result.delegation).toBe('task');
    expect(result.response).toContain('high');
    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledTimes(1);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('passes JWT tenant and user to TaskService, not identity from the message', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'create',
      message: 'Task created successfully.',
      data: { title: 'Call Ahmed', priority: 'medium', status: 'pending' },
    });

    await service.invoke(
      tenantId,
      userId,
      'Create a task for tenant-B createdBy attacker-user',
    );

    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'Create a task for tenant-B createdBy attacker-user',
      { tenantId, userId },
    );
    const context = taskAgent.delegateNaturalLanguage.mock.calls[0][1];
    expect(context.tenantId).toBe(tenantId);
    expect(context.tenantId).not.toBe('tenant-B');
    expect(context.userId).toBe(userId);
    expect(context.userId).not.toBe('attacker-user');
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('returns TaskService clarification without guessing or calling ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'clarify',
      message: 'I found 2 matching tasks. Which one do you mean?',
      data: [
        { title: 'Follow up with Ahmed', status: 'pending', priority: 'medium' },
        { title: 'Follow up with ABC', status: 'pending', priority: 'medium' },
      ],
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Complete my follow-up task.',
    );

    expect(result.delegation).toBe('task');
    expect(result.response).toContain('I found 2 matching tasks');
    expect(result.response).toContain('Follow up with Ahmed');
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('does not fall back to ADK when TaskService fails', async () => {
    taskAgent.delegateNaturalLanguage.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      service.invoke(tenantId, userId, 'Show my pending tasks.'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('loads tenant master settings and uses tenant aiModel for ADK agents', async () => {
    mockChatEvents();
    masterSettingsService.getOrCreate.mockResolvedValue({
      aiModel: 'gemini-2.5-pro',
    });

    await service.invoke(tenantId, userId, 'hello');

    expect(masterSettingsService.getOrCreate).toHaveBeenCalledWith(tenantId);
    expect(adkAgentFactory.getMasterAgent).toHaveBeenCalledWith('gemini-2.5-pro');
  });

  it('still routes greetings through ADK chat, not TaskService', async () => {
    mockChatEvents();

    await service.invoke(tenantId, userId, 'hello');

    expect(taskAgent.delegateNaturalLanguage).not.toHaveBeenCalled();
    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(mockRunEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({ userId }),
    );
    expect(mockRunEphemeral.mock.calls[0][0].userId).not.toBe(tenantId);
  });

  it('distinguishes tenant A user A from tenant A user B in ADK runner identity', async () => {
    mockChatEvents();

    await service.invoke(tenantId, userId, 'hello');
    expect(mockRunEphemeral.mock.calls[0][0].userId).toBe(userId);

    mockRunEphemeral.mockClear();
    mockChatEvents();

    await service.invoke(tenantId, otherUserId, 'hello');
    expect(mockRunEphemeral.mock.calls[0][0].userId).toBe(otherUserId);
    expect(mockRunEphemeral.mock.calls[0][0].userId).not.toBe(userId);
  });

  it('routes a company follow-up through TaskService with JWT identity', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'create',
      message: 'Task created: Follow up with ABC Technologies — due 2026-08-21.',
      data: {
        title: 'Follow up with ABC Technologies',
        companyId: 'company-1',
        company: { id: 'company-1', name: 'ABC Technologies' },
        priority: 'medium',
        status: 'pending',
      },
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Create a task to follow up with ABC company tomorrow.',
    );

    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'Create a task to follow up with ABC company tomorrow.',
      { tenantId, userId },
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(result.delegation).toBe('task');
    expect(result.response).toContain('ABC Technologies');
  });

  it('routes overdue and remind-me task phrasing through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'list',
      message: 'Tasks retrieved.',
      data: [{ title: 'Follow up', status: 'pending', priority: 'medium' }],
    });

    await service.invoke(tenantId, userId, 'Show my overdue tasks');
    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'Show my overdue tasks',
      { tenantId, userId },
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();

    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'create',
      message: 'Task created successfully.',
      data: { title: 'Call Ahmed', status: 'pending', priority: 'medium' },
    });

    await service.invoke(
      tenantId,
      userId,
      'Remind me to call Ahmed tomorrow at 3 PM',
    );
    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'Remind me to call Ahmed tomorrow at 3 PM',
      { tenantId, userId },
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('routes task analytics phrasing through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'analytics',
      message: 'You have 4 overdue tasks.',
      data: { summary: { total: 20, overdue: 4 }, completionRate: 35 },
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'How many tasks are overdue?',
    );

    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'How many tasks are overdue?',
      { tenantId, userId },
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(result.delegation).toBe('task');
    expect(result.response).toContain('4 overdue');
  });

  it('routes task report phrasing through TaskService and skips ADK', async () => {
    taskAgent.delegateNaturalLanguage.mockResolvedValue({
      action: 'analytics',
      message: 'Task report: 20 total.',
      data: { summary: { total: 20 } },
    });

    const result = await service.invoke(
      tenantId,
      userId,
      'Give me a report of my tasks.',
    );

    expect(taskAgent.delegateNaturalLanguage).toHaveBeenCalledWith(
      'Give me a report of my tasks.',
      { tenantId, userId },
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
    expect(result.delegation).toBe('task');
    expect(result.response).toContain('Task report');
  });
});
