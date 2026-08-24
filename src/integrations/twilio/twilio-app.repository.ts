import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { phoneNumbers } from '../../database/drizzle/schema/phone-number.schema';
import { IntegrationEncryptionService } from '../../infrastructure/security/integration-encryption.service.js';
import type { TenantTwilioAppConfig } from './twilio-app-configuration';

/**
 * Credential lookup for Twilio operations (calls, SMS, buy, webhooks).
 * Reads from phone_numbers — not a Twilio Apps CRUD overlay.
 * authToken is decrypted in memory only at point of use.
 */
@Injectable()
export class TwilioAppRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  private async decryptConfig(
    row: {
      id: string;
      tenantId: string;
      phoneNumberId: string;
      accountSid: string | null;
      authToken: string | null;
      appSid: string | null;
      webhookUrl: string | null;
      status: string;
    } | undefined,
  ): Promise<TenantTwilioAppConfig | null> {
    if (!row?.accountSid || !row?.authToken) {
      return null;
    }

    const authToken = this.encryption.decryptStored(row.authToken);
    if (authToken.wasLegacy && authToken.plaintext) {
      await this.db
        .update(phoneNumbers)
        .set({
          authToken: this.encryption.encrypt(authToken.plaintext),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(phoneNumbers.id, row.id),
            eq(phoneNumbers.tenantId, row.tenantId),
          ),
        );
    }

    if (!authToken.plaintext) {
      return null;
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      phoneNumberId: row.phoneNumberId,
      accountSid: row.accountSid,
      authToken: authToken.plaintext,
      appSid: row.appSid,
      webhookUrl: row.webhookUrl,
      status: row.status,
    };
  }

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

    return this.decryptConfig(result[0]);
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
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)))
      .limit(1);

    return this.decryptConfig(result[0]);
  }
}
