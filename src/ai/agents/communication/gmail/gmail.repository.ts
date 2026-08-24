import { Inject, Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.service';
import { IntegrationEncryptionService } from '../../../../infrastructure/security/integration-encryption.service.js';

import { gmailConfigs } from '../../../../database/drizzle/schema/gmail-config.schema';

export interface SaveGmailConfigInput {
  tenantId: string;
  email: string;
  clientId?: string | null;
  clientSecret?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
}

type GmailConfigDbRow = typeof gmailConfigs.$inferSelect;

@Injectable()
export class GmailRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  private decryptRow(row: GmailConfigDbRow): GmailConfigDbRow {
    return {
      ...row,
      clientSecret: this.encryption.decryptStored(row.clientSecret).plaintext,
      accessToken: this.encryption.decryptStored(row.accessToken).plaintext,
      refreshToken: this.encryption.decryptStored(row.refreshToken).plaintext,
      smtpPassword: this.encryption.decryptStored(row.smtpPassword).plaintext,
    };
  }

  private async materialize(
    row: GmailConfigDbRow | null,
  ): Promise<GmailConfigDbRow | null> {
    if (!row) {
      return null;
    }

    const clientSecret = this.encryption.decryptStored(row.clientSecret);
    const accessToken = this.encryption.decryptStored(row.accessToken);
    const refreshToken = this.encryption.decryptStored(row.refreshToken);
    const smtpPassword = this.encryption.decryptStored(row.smtpPassword);

    if (
      clientSecret.wasLegacy ||
      accessToken.wasLegacy ||
      refreshToken.wasLegacy ||
      smtpPassword.wasLegacy
    ) {
      const patch: Partial<typeof gmailConfigs.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (clientSecret.wasLegacy) {
        patch.clientSecret = this.encryption.encrypt(clientSecret.plaintext);
      }
      if (accessToken.wasLegacy) {
        patch.accessToken = this.encryption.encrypt(accessToken.plaintext);
      }
      if (refreshToken.wasLegacy) {
        patch.refreshToken = this.encryption.encrypt(refreshToken.plaintext);
      }
      if (smtpPassword.wasLegacy) {
        patch.smtpPassword = this.encryption.encrypt(smtpPassword.plaintext);
      }
      await this.db
        .update(gmailConfigs)
        .set(patch)
        .where(eq(gmailConfigs.id, row.id));
    }

    return {
      ...row,
      clientSecret: clientSecret.plaintext,
      accessToken: accessToken.plaintext,
      refreshToken: refreshToken.plaintext,
      smtpPassword: smtpPassword.plaintext,
    };
  }

  async findByTenantAndEmail(tenantId: string, email: string) {
    const result = await this.db
      .select()
      .from(gmailConfigs)
      .where(
        and(eq(gmailConfigs.tenantId, tenantId), eq(gmailConfigs.email, email)),
      )
      .limit(1);

    return this.materialize(result[0] ?? null);
  }

  async create(data: SaveGmailConfigInput) {
    const result = await this.db
      .insert(gmailConfigs)
      .values({
        tenantId: data.tenantId,
        email: data.email,
        clientId: data.clientId ?? null,
        clientSecret: this.encryption.encrypt(data.clientSecret ?? null) ?? null,
        accessToken: this.encryption.encrypt(data.accessToken ?? null) ?? null,
        refreshToken: this.encryption.encrypt(data.refreshToken ?? null) ?? null,
        tokenExpiry: data.tokenExpiry ?? null,
      })
      .returning();

    return this.decryptRow(result[0]);
  }

  async updateTokens(
    id: string,
    data: {
      accessToken?: string | null;
      refreshToken?: string | null;
      tokenExpiry?: Date | null;
    },
  ) {
    const set: Partial<typeof gmailConfigs.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.accessToken !== undefined) {
      set.accessToken = this.encryption.encrypt(data.accessToken) ?? null;
    }
    if (data.refreshToken !== undefined) {
      set.refreshToken = this.encryption.encrypt(data.refreshToken) ?? null;
    }
    if (data.tokenExpiry !== undefined) {
      set.tokenExpiry = data.tokenExpiry;
    }

    const result = await this.db
      .update(gmailConfigs)
      .set(set)
      .where(eq(gmailConfigs.id, id))
      .returning();

    return result[0] ? this.decryptRow(result[0]) : null;
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(gmailConfigs)
      .where(eq(gmailConfigs.id, id))
      .limit(1);

    return this.materialize(result[0] ?? null);
  }

  async findAllForTenant(tenantId: string) {
    const rows = await this.db
      .select()
      .from(gmailConfigs)
      .where(eq(gmailConfigs.tenantId, tenantId));

    return Promise.all(rows.map((row) => this.materialize(row))).then(
      (materialized) =>
        materialized.filter((row): row is GmailConfigDbRow => row != null),
    );
  }

  async findFirstActiveForTenant(tenantId: string) {
    const result = await this.db
      .select()
      .from(gmailConfigs)
      .where(
        and(
          eq(gmailConfigs.tenantId, tenantId),
          eq(gmailConfigs.isActive, true),
        ),
      )
      .limit(1);

    return this.materialize(result[0] ?? null);
  }
}
