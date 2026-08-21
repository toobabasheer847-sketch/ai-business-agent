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
  master_chat_agent: {},
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

  it('routes create/list/complete task phrasing to task_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Create a task to call Ahmed tomorrow.')),
    ).resolves.toBe('task_agent');
    await expect(
      router(ALL_AGENTS, messageContext('Show my pending tasks.')),
    ).resolves.toBe('task_agent');
    await expect(
      router(ALL_AGENTS, messageContext('Mark the follow-up task completed.')),
    ).resolves.toBe('task_agent');
  });

  it('routes plural task requests to task_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Show me my tasks')),
    ).resolves.toBe('task_agent');
  });

  it('routes greetings to master_chat_agent instead of rag_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('hello')),
    ).resolves.toBe('master_chat_agent');
  });

  it('routes casual check-ins to master_chat_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('How are you?')),
    ).resolves.toBe('master_chat_agent');
  });

  it('routes unmatched general messages to master_chat_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Hello there')),
    ).resolves.toBe('master_chat_agent');
  });

  it('routes knowledge questions to rag_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('What is our refund policy?')),
    ).resolves.toBe('rag_agent');
  });

  it('routes uploaded document questions to rag_agent', async () => {
    await expect(
      router(
        ALL_AGENTS,
        messageContext(
          'What information is contained in the uploaded document?',
        ),
      ),
    ).resolves.toBe('rag_agent');
  });

  it('routes email requests to communication_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Draft an email to the client')),
    ).resolves.toBe('communication_agent');
  });

  it('routes SMS and email sends to communication_agent, not task_agent', async () => {
    await expect(
      router(ALL_AGENTS, messageContext('Send an SMS to Ahmed.')),
    ).resolves.toBe('communication_agent');
    await expect(
      router(ALL_AGENTS, messageContext('Send an email to Ahmed.')),
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
