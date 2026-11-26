import { Module } from '@nestjs/common';

import { TwilioIntegrationModule } from '../../integrations/twilio/twilio.module';
import { OmnichannelModule } from '../../modules/omnichannel/omnichannel.module';

import { InboundSmsWebhookController } from './inbound-sms.webhook';
import { InboundCallWebhookController } from './inbound-call.webhook';
import { CallStatusWebhookController } from './call-status.webhook';
import { SmsStatusWebhookController } from './sms-status.webhook';

/**
 * Registers the Twilio webhook HTTP endpoints and wires them to the
 * TwilioIntegrationModule services (webhook validation, SMS parsing, call
 * parsing, and tenant resolution).
 */
@Module({
  imports: [TwilioIntegrationModule, OmnichannelModule],

  controllers: [
    InboundSmsWebhookController,
    InboundCallWebhookController,
    CallStatusWebhookController,
    SmsStatusWebhookController,
  ],
})
export class TwilioWebhooksModule {}
