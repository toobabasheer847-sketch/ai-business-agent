import { Injectable } from '@nestjs/common';

import { SmsManagementService } from '../../integrations/twilio/sms-management';
import type { ChannelAdapter, ChannelSendRequest, ChannelSendResult } from './channel-adapter';
import { clipError } from './channel-adapter';
import { classifyProviderFailure, mapProviderStatus } from './communication-rules';

@Injectable()
export class SmsChannelAdapter implements ChannelAdapter {
  channel = 'sms' as const;

  constructor(private readonly sms: SmsManagementService) {}

  async send(input: ChannelSendRequest): Promise<ChannelSendResult> {
    if (!input.fromPhoneNumberId) {
      return {
        outcome: 'failed',
        provider: 'twilio',
        providerMessageId: null,
        providerStatus: 'failed',
        deliveryConfirmed: false,
        permanent: true,
        errorCode: 'invalid_recipient',
        errorDetail: 'A tenant phone number is required to send SMS.',
      };
    }
    try {
      const sent = await this.sms.sendSms({
        tenantId: input.tenantId,
        to: input.to,
        body: input.body,
        fromPhoneNumberId: input.fromPhoneNumberId,
      });
      const mapped = mapProviderStatus({
        channel: 'sms',
        providerStatus: sent.status,
        source: 'send',
      });
      return {
        outcome: 'sent',
        provider: 'twilio',
        providerMessageId: sent.messageSid,
        providerStatus: mapped.status,
        deliveryConfirmed: false,
        permanent: false,
        errorCode: null,
        errorDetail: null,
      };
    } catch (error) {
      const detail = clipError(error);
      const code = detail.match(/\b(2\d{4}|3\d{4})\b/)?.[1] ?? null;
      const failure = classifyProviderFailure({ errorCode: code, message: detail });
      return {
        outcome: 'failed',
        provider: 'twilio',
        providerMessageId: null,
        providerStatus: 'failed',
        deliveryConfirmed: false,
        permanent: failure.permanent,
        errorCode: failure.code,
        errorDetail: detail,
      };
    }
  }
}
