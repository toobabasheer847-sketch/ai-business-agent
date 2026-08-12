import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { conversations, messages } from '../../database/drizzle/schema';

const MSG_COLUMNS = {
  id: messages.id,
  tenantId: messages.tenantId,
  conversationId: messages.conversationId,
  userId: messages.userId,
  role: messages.role,
  content: messages.content,
  metadata: messages.metadata,
  tokenCount: messages.totalTokens,
  createdAt: messages.createdAt,
} as const;

@Injectable()
export class MessageRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  /**
   * Verify a conversation belongs to the tenant before performing message ops.
   */
  async findConversationByIdAndTenant(conversationId: string, tenantId: string) {
    return this.db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId),
      ),
      columns: { id: true },
    });
  }

  async findAllByConversation(
    conversationId: string,
    tenantId: string,
    role?: string,
  ) {
    const conditions = [
      eq(messages.conversationId, conversationId),
      eq(messages.tenantId, tenantId),
    ];

    if (role) {
      conditions.push(eq(messages.role, role));
    }

    return this.db
      .select(MSG_COLUMNS)
      .from(messages)
      .where(and(...conditions))
      .orderBy(asc(messages.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    const [row] = await this.db
      .select(MSG_COLUMNS)
      .from(messages)
      .where(
        and(
          eq(messages.id, id),
          eq(messages.tenantId, tenantId),
        ),
      )
      .limit(1);

    return row ?? undefined;
  }

  async create(input: {
    tenantId: string;
    conversationId: string;
    userId?: string;
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
    tokenCount?: number;
  }) {
    const [row] = await this.db
      .insert(messages)
      .values({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        userId: input.userId ?? null,
        role: input.role,
        content: input.content,
        metadata: (input.metadata ?? null) as any,
        totalTokens: input.tokenCount ?? null,
      })
      .returning(MSG_COLUMNS);

    return row;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      tokenCount?: number | null;
      metadata?: Record<string, unknown> | null;
    },
  ) {
    const values: Partial<typeof messages.$inferInsert> = {};

    if (input.tokenCount !== undefined) values.totalTokens = input.tokenCount;
    if (input.metadata !== undefined) values.metadata = input.metadata as any;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await this.db
      .update(messages)
      .set(values)
      .where(
        and(
          eq(messages.id, id),
          eq(messages.tenantId, tenantId),
        ),
      )
      .returning(MSG_COLUMNS);

    return row ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(messages)
      .where(
        and(
          eq(messages.id, id),
          eq(messages.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }
}
