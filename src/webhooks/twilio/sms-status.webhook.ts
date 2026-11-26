import { Body, Controller, ForbiddenException, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';

import { TwilioWebhookService } from '../../integrations/twilio/twilio-webhooks';
import { OmnichannelService } from '../../modules/omnichannel/omnichannel.service';
import type { TwilioWebhookRequest } from './twilio-webhook.types';

@Controller('webhooks/twilio')
export class SmsStatusWebhookController {
  constructor(
    private readonly webhookService: TwilioWebhookService,
    private readonly omnichannel: OmnichannelService,
  ) {}

  @Post('sms/status')
  @HttpCode(HttpStatus.OK)
  async handleStatus(
    @Req() req: TwilioWebhookRequest,
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string,
  ) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = this.webhookService.validateWebhookRequest({
      method: 'POST',
      url: fullUrl,
      signatureHeader: signature ?? '',
      body,
    });
    if (!valid) throw new ForbiddenException('Invalid Twilio webhook signature');
    const { tenantId } = await this.webhookService.resolveTenantFromDestination(body.To ?? body.From);
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved for this callback.');
    await this.omnichannel.recordTwilioStatus(tenantId, body);
    return { received: true };
  }
}
