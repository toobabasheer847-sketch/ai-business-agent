import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { businessImprovementEvents } from '../../database/drizzle/schema/continuous-improvement.schema';
import { sanitizeMetadata } from './continuous-improvement';

export type HistoryQuery = {
  page: number;
  limit: number;
  eventType?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
};

@Injectable()
export class ImprovementHistoryService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async record(
    tenantId: string,
    event: {
      eventType: string;
      relatedEntityType: string;
      relatedEntityId?: string | null;
      actorId?: string | null;
      metadata?: Record<string, unknown>;
      occurredAt?: Date;
    },
  ) {
    const metadata = sanitizeMetadata(event.metadata ?? {});
    await this.db.insert(businessImprovementEvents).values({
      tenantId,
      eventType: event.eventType.slice(0, 60),
      relatedEntityType: event.relatedEntityType.slice(0, 40),
      relatedEntityId: event.relatedEntityId?.slice(0, 80) ?? null,
      actorId: event.actorId ?? null,
      eventMetadata: metadata,
      occurredAt: event.occurredAt ?? new Date(),
    });
  }

  async list(tenantId: string, query: HistoryQuery) {
    const filters = [eq(businessImprovementEvents.tenantId, tenantId)];
    if (query.eventType) filters.push(eq(businessImprovementEvents.eventType, query.eventType));
    if (query.relatedEntityType) filters.push(eq(businessImprovementEvents.relatedEntityType, query.relatedEntityType));
    if (query.relatedEntityId) filters.push(eq(businessImprovementEvents.relatedEntityId, query.relatedEntityId));
    if (query.actorId) filters.push(eq(businessImprovementEvents.actorId, query.actorId));
    if (query.from) filters.push(gte(businessImprovementEvents.occurredAt, query.from));
    if (query.to) filters.push(lte(businessImprovementEvents.occurredAt, query.to));
    const where = and(...filters);
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(businessImprovementEvents)
        .where(where)
        .orderBy(desc(businessImprovementEvents.occurredAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      this.db.select({ total: count() }).from(businessImprovementEvents).where(where),
    ]);
    return {
      data: rows.map((row) => ({
        ...row,
        eventMetadata: sanitizeMetadata((row.eventMetadata ?? {}) as Record<string, unknown>),
      })),
      total: Number(total[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }
}
