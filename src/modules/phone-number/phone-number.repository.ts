import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { phoneNumbers } from '../../database/drizzle/schema';
import { IntegrationEncryptionService } from '../../infrastructure/security/integration-encryption.service.js';
import type { PhoneNumberRow } from './entities/phone-number.entity';

const RETURNING_COLUMNS = {
  id: phoneNumbers.id,
  tenantId: phoneNumbers.tenantId,
  phoneNumber: phoneNumbers.phoneNumber,
  label: phoneNumbers.label,
  provider: phoneNumbers.provider,
  status: phoneNumbers.status,
  phoneSid: phoneNumbers.phoneSid,
  twilioSid: phoneNumbers.twilioSid,
  authToken: phoneNumbers.authToken,
  appSid: phoneNumbers.appSid,
  webhookUrl: phoneNumbers.webhookUrl,
  createdAt: phoneNumbers.createdAt,
  updatedAt: phoneNumbers.updatedAt,
} as const;

export interface ListPhoneNumbersOptions {
  provider?: string;
  status?: string;
  search?: string;
}

export type PhoneNumberWriteInput = {
  phoneNumber?: string;
  label?: string | null;
  provider?: string;
  status?: string;
  phoneSid?: string | null;
  twilioSid?: string | null;
  authToken?: string | null;
  appSid?: string | null;
  webhookUrl?: string | null;
};

@Injectable()
export class PhoneNumberRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  private decryptAuthToken(row: PhoneNumberRow): PhoneNumberRow {
    return {
      ...row,
      authToken: this.encryption.decryptStored(row.authToken).plaintext,
    };
  }

  private async materialize(
    row: PhoneNumberRow | null,
  ): Promise<PhoneNumberRow | null> {
    if (!row) {
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

    return {
      ...row,
      authToken: authToken.plaintext,
    };
  }

  private async materializeMany(rows: PhoneNumberRow[]): Promise<PhoneNumberRow[]> {
    return Promise.all(
      rows.map(async (row) => (await this.materialize(row))!),
    );
  }

  async findAllByTenant(tenantId: string, options: ListPhoneNumbersOptions = {}) {
    const { provider, status, search } = options;

    const conditions = [eq(phoneNumbers.tenantId, tenantId)];

    if (provider) {
      conditions.push(eq(phoneNumbers.provider, provider));
    }

    if (status) {
      conditions.push(eq(phoneNumbers.status, status));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(phoneNumbers.phoneNumber, `%${search.trim()}%`),
          ilike(phoneNumbers.label, `%${search.trim()}%`),
        )!,
      );
    }

    const rows = await this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(and(...conditions))
      .orderBy(desc(phoneNumbers.createdAt));

    return this.materializeMany(rows);
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    const rows = await this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)))
      .limit(1);

    return this.materialize(rows[0] ?? null);
  }

  async findByPhoneNumberAndTenant(phoneNumber: string, tenantId: string) {
    const rows = await this.db
      .select(RETURNING_COLUMNS)
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.phoneNumber, phoneNumber),
          eq(phoneNumbers.tenantId, tenantId),
        ),
      )
      .limit(1);

    return this.materialize(rows[0] ?? null);
  }

  async create(input: {
    tenantId: string;
    phoneNumber: string;
    label?: string | null;
    provider?: string;
    status?: string;
    phoneSid?: string | null;
    twilioSid?: string | null;
    authToken?: string | null;
    appSid?: string | null;
    webhookUrl?: string | null;
  }): Promise<PhoneNumberRow> {
    const [row] = await this.db
      .insert(phoneNumbers)
      .values({
        tenantId: input.tenantId,
        phoneNumber: input.phoneNumber,
        label: input.label ?? null,
        provider: input.provider ?? 'twilio',
        status: input.status ?? 'active',
        phoneSid: input.phoneSid ?? null,
        twilioSid: input.twilioSid ?? null,
        authToken: this.encryption.encrypt(input.authToken ?? null) ?? null,
        appSid: input.appSid ?? null,
        webhookUrl: input.webhookUrl ?? null,
      })
      .returning(RETURNING_COLUMNS);

    return this.decryptAuthToken(row);
  }

  async update(
    id: string,
    tenantId: string,
    input: PhoneNumberWriteInput,
  ): Promise<PhoneNumberRow | null> {
    const values: Partial<typeof phoneNumbers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.phoneNumber !== undefined) values.phoneNumber = input.phoneNumber;
    if (input.label !== undefined) values.label = input.label;
    if (input.provider !== undefined) values.provider = input.provider;
    if (input.status !== undefined) values.status = input.status;
    if (input.phoneSid !== undefined) values.phoneSid = input.phoneSid;
    if (input.twilioSid !== undefined) values.twilioSid = input.twilioSid;
    if (input.authToken !== undefined) {
      values.authToken = this.encryption.encrypt(input.authToken) ?? null;
    }
    if (input.appSid !== undefined) values.appSid = input.appSid;
    if (input.webhookUrl !== undefined) values.webhookUrl = input.webhookUrl;

    const [row] = await this.db
      .update(phoneNumbers)
      .set(values)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)))
      .returning(RETURNING_COLUMNS);

    return row ? this.decryptAuthToken(row) : null;
  }

  /**
   * Clears Twilio configuration columns without deleting the phone number row.
   */
  async disconnectTwilio(
    id: string,
    tenantId: string,
  ): Promise<PhoneNumberRow | null> {
    return this.update(id, tenantId, {
      phoneSid: null,
      twilioSid: null,
      authToken: null,
      appSid: null,
      webhookUrl: null,
    });
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)));

    return (result.rowCount ?? 0) > 0;
  }
}
