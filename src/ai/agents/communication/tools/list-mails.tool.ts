import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const listMailsTool = new FunctionTool({
  name: 'list_all_mails',

  description:
    'Lists emails available in the communication inbox.',

  parameters: z.object({}),

  execute: async () => {
    return {
      status: 'success',
      mails: [
        {
          id: 'mail-001',
          from: 'client@example.com',
          subject: 'Project Proposal',
          preview: 'We would like to discuss the project...',
        },
        {
          id: 'mail-002',
          from: 'customer@example.com',
          subject: 'Product Inquiry',
          preview: 'I would like to know more about your services...',
        },
      ],
    };
  },
});