import { Injectable, Optional } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

import { assertRolePermission } from '../../context/assert-ai-permission.js';
import { getTrustedAiContext } from '../../context/ai-request-context.js';
import { Permission } from '../../../modules/authorization/permissions';
import { GmailService, TenantGmailCredentials } from './gmail/gmail.service';
import { ApprovalService } from '../../approvals/approval.service';
import { uncertainDelivery } from '../../approvals/approval-executor.registry';
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
  constructor(
    private readonly gmailService: GmailService,
    @Optional() private readonly approvals?: ApprovalService,
  ) {}

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

  async deliverApprovedEmail(input: { tenantId: string; to: string; subject: string; body: string; fromEmail?: string }) {
    const creds = await this.resolveCredentials(input.tenantId, input.fromEmail);
    try {
      const sent = await this.gmailService.mailOperations.sendEmail({
        to: input.to,
        subject: input.subject,
        body: input.body,
        contentType: 'text/plain',
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        tokenExpiry: creds.tokenExpiry,
        refreshAccessToken: this.refreshCallback(creds),
      });
      return { reference: sent.messageId, uncertain: false as const };
    } catch (error) {
      if (uncertainDelivery(error)) return { reference: null, uncertain: true as const };
      throw error;
    }
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
        const trusted = getTrustedAiContext();
        assertRolePermission(trusted.role, [Permission.CommunicationView]);
        if (provider.approvals) {
          const proposed = await provider.approvals.propose({
            tenantId: trusted.tenantId,
            userId: trusted.userId,
            role: trusted.role ?? undefined,
            actionType: 'email.send',
            title: `Email ${to}`,
            description: subject,
            targetEntityType: 'email',
            targetEntityId: to,
            payload: { to, subject, body, ...(fromEmail ? { fromEmail } : {}) },
            agentName: 'communication',
          });
          return {
            status: 'pending_approval',
            message: 'The email is waiting for approval and was not sent.',
            approvalId: proposed.approval?.id ?? null,
            email: { to, subject, status: 'pending_approval' },
          };
        }
        return {
          status: 'pending_approval',
          message: 'The email requires approval and was not sent.',
          approvalId: null,
          email: { to, subject, status: 'pending_approval' },
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
        const trusted = getTrustedAiContext();
        assertRolePermission(trusted.role, [Permission.CommunicationView]);
        const creds = await provider.resolveCredentials(trusted.tenantId, fromEmail);
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
        const trusted = getTrustedAiContext();
        assertRolePermission(trusted.role, [Permission.CommunicationView]);
        const creds = await provider.resolveCredentials(trusted.tenantId, fromEmail);
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
