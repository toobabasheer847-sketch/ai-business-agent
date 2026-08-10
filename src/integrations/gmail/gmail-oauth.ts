import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';

export interface GoogleOAuthTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string;
  token_type?: string;
}

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
] as const;

@Injectable()
export class GmailOAuthService {
  constructor(private readonly configService: ConfigService) {}

  private createBaseOAuthClient() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured');
    }

    if (!clientSecret) {
      throw new Error('GOOGLE_CLIENT_SECRET is not configured');
    }

    if (!redirectUri) {
      throw new Error('GOOGLE_REDIRECT_URI is not configured');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  isConfigurationValid(): boolean {
    return Boolean(
      this.configService.get<string>('GOOGLE_CLIENT_ID') &&
        this.configService.get<string>('GOOGLE_CLIENT_SECRET') &&
        this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  generateAuthorizationUrl(state: string): string {
    const oauth2Client = this.createBaseOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      scope: [...GMAIL_SCOPES],
    });
  }

  async exchangeAuthorizationCode(code: string): Promise<GoogleOAuthTokens> {
    if (!code) {
      throw new Error('Google authorization code is required');
    }

    const oauth2Client = this.createBaseOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    return {
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      scope: tokens.scope ?? undefined,
      token_type: tokens.token_type ?? undefined,
    };
  }

  createAuthenticatedClient(
    accessToken: string,
    refreshToken?: string | null,
  ): gmail_v1.Gmail {
    if (!accessToken) {
      throw new Error('Google access token is required');
    }

    const oauth2Client = this.createBaseOAuthClient();

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
    });

    return google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });
  }

  async fetchAuthenticatedEmail(
    tokens: GoogleOAuthTokens,
  ): Promise<string> {
    if (!tokens.access_token) {
      throw new Error('Google access token is missing');
    }

    const gmail = this.createAuthenticatedClient(
      tokens.access_token,
      tokens.refresh_token,
    );

    const response = await gmail.users.getProfile({ userId: 'me' });
    const email = response.data.emailAddress;

    if (!email) {
      throw new Error('Unable to determine authenticated Gmail address');
    }

    return email;
  }
}
