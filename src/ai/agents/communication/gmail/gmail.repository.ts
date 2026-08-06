import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';

import { db } from '../../../../database/drizzle';

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

@Injectable()
export class GmailRepository {
  async findByTenantAndEmail(
    tenantId: string,
    email: string,
  ) {
    const result = await db
      .select()
      .from(gmailConfigs)
      .where(
        and(
          eq(gmailConfigs.tenantId, tenantId),
          eq(gmailConfigs.email, email),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  async create(
    data: SaveGmailConfigInput,
  ) {
    const result = await db
      .insert(gmailConfigs)
      .values({
        tenantId: data.tenantId,
        email: data.email,
        clientId: data.clientId ?? null,
        clientSecret: data.clientSecret ?? null,
        accessToken: data.accessToken ?? null,
        refreshToken: data.refreshToken ?? null,
        tokenExpiry: data.tokenExpiry ?? null,
      })
      .returning();

    return result[0];
  }

  async updateTokens(
    id: string,
    data: {
      accessToken?: string | null;
      refreshToken?: string | null;
      tokenExpiry?: Date | null;
    },
  ) {
    const result = await db
      .update(gmailConfigs)
      .set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiry: data.tokenExpiry,
        updatedAt: new Date(),
      })
      .where(eq(gmailConfigs.id, id))
      .returning();

    return result[0] ?? null;
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(gmailConfigs)
      .where(eq(gmailConfigs.id, id))
      .limit(1);

    return result[0] ?? null;
  }
}