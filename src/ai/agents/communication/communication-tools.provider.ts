import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { getTrustedAiContext } from '../../context/ai-request-context.js';
import { GmailService, TenantGmailCredentials } from './gmail/gmail.service';
import type { MailSummary, MailDraft } from '../../../integrations/gmail/mail-operations';

const SEND_MAIL_SCHEMA = z.object({
  to: z.string().email().describe('Recipient email address.'),
  subject: z.string().min(1).describe('Subject of the email.'),
  body: z.string().min(1).describe('Body/content of the email.'),
  fromEmail: z
    .string()
    .email()
    .optional()
    .describe(
      'Optional: the configured sender Gmail address. If omitted, the first active Gmail configuration for the tenant is used.',
    ),
});

const LIST_MAILS_SCHEMA = z.object({
  fromEmail: z
    .string()
    .email()
    .optional()
    .describe('Optional: which configured Gmail inbox to read from.'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of emails to list (1-50, default 10).'),
  query: z
    .string()
    .optional()
    .describe('Optional Gmail search query to filter the inbox list.'),
});

const DRAFT_MAIL_SCHEMA = z.object({
  to: z.string().email().describe('Recipient email address.'),
  subject: z.string().min(1).describe('Subject of the email draft.'),
  body: z.string().min(1).describe('Body/content of the email draft.'),
  fromEmail: z
    .string()
    .email()
    .optional()
    .describe('Optional: the configured sender Gmail address used to store the draft.'),
});

export interface MailSendResult {
  status: string;
  message: string;
  email: {
    messageId: string;
    to: string;
    subject: string;
    body?: string;
    status: 'sent';
  };
}

export interface MailListResult {
  status: string;
  message: string;
  mails: Array<{
    id: string;
    threadId?: string;
    from: string;
    subject: string;
    preview: string;
    receivedAt?: string | null;
    labels?: string[];
  }>;
}

export interface DraftMailResult {
  status: string;
  message: string;
  draft: {
    id: string;
    messageId?: string;
    to: string;
    subject: string;
    body: string;
    status: 'draft';
  };
}

@Injectable()
export class CommunicationToolsProvider {
  constructor(private readonly gmailService: GmailService) {}

  private async resolveCredentials(
    tenantId: string,
    fromEmail?: string,
  ): Promise<TenantGmailCredentials> {
    const creds = await this.gmailService.findActiveCredentialsForTenant(
      tenantId,
      fromEmail,
    );
    if (!creds) {
      throw new Error(
        'No active Gmail configuration exists for this tenant. Connect Gmail first via /google/auth before sending or reading emails.',
      );
    }
    return creds;
  }

  private refreshCallback(
    creds: TenantGmailCredentials,
  ): (refreshed: { accessToken: string; tokenExpiry: Date }) => Promise<void> {
    return async (refreshed) => {
      await this.gmailService.refreshAndSave(creds, refreshed);
    };
  }

  createSendMailTool(): FunctionTool<typeof SEND_MAIL_SCHEMA> {
    const provider = this;
    return new FunctionTool({
      name: 'send_mail',
      description:
        'Sends an email to the specified recipient using the authenticated tenant Gmail configuration.',
      parameters: SEND_MAIL_SCHEMA,
      execute: async ({ to, subject, body, fromEmail }) => {
        const { tenantId } = getTrustedAiContext();
        const creds = await provider.resolveCredentials(tenantId, fromEmail);
        const sent = await provider.gmailService.mailOperations.sendEmail({
          to,
          subject,
          body,
          contentType: 'text/plain',
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          tokenExpiry: creds.tokenExpiry,
          refreshAccessToken: provider.refreshCallback(creds),
        });
        return {
          status: 'success',
          message: 'Email sent successfully.',
          email: {
            messageId: sent.messageId,
            to: sent.to,
            subject: sent.subject,
            status: 'sent',
          },
        };
      },
    });
  }

  createListMailsTool(): FunctionTool<typeof LIST_MAILS_SCHEMA> {
    const provider = this;
    return new FunctionTool({
      name: 'list_all_mails',
      description:
        'Lists emails available in the authenticated tenant Gmail inbox. Returns a short preview of each email.',
      parameters: LIST_MAILS_SCHEMA,
      execute: async ({ fromEmail, maxResults, query }) => {
        const { tenantId } = getTrustedAiContext();
        const creds = await provider.resolveCredentials(tenantId, fromEmail);
        const mails: MailSummary[] =
          await provider.gmailService.mailOperations.listMessages({
            maxResults: maxResults ?? 10,
            query: query ?? undefined,
            accessToken: creds.accessToken,
            refreshToken: creds.refreshToken,
            tokenExpiry: creds.tokenExpiry,
            refreshAccessToken: provider.refreshCallback(creds),
          });
        return {
          status: 'success',
          message: `Retrieved ${mails.length} email(s) from the Gmail inbox.`,
          mails: mails.map((m) => ({
            id: m.id,
            threadId: m.threadId,
            from: m.from,
            subject: m.subject,
            preview: m.preview,
            receivedAt: m.receivedAt ? new Date(m.receivedAt).toISOString() : null,
            labels: m.labels,
          })),
        };
      },
    });
  }

  createDraftMailTool(): FunctionTool<typeof DRAFT_MAIL_SCHEMA> {
    const provider = this;
    return new FunctionTool({
      name: 'draft_mail',
      description:
        'Creates an email draft in the authenticated tenant Gmail account. The draft is stored on Gmail servers and is NOT sent.',
      parameters: DRAFT_MAIL_SCHEMA,
      execute: async ({ to, subject, body, fromEmail }) => {
        const { tenantId } = getTrustedAiContext();
        const creds = await provider.resolveCredentials(tenantId, fromEmail);
        const draft: MailDraft =
          await provider.gmailService.mailOperations.createDraft({
            to,
            subject,
            body,
            contentType: 'text/plain',
            accessToken: creds.accessToken,
            refreshToken: creds.refreshToken,
            tokenExpiry: creds.tokenExpiry,
            refreshAccessToken: provider.refreshCallback(creds),
          });
        return {
          status: 'success',
          message: 'Email draft created successfully.',
          draft: {
            id: draft.id,
            messageId: draft.messageId,
            to: draft.to,
            subject: draft.subject,
            body: draft.body,
            status: 'draft',
          },
        };
      },
    });
  }
}
