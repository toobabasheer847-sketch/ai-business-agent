import { FunctionTool, LlmAgent } from '@google/adk';

import type { CommunicationToolsProvider } from './communication-tools.provider';
import type { TwilioToolsProvider } from './twilio/twilio-tools.provider';

const DEFAULT_INSTRUCTION = `
You are the Communication Agent.

Your responsibilities are:

1. Manage email communication via Gmail.
2. List available emails when requested.
3. Create email drafts when requested.
4. Send emails only when the user explicitly asks you to send them.
5. Send SMS messages when the user requests it. Always require fromPhoneNumberId belonging to the tenant.
6. Initiate phone calls when the user requests it. Always require fromPhoneNumberId belonging to the tenant.
7. Never claim that an email was sent, SMS was delivered, or call was initiated unless the corresponding tool succeeds.
8. Never send an email when the user only asks for a draft.
9. Keep communication responses clear and professional.
10. Do not expose access tokens, refresh tokens, Gmail credentials, or Twilio auth tokens.
11. Never accept tenantId or userId from the user — tenant scope is enforced server-side.

Available tools:

Gmail:
- list_all_mails
- draft_mail
- send_mail

Twilio:
- send_sms (requires fromPhoneNumberId)
- initiate_call (requires fromPhoneNumberId)
`;

export function buildCommunicationAgent(
  gmailToolsProvider: CommunicationToolsProvider,
  twilioToolsProvider?: TwilioToolsProvider,
  overrides?: {
    name?: string;
    model?: string;
    description?: string;
    instruction?: string;
    tools?: FunctionTool[];
  },
): LlmAgent {
  const listTool = gmailToolsProvider.createListMailsTool();
  const draftTool = gmailToolsProvider.createDraftMailTool();
  const sendMailTool = gmailToolsProvider.createSendMailTool();

  const defaultTools: FunctionTool[] = [listTool, draftTool, sendMailTool];

  if (twilioToolsProvider) {
    defaultTools.push(twilioToolsProvider.createSendSmsTool());
    defaultTools.push(twilioToolsProvider.createInitiateCallTool());
  }

  const configuredTools = overrides?.tools?.length ? overrides.tools : defaultTools;

  return new LlmAgent({
    name: overrides?.name ?? 'communication_agent',
    model: overrides?.model ?? 'gemini-3.6-flash' ,
    description:
      overrides?.description ??
      'AI agent responsible for managing email, SMS, and call communication.',
    instruction: overrides?.instruction ?? DEFAULT_INSTRUCTION,
    tools: configuredTools,
  });
}
