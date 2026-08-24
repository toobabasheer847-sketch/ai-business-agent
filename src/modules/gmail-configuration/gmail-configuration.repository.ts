import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { gmailConfigs } from '../../database/drizzle/schema';
import { IntegrationEncryptionService } from '../../infrastructure/security/integration-encryption.service.js';

/** All columns — used internally only, never sent to the client directly. */
const ALL_COLUMNS = {
  id: gmailConfigs.id,
  tenantId: gmailConfigs.tenantId,
  email: gmailConfigs.email,
  clientId: gmailConfigs.clientId,
  clientSecret: gmailConfigs.clientSecret,
  accessToken: gmailConfigs.accessToken,
  refreshToken: gmailConfigs.refreshToken,
  tokenExpiry: gmailConfigs.tokenExpiry,
  smtpPassword: gmailConfigs.smtpPassword,
  isActive: gmailConfigs.isActive,
  createdAt: gmailConfigs.createdAt,
  updatedAt: gmailConfigs.updatedAt,
} as const;

export type GmailConfigRow = {
  id: string;
  tenantId: string;
  email: string;
  clientId: string | null;
  clientSecret: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  smtpPassword: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class GmailConfigurationRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  private decryptRow(row: GmailConfigRow): GmailConfigRow {
    return {
      ...row,
      clientSecret: this.encryption.decryptStored(row.clientSecret).plaintext,
      accessToken: this.encryption.decryptStored(row.accessToken).plaintext,
      refreshToken: this.encryption.decryptStored(row.refreshToken).plaintext,
      smtpPassword: this.encryption.decryptStored(row.smtpPassword).plaintext,
    };
  }

  private async maybeReencryptLegacy(
    id: string,
    tenantId: string,
    encrypted: {
      clientSecret?: string | null;
      accessToken?: string | null;
      refreshToken?: string | null;
      smtpPassword?: string | null;
    },
    flags: {
      clientSecret: boolean;
      accessToken: boolean;
      refreshToken: boolean;
      smtpPassword: boolean;
    },
  ): Promise<void> {
    const patch: Partial<typeof gmailConfigs.$inferInsert> = {};
    if (flags.clientSecret && encrypted.clientSecret != null) {
      patch.clientSecret = encrypted.clientSecret;
    }
    if (flags.accessToken && encrypted.accessToken != null) {
      patch.accessToken = encrypted.accessToken;
    }
    if (flags.refreshToken && encrypted.refreshToken != null) {
      patch.refreshToken = encrypted.refreshToken;
    }
    if (flags.smtpPassword && encrypted.smtpPassword != null) {
      patch.smtpPassword = encrypted.smtpPassword;
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    patch.updatedAt = new Date();
    await this.db
      .update(gmailConfigs)
      .set(patch)
      .where(
        and(eq(gmailConfigs.id, id), eq(gmailConfigs.tenantId, tenantId)),
      );
  }

  private async materializeRow(
    row: GmailConfigRow | undefined,
  ): Promise<GmailConfigRow | undefined> {
    if (!row) {
      return undefined;
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
      await this.maybeReencryptLegacy(
        row.id,
        row.tenantId,
        {
          clientSecret: this.encryption.encrypt(clientSecret.plaintext),
          accessToken: this.encryption.encrypt(accessToken.plaintext),
          refreshToken: this.encryption.encrypt(refreshToken.plaintext),
          smtpPassword: this.encryption.encrypt(smtpPassword.plaintext),
        },
        {
          clientSecret: clientSecret.wasLegacy,
          accessToken: accessToken.wasLegacy,
          refreshToken: refreshToken.wasLegacy,
          smtpPassword: smtpPassword.wasLegacy,
        },
      );
    }

    return {
      ...row,
      clientSecret: clientSecret.plaintext,
      accessToken: accessToken.plaintext,
      refreshToken: refreshToken.plaintext,
      smtpPassword: smtpPassword.plaintext,
    };
  }

  /** Find existing config for a tenant — returns decrypted secrets for internal use. */
  async findByTenantId(tenantId: string): Promise<GmailConfigRow | undefined> {
    const row = await this.db.query.gmailConfigs.findFirst({
      where: eq(gmailConfigs.tenantId, tenantId),
    });
    return this.materializeRow(row as GmailConfigRow | undefined);
  }

  /** Find by id and tenant — returns decrypted secrets for internal use. */
  async findByIdAndTenant(
    id: string,
    tenantId: string,
  ): Promise<GmailConfigRow | undefined> {
    const row = await this.db.query.gmailConfigs.findFirst({
      where: and(eq(gmailConfigs.id, id), eq(gmailConfigs.tenantId, tenantId)),
    });
    return this.materializeRow(row as GmailConfigRow | undefined);
  }

  async create(input: {
    tenantId: string;
    email: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    smtpPassword?: string;
    isActive: boolean;
  }): Promise<GmailConfigRow> {
    const [row] = await this.db
      .insert(gmailConfigs)
      .values({
        tenantId: input.tenantId,
        email: input.email,
        clientId: input.clientId ?? null,
        clientSecret: this.encryption.encrypt(input.clientSecret ?? null) ?? null,
        accessToken: this.encryption.encrypt(input.accessToken ?? null) ?? null,
        refreshToken: this.encryption.encrypt(input.refreshToken ?? null) ?? null,
        tokenExpiry: input.tokenExpiry ?? null,
        smtpPassword: this.encryption.encrypt(input.smtpPassword ?? null) ?? null,
        isActive: input.isActive,
      })
      .returning(ALL_COLUMNS);

    return this.decryptRow(row);
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      email?: string;
      clientId?: string | null;
      clientSecret?: string | null;
      accessToken?: string | null;
      refreshToken?: string | null;
      tokenExpiry?: Date | null;
      smtpPassword?: string | null;
      isActive?: boolean;
    },
  ): Promise<GmailConfigRow | null> {
    const values: Partial<typeof gmailConfigs.$inferInsert> = {};

    if (input.email !== undefined) values.email = input.email;
    if (input.clientId !== undefined) values.clientId = input.clientId;
    if (input.clientSecret !== undefined) {
      values.clientSecret = this.encryption.encrypt(input.clientSecret) ?? null;
    }
    if (input.accessToken !== undefined) {
      values.accessToken = this.encryption.encrypt(input.accessToken) ?? null;
    }
    if (input.refreshToken !== undefined) {
      values.refreshToken = this.encryption.encrypt(input.refreshToken) ?? null;
    }
    if (input.tokenExpiry !== undefined) values.tokenExpiry = input.tokenExpiry;
    if (input.smtpPassword !== undefined) {
      values.smtpPassword = this.encryption.encrypt(input.smtpPassword) ?? null;
    }
    if (input.isActive !== undefined) values.isActive = input.isActive;

    if (Object.keys(values).length === 0) {
      return (await this.findByIdAndTenant(id, tenantId)) ?? null;
    }

    values.updatedAt = new Date();

    const [row] = await this.db
      .update(gmailConfigs)
      .set(values)
      .where(and(eq(gmailConfigs.id, id), eq(gmailConfigs.tenantId, tenantId)))
      .returning(ALL_COLUMNS);

    return row ? this.decryptRow(row) : null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(gmailConfigs)
      .where(and(eq(gmailConfigs.id, id), eq(gmailConfigs.tenantId, tenantId)));

    return (result.rowCount ?? 0) > 0;
  }
}
