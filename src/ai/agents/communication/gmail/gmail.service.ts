import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';

export interface GoogleTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string;
  token_type?: string;
}

@Injectable()
export class GmailService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates a fresh OAuth2 client for each operation.
   *
   * We intentionally do not keep one OAuth2 client as a singleton
   * because OAuth credentials are user/tenant specific.
   */
  private createOAuthClient() {
    const clientId =
      this.configService.get<string>('GOOGLE_CLIENT_ID');

    const clientSecret =
      this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    const redirectUri =
      this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured');
    }

    if (!clientSecret) {
      throw new Error('GOOGLE_CLIENT_SECRET is not configured');
    }

    if (!redirectUri) {
      throw new Error('GOOGLE_REDIRECT_URI is not configured');
    }

    return new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );
  }

  /**
   * Generates the Google OAuth authorization URL.
   *
   * The state parameter will be used later for
   * OAuth CSRF protection and tenant identification.
   */
  getAuthorizationUrl(state: string): string {
    const oauth2Client = this.createOAuthClient();

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.send',
      ],
    });
  }

  /**
   * Exchanges Google's authorization code for OAuth tokens.
   */
  async exchangeCode(code: string): Promise<GoogleTokens> {
    if (!code) {
      throw new Error('Google authorization code is required');
    }

    const oauth2Client = this.createOAuthClient();

    const { tokens } =
      await oauth2Client.getToken(code);

    return {
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      scope: tokens.scope ?? undefined,
      token_type: tokens.token_type ?? undefined,
    };
  }

  /**
   * Creates an authenticated Gmail API client.
   *
   * The OAuth client is created from the credentials
   * belonging to the specific Gmail configuration.
   */
  createGmailClient(
    accessToken: string,
    refreshToken: string,
  ): gmail_v1.Gmail {
    if (!accessToken) {
      throw new Error('Google access token is required');
    }

    if (!refreshToken) {
      throw new Error('Google refresh token is required');
    }

    const oauth2Client = this.createOAuthClient();

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });
  }

  /**
   * Gets the Gmail account email associated with the OAuth credentials.
   *
   * We use this during OAuth callback so that the
   * gmail_configs.email field contains the actual Google account.
   */
  async getAuthenticatedEmail(
    tokens: GoogleTokens,
  ): Promise<string> {
    if (!tokens.access_token) {
      throw new Error(
        'Google access token is missing',
      );
    }

    const oauth2Client = this.createOAuthClient();

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token:
        tokens.refresh_token ?? undefined,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });

    const response =
      await gmail.users.getProfile({
        userId: 'me',
      });

    const email = response.data.emailAddress;

    if (!email) {
      throw new Error(
        'Unable to determine authenticated Gmail address',
      );
    }

    return email;
  }
}