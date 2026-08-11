import { Injectable } from '@nestjs/common';
import { and, eq, ilike, or, sql, count, desc } from 'drizzle-orm';

import { db } from '../../database/drizzle';
import { conversations, messages } from '../../database/drizzle/schema';
import { CommunicationChannel, CommunicationDirection } from './dto/communication-history.dto';
import { CommunicationStats } from './entities/communication-history.entity';

interface ListHistoryOptions {
  channel?: CommunicationChannel;
  direction?: CommunicationDirection;
  prospectId?: string;
  search?: string;
  page: number;
  limit: number;
}

@Injectable()
export class CommunicationHubRepository {
  async listHistory(tenantId: string, options: ListHistoryOptions) {
    const { channel, prospectId, search, page, limit } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(conversations.tenantId, tenantId)];

    // Filter by channel (excluding 'all')
    if (channel && channel !== CommunicationChannel.ALL) {
      conditions.push(eq(conversations.channel, channel));
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

    const where = and(...conditions);

    const rows = await db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
        prospectId: conversations.prospectId,
        title: conversations.title,
        channel: conversations.channel,
        status: conversations.status,
        summary: conversations.summary,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.conversation_id = ${conversations.id}
            AND m.tenant_id = ${conversations.tenantId}
        )`,
      })
      .from(conversations)
      .where(where)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(conversations)
      .where(where);

    return {
      data: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        channel: row.channel as 'email' | 'sms' | 'call' | 'web',
        direction: null as 'inbound' | 'outbound' | 'internal' | null,
        prospectId: row.prospectId ?? null,
        title: row.title ?? null,
        summary: row.summary ?? null,
        status: row.status,
        participantCount: 1,
        messageCount: row.messageCount ?? 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findConversationById(tenantId: string, conversationId: string) {
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId),
      ),
    });

    if (!conversation) {
      return null;
    }

    const conversationMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        metadata: messages.metadata,
        tokenCount: messages.tokenCount,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.tenantId, tenantId),
        ),
      )
      .orderBy(messages.createdAt);

    return {
      ...conversation,
      messages: conversationMessages,
    };
  }

  async listEmailThreads(tenantId: string, options: { page: number; limit: number; prospectId?: string; search?: string }) {
    const { page, limit, prospectId, search } = options;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(conversations.tenantId, tenantId),
      eq(conversations.channel, 'email'),
    ];

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

    const where = and(...conditions);

    const rows = await db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
        prospectId: conversations.prospectId,
        title: conversations.title,
        status: conversations.status,
        summary: conversations.summary,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.conversation_id = ${conversations.id}
            AND m.tenant_id = ${conversations.tenantId}
        )`,
      })
      .from(conversations)
      .where(where)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(conversations)
      .where(where);

    return {
      data: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        prospectId: row.prospectId ?? null,
        title: row.title ?? null,
        status: row.status,
        summary: row.summary ?? null,
        messageCount: row.messageCount ?? 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listSmsThreads(tenantId: string, options: { page: number; limit: number; prospectId?: string; search?: string }) {
    const { page, limit, prospectId, search } = options;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(conversations.tenantId, tenantId),
      eq(conversations.channel, 'sms'),
    ];

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

    const where = and(...conditions);

    const rows = await db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
        prospectId: conversations.prospectId,
        title: conversations.title,
        status: conversations.status,
        summary: conversations.summary,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.conversation_id = ${conversations.id}
            AND m.tenant_id = ${conversations.tenantId}
        )`,
      })
      .from(conversations)
      .where(where)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(conversations)
      .where(where);

    return {
      data: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        prospectId: row.prospectId ?? null,
        title: row.title ?? null,
        status: row.status,
        summary: row.summary ?? null,
        messageCount: row.messageCount ?? 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(tenantId: string): Promise<CommunicationStats> {
    const rows = await db
      .select({
        channel: conversations.channel,
        status: conversations.status,
        total: count(),
      })
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId))
      .groupBy(conversations.channel, conversations.status);

    const stats: CommunicationStats = {
      totalConversations: 0,
      emailConversations: 0,
      smsConversations: 0,
      callConversations: 0,
      webConversations: 0,
      activeConversations: 0,
    };

    for (const row of rows) {
      const n = Number(row.total);
      stats.totalConversations += n;

      if (row.channel === 'email') stats.emailConversations += n;
      else if (row.channel === 'sms') stats.smsConversations += n;
      else if (row.channel === 'call') stats.callConversations += n;
      else if (row.channel === 'web') stats.webConversations += n;

      if (row.status === 'active') stats.activeConversations += n;
    }

    return stats;
  }
}
