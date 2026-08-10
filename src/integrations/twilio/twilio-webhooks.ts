import { Injectable } from '@nestjs/common';
import { validateRequest } from 'twilio/lib/webhooks/webhooks.js';

import { TwilioAppConfigurationService } from './twilio-app-configuration';
import { PhoneNumberManagementService } from './phone-number-management';

export interface InboundTwilioSms {
  MessageSid: string;
  SmsSid?: string;
  From: string;
  To: string;
  Body: string;
  FromCity?: string;
  FromState?: string;
  FromCountry?: string;
  ToCity?: string;
  ToState?: string;
  ToCountry?: string;
}

export interface InboundTwilioCall {
  CallSid: string;
  From: string;
  To: string;
  Direction?: string;
  CallStatus?: string;
  CallerName?: string;
  FromCity?: string;
  FromState?: string;
  FromCountry?: string;
}

export interface CallStatusEvent {
  CallSid: string;
  CallStatus: string;
  From: string;
  To: string;
  Timestamp?: string;
  CallDuration?: string;
}

export interface ResolvedTenantContext {
  tenantId: string | null;
  phoneNumber: string;
  raw: Record<string, string>;
}

@Injectable()
export class TwilioWebhookService {
  constructor(
    private readonly configService: TwilioAppConfigurationService,
    private readonly phoneNumberService: PhoneNumberManagementService,
  ) {}

  private getAuthTokenForTenant(
    tenantConfig?: { authToken?: string } | null,
  ): string {
    if (tenantConfig && tenantConfig.authToken) {
      return tenantConfig.authToken;
    }

    const env = this.configService.getEnvironmentCredentials();
    if (env.authToken) {
      return env.authToken;
    }

    throw new Error('Twilio auth token is not configured');
  }

  validateWebhookRequest(params: {
    method: 'GET' | 'POST';
    url: string;
    signatureHeader: string;
    body: Record<string, string>;
    authToken?: string;
  }): boolean {
    const token = params.authToken ?? this.getAuthTokenForTenant(null);
    return validateRequest(token, params.signatureHeader, params.url, params.body);
  }

  private normalizeRaw(body: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of Object.keys(body)) {
      const value = body[key];
      out[key] = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
    }
    return out;
  }

  parseInboundSms(body: Record<string, unknown>): InboundTwilioSms {
    const raw = this.normalizeRaw(body);
    return {
      MessageSid: raw.MessageSid ?? raw.SmsSid ?? '',
      SmsSid: raw.SmsSid ?? undefined,
      From: raw.From ?? '',
      To: raw.To ?? '',
      Body: raw.Body ?? '',
      FromCity: raw.FromCity ?? undefined,
      FromState: raw.FromState ?? undefined,
      FromCountry: raw.FromCountry ?? undefined,
      ToCity: raw.ToCity ?? undefined,
      ToState: raw.ToState ?? undefined,
      ToCountry: raw.ToCountry ?? undefined,
    };
  }

  parseInboundCall(body: Record<string, unknown>): InboundTwilioCall {
    const raw = this.normalizeRaw(body);
    return {
      CallSid: raw.CallSid ?? '',
      From: raw.From ?? '',
      To: raw.To ?? '',
      Direction: raw.Direction ?? undefined,
      CallStatus: raw.CallStatus ?? undefined,
      CallerName: raw.CallerName ?? undefined,
      FromCity: raw.FromCity ?? undefined,
      FromState: raw.FromState ?? undefined,
      FromCountry: raw.FromCountry ?? undefined,
    };
  }

  parseCallStatus(body: Record<string, unknown>): CallStatusEvent {
    const raw = this.normalizeRaw(body);
    return {
      CallSid: raw.CallSid ?? '',
      CallStatus: raw.CallStatus ?? '',
      From: raw.From ?? '',
      To: raw.To ?? '',
      Timestamp: raw.Timestamp ?? undefined,
      CallDuration: raw.CallDuration ?? undefined,
    };
  }

  async resolveTenantFromDestination(
    destinationPhoneNumber: string,
  ): Promise<ResolvedTenantContext> {
    const tenantId =
      await this.phoneNumberService.resolveTenantIdForTwilioPhoneNumber(destinationPhoneNumber);

    return {
      tenantId,
      phoneNumber: destinationPhoneNumber,
      raw: {},
    };
  }
}
