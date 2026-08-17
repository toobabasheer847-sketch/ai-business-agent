jest.mock('@google/adk', () => {
  class MockFunctionTool {
    constructor(public options: any) {}
  }

  class MockLlmAgent {
    constructor(public options: any) {}
  }

  class MockRoutedAgent {
    name = 'master_agent';
    constructor(public options: any) {}
  }

  return {
    FunctionTool: MockFunctionTool,
    LlmAgent: MockLlmAgent,
    RoutedAgent: MockRoutedAgent,
  };
});

import { buildMasterRouter } from './master.agent';

const ALL_AGENTS = {
  master_status_agent: {},
  proposal_agent: {},
  task_agent: {},
  communication_agent: {},
  rag_agent: {},
};

function messageContext(text: string) {
  return {
    newMessage: {
      parts: [{ text }],
    },
  };
}

describe('Master Agent regex router', () => {
  const router = buildMasterRouter();

  it('routes an explicit singular task request to task_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Create a task for Sarah')),
    ).resolves.toBe('task_agent');
  });

  it('falls back away from task_agent for plural "tasks" (current regex limitation)', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Show me my tasks')),
    ).resolves.toBe('communication_agent');
  });

  it('routes knowledge questions to rag_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('What is our refund policy?')),
    ).resolves.toBe('rag_agent');
  });

  it('routes email requests to communication_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Draft an email to the client')),
    ).resolves.toBe('communication_agent');
  });

  it('routes proposal requests to proposal_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Generate a proposal')),
    ).resolves.toBe('proposal_agent');
  });

  it('gives proposal keywords priority over task keywords', async () => {
    await expect(
      router(
        ALL_AGENTS,
        messageContext('Create a task for the proposal follow-up'),
      ),
    ).resolves.toBe('proposal_agent');
  });
});
