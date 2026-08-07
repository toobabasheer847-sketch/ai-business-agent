import { LlmAgent } from '@google/adk';

import { listMailsTool } from './tools/list-mails.tool';
import { draftMailTool } from './tools/draft-mail.tool';
import { sendMailTool } from './tools/send-mail.tool';

export const communicationAgent = new LlmAgent({
  name: 'communication_agent',

  model: 'gemini-2.5-flash',

  description:
    'AI agent responsible for managing email communication.',

  instruction: `
You are the Communication Agent.

Your responsibilities are:

1. Manage email communication.
2. List available emails when requested.
3. Create email drafts when requested.
4. Send emails only when the user explicitly asks you to send them.
5. Never claim that an email was sent unless the send_mail tool succeeds.
6. Never send an email when the user only asks for a draft.
7. Keep email responses clear and professional.

Available tools:

- list_all_mails
- draft_mail
- send_mail
`,

  tools: [
    listMailsTool,
    draftMailTool,
    sendMailTool,
  ],
});
