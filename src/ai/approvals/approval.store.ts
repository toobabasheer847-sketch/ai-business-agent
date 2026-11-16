import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { auditLogs } from '../../database/drizzle/schema/audit-log.schema';
import { aiApprovalEvents, aiApprovals } from '../../database/drizzle/schema/ai-approval.schema';
import type {
  ApprovalEvent,
  ApprovalQuery,
  ApprovalRecord,
  ApprovalScope,
  ApprovalStatus,
  ApprovalStore,
} from './approval.types';

const EMPTY_SUMMARY = (): Record<ApprovalStatus, number> => ({
  pending: 0,
  approved: 0,
  rejected: 0,
  executing: 0,
  executed: 0,
  failed: 0,
  expired: 0,
  cancelled: 0,
});

@Injectable()
export class DrizzleApprovalStore implements ApprovalStore {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async insert(row: ApprovalRecord): Promise<ApprovalRecord> {
    try {
      const [saved] = await this.db.insert(aiApprovals).values(this.toInsert(row)).returning();
      await this.audit(row.tenantId, row.requesterUserId, 'approval.created', row.id, row.actionType);
      return this.fromRow(saved);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.findPendingDuplicate(row.tenantId, row.actionType, row.targetEntityId, row.payloadHash);
      if (existing) return existing;
      throw error;
    }
  }

  async expireDue(scope: ApprovalScope, now: Date): Promise<void> {
    const rows = await this.db.update(aiApprovals).set({
      status: 'expired',
      decidedAt: now,
      updatedAt: now,
    }).where(and(
      eq(aiApprovals.tenantId, scope.tenantId),
      scope.userId ? eq(aiApprovals.requesterUserId, scope.userId) : undefined,
      eq(aiApprovals.status, 'pending'),
      lte(aiApprovals.expiresAt, now),
    )).returning();
    for (const row of rows) {
      await this.addEvent({
        approvalId: row.id,
        tenantId: row.tenantId,
        actorUserId: null,
        eventType: 'expired',
        note: 'The approval window elapsed.',
      });
      await this.audit(row.tenantId, null, 'approval.expired', row.id, row.actionType);
    }
  }

  async findPendingDuplicate(tenantId: string, actionType: string, targetEntityId: string, payloadHash: string) {
    const [row] = await this.db.select().from(aiApprovals).where(and(
      eq(aiApprovals.tenantId, tenantId),
      eq(aiApprovals.actionType, actionType),
      eq(aiApprovals.targetEntityId, targetEntityId),
      eq(aiApprovals.payloadHash, payloadHash),
      eq(aiApprovals.status, 'pending'),
    )).limit(1);
    return row ? this.fromRow(row) : null;
  }

  async find(scope: ApprovalScope, id: string) {
    const [row] = await this.db.select().from(aiApprovals).where(and(eq(aiApprovals.id, id), this.scopeWhere(scope))).limit(1);
    return row ? this.fromRow(row) : null;
  }

  async transition(scope: ApprovalScope, id: string, from: ApprovalStatus[], patch: Partial<ApprovalRecord>) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) set[key] = value;
    }
    const [row] = await this.db.update(aiApprovals).set(set).where(and(
      eq(aiApprovals.id, id),
      eq(aiApprovals.tenantId, scope.tenantId),
      scope.userId ? eq(aiApprovals.requesterUserId, scope.userId) : undefined,
      inArray(aiApprovals.status, from),
    )).returning();
    if (row && patch.status) {
      await this.audit(scope.tenantId, patch.approverUserId ?? null, `approval.${patch.status}`, id, row.actionType);
    }
    return row ? this.fromRow(row) : null;
  }

  async list(scope: ApprovalScope, query: ApprovalQuery) {
    const where = and(this.scopeWhere(scope), this.filters(query));
    const [rows, totals] = await Promise.all([
      this.db.select().from(aiApprovals).where(where).orderBy(desc(aiApprovals.createdAt)).limit(query.limit).offset(query.offset),
      this.db.select({ total: count() }).from(aiApprovals).where(where),
    ]);
    return { data: rows.map((row) => this.fromRow(row)), total: Number(totals[0]?.total ?? 0) };
  }

  async summary(scope: ApprovalScope) {
    const rows = await this.db.select({
      status: aiApprovals.status,
      total: sql<number>`count(*)::int`,
    }).from(aiApprovals).where(this.scopeWhere(scope)).groupBy(aiApprovals.status);
    const summary = EMPTY_SUMMARY();
    for (const row of rows) {
      if (row.status in summary) summary[row.status as ApprovalStatus] = Number(row.total);
    }
    return summary;
  }

  async addEvent(event: Omit<ApprovalEvent, 'id' | 'createdAt'>) {
    await this.db.insert(aiApprovalEvents).values({
      approvalId: event.approvalId,
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      eventType: event.eventType,
      note: event.note,
    });
  }

  async hasEvent(approvalId: string, actorUserId: string, eventType: string) {
    const [row] = await this.db.select({ id: aiApprovalEvents.id }).from(aiApprovalEvents).where(and(
      eq(aiApprovalEvents.approvalId, approvalId),
      eq(aiApprovalEvents.actorUserId, actorUserId),
      eq(aiApprovalEvents.eventType, eventType),
    )).limit(1);
    return Boolean(row);
  }

  async events(scope: ApprovalScope, approvalId: string) {
    const rows = await this.db.select().from(aiApprovalEvents).where(and(
      eq(aiApprovalEvents.approvalId, approvalId),
      eq(aiApprovalEvents.tenantId, scope.tenantId),
    )).orderBy(aiApprovalEvents.createdAt);
    return rows.map((row) => ({
      id: row.id,
      approvalId: row.approvalId,
      tenantId: row.tenantId,
      actorUserId: row.actorUserId,
      eventType: row.eventType,
      note: row.note,
      createdAt: row.createdAt,
    }));
  }

  private scopeWhere(scope: ApprovalScope): SQL | undefined {
    return and(
      eq(aiApprovals.tenantId, scope.tenantId),
      scope.userId ? eq(aiApprovals.requesterUserId, scope.userId) : undefined,
    );
  }

  private filters(query: ApprovalQuery): SQL | undefined {
    return and(
      query.status ? eq(aiApprovals.status, query.status) : undefined,
      query.riskLevel ? eq(aiApprovals.riskLevel, query.riskLevel) : undefined,
      query.actionType ? eq(aiApprovals.actionType, query.actionType) : undefined,
      query.agentName ? eq(aiApprovals.agentName, query.agentName) : undefined,
      query.requesterUserId ? eq(aiApprovals.requesterUserId, query.requesterUserId) : undefined,
      query.from ? gte(aiApprovals.createdAt, query.from) : undefined,
      query.to ? lte(aiApprovals.createdAt, query.to) : undefined,
    );
  }

  private async audit(tenantId: string, userId: string | null, action: string, id: string, actionType: string) {
    await this.db.insert(auditLogs).values({
      tenantId,
      userId,
      action,
      entityType: 'ai_approval',
      entityId: id,
      description: actionType,
      metadata: { actionType },
    });
  }

  private toInsert(row: ApprovalRecord) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      requesterUserId: row.requesterUserId,
      approverUserId: row.approverUserId,
      agentRunId: row.agentRunId,
      agentName: row.agentName,
      actionType: row.actionType,
      title: row.title,
      description: row.description,
      targetEntityType: row.targetEntityType,
      targetEntityId: row.targetEntityId,
      proposedPayload: row.proposedPayload,
      originalPayload: row.originalPayload,
      approvedPayload: row.approvedPayload,
      status: row.status,
      riskLevel: row.riskLevel,
      reason: row.reason,
      rejectionReason: row.rejectionReason,
      payloadHash: row.payloadHash,
      expiresAt: row.expiresAt,
      decidedAt: row.decidedAt,
      executedAt: row.executedAt,
      executionReference: row.executionReference,
      errorSummary: row.errorSummary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private fromRow(row: typeof aiApprovals.$inferSelect): ApprovalRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      requesterUserId: row.requesterUserId,
      approverUserId: row.approverUserId,
      agentRunId: row.agentRunId,
      agentName: row.agentName,
      actionType: row.actionType,
      title: row.title,
      description: row.description,
      targetEntityType: row.targetEntityType,
      targetEntityId: row.targetEntityId,
      proposedPayload: (row.proposedPayload ?? {}) as Record<string, unknown>,
      originalPayload: (row.originalPayload ?? {}) as Record<string, unknown>,
      approvedPayload: (row.approvedPayload ?? null) as Record<string, unknown> | null,
      status: row.status as ApprovalStatus,
      riskLevel: row.riskLevel as ApprovalRecord['riskLevel'],
      reason: row.reason,
      rejectionReason: row.rejectionReason,
      payloadHash: row.payloadHash,
      expiresAt: row.expiresAt,
      decidedAt: row.decidedAt,
      executedAt: row.executedAt,
      executionReference: row.executionReference,
      errorSummary: row.errorSummary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ('code' in current && String((current as { code?: string }).code) === '23505') return true;
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}
