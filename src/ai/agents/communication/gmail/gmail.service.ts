import { Injectable } from '@nestjs/common';
import { gmail_v1 } from 'googleapis';

import {
  GmailOAuthService,
  GoogleOAuthTokens,
} from '../../../../integrations/gmail/gmail-oauth';
import { GmailTokenService } from '../../../../integrations/gmail/gmail-tokens';
import { MailOperationsService } from '../../../../integrations/gmail/mail-operations';

import { GmailRepository } from './gmail.repository';

export interface GoogleTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string;
  token_type?: string;
}

export interface TenantGmailCredentials {
  configId: string;
  tenantId: string;
  email: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
}

@Injectable()
export class GmailService {
  constructor(
    private readonly gmailOAuthService: GmailOAuthService,
    private readonly gmailTokenService: GmailTokenService,
    private readonly mailOperationsService: MailOperationsService,
    private readonly gmailRepository: GmailRepository,
  ) {}

  static toStoredTokens(tokens: GoogleTokens | GoogleOAuthTokens): {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: Date | null;
  } {
    return {
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };
  }

  getAuthorizationUrl(state: string): string {
    return this.gmailOAuthService.generateAuthorizationUrl(state);
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    const tokens = await this.gmailOAuthService.exchangeAuthorizationCode(code);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type,
    };
  }

  createGmailClient(
    accessToken: string,
    refreshToken: string,
  ): gmail_v1.Gmail {
    return this.gmailOAuthService.createAuthenticatedClient(
      accessToken,
      refreshToken,
    );
  }

  async getAuthenticatedEmail(tokens: GoogleTokens): Promise<string> {
    return this.gmailOAuthService.fetchAuthenticatedEmail(tokens);
  }

  async findActiveCredentialsForTenant(
    tenantId: string,
    emailHint?: string,
  ): Promise<TenantGmailCredentials | null> {
    if (!tenantId) {
      return null;
    }

    if (emailHint) {
      const found = await this.gmailRepository.findByTenantAndEmail(
        tenantId,
        emailHint,
      );
      if (found && found.isActive) {
        return {
          configId: found.id,
          tenantId: found.tenantId,
          email: found.email,
          accessToken: found.accessToken ?? null,
          refreshToken: found.refreshToken ?? null,
          tokenExpiry: found.tokenExpiry ?? null,
        };
      }
    }

    const primary = await this.gmailRepository.findFirstActiveForTenant(tenantId);
    if (!primary) {
      return null;
    }

    return {
      configId: primary.id,
      tenantId: primary.tenantId,
      email: primary.email,
      accessToken: primary.accessToken ?? null,
      refreshToken: primary.refreshToken ?? null,
      tokenExpiry: primary.tokenExpiry ?? null,
    };
  }

  async refreshAndSave(
    creds: TenantGmailCredentials,
    refreshed: { accessToken: string; tokenExpiry: Date },
  ): Promise<void> {
    await this.gmailRepository.updateTokens(creds.configId, {
      accessToken: refreshed.accessToken,
      tokenExpiry: refreshed.tokenExpiry,
    });
  }

  get mailOperations(): MailOperationsService {
    return this.mailOperationsService;
  }

  get tokens(): GmailTokenService {
    return this.gmailTokenService;
  }
}
