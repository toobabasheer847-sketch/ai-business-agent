import { Injectable } from '@nestjs/common';
import Twilio from 'twilio';

import { TwilioAppConfigurationService } from './twilio-app-configuration';
import { PhoneNumberManagementService } from './phone-number-management';

export interface OutboundCallInput {
  tenantId: string;
  to: string;
  fromPhoneNumberId: string;
  twiml?: string;
  callbackUrl?: string;
  statusCallback?: string;
}

export interface OutboundCallResult {
  callSid: string;
  from: string;
  to: string;
  status: string;
}

@Injectable()
export class CallManagementService {
  constructor(
    private readonly configService: TwilioAppConfigurationService,
    private readonly phoneNumberService: PhoneNumberManagementService,
  ) {}

  async initiateOutboundCall(input: OutboundCallInput): Promise<OutboundCallResult> {
    if (!input.tenantId) {
      throw new Error('tenantId is required for outbound calls');
    }

    if (!input.to) {
      throw new Error('Destination phone number is required');
    }

    if (!input.fromPhoneNumberId) {
      throw new Error('Source phone number identifier is required');
    }

    // Resolve per-tenant credentials first (DB → env fallback).
    const credentials = await this.configService.resolveCredentialsForTenant(input.tenantId);
    if (!credentials) {
      throw new Error('Twilio credentials are not configured for this tenant');
    }

    const fromRow = await this.phoneNumberService.findTenantPhoneNumberById(
      input.tenantId,
      input.fromPhoneNumberId,
    );
    if (!fromRow) {
      throw new Error('Source phone number not found for the tenant');
    }

    if (fromRow.status !== 'active') {
      throw new Error('Source phone number is not active');
    }

    // Credentials are never logged — only used to create the Twilio client.
    const client = Twilio(credentials.accountSid, credentials.authToken);

    const createParams: {
      to: string;
      from: string;
      twiml?: string;
      url?: string;
      statusCallback?: string;
    } = {
      to: input.to,
      from: fromRow.phoneNumber,
      statusCallback: input.statusCallback,
    };

    if (input.twiml) {
      createParams.twiml = input.twiml;
    } else if (input.callbackUrl) {
      createParams.url = input.callbackUrl;
    } else {
      createParams.twiml =
        '<Response><Say>Thank you for your call. Connecting you now.</Say></Response>';
    }

    const call = await client.calls.create(createParams);

    return {
      callSid: call.sid,
      from: call.from ?? fromRow.phoneNumber,
      to: call.to ?? input.to,
      status: call.status,
    };
  }
}
