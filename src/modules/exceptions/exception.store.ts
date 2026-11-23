import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import {
  exceptionScans,
  operationalExceptions,
} from '../../database/drizzle/schema/operational-exception.schema';
import { users } from '../../database/drizzle/schema/user.schema';
import type { ScanRecord } from './exception-lifecycle';
import {
  OPEN_STATUSES,
  type ExceptionQuery,
  type ExceptionRecord,
  type ExceptionStatus,
} from './exception.types';

@Injectable()
export class DrizzleExceptionStore {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async findByKey(tenantId: string, exceptionKey: string) {
    const [row] = await this.db
      .select()
      .from(operationalExceptions)
      .where(
        and(
          eq(operationalExceptions.tenantId, tenantId),
          eq(operationalExceptions.exceptionKey, exceptionKey),
        ),
      )
      .limit(1);
    return row ? this.fromRow(row) : null;
  }

  async insert(row: ExceptionRecord) {
    const [saved] = await this.db
      .insert(operationalExceptions)
      .values(this.toInsert(row))
      .returning();
    return this.fromRow(saved);
  }

  async save(row: ExceptionRecord) {
    const [saved] = await this.db
      .update(operationalExceptions)
      .set({
        ...this.toInsert(row),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(operationalExceptions.id, row.id),
          eq(operationalExceptions.tenantId, row.tenantId),
        ),
      )
      .returning();
    return this.fromRow(saved);
  }

  async find(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(operationalExceptions)
      .where(
        and(
          eq(operationalExceptions.id, id),
          eq(operationalExceptions.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ? this.fromRow(row) : null;
  }

  async list(tenantId: string, query: ExceptionQuery) {
    const where = and(
      eq(operationalExceptions.tenantId, tenantId),
      this.filters(query),
    );
    const order =
      query.sort === 'detectedAt'
        ? desc(operationalExceptions.detectedAt)
        : desc(operationalExceptions.priorityScore);
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          exception: operationalExceptions,
          assigneeName: users.name,
        })
        .from(operationalExceptions)
        .leftJoin(
          users,
          and(
            eq(operationalExceptions.assignedTo, users.id),
            eq(users.tenantId, tenantId),
          ),
        )
        .where(where)
        .orderBy(order, desc(operationalExceptions.detectedAt))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ total: count() })
        .from(operationalExceptions)
        .where(where),
    ]);
    return {
      data: rows.map((row) => ({
        ...this.fromRow(row.exception),
        assigneeName: row.assigneeName,
      })),
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async summary(tenantId: string, now: Date) {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const rows = await this.db
      .select({
        status: operationalExceptions.status,
        severity: operationalExceptions.severity,
        category: operationalExceptions.category,
        total: sql<number>`count(*)::int`,
      })
      .from(operationalExceptions)
      .where(eq(operationalExceptions.tenantId, tenantId))
      .groupBy(
        operationalExceptions.status,
        operationalExceptions.severity,
        operationalExceptions.category,
      );
    const [resolvedToday] = await this.db
      .select({ total: count() })
      .from(operationalExceptions)
      .where(
        and(
          eq(operationalExceptions.tenantId, tenantId),
          eq(operationalExceptions.status, 'resolved'),
          gte(operationalExceptions.resolvedAt, start),
        ),
      );
    const summary = {
      open: 0,
      critical: 0,
      high: 0,
      acknowledged: 0,
      resolved: 0,
      resolvedToday: Number(resolvedToday?.total ?? 0),
      categories: {} as Record<string, number>,
    };
    for (const row of rows) {
      const total = Number(row.total);
      if (OPEN_STATUSES.includes(row.status as ExceptionStatus)) {
        summary.open += total;
        summary.categories[row.category] =
          (summary.categories[row.category] ?? 0) + total;
        if (row.severity === 'critical') summary.critical += total;
        if (row.severity === 'high') summary.high += total;
      }
      if (row.status === 'acknowledged') summary.acknowledged += total;
      if (row.status === 'resolved') summary.resolved += total;
    }
    return summary;
  }

  async assigneeName(tenantId: string, userId: string) {
    const [row] = await this.db
      .select({ name: users.name })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    return row?.name ?? null;
  }

  async userInTenant(tenantId: string, userId: string) {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.tenantId, tenantId),
          eq(users.isActive, true),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async openKeys(tenantId: string) {
    return this.db
      .select({
        id: operationalExceptions.id,
        exceptionKey: operationalExceptions.exceptionKey,
      })
      .from(operationalExceptions)
      .where(
        and(
          eq(operationalExceptions.tenantId, tenantId),
          sql`${operationalExceptions.status} in ('open', 'acknowledged', 'in_progress')`,
        ),
      );
  }

  async recordScan(input: ScanRecord) {
    await this.db.insert(exceptionScans).values(input);
  }

  async attention(tenantId: string) {
    const rows = await this.db
      .select({
        exception: operationalExceptions,
        assigneeName: users.name,
      })
      .from(operationalExceptions)
      .leftJoin(
        users,
        and(
          eq(operationalExceptions.assignedTo, users.id),
          eq(users.tenantId, tenantId),
        ),
      )
      .where(
        and(
          eq(operationalExceptions.tenantId, tenantId),
          sql`${operationalExceptions.status} in ('open', 'acknowledged', 'in_progress')`,
          sql`${operationalExceptions.severity} in ('critical', 'high')`,
        ),
      )
      .orderBy(desc(operationalExceptions.priorityScore))
      .limit(5);
    return rows.map((row) => ({
      ...this.fromRow(row.exception),
      assigneeName: row.assigneeName,
    }));
  }

  private filters(query: ExceptionQuery): SQL | undefined {
    return and(
      query.category
        ? eq(operationalExceptions.category, query.category)
        : undefined,
      query.severity
        ? eq(operationalExceptions.severity, query.severity)
        : undefined,
      query.status ? eq(operationalExceptions.status, query.status) : undefined,
      query.assignedTo
        ? eq(operationalExceptions.assignedTo, query.assignedTo)
        : undefined,
      query.from
        ? gte(operationalExceptions.detectedAt, query.from)
        : undefined,
      query.to ? lte(operationalExceptions.detectedAt, query.to) : undefined,
      query.search
        ? or(
            ilike(
              operationalExceptions.title,
              `%${query.search.replace(/[%_]/g, '')}%`,
            ),
            ilike(
              operationalExceptions.description,
              `%${query.search.replace(/[%_]/g, '')}%`,
            ),
          )
        : undefined,
    );
  }

  private toInsert(row: ExceptionRecord) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      exceptionKey: row.exceptionKey,
      category: row.category,
      severity: row.severity,
      title: row.title,
      description: row.description,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      status: row.status,
      detectedAt: row.detectedAt,
      lastDetectedAt: row.lastDetectedAt,
      occurrenceCount: row.occurrenceCount,
      priorityScore: row.priorityScore,
      priorityReason: row.priorityReason,
      recommendedAction: row.recommendedAction,
      recommendedActionType: row.recommendedActionType,
      assignedTo: row.assignedTo,
      acknowledgedAt: row.acknowledgedAt,
      acknowledgedBy: row.acknowledgedBy,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      dismissedAt: row.dismissedAt,
      dismissedBy: row.dismissedBy,
      resolutionNote: row.resolutionNote,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private fromRow(
    row: typeof operationalExceptions.$inferSelect,
  ): ExceptionRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      exceptionKey: row.exceptionKey,
      category: row.category as ExceptionRecord['category'],
      severity: row.severity as ExceptionRecord['severity'],
      title: row.title,
      description: row.description,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      status: row.status as ExceptionRecord['status'],
      detectedAt: row.detectedAt,
      lastDetectedAt: row.lastDetectedAt,
      occurrenceCount: row.occurrenceCount,
      priorityScore: row.priorityScore,
      priorityReason: row.priorityReason,
      recommendedAction: row.recommendedAction,
      recommendedActionType: row.recommendedActionType,
      assignedTo: row.assignedTo,
      acknowledgedAt: row.acknowledgedAt,
      acknowledgedBy: row.acknowledgedBy,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      dismissedAt: row.dismissedAt,
      dismissedBy: row.dismissedBy,
      resolutionNote: row.resolutionNote,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
