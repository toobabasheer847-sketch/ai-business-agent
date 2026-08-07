import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const draftMailTool = new FunctionTool({
  name: 'draft_mail',

  description:
    'Creates an email draft. It does not send the email.',

  parameters: z.object({
    to: z.string().email().describe('Recipient email address.'),

    subject: z
      .string()
      .min(1)
      .describe('Subject of the email.'),

    body: z
      .string()
      .min(1)
      .describe('Body/content of the email.'),
  }),

  execute: async ({ to, subject, body }) => {
    return {
      status: 'success',
      message: 'Email draft created successfully.',

      draft: {
        to,
        subject,
        body,
        status: 'draft',
      },
    };
  },
});