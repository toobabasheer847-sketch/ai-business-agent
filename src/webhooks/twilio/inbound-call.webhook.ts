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
 * Receives inbound call events from Twilio.
 * Route: POST /webhooks/twilio/call/inbound
 *
 * Twilio will POST to this URL when a call arrives on a configured phone
 * number.  The handler:
 *  1. Validates the Twilio request signature.
 *  2. Resolves the destination tenant.
 *  3. Parses the call payload.
 *
 * Returns a minimal TwiML response that Twilio uses to handle the call.
 */
@Controller('webhooks/twilio')
export class InboundCallWebhookController {
  constructor(
    private readonly webhookService: TwilioWebhookService,
    private readonly logger: AppLogger,
  ) {}

  @Post('call/inbound')
  @HttpCode(HttpStatus.OK)
  async handleInboundCall(
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
        'Twilio inbound call webhook signature validation failed',
        InboundCallWebhookController.name,
        { url: fullUrl },
      );
      throw new ForbiddenException('Invalid Twilio webhook signature');
    }

    const call = this.webhookService.parseInboundCall(body);
    const { tenantId } = await this.webhookService.resolveTenantFromDestination(call.To);

    this.logger.log(
      'Inbound call received',
      InboundCallWebhookController.name,
      {
        tenantId,
        from: call.From,
        to: call.To,
        callSid: call.CallSid,
      },
    );

    // Return a basic TwiML response to keep the caller connected.
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Please hold while we connect your call.</Say></Response>';
  }
}
