import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { conversations, messages } from '../../database/drizzle/schema';
import { ConversationChannel, ConversationStatus } from './dto/create-conversation.dto';

export const ASSISTANT_CONVERSATION_CHANNEL = 'assistant';

// Columns returned for every conversation query
const CONV_COLUMNS = {
  id: conversations.id,
  tenantId: conversations.tenantId,
  userId: conversations.userId,
  prospectId: conversations.prospectId,
  title: conversations.title,
  slug: conversations.slug,
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
  tokenCount: messages.totalTokens,
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
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

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

    return this.db
      .select(CONV_COLUMNS)
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt));
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.db.query.conversations.findFirst({
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

  async findByIdTenantAndUser(
    conversationId: string,
    tenantId: string,
    userId: string,
  ) {
    return this.db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId),
        eq(conversations.userId, userId),
        eq(conversations.channel, ASSISTANT_CONVERSATION_CHANNEL),
      ),
      columns: {
        id: true,
        tenantId: true,
        userId: true,
        prospectId: true,
        title: true,
        slug: true,
        channel: true,
        status: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findRecentByUser(tenantId: string, userId: string, limit: number) {
    const safeLimit = Math.max(1, limit);

    return this.db
      .select(CONV_COLUMNS)
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.userId, userId),
          eq(conversations.channel, ASSISTANT_CONVERSATION_CHANNEL),
        ),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(safeLimit);
  }

  async findRecentMessages(
    conversationId: string,
    tenantId: string,
    limit: number,
  ) {
    const safeLimit = Math.max(1, limit);

    const rows = await this.db
      .select(MSG_COLUMNS)
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.tenantId, tenantId),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(safeLimit);

    return rows.reverse();
  }

  async deleteByIdTenantAndUser(
    conversationId: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.db
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.tenantId, tenantId),
          eq(conversations.userId, userId),
          eq(conversations.channel, ASSISTANT_CONVERSATION_CHANNEL),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }

  async touchUpdatedAt(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
  }

  async create(input: {
    tenantId: string;
    userId: string;
    prospectId?: string;
    title?: string;
    channel?: string;
    summary?: string;
  }) {
    const baseSlug =
      input.title
        ?.toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 200) || 'conversation';

    const [conversation] = await this.db
      .insert(conversations)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        prospectId: input.prospectId ?? null,
        title: input.title ?? null,
        slug: `${baseSlug}-${randomUUID().slice(0, 8)}`,
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

    const [conversation] = await this.db
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
    const result = await this.db
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
    return this.db
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
    const [message] = await this.db
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

    return message;
  }
}
