import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

import type { GoogleOAuthTokens } from './gmail-oauth';

export interface RefreshedTokenSet {
  accessToken: string;
  tokenExpiry: Date;
}

@Injectable()
export class GmailTokenService {
  constructor(private readonly configService: ConfigService) {}

  private createOAuthClient() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth configuration is incomplete');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  isTokenValid(expiry: Date | null | undefined, slackSeconds = 60): boolean {
    if (!expiry) {
      return false;
    }

    const slackMs = slackSeconds * 1000;
    const now = Date.now();
    return new Date(expiry).getTime() - now > slackMs;
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<RefreshedTokenSet> {
    if (!refreshToken) {
      throw new Error('Google refresh token is required for token refresh');
    }

    const oauth2Client = this.createOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const tokens = await oauth2Client.refreshAccessToken();
    const credentials = tokens.credentials;

    if (!credentials.access_token) {
      throw new Error('Google did not return a new access token');
    }

    const expiryEpoch = credentials.expiry_date ?? Date.now() + 3000_000;

    return {
      accessToken: credentials.access_token,
      tokenExpiry: new Date(expiryEpoch),
    };
  }

  toStored(tokens: GoogleOAuthTokens): {
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
}
