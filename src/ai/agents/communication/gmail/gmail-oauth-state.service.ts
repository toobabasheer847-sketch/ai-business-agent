import { randomBytes } from 'node:crypto';

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.service';
import { oauthStates } from '../../../../database/drizzle/schema/oauth-state.schema';

export const GMAIL_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const GMAIL_OAUTH_PURPOSE = 'gmail_oauth';

export interface GmailOAuthStateContext {
  tenantId: string;
  userId: string;
}

@Injectable()
export class GmailOauthStateService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async create(tenantId: string, userId: string): Promise<string> {
    if (!tenantId?.trim() || !userId?.trim()) {
      throw new BadRequestException(
        'Authenticated tenant and user are required to start Gmail OAuth',
      );
    }

    const state = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + GMAIL_OAUTH_STATE_TTL_MS);

    await this.db.insert(oauthStates).values({
      state,
      tenantId,
      userId,
      purpose: GMAIL_OAUTH_PURPOSE,
      expiresAt,
    });

    return state;
  }

  async consume(state: string | undefined): Promise<GmailOAuthStateContext> {
    if (!state?.trim()) {
      throw new BadRequestException('OAuth state is required');
    }

    const [record] = await this.db
      .select()
      .from(oauthStates)
      .where(
        and(
          eq(oauthStates.state, state),
          eq(oauthStates.purpose, GMAIL_OAUTH_PURPOSE),
        ),
      )
      .limit(1);

    if (!record) {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (record.usedAt) {
      throw new BadRequestException('OAuth state has already been used');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('OAuth state has expired');
    }

    const [updated] = await this.db
      .update(oauthStates)
      .set({ usedAt: new Date() })
      .where(and(eq(oauthStates.id, record.id), isNull(oauthStates.usedAt)))
      .returning({
        tenantId: oauthStates.tenantId,
        userId: oauthStates.userId,
      });

    if (!updated) {
      throw new BadRequestException('OAuth state has already been used');
    }

    return {
      tenantId: updated.tenantId,
      userId: updated.userId,
    };
  }
}
