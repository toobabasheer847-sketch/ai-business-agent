import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const sendMailTool = new FunctionTool({
  name: 'send_mail',

  description:
    'Sends an email to the specified recipient.',

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
      message: 'Email sent successfully.',

      email: {
        to,
        subject,
        body,
        status: 'sent',
      },
    };
  },
});