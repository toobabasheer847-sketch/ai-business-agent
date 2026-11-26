import type { Channel } from './communication-rules';

export type ChannelSendRequest = {
  tenantId: string;
  to: string;
  body: string;
  subject?: string | null;
  fromEmail?: string | null;
  fromPhoneNumberId?: string | null;
  providerTemplateRef?: string | null;
};

export type ChannelSendResult = {
  outcome: 'sent' | 'not_configured' | 'failed';
  provider: string;
  providerMessageId: string | null;
  providerStatus: string | null;
  deliveryConfirmed: false;
  permanent: boolean;
  errorCode: string | null;
  errorDetail: string | null;
};

export interface ChannelAdapter {
  channel: Channel;
  send(input: ChannelSendRequest): Promise<ChannelSendResult>;
}

export function clipError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Provider request failed';
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 300);
}
