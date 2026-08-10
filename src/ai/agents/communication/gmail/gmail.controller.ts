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

import { GmailService } from './gmail.service';
import { GmailRepository } from './gmail.repository';
import { AppLogger } from '../../../../infrastructure/logging/logger.service';

interface OAuthState {
  tenantId: string;
  userId: string;
}

@Controller('google')
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly gmailRepository: GmailRepository,
    private readonly logger: AppLogger,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth')
  authorize(
    @Req() req: AuthenticatedRequest,
    @Query('state') state?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const statePayload = state ?? `tenant:${tenantId}:user:${userId}`;

    return {
      authorizationUrl: this.gmailService.getAuthorizationUrl(statePayload),
      tenantId,
      userId,
    };
  }

  private parseState(state: string): OAuthState | null {
    const match = /^tenant:([^:]+):user:([^:]+)$/.exec(state);
    if (!match) {
      return null;
    }

    return {
      tenantId: match[1],
      userId: match[2],
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

    if (!state) {
      throw new BadRequestException('OAuth state is required');
    }

    const parsedState = this.parseState(state);
    if (!parsedState) {
      throw new BadRequestException(
        'Invalid OAuth state format. Expected tenant:<tenantId>:user:<userId>',
      );
    }

    const { tenantId, userId } = parsedState;

    const tokens = await this.gmailService.exchangeCode(code);
    const hasRefresh = Boolean(tokens.refresh_token);
    const hasAccess = Boolean(tokens.access_token);

    let email: string | null = null;
    let savedConfig: { id: string; email: string } | null = null;

    if (tokens.access_token) {
      try {
        email = await this.gmailService.getAuthenticatedEmail(tokens);
      } catch (err) {
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
