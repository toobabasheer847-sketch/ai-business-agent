import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ilike, or, sql, count, desc } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { conversations, messages } from '../../database/drizzle/schema';
import { CommunicationChannel, CommunicationDirection } from './dto/communication-history.dto';
import { CommunicationStats } from './entities/communication-history.entity';

  const MSG_COLUMNS = {
  id: messages.id,
  role: messages.role,
  content: messages.content,
  metadata: messages.metadata,
  tokenCount: messages.totalTokens,
  createdAt: messages.createdAt,
  direction: messages.direction,
  deliveryStatus: messages.deliveryStatus,
  provider: messages.provider,
  errorCode: messages.errorCode,
  errorDetail: messages.errorDetail,
  authorKind: messages.authorKind,
  channel: messages.channel,
} as const;

interface ListHistoryOptions {
  channel?: CommunicationChannel;
  direction?: CommunicationDirection;
  prospectId?: string;
  leadId?: string;
  assignedUserId?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
  userId?: string;
}

@Injectable()
export class CommunicationHubRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async listHistory(tenantId: string, options: ListHistoryOptions) {
    const { channel, direction, prospectId, leadId, assignedUserId, status, search, page, limit } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(conversations.tenantId, tenantId)];
    if (options.userId) {
      conditions.push(eq(conversations.userId, options.userId));
    }

    // Filter by channel (excluding 'all')
    if (channel && channel !== CommunicationChannel.ALL) {
      conditions.push(eq(conversations.channel, channel));
    }

    if (prospectId) {
      conditions.push(eq(conversations.prospectId, prospectId));
    }
    if (leadId) conditions.push(eq(conversations.leadId, leadId));
    if (assignedUserId) conditions.push(eq(conversations.assignedUserId, assignedUserId));
    if (status && ['active', 'resolved', 'open', 'handoff'].includes(status)) {
      conditions.push(eq(conversations.status, status));
    }
    if (direction && direction !== CommunicationDirection.ALL) {
      conditions.push(sql`exists (
        select 1 from ${messages}
        where ${messages.conversationId} = ${conversations.id}
          and ${messages.tenantId} = ${conversations.tenantId}
          and ${messages.direction} = ${direction}
      )`);
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

    const rows = await this.db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
        prospectId: conversations.prospectId,
        leadId: conversations.leadId,
        assignedUserId: conversations.assignedUserId,
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

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(conversations)
      .where(where);

    return {
      data: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        channel: row.channel as 'email' | 'sms' | 'call' | 'web' | 'whatsapp',
        direction: null as 'inbound' | 'outbound' | 'internal' | null,
        prospectId: row.prospectId ?? null,
        leadId: row.leadId ?? null,
        assignedUserId: row.assignedUserId ?? null,
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

  async findConversationById(tenantId: string, conversationId: string, userId?: string) {
    const conversation = await this.db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId),
        userId ? eq(conversations.userId, userId) : undefined,
      ),
    });

    if (!conversation) {
      return null;
    }

    const conversationMessages = await this.db
      .select(MSG_COLUMNS)
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

    const rows = await this.db
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

    const [{ total }] = await this.db
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

    const rows = await this.db
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

    const [{ total }] = await this.db
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
    const rows = await this.db
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
      whatsappConversations: 0,
      activeConversations: 0,
    };

    for (const row of rows) {
      const n = Number(row.total);
      stats.totalConversations += n;

      if (row.channel === 'email') stats.emailConversations += n;
      else if (row.channel === 'sms') stats.smsConversations += n;
      else if (row.channel === 'call') stats.callConversations += n;
      else if (row.channel === 'web') stats.webConversations += n;
      else if (row.channel === 'whatsapp') stats.whatsappConversations += n;

      if (row.status === 'active') stats.activeConversations += n;
    }

    return stats;
  }
}
