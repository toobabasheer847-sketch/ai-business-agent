import { Controller, ForbiddenException, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';

import { OmnichannelService } from './omnichannel.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly omnichannel: OmnichannelService) {}

  @Get()
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const ok = await this.omnichannel.verifyWhatsApp(mode ?? '', token ?? '');
    if (!ok || !challenge) {
      res.status(403).type('text/plain').send('forbidden');
      return;
    }
    res.status(200).type('text/plain').send(challenge);
  }

  @Post()
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new ForbiddenException('Invalid WhatsApp webhook signature.');
    return this.omnichannel.receiveWhatsApp(raw, signature);
  }
}
