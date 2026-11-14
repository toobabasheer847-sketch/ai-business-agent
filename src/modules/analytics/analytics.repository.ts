import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module.js';
import type { DrizzleDb } from '../../database/database.service.js';
import { conversations } from '../../database/drizzle/schema/conversation.schema.js';
import { leads } from '../../database/drizzle/schema/lead.schema.js';
import { proposals } from '../../database/drizzle/schema/proposal.schema.js';
import { prospects } from '../../database/drizzle/schema/prospect.schema.js';
import { tasks } from '../../database/drizzle/schema/task.schema.js';
import type { DashboardWindow } from '../dashboard/dashboard-range.js';

export type StatusCount = { status: string; count: number };
export type TrendPoint = { day: string; count: number };

export type LeadConversionCounts = { leads: number; withProspect: number };
export type ProposalTiming = {
  expired: number;
  cancelled: number;
  sentPopulation: number;
  accepted: number;
  averageSentToAcceptedHours: number | null;
};
export type TaskStatusCounts = {
  assigned: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  createdInPeriod: number;
};

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async leadConversion(tenantId: string, window: DashboardWindow): Promise<LeadConversionCounts> {
    this.assertTenant(tenantId);
    const [row] = await this.db
      .select({
        leads: sql<number>`count(*)::int`,
        withProspect: sql<number>`count(*) filter (where exists (
          select 1 from ${prospects}
          where ${prospects.leadId} = ${leads.id}
            and ${prospects.tenantId} = ${leads.tenantId}
        ))::int`,
      })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), this.between(leads.createdAt, window)));
    return { leads: this.number(row?.leads), withProspect: this.number(row?.withProspect) };
  }

  async statusCounts(
    tenantId: string,
    table: 'leads' | 'prospects' | 'conversations',
    window: DashboardWindow,
  ): Promise<StatusCount[]> {
    this.assertTenant(tenantId);
    const source = table === 'leads' ? leads : table === 'prospects' ? prospects : conversations;
    const rows = await this.db
      .select({
        status: source.status,
        count: sql<number>`count(*)::int`,
      })
      .from(source)
      .where(and(eq(source.tenantId, tenantId), this.between(source.createdAt, window)))
      .groupBy(source.status);
    return rows.map((row) => ({ status: row.status, count: this.number(row.count) }));
  }

  async proposalTiming(tenantId: string, window: DashboardWindow): Promise<ProposalTiming> {
    this.assertTenant(tenantId);
    const from = window.from;
    const to = window.to;
    const [row] = await this.db
      .select({
        expired: sql<number>`count(*) filter (where ${proposals.status} = 'expired' and ${proposals.updatedAt} >= ${from} and ${proposals.updatedAt} <= ${to})::int`,
        cancelled: sql<number>`count(*) filter (where ${proposals.status} = 'cancelled' and ${proposals.updatedAt} >= ${from} and ${proposals.updatedAt} <= ${to})::int`,
        sentPopulation: sql<number>`count(*) filter (where ${proposals.sentAt} is not null and ${proposals.sentAt} >= ${from} and ${proposals.sentAt} <= ${to})::int`,
        accepted: sql<number>`count(*) filter (where ${proposals.acceptedAt} is not null and ${proposals.acceptedAt} >= ${from} and ${proposals.acceptedAt} <= ${to})::int`,
        averageSeconds: sql<number | null>`avg(extract(epoch from (${proposals.acceptedAt} - ${proposals.sentAt}))) filter (where ${proposals.sentAt} is not null and ${proposals.acceptedAt} is not null and ${proposals.acceptedAt} >= ${proposals.sentAt} and ${proposals.acceptedAt} >= ${from} and ${proposals.acceptedAt} <= ${to})`,
      })
      .from(proposals)
      .where(eq(proposals.tenantId, tenantId));
    const averageSeconds = row?.averageSeconds === null || row?.averageSeconds === undefined
      ? null
      : Number(row.averageSeconds);
    return {
      expired: this.number(row?.expired),
      cancelled: this.number(row?.cancelled),
      sentPopulation: this.number(row?.sentPopulation),
      accepted: this.number(row?.accepted),
      averageSentToAcceptedHours: averageSeconds === null || !Number.isFinite(averageSeconds) ? null : Math.round((averageSeconds / 3600) * 10) / 10,
    };
  }

  async taskStatus(tenantId: string, window: DashboardWindow): Promise<TaskStatusCounts> {
    this.assertTenant(tenantId);
    const from = window.from;
    const to = window.to;
    const [row] = await this.db
      .select({
        assigned: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${tasks.status} = 'pending')::int`,
        inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
        cancelled: sql<number>`count(*) filter (where ${tasks.status} = 'cancelled')::int`,
        overdue: sql<number>`count(*) filter (where ${tasks.status} not in ('completed', 'cancelled') and ${tasks.dueAt} is not null and ${tasks.dueAt} < now())::int`,
        createdInPeriod: sql<number>`count(*) filter (where ${tasks.createdAt} >= ${from} and ${tasks.createdAt} <= ${to})::int`,
      })
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId));
    return {
      assigned: this.number(row?.assigned),
      pending: this.number(row?.pending),
      inProgress: this.number(row?.inProgress),
      completed: this.number(row?.completed),
      cancelled: this.number(row?.cancelled),
      overdue: this.number(row?.overdue),
      createdInPeriod: this.number(row?.createdInPeriod),
    };
  }

  async createdTrend(
    tenantId: string,
    table: 'leads' | 'prospects' | 'proposals' | 'tasks' | 'conversations',
    window: DashboardWindow,
    completed = false,
  ): Promise<TrendPoint[]> {
    this.assertTenant(tenantId);
    const source = table === 'leads'
      ? leads
      : table === 'prospects'
        ? prospects
        : table === 'proposals'
          ? proposals
          : table === 'tasks'
            ? tasks
            : conversations;
    const column = completed && table === 'tasks' ? tasks.completedAt : source.createdAt;
    const rows = await this.db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${column} at time zone 'utc'), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(source)
      .where(and(
        eq(source.tenantId, tenantId),
        gte(column, window.from ?? new Date(0)),
        lte(column, window.to ?? new Date()),
        completed && table === 'tasks' ? eq(tasks.status, 'completed') : undefined,
      ))
      .groupBy(sql`date_trunc('day', ${column} at time zone 'utc')`)
      .orderBy(sql`date_trunc('day', ${column} at time zone 'utc')`);
    return rows.map((row) => ({ day: row.day, count: this.number(row.count) }));
  }

  private between(column: { name: string }, window: DashboardWindow) {
    if (!window.from || !window.to) return undefined;
    return and(gte(column as never, window.from), lte(column as never, window.to));
  }

  private number(value: number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new UnauthorizedException('Tenant context is required');
    }
  }
}
