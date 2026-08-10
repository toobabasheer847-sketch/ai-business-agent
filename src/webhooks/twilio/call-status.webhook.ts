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
 * Receives call status callback events from Twilio.
 * Route: POST /webhooks/twilio/call/status
 *
 * Twilio posts this when a call changes state (ringing, in-progress,
 * completed, failed, etc.).  The handler:
 *  1. Validates the Twilio request signature.
 *  2. Parses the call status payload.
 *  3. Logs the status change for the resolved tenant.
 *
 * Returns HTTP 204 — no content body is expected by Twilio for status callbacks.
 */
@Controller('webhooks/twilio')
export class CallStatusWebhookController {
  constructor(
    private readonly webhookService: TwilioWebhookService,
    private readonly logger: AppLogger,
  ) {}

  @Post('call/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleCallStatus(
    @Req() req: TwilioWebhookRequest,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string,
  ): Promise<void> {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const isValid = this.webhookService.validateWebhookRequest({
      method: 'POST',
      url: fullUrl,
      signatureHeader: signature ?? '',
      body,
    });

    if (!isValid) {
      this.logger.warn(
        'Twilio call status webhook signature validation failed',
        CallStatusWebhookController.name,
        { url: fullUrl },
      );
      throw new ForbiddenException('Invalid Twilio webhook signature');
    }

    const statusEvent = this.webhookService.parseCallStatus(body);
    const { tenantId } = await this.webhookService.resolveTenantFromDestination(
      statusEvent.To,
    );

    this.logger.log(
      'Call status update received',
      CallStatusWebhookController.name,
      {
        tenantId,
        callSid: statusEvent.CallSid,
        callStatus: statusEvent.CallStatus,
        from: statusEvent.From,
        to: statusEvent.To,
        duration: statusEvent.CallDuration ?? null,
      },
    );
  }
}
