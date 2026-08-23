import { ConfigService } from '@nestjs/config';

jest.mock('@google/adk', () => {
  class MockFunctionTool {
    constructor(public options: any) {}
  }

  class MockLlmAgent {
    name: string;
    parent: string | null = null;

    constructor(public options: any) {
      this.name = options.name;
    }
  }

  class MockGemini {
    constructor(public options: any) {}
  }

  const attachedAgentInstances = new WeakSet<object>();

  class MockRoutedAgent {
    name = 'master_agent';
    subAgents: Array<{ name: string }> = [];

    constructor(public options: any) {
      for (const agent of options.agents ?? []) {
        if (attachedAgentInstances.has(agent)) {
          const parent = (agent as { parent?: string | null }).parent ?? 'master_agent';
          throw new Error(
            `Agent "${agent.name}" already has a parent agent, current parent: "${parent}", trying to add: "master_agent"`,
          );
        }

        agent.parent = 'master_agent';
        attachedAgentInstances.add(agent);
        this.subAgents.push({ name: agent.name });
      }
    }
  }

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
    Gemini: MockGemini,
    RoutedAgent: MockRoutedAgent,
  };
});

import { AdkAgentFactoryService } from './adk-agent.factory';

describe('AdkAgentFactoryService', () => {
  let factory: AdkAgentFactoryService;
  let taskBuildLlmAgent: jest.Mock;
  let proposalBuildLlmAgent: jest.Mock;
  let ragBuildLlmAgent: jest.Mock;

  beforeEach(() => {
    let taskCounter = 0;
    let proposalCounter = 0;
    let ragCounter = 0;

    taskBuildLlmAgent = jest.fn((modelName: string) => ({
      name: 'task_agent',
      modelName,
      id: ++taskCounter,
    }));
    proposalBuildLlmAgent = jest.fn((modelName: string) => ({
      name: 'proposal_agent',
      modelName,
      id: ++proposalCounter,
    }));
    ragBuildLlmAgent = jest.fn((modelName: string) => ({
      name: 'rag_agent',
      modelName,
      id: ++ragCounter,
    }));

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_MODEL') return 'gemini-2.0-flash';
        if (key === 'GOOGLE_GENAI_API_KEY') return 'test-key';
        return undefined;
      }),
    } as unknown as ConfigService;

    factory = new AdkAgentFactoryService(
      configService,
      { createListMailsTool: jest.fn(), createDraftMailTool: jest.fn(), createSendMailTool: jest.fn() } as any,
      { createSendSmsTool: jest.fn(), createInitiateCallTool: jest.fn() } as any,
      { buildLlmAgent: ragBuildLlmAgent } as any,
      { buildLlmAgent: taskBuildLlmAgent } as any,
      { buildLlmAgent: proposalBuildLlmAgent } as any,
    );
  });

  it('builds a master agent without duplicate-parent errors', () => {
    expect(() => factory.getMasterAgent(null)).not.toThrow();
  });

  it('attaches task_agent exactly once per master agent via fresh instances', () => {
    const master = factory.getMasterAgent(null) as { subAgents: Array<{ name: string }> };

    expect(taskBuildLlmAgent).toHaveBeenCalledTimes(1);
    expect(
      master.subAgents.filter((agent) => agent.name === 'task_agent'),
    ).toHaveLength(1);
  });

  it('creates separate task_agent instances for different tenant models', () => {
    factory.getMasterAgent('gemini-2.5-pro');
    factory.getMasterAgent('gemini-3.6-flash');

    expect(taskBuildLlmAgent).toHaveBeenCalledTimes(2);
    expect(taskBuildLlmAgent.mock.calls[0][0]).toBe('gemini-2.5-pro');
    expect(taskBuildLlmAgent.mock.calls[1][0]).toBe('gemini-3.6-flash');
    expect(taskBuildLlmAgent.mock.results[0].value.id).not.toBe(
      taskBuildLlmAgent.mock.results[1].value.id,
    );
  });

  it('reuses cached master agent for the same resolved model', () => {
    const first = factory.getMasterAgent('gemini-2.5-pro');
    const second = factory.getMasterAgent('gemini-2.5-pro');

    expect(first).toBe(second);
    expect(taskBuildLlmAgent).toHaveBeenCalledTimes(1);
  });

  it('does not attach the standalone getRagAgent instance to Master', () => {
    const standalone = factory.getRagAgent('gemini-2.5-pro');
    const master = factory.getMasterAgent('gemini-2.5-pro') as {
      subAgents: Array<{ name: string; id: number }>;
    };
    const attachedRag = master.subAgents.find((agent) => agent.name === 'rag_agent');

    expect(attachedRag).toBeDefined();
    expect(attachedRag).not.toBe(standalone);
    expect(ragBuildLlmAgent).toHaveBeenCalledTimes(2);
  });

  it('rejects reusing the same rag_agent instance under a second master', () => {
    const sharedRag = { name: 'rag_agent', parent: null as string | null, id: 1 };
    ragBuildLlmAgent.mockReturnValue(sharedRag);

    factory.getMasterAgent('gemini-2.5-pro');

    expect(() => factory.getMasterAgent('gemini-3.6-flash')).toThrow(
      /rag_agent.*already has a parent agent/i,
    );
  });

  it('rejects reusing the same task_agent instance under a second master', () => {
    const sharedTaskAgent = { name: 'task_agent', parent: null as string | null, id: 1 };
    taskBuildLlmAgent.mockReturnValue(sharedTaskAgent);

    factory.getMasterAgent('gemini-2.5-pro');

    expect(() => factory.getMasterAgent('gemini-3.6-flash')).toThrow(
      /task_agent.*already has a parent agent/i,
    );
  });
});
