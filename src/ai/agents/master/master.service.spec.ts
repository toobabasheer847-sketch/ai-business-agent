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
  };
  const taskAgent = {
    getAgentInstance: jest.fn().mockReturnValue({ name: 'task_agent' }),
  };
  const proposalAgent = {
    getAgentInstance: jest.fn().mockReturnValue({ name: 'proposal_agent' }),
  };

  beforeEach(() => {
    mockRunEphemeral.mockReset();
    (InMemoryRunner as any).lastOptions = null;

    service = new MasterAgentService(
      communicationAgentService as any,
      ragAgent as any,
      taskAgent as any,
      proposalAgent as any,
    );
  });

  it('invokes the existing Master RoutedAgent and returns the final response', async () => {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          author: 'task_agent',
          content: { parts: [{ text: 'Here are your tasks...' }] },
        },
      ]),
    );

    const result = await service.invoke(tenantId, 'Show me my tasks');

    expect(mockRunEphemeral).toHaveBeenCalledTimes(1);
    expect(mockRunEphemeral).toHaveBeenCalledWith({
      userId: tenantId,
      newMessage: {
        parts: [{ text: 'Show me my tasks' }],
      },
    });
    expect((InMemoryRunner as any).lastOptions.agent.name).toBe('master_agent');
    expect(result).toEqual({
      response: 'Here are your tasks...',
      delegation: 'task',
    });
  });

  it('maps known ADK authors to delegation labels', async () => {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          author: 'rag_agent',
          content: { parts: [{ text: 'Refunds are issued within 30 days.' }] },
        },
      ]),
    );

    const result = await service.invoke(tenantId, 'What is our refund policy?');

    expect(result.delegation).toBe('rag');
    expect(result.response).toContain('Refunds');
  });

  it('does not invent delegation when ADK emits no author', async () => {
    mockRunEphemeral.mockReturnValue(
      asyncEvents([
        {
          content: { parts: [{ text: 'Generic reply' }] },
        },
      ]),
    );

    const result = await service.invoke(tenantId, 'Hello');

    expect(result).toEqual({
      response: 'Generic reply',
      delegation: null,
    });
  });

  it('rejects a missing tenant context', async () => {
    await expect(service.invoke('', 'Show me my tasks')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('rejects an empty message', async () => {
    await expect(service.invoke(tenantId, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockRunEphemeral).not.toHaveBeenCalled();
  });

  it('hides ADK execution errors from the client', async () => {
    mockRunEphemeral.mockImplementation(() => {
      throw new Error('GOOGLE_GENAI_API_KEY missing: sk-secret');
    });

    await expect(
      service.invoke(tenantId, 'Show me my tasks'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    try {
      await service.invoke(tenantId, 'Show me my tasks');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      const exception = error as InternalServerErrorException;
      expect(exception.getStatus()).toBe(500);
      expect(JSON.stringify(exception.getResponse())).not.toContain('sk-secret');
      expect(JSON.stringify(exception.getResponse())).toContain(
        'Master Agent failed to process the request',
      );
    }
  });
});
