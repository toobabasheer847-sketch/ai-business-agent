import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { conversations, messages } from '../../database/drizzle/schema';
import { ConversationChannel, ConversationStatus } from './dto/create-conversation.dto';

// Columns returned for every conversation query
const CONV_COLUMNS = {
  id: conversations.id,
  tenantId: conversations.tenantId,
  userId: conversations.userId,
  prospectId: conversations.prospectId,
  title: conversations.title,
  channel: conversations.channel,
  status: conversations.status,
  summary: conversations.summary,
  createdAt: conversations.createdAt,
  updatedAt: conversations.updatedAt,
} as const;

// Columns returned for every message query
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

interface ListConversationsOptions {
  channel?: ConversationChannel;
  status?: ConversationStatus;
  prospectId?: string;
  search?: string;
}

@Injectable()
export class ConversationRepository {
  // ─── Conversations ────────────────────────────────────────────────────────

  async findAllByTenant(tenantId: string, options: ListConversationsOptions = {}) {
    const { channel, status, prospectId, search } = options;

    const conditions = [eq(conversations.tenantId, tenantId)];

    if (channel) {
      conditions.push(eq(conversations.channel, channel));
    }

    if (status) {
      conditions.push(eq(conversations.status, status));
    }

    if (prospectId) {
      conditions.push(eq(conversations.prospectId, prospectId));
    }

    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(conversations.title, `%${search.trim()}%`),
          ilike(conversations.summary, `%${search.trim()}%`),
        )!,
      );
    }

    return db
      .select(CONV_COLUMNS)
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, id),
        eq(conversations.tenantId, tenantId),
      ),
      columns: {
        id: true,
        tenantId: true,
        userId: true,
        prospectId: true,
        title: true,
        channel: true,
        status: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(input: {
    tenantId: string;
    userId: string;
    prospectId?: string;
    title?: string;
    channel?: string;
    summary?: string;
  }) {
    const [conversation] = await db
      .insert(conversations)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        prospectId: input.prospectId ?? null,
        title: input.title ?? null,
        channel: input.channel ?? 'web',
        status: 'active',
        summary: input.summary ?? null,
      })
      .returning(CONV_COLUMNS);

    return conversation;
  }

  async update(
    id: string,
    tenantId: string,
    input: {
      title?: string | null;
      channel?: string;
      status?: string;
      summary?: string | null;
    },
  ) {
    const values: Partial<typeof conversations.$inferInsert> = {};

    if (input.title !== undefined) values.title = input.title;
    if (input.channel !== undefined) values.channel = input.channel;
    if (input.status !== undefined) values.status = input.status;
    if (input.summary !== undefined) values.summary = input.summary;

    if (Object.keys(values).length === 0) {
      return this.findByIdAndTenant(id, tenantId);
    }

    const [conversation] = await db
      .update(conversations)
      .set(values)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.tenantId, tenantId),
        ),
      )
      .returning(CONV_COLUMNS);

    return conversation ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.tenantId, tenantId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async findMessagesByConversation(conversationId: string, tenantId: string) {
    return db
      .select(MSG_COLUMNS)
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.tenantId, tenantId),
        ),
      )
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(input: {
    tenantId: string;
    conversationId: string;
    userId?: string;
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
    tokenCount?: number;
  }) {
    const [message] = await db
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

    return message;
  }
}
