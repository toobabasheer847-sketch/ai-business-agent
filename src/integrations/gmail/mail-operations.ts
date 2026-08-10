import { Injectable } from '@nestjs/common';
import { gmail_v1 } from 'googleapis';

import { GmailOAuthService } from './gmail-oauth';
import { GmailTokenService } from './gmail-tokens';

export interface ComposeEmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  contentType?: 'text/plain' | 'text/html';
}

export interface ListMessagesOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
}

export interface MailSummary {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt?: Date | null;
  labels?: string[];
}

export interface MailDraft {
  id: string;
  messageId?: string;
  to: string;
  subject: string;
  body: string;
}

function encodeRfc2822(input: ComposeEmailInput): string {
  const contentType = input.contentType ?? 'text/plain';
  const subjectEncoded = `=?utf-8?B?${Buffer.from(input.subject, 'utf-8').toString('base64')}?=`;
  const lines: string[] = [];
  lines.push(`To: ${input.to}`);
  if (input.cc) lines.push(`Cc: ${input.cc}`);
  if (input.bcc) lines.push(`Bcc: ${input.bcc}`);
  lines.push(`Subject: ${subjectEncoded}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: ${contentType}; charset=\"UTF-8\"`);
  lines.push(`Content-Transfer-Encoding: 7bit`);
  lines.push('');
  lines.push(input.body);
  return lines.join('\r\n');
}

function base64UrlEncode(raw: string): string {
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

@Injectable()
export class MailOperationsService {
  constructor(
    private readonly gmailOAuthService: GmailOAuthService,
    private readonly gmailTokenService: GmailTokenService,
  ) {}

  private async resolveGmailClient(args: {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: Date | null;
    refreshAccessToken: (refreshed: {
      accessToken: string;
      tokenExpiry: Date;
    }) => Promise<void> | void;
  }): Promise<gmail_v1.Gmail> {
    let accessToken = args.accessToken ?? '';
    let tokenExpiry = args.tokenExpiry;

    if (args.refreshToken && !this.gmailTokenService.isTokenValid(tokenExpiry)) {
      const refreshed = await this.gmailTokenService.refreshAccessToken(args.refreshToken);
      accessToken = refreshed.accessToken;
      tokenExpiry = refreshed.tokenExpiry;
      await args.refreshAccessToken(refreshed);
    }

    return this.gmailOAuthService.createAuthenticatedClient(
      accessToken,
      args.refreshToken,
    );
  }

  private extractHeader(
    headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
    name: string,
  ): string {
    if (!headers) return '';
    const target = headers.find(
      (h) => typeof h.name === 'string' && h.name.toLowerCase() === name.toLowerCase(),
    );
    return typeof target?.value === 'string' ? target.value : '';
  }

  private async fetchMessageSummary(
    gmail: gmail_v1.Gmail,
    messageId: string,
  ): Promise<MailSummary> {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const data = response.data;
    const headers = data.payload?.headers;

    return {
      id: data.id ?? messageId,
      threadId: data.threadId ?? undefined,
      from: this.extractHeader(headers, 'From'),
      subject: this.extractHeader(headers, 'Subject'),
      preview: typeof data.snippet === 'string' ? data.snippet : '',
      receivedAt: data.internalDate ? new Date(Number(data.internalDate)) : null,
      labels: Array.isArray(data.labelIds) ? [...data.labelIds] : [],
    };
  }

  async sendEmail(
    input: ComposeEmailInput & {
      accessToken: string | null;
      refreshToken: string | null;
      tokenExpiry: Date | null;
      refreshAccessToken: (refreshed: {
        accessToken: string;
        tokenExpiry: Date;
      }) => Promise<void> | void;
    },
  ): Promise<{ messageId: string; to: string; subject: string; status: 'sent' }> {
    const gmail = await this.resolveGmailClient(input);
    const raw = encodeRfc2822(input);
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64UrlEncode(raw),
      },
    });

    return {
      messageId: response.data.id ?? '',
      to: input.to,
      subject: input.subject,
      status: 'sent',
    };
  }

  async listMessages(
    input: ListMessagesOptions & {
      accessToken: string | null;
      refreshToken: string | null;
      tokenExpiry: Date | null;
      refreshAccessToken: (refreshed: {
        accessToken: string;
        tokenExpiry: Date;
      }) => Promise<void> | void;
    },
  ): Promise<MailSummary[]> {
    const gmail = await this.resolveGmailClient(input);
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: input.maxResults ?? 10,
      q: input.query,
      labelIds: input.labelIds,
    });

    const messageIds = listResponse.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
    const summaries: MailSummary[] = [];

    for (const id of messageIds) {
      try {
        summaries.push(await this.fetchMessageSummary(gmail, id));
      } catch {
        summaries.push({
          id,
          from: '',
          subject: '',
          preview: '',
          receivedAt: null,
        });
      }
    }

    return summaries;
  }

  async createDraft(
    input: ComposeEmailInput & {
      accessToken: string | null;
      refreshToken: string | null;
      tokenExpiry: Date | null;
      refreshAccessToken: (refreshed: {
        accessToken: string;
        tokenExpiry: Date;
      }) => Promise<void> | void;
    },
  ): Promise<MailDraft> {
    const gmail = await this.resolveGmailClient(input);
    const raw = encodeRfc2822(input);
    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: base64UrlEncode(raw),
        },
      },
    });

    return {
      id: response.data.id ?? '',
      messageId: response.data.message?.id ?? undefined,
      to: input.to,
      subject: input.subject,
      body: input.body,
    };
  }
}
