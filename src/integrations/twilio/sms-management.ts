import { Injectable } from '@nestjs/common';
import Twilio from 'twilio';

import { TwilioAppConfigurationService } from './twilio-app-configuration';
import { PhoneNumberManagementService } from './phone-number-management';

export interface SendSmsInput {
  tenantId: string;
  to: string;
  body: string;
  fromPhoneNumberId: string;
  statusCallback?: string;
}

export interface SendSmsResult {
  messageSid: string;
  from: string;
  to: string;
  status: string;
  body: string;
}

@Injectable()
export class SmsManagementService {
  constructor(
    private readonly configService: TwilioAppConfigurationService,
    private readonly phoneNumberService: PhoneNumberManagementService,
  ) {}

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    if (!input.tenantId) {
      throw new Error('tenantId is required for SMS');
    }

    if (!input.to) {
      throw new Error('Destination phone number is required');
    }

    if (!input.body || input.body.trim().length === 0) {
      throw new Error('SMS body cannot be empty');
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

    const message = await client.messages.create({
      to: input.to,
      from: fromRow.phoneNumber,
      body: input.body,
      statusCallback: input.statusCallback,
    });

    return {
      messageSid: message.sid,
      from: message.from ?? fromRow.phoneNumber,
      to: message.to ?? input.to,
      status: message.status,
      body: input.body,
    };
  }
}
