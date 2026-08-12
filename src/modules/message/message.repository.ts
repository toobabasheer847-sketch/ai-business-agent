import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { conversations, messages } from '../../database/drizzle/schema';

const MSG_COLUMNS = {
  id: messages.id,
  tenantId: messages.tenantId,
  conversationId: messages.conversationId,
  userId: messages.userId,
  role: messages.role,
  content: messages.content,
  metadata: messages.metadata,
  tokenCount: messages.tokenCount,
  createdAt: messages.createdAt,
} as const;

@Injectable()
export class MessageRepository {
  /**
   * Verify a conversation belongs to the tenant before performing message ops.
   */
  async findConversationByIdAndTenant(conversationId: string, tenantId: string) {
    return db.query.conversations.findFirst({
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

    return db
      .select(MSG_COLUMNS)
      .from(messages)
      .where(and(...conditions))
      .orderBy(asc(messages.createdAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return db.query.messages.findFirst({
      where: and(
        eq(messages.id, id),
        eq(messages.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        metadata: true,
        tokenCount: true,
        createdAt: true,
      },
    });
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
    const [row] = await db
      .insert(messages)
      .values({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        userId: input.userId ?? null,
        role: input.role,
        content: input.content,
        metadata: (input.metadata ?? null) as any,
        tokenCount: input.tokenCount ?? null,
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

    if (input.tokenCount !== undefined) values.tokenCount = input.tokenCount;
    if (input.metadata !== undefined) values.metadata = input.metadata as any;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [row] = await db
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
    const result = await db
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
