import { Injectable } from '@nestjs/common';

import { GmailService } from '../../ai/agents/communication/gmail/gmail.service';
import { SmtpMailService } from '../../integrations/gmail/smtp-mail.service';
import type { ChannelAdapter, ChannelSendRequest, ChannelSendResult } from './channel-adapter';
import { clipError } from './channel-adapter';
import { classifyProviderFailure } from './communication-rules';

@Injectable()
export class EmailChannelAdapter implements ChannelAdapter {
  channel = 'email' as const;

  constructor(
    private readonly gmail: GmailService,
    private readonly smtp: SmtpMailService,
  ) {}

  async send(input: ChannelSendRequest): Promise<ChannelSendResult> {
    const creds = await this.gmail.findActiveCredentialsForTenant(
      input.tenantId,
      input.fromEmail ?? undefined,
    );
    if (creds) {
      try {
        const sent = await this.gmail.mailOperations.sendEmail({
          to: input.to,
          subject: input.subject || 'Message',
          body: input.body,
          contentType: 'text/plain',
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          tokenExpiry: creds.tokenExpiry,
          refreshAccessToken: async (refreshed) => {
            await this.gmail.refreshAndSave(creds, refreshed);
          },
        });
        return accepted('gmail', sent.messageId || null);
      } catch (error) {
        const failure = classifyProviderFailure({ message: clipError(error) });
        return {
          outcome: 'failed',
          provider: 'gmail',
          providerMessageId: null,
          providerStatus: 'failed',
          deliveryConfirmed: false,
          permanent: failure.permanent,
          errorCode: failure.code,
          errorDetail: clipError(error),
        };
      }
    }
    if (this.smtp.isReady) {
      try {
        const sent = await this.smtp.sendEmail({
          to: input.to,
          subject: input.subject || 'Message',
          text: input.body,
        });
        return accepted('smtp', sent.messageId || null);
      } catch (error) {
        const failure = classifyProviderFailure({ message: clipError(error) });
        return {
          outcome: 'failed',
          provider: 'smtp',
          providerMessageId: null,
          providerStatus: 'failed',
          deliveryConfirmed: false,
          permanent: failure.permanent,
          errorCode: failure.code,
          errorDetail: clipError(error),
        };
      }
    }
    return {
      outcome: 'not_configured',
      provider: 'email',
      providerMessageId: null,
      providerStatus: null,
      deliveryConfirmed: false,
      permanent: true,
      errorCode: 'provider_not_configured',
      errorDetail: 'No active Gmail connection or SMTP transport is configured for this tenant.',
    };
  }
}

function accepted(provider: string, providerMessageId: string | null): ChannelSendResult {
  return {
    outcome: 'sent',
    provider,
    providerMessageId,
    providerStatus: 'sent',
    deliveryConfirmed: false,
    permanent: false,
    errorCode: null,
    errorDetail: null,
  };
}
