import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { phoneNumbers } from '../../database/drizzle/schema';

/**
 * Twilio "app" rows are now the same as phone_numbers rows that have
 * Twilio credentials (twilio_sid / auth_token) filled in.
 */
const RETURNING_COLUMNS = {
  id: phoneNumbers.id,
  tenantId: phoneNumbers.tenantId,
  phoneNumberId: phoneNumbers.id,
  accountSid: phoneNumbers.twilioSid,
  authToken: phoneNumbers.authToken,
  appSid: phoneNumbers.appSid,
  webhookUrl: phoneNumbers.webhookUrl,
  status: phoneNumbers.status,
  createdAt: phoneNumbers.createdAt,
  updatedAt: phoneNumbers.updatedAt,
} as const;

export interface ListTwilioAppsOptions {
  phoneNumberId?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class TwilioAppRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async findPhoneNumberByIdAndTenant(phoneNumberId: string, tenantId: string) {
    const rows = await this.db
      .select({ id: phoneNumbers.id })
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.id, phoneNumberId),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  private hasTwilioCredentials() {
    return sql`(${phoneNumbers.twilioSid} is not null or ${phoneNumbers.authToken} is not null)`;
  }

  async findAllByTenant(tenantId: string, options: ListTwilioAppsOptions = {}) {
    const { phoneNumberId, status, search } = options;

    const conditions = [
      eq(phoneNumbers.tenantId, tenantId),
      this.hasTwilioCredentials(),
    ];

    if (phoneNumberId) {
      conditions.push(eq(phoneNumbers.id, phoneNumberId));
    }

    if (status) {
      conditions.push(eq(phoneNumbers.status, status));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(phoneNumbers.twilioSid, `%${search.trim()}%`),
          ilike(phoneNumbers.appSid, `%${search.trim()}%`),
          ilike(phoneNumbers.webhookUrl, `%${search.trim()}%`),
        )!,
      );
    }

    return this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(and(...conditions))
      .orderBy(desc(phoneNumbers.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    const rows = await this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.id, id),
          eq(phoneNumbers.tenantId, tenantId),
          this.hasTwilioCredentials(),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Attaches Twilio credentials onto an existing phone_numbers row.
   */
  async create(input: {
    tenantId: string;
    phoneNumberId: string;
    accountSid: string;
    authToken: string;
    appSid?: string;
    webhookUrl?: string;
    status?: string;
  }) {
    const [row] = await this.db
      .update(phoneNumbers)
      .set({
        twilioSid: input.accountSid,
        authToken: input.authToken,
        appSid: input.appSid ?? null,
        webhookUrl: input.webhookUrl ?? null,
        status: input.status ?? 'active',
        provider: 'twilio',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(phoneNumbers.id, input.phoneNumberId),
          eq(phoneNumbers.tenantId, input.tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      phoneNumberId?: string;
      accountSid?: string;
      authToken?: string;
      appSid?: string | null;
      webhookUrl?: string | null;
      status?: string;
    },
  ) {
    const values: Partial<typeof phoneNumbers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.accountSid !== undefined) values.twilioSid = input.accountSid;
    if (input.authToken !== undefined) values.authToken = input.authToken;
    if (input.appSid !== undefined) values.appSid = input.appSid;
    if (input.webhookUrl !== undefined) values.webhookUrl = input.webhookUrl;
    if (input.status !== undefined) values.status = input.status;

    const targetId = input.phoneNumberId ?? id;

    const [row] = await this.db
      .update(phoneNumbers)
      .set(values)
      .where(
        and(
          eq(phoneNumbers.id, targetId),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      )
      .returning(RETURNING_COLUMNS);

    return row ?? null;
  }

  /**
   * Clears Twilio credentials from the phone row (does not delete the number).
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .update(phoneNumbers)
      .set({
        twilioSid: null,
        authToken: null,
        appSid: null,
        webhookUrl: null,
        phoneSid: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(phoneNumbers.id, id),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
