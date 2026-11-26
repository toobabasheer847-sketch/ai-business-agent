import { Injectable } from '@nestjs/common';

import type { ChannelAdapter, ChannelSendRequest, ChannelSendResult } from './channel-adapter';
import { clipError } from './channel-adapter';
import { classifyProviderFailure } from './communication-rules';
import { OmnichannelRepository } from './omnichannel.repository';

@Injectable()
export class WhatsAppChannelAdapter implements ChannelAdapter {
  channel = 'whatsapp' as const;

  constructor(private readonly records: OmnichannelRepository) {}

  async send(input: ChannelSendRequest): Promise<ChannelSendResult> {
    const config = await this.records.whatsAppSecrets(input.tenantId);
    if (!config?.accessToken || !config.phoneNumberId) {
      return {
        outcome: 'not_configured',
        provider: 'meta_cloud',
        providerMessageId: null,
        providerStatus: null,
        deliveryConfirmed: false,
        permanent: true,
        errorCode: 'provider_not_configured',
        errorDetail: 'WhatsApp is not configured for this tenant. Live delivery is unverified.',
      };
    }
    const to = input.to.replace(/^\+/, '');
    const payload = input.providerTemplateRef
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: { name: input.providerTemplateRef, language: { code: 'en' } },
        }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: input.body },
        };
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(config.phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const json = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { code?: number; message?: string };
      };
      if (!response.ok || json.error) {
        const failure = classifyProviderFailure({
          errorCode: json.error?.code ? String(json.error.code) : String(response.status),
          message: json.error?.message ?? response.statusText,
        });
        return {
          outcome: 'failed',
          provider: 'meta_cloud',
          providerMessageId: null,
          providerStatus: 'failed',
          deliveryConfirmed: false,
          permanent: failure.permanent,
          errorCode: failure.code,
          errorDetail: (json.error?.message ?? 'WhatsApp request was rejected').slice(0, 300),
        };
      }
      return {
        outcome: 'sent',
        provider: 'meta_cloud',
        providerMessageId: json.messages?.[0]?.id ?? null,
        providerStatus: 'sent',
        deliveryConfirmed: false,
        permanent: false,
        errorCode: null,
        errorDetail: null,
      };
    } catch (error) {
      const failure = classifyProviderFailure({ message: clipError(error) });
      return {
        outcome: 'failed',
        provider: 'meta_cloud',
        providerMessageId: null,
        providerStatus: 'failed',
        deliveryConfirmed: false,
        permanent: failure.permanent,
        errorCode: failure.code,
        errorDetail: clipError(error),
      };
    }
  }
}
