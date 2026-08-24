import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { TwilioAppRepository } from './twilio-app.repository';

export interface TwilioEnvironmentCredentials {
  accountSid: string | null;
  authToken: string | null;
}

export interface TenantTwilioAppConfig {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  accountSid: string;
  authToken: string;
  appSid: string | null;
  webhookUrl: string | null;
  status: string;
}

export interface ResolvedTwilioCredentials {
  accountSid: string;
  authToken: string;
}

@Injectable()
export class TwilioAppConfigurationService {
  constructor(
    private readonly configService: ConfigService,
    /**
     * Optional to avoid a circular dependency when the repository is not yet
     * available in the DI graph (e.g. early bootstrapping).  Always provided
     * in production via TwilioIntegrationModule.
     */
    @Optional() private readonly twilioAppRepository?: TwilioAppRepository,
  ) {}

  getEnvironmentCredentials(): TwilioEnvironmentCredentials {
    return {
      accountSid: this.configService.get<string>('TWILIO_ACCOUNT_SID') ?? null,
      authToken: this.configService.get<string>('TWILIO_AUTH_TOKEN') ?? null,
    };
  }

  getTwimlAppSid(): string | null {
    return this.configService.get<string>('TWILIO_TWIML_APP_SID') ?? null;
  }

  isEnvironmentConfigured(): boolean {
    const creds = this.getEnvironmentCredentials();
    return Boolean(creds.accountSid && creds.authToken);
  }

  /**
   * Resolves credentials from an already-loaded tenant config object.
   * Falls back to environment variables when no tenant config is provided.
   * Synchronous — use resolveCredentialsForTenant() for DB-backed resolution.
   */
  resolveCredentials(
    tenantConfig?: Pick<TenantTwilioAppConfig, 'accountSid' | 'authToken'> | null,
  ): ResolvedTwilioCredentials | null {
    if (tenantConfig?.accountSid && tenantConfig?.authToken) {
      return {
        accountSid: tenantConfig.accountSid,
        authToken: tenantConfig.authToken,
      };
    }

    const env = this.getEnvironmentCredentials();
    if (env.accountSid && env.authToken) {
      return {
        accountSid: env.accountSid,
        authToken: env.authToken,
      };
    }

    return null;
  }

  /**
   * Resolves credentials for a specific tenant from phone_numbers
   * (active row with twilio_sid + auth_token). Falls back to environment
   * variables only when no DB record exists.
   *
   * Resolution order (most specific → least specific):
   *  1. Active phone_numbers row for this tenantId with Twilio credentials
   *  2. Environment variables (shared / single-tenant fallback)
   *
   * Never mixes credentials across tenants.
   */
  async resolveCredentialsForTenant(
    tenantId: string,
  ): Promise<ResolvedTwilioCredentials | null> {
    if (!tenantId) return null;

    if (this.twilioAppRepository) {
      const tenantApp = await this.twilioAppRepository.findActiveForTenant(tenantId);
      if (tenantApp?.accountSid && tenantApp?.authToken) {
        // Credentials are tenant-specific — never log them.
        return {
          accountSid: tenantApp.accountSid,
          authToken: tenantApp.authToken,
        };
      }
    }

    // Fallback: shared environment credentials (acceptable for single-tenant
    // deployments or when a tenant has not yet configured their own app).
    const env = this.getEnvironmentCredentials();
    if (env.accountSid && env.authToken) {
      return {
        accountSid: env.accountSid,
        authToken: env.authToken,
      };
    }

    return null;
  }
}
