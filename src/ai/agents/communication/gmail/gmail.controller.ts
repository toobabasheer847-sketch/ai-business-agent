import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { GmailService } from './gmail.service';

@Controller('google')
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
  ) {}

  @Get('auth')
  authorize() {
    return {
      authorizationUrl:
        this.gmailService.getAuthorizationUrl(),
    };
  }

  @Get('auth/callback')
  async callback(
    @Query('code') code: string,
  ) {
    const tokens =
      await this.gmailService.exchangeCode(code);

    return {
      message: 'Google authorization successful.',
      hasAccessToken: Boolean(tokens.access_token),
      hasRefreshToken: Boolean(tokens.refresh_token),
    };
  }
}