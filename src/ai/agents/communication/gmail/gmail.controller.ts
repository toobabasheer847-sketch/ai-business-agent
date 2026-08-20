import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../../../modules/auth/types/auth.types';

import { GmailOauthStateService } from './gmail-oauth-state.service';
import { GmailService } from './gmail.service';
import { GmailRepository } from './gmail.repository';
import { AppLogger } from '../../../../infrastructure/logging/logger.service';

@Controller('google')
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly gmailRepository: GmailRepository,
    private readonly oauthStateService: GmailOauthStateService,
    private readonly logger: AppLogger,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth')
  async authorize(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const state = await this.oauthStateService.create(tenantId, userId);

    return {
      authorizationUrl: this.gmailService.getAuthorizationUrl(state),
      tenantId,
      userId,
    };
  }

  @Get('auth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code) {
      throw new BadRequestException('Google authorization code is required');
    }

    const { tenantId, userId } = await this.oauthStateService.consume(state);

    const tokens = await this.gmailService.exchangeCode(code);
    const hasRefresh = Boolean(tokens.refresh_token);
    const hasAccess = Boolean(tokens.access_token);

    let email: string | null = null;
    let savedConfig: { id: string; email: string } | null = null;

    if (tokens.access_token) {
      try {
        email = await this.gmailService.getAuthenticatedEmail(tokens);
      } catch {
        this.logger.warn(
          'Could not determine authenticated Gmail address during callback',
          GmailController.name,
          { tenantId, userId },
        );
      }
    }

    if (email) {
      const existing = await this.gmailRepository.findByTenantAndEmail(
        tenantId,
        email,
      );
      const stored = GmailService.toStoredTokens(tokens);

      if (existing) {
        const updated = await this.gmailRepository.updateTokens(existing.id, {
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken ?? existing.refreshToken,
          tokenExpiry: stored.tokenExpiry,
        });
        savedConfig = updated ? { id: updated.id, email: updated.email } : null;
      } else {
        const created = await this.gmailRepository.create({
          tenantId,
          email,
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          tokenExpiry: stored.tokenExpiry,
        });
        savedConfig = { id: created.id, email: created.email };
      }
    }

    this.logger.log('Gmail OAuth callback completed', GmailController.name, {
      tenantId,
      userId,
      configuredEmail: email ?? null,
      hasRefreshToken: hasRefresh,
      hasAccessToken: hasAccess,
      storedConfigId: savedConfig?.id ?? null,
    });

    return {
      message: 'Google authorization successful.',
      hasAccessToken: hasAccess,
      hasRefreshToken: hasRefresh,
      tenantId,
      userId,
      email: email ?? null,
      configId: savedConfig?.id ?? null,
    };
  }
}
