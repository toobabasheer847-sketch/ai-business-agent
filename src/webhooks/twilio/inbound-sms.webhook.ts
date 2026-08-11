import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';

import { TwilioWebhookService } from '../../integrations/twilio/twilio-webhooks';
import { AppLogger } from '../../infrastructure/logging/logger.service';
import type { TwilioWebhookRequest } from './twilio-webhook.types';

/**
 * Receives inbound SMS events from Twilio.
 * Route: POST /webhooks/twilio/sms/inbound
 *
 * Twilio will POST to this URL whenever an SMS is received on a configured
 * phone number.  The handler:
 *  1. Validates the Twilio request signature.
 *  2. Resolves the destination tenant from the destination phone number.
 *  3. Parses the SMS payload.
 *
 * Returns an empty 200 TwiML response to acknowledge delivery.
 */
@Controller('webhooks/twilio')
export class InboundSmsWebhookController {
  constructor(
    private readonly webhookService: TwilioWebhookService,
    private readonly logger: AppLogger,
  ) {}

  @Post('sms/inbound')
  @HttpCode(HttpStatus.OK)
  async handleInboundSms(
    @Req() req: TwilioWebhookRequest,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string,
  ): Promise<string> {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const isValid = this.webhookService.validateWebhookRequest({
      method: 'POST',
      url: fullUrl,
      signatureHeader: signature ?? '',
      body,
    });

    if (!isValid) {
      this.logger.warn(
        'Twilio inbound SMS webhook signature validation failed',
        InboundSmsWebhookController.name,
        { url: fullUrl },
      );
      throw new ForbiddenException('Invalid Twilio webhook signature');
    }

    const sms = this.webhookService.parseInboundSms(body);
    const { tenantId } = await this.webhookService.resolveTenantFromDestination(sms.To);

    this.logger.log(
      'Inbound SMS received',
      InboundSmsWebhookController.name,
      {
        tenantId,
        from: sms.From,
        to: sms.To,
        messageSid: sms.MessageSid,
      },
    );

    // Return empty TwiML to acknowledge receipt without sending an auto-reply.
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
}
