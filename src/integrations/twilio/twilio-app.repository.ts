import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { phoneNumbers } from '../../database/drizzle/schema/phone-number.schema';
import type { TenantTwilioAppConfig } from './twilio-app-configuration';

/**
 * Credential lookup for Twilio operations (calls, SMS, buy, webhooks).
 * Reads from phone_numbers — not a Twilio Apps CRUD overlay.
 * The retired /api/twilio-apps module lived in src/modules/twilio-app/.
 */
@Injectable()
export class TwilioAppRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async findActiveForTenant(tenantId: string): Promise<TenantTwilioAppConfig | null> {
    if (!tenantId) return null;

    const result = await this.db
      .select({
        id: phoneNumbers.id,
        tenantId: phoneNumbers.tenantId,
        phoneNumberId: phoneNumbers.id,
        accountSid: phoneNumbers.twilioSid,
        authToken: phoneNumbers.authToken,
        appSid: phoneNumbers.appSid,
        webhookUrl: phoneNumbers.webhookUrl,
        status: phoneNumbers.status,
      })
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.tenantId, tenantId),
          eq(phoneNumbers.status, 'active'),
          sql`(${phoneNumbers.twilioSid} is not null and ${phoneNumbers.authToken} is not null)`,
        ),
      )
      .limit(1);

    const row = result[0];
    if (!row?.accountSid || !row?.authToken) return null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      phoneNumberId: row.phoneNumberId,
      accountSid: row.accountSid,
      authToken: row.authToken,
      appSid: row.appSid,
      webhookUrl: row.webhookUrl,
      status: row.status,
    };
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<TenantTwilioAppConfig | null> {
    if (!id || !tenantId) return null;

    const result = await this.db
      .select({
        id: phoneNumbers.id,
        tenantId: phoneNumbers.tenantId,
        phoneNumberId: phoneNumbers.id,
        accountSid: phoneNumbers.twilioSid,
        authToken: phoneNumbers.authToken,
        appSid: phoneNumbers.appSid,
        webhookUrl: phoneNumbers.webhookUrl,
        status: phoneNumbers.status,
      })
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.id, id),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      )
      .limit(1);

    const row = result[0];
    if (!row?.accountSid || !row?.authToken) return null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      phoneNumberId: row.phoneNumberId,
      accountSid: row.accountSid,
      authToken: row.authToken,
      appSid: row.appSid,
      webhookUrl: row.webhookUrl,
      status: row.status,
    };
  }
}
