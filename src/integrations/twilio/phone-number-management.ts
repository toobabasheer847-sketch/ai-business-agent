import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { phoneNumbers } from '../../database/drizzle/schema/phone-number.schema';
import { twilioPhoneNumbers } from '../../database/drizzle/schema/twilio-phone-number.schema';

export interface TenantPhoneNumber {
  id: string;
  tenantId: string;
  phoneNumber: string;
  provider: string;
  label: string | null;
  status: string;
}

export interface TenantTwilioPhoneNumber {
  id: string;
  tenantId: string;
  userId: string | null;
  phoneNumber: string;
  phoneNumberSid: string | null;
  friendlyName: string | null;
  accountSid: string | null;
  appSid: string | null;
  webhookUrl: string | null;
  status: string;
}

@Injectable()
export class PhoneNumberManagementService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async listTenantPhoneNumbers(tenantId: string): Promise<TenantPhoneNumber[]> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    return this.db
      .select({
        id: phoneNumbers.id,
        tenantId: phoneNumbers.tenantId,
        phoneNumber: phoneNumbers.phoneNumber,
        provider: phoneNumbers.provider,
        label: phoneNumbers.label,
        status: phoneNumbers.status,
      })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.tenantId, tenantId));
  }

  async findTenantPhoneNumberById(
    tenantId: string,
    phoneNumberId: string,
  ): Promise<TenantPhoneNumber | null> {
    if (!tenantId || !phoneNumberId) return null;

    const result = await this.db
      .select({
        id: phoneNumbers.id,
        tenantId: phoneNumbers.tenantId,
        phoneNumber: phoneNumbers.phoneNumber,
        provider: phoneNumbers.provider,
        label: phoneNumbers.label,
        status: phoneNumbers.status,
      })
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.tenantId, tenantId), eq(phoneNumbers.id, phoneNumberId)))
      .limit(1);

    return result[0] ?? null;
  }

  async listTenantTwilioPhoneNumbers(tenantId: string): Promise<TenantTwilioPhoneNumber[]> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    return this.db
      .select({
        id: twilioPhoneNumbers.id,
        tenantId: twilioPhoneNumbers.tenantId,
        userId: twilioPhoneNumbers.userId,
        phoneNumber: twilioPhoneNumbers.phoneNumber,
        phoneNumberSid: twilioPhoneNumbers.phoneNumberSid,
        friendlyName: twilioPhoneNumbers.friendlyName,
        accountSid: twilioPhoneNumbers.accountSid,
        appSid: twilioPhoneNumbers.appSid,
        webhookUrl: twilioPhoneNumbers.webhookUrl,
        status: twilioPhoneNumbers.status,
      })
      .from(twilioPhoneNumbers)
      .where(eq(twilioPhoneNumbers.tenantId, tenantId));
  }

  async findTwilioPhoneNumberByNumber(
    tenantId: string | null,
    phoneNumber: string,
  ): Promise<TenantTwilioPhoneNumber | null> {
    if (!phoneNumber) return null;

    const clauses = [eq(twilioPhoneNumbers.phoneNumber, phoneNumber)];
    if (tenantId) {
      clauses.push(eq(twilioPhoneNumbers.tenantId, tenantId));
    }

    const result = await this.db
      .select({
        id: twilioPhoneNumbers.id,
        tenantId: twilioPhoneNumbers.tenantId,
        userId: twilioPhoneNumbers.userId,
        phoneNumber: twilioPhoneNumbers.phoneNumber,
        phoneNumberSid: twilioPhoneNumbers.phoneNumberSid,
        friendlyName: twilioPhoneNumbers.friendlyName,
        accountSid: twilioPhoneNumbers.accountSid,
        appSid: twilioPhoneNumbers.appSid,
        webhookUrl: twilioPhoneNumbers.webhookUrl,
        status: twilioPhoneNumbers.status,
      })
      .from(twilioPhoneNumbers)
      .where(and(...clauses))
      .limit(1);

    return result[0] ?? null;
  }

  async resolveTenantIdForTwilioPhoneNumber(phoneNumber: string): Promise<string | null> {
    const resolved = await this.findTwilioPhoneNumberByNumber(null, phoneNumber);
    return resolved?.tenantId ?? null;
  }
}
