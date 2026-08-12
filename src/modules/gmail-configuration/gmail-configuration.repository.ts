import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { gmailConfigs } from '../../database/drizzle/schema';

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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class GmailConfigurationRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  /** Find existing config for a tenant — returns all columns for internal use. */
  async findByTenantId(tenantId: string): Promise<GmailConfigRow | undefined> {
    return this.db.query.gmailConfigs.findFirst({
      where: eq(gmailConfigs.tenantId, tenantId),
    });
  }

  /** Find by id and tenant — returns all columns for internal use. */
  async findByIdAndTenant(id: string, tenantId: string): Promise<GmailConfigRow | undefined> {
    return this.db.query.gmailConfigs.findFirst({
      where: and(
        eq(gmailConfigs.id, id),
        eq(gmailConfigs.tenantId, tenantId),
      ),
    });
  }

  async create(input: {
    tenantId: string;
    email: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    isActive: boolean;
  }): Promise<GmailConfigRow> {
    const [row] = await this.db
      .insert(gmailConfigs)
      .values({
        tenantId: input.tenantId,
        email: input.email,
        clientId: input.clientId ?? null,
        clientSecret: input.clientSecret ?? null,
        accessToken: input.accessToken ?? null,
        refreshToken: input.refreshToken ?? null,
        tokenExpiry: input.tokenExpiry ?? null,
        isActive: input.isActive,
      })
      .returning(ALL_COLUMNS);

    return row;
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
      isActive?: boolean;
    },
  ): Promise<GmailConfigRow | null> {
    const values: Partial<typeof gmailConfigs.$inferInsert> = {};

    if (input.email !== undefined) values.email = input.email;
    if (input.clientId !== undefined) values.clientId = input.clientId;
    if (input.clientSecret !== undefined) values.clientSecret = input.clientSecret;
    if (input.accessToken !== undefined) values.accessToken = input.accessToken;
    if (input.refreshToken !== undefined) values.refreshToken = input.refreshToken;
    if (input.tokenExpiry !== undefined) values.tokenExpiry = input.tokenExpiry;
    if (input.isActive !== undefined) values.isActive = input.isActive;

    if (Object.keys(values).length === 0) {
      return (await this.findByIdAndTenant(id, tenantId)) ?? null;
    }

    const [row] = await this.db
      .update(gmailConfigs)
      .set(values)
      .where(
        and(
          eq(gmailConfigs.id, id),
          eq(gmailConfigs.tenantId, tenantId),
        ),
      )
      .returning(ALL_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(gmailConfigs)
      .where(
        and(
          eq(gmailConfigs.id, id),
          eq(gmailConfigs.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
