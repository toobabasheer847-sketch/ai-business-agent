import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';

const getSystemStatusTool = new FunctionTool({
  name: 'get_system_status',

  description:
    'Returns the current status of the AI Business Agent system.',

  parameters: z.object({}),

  execute: async () => {
    return {
      status: 'success',
      message: 'AI Business Agent system is running.',
    };
  },
});

export const masterAgent = new LlmAgent({
  name: 'master_agent',

  model: 'gemini-2.5-flash',

  description:
    'Main orchestration agent for the AI Business Agent system.',

  instruction: `
You are the Master Agent of an AI Business Agent system.

Your responsibilities are:

1. Understand the user's request.
2. Decide which agent or tool should handle the request.
3. Never invent company information.
4. Use available tools when required.
5. Give clear and concise responses.

You currently have access to a system status tool.
`,

  tools: [getSystemStatusTool],
});
