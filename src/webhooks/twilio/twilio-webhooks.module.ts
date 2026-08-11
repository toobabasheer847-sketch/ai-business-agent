import { Module } from '@nestjs/common';

import { TwilioIntegrationModule } from '../../integrations/twilio/twilio.module';

import { InboundSmsWebhookController } from './inbound-sms.webhook';
import { InboundCallWebhookController } from './inbound-call.webhook';
import { CallStatusWebhookController } from './call-status.webhook';

/**
 * Registers the Twilio webhook HTTP endpoints and wires them to the
 * TwilioIntegrationModule services (webhook validation, SMS parsing, call
 * parsing, and tenant resolution).
 */
@Module({
  imports: [TwilioIntegrationModule],

  controllers: [
    InboundSmsWebhookController,
    InboundCallWebhookController,
    CallStatusWebhookController,
  ],
})
export class TwilioWebhooksModule {}
