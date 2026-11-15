import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { agentRuns } from '../../database/drizzle/schema/agent-run.schema';
import { monitoringScope, parseMonitoringQuery, runMatchesScope } from './monitoring-query';
import type { AgentRunView, MonitoringQuery, MonitoringScope, MonitoringSummary } from './monitoring.types';

type Actor = { tenantId: string; userId: string; role?: string };

@Injectable()
export class AgentRunQueryService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async list(actor: Actor, raw: Parameters<typeof parseMonitoringQuery>[0]) {
    const scope = monitoringScope(actor);
    const query = parseMonitoringQuery(raw);
    const where = this.where(scope, query);
    const [rows, totals] = await Promise.all([
      this.db.select().from(agentRuns).where(where).orderBy(desc(agentRuns.startedAt)).limit(query.limit).offset(query.offset),
      this.db.select({ total: count() }).from(agentRuns).where(where),
    ]);
    return {
      data: rows.map(present).filter((row) => runMatchesScope(row, scope)),
      page: query.page,
      limit: query.limit,
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async find(actor: Actor, id: string): Promise<AgentRunView> {
    const scope = monitoringScope(actor);
    const rows = await this.db.select().from(agentRuns).where(and(eq(agentRuns.id, id), eq(agentRuns.tenantId, scope.tenantId))).limit(1);
    const row = rows[0] ? present(rows[0]) : null;
    if (!row || !runMatchesScope(row, scope)) throw new NotFoundException('Agent run not found.');
    return row;
  }

  async summary(actor: Actor, raw: Parameters<typeof parseMonitoringQuery>[0]): Promise<MonitoringSummary> {
    const scope = monitoringScope(actor);
    const query = parseMonitoringQuery(raw);
    const where = this.where(scope, query);
    const [totals] = await this.db.select({
      totalRuns: sql<number>`count(*)::int`,
      successfulRuns: sql<number>`count(*) filter (where ${agentRuns.status} = 'completed')::int`,
      failedRuns: sql<number>`count(*) filter (where ${agentRuns.status} = 'failed')::int`,
      runningRuns: sql<number>`count(*) filter (where ${agentRuns.status} = 'running')::int`,
      usageUnavailableRuns: sql<number>`count(*) filter (where ${agentRuns.usageStatus} = 'unavailable')::int`,
      pricingNotConfiguredRuns: sql<number>`count(*) filter (where ${agentRuns.costStatus} = 'pricing_not_configured')::int`,
      inputTokens: sql<string | null>`sum(${agentRuns.inputTokens}) filter (where ${agentRuns.usageStatus} = 'reported')`,
      outputTokens: sql<string | null>`sum(${agentRuns.outputTokens}) filter (where ${agentRuns.usageStatus} = 'reported')`,
      totalTokens: sql<string | null>`sum(${agentRuns.totalTokens}) filter (where ${agentRuns.usageStatus} = 'reported')`,
      averageDurationMs: sql<string | null>`avg(${agentRuns.durationMs}) filter (where ${agentRuns.durationMs} is not null)`,
    }).from(agentRuns).where(where);

    const currencies = await this.db.select({
      currency: agentRuns.currency,
      estimatedCost: sql<string | null>`sum(${agentRuns.estimatedTotalCost})`,
    }).from(agentRuns).where(and(where, eq(agentRuns.costStatus, 'estimated'))).groupBy(agentRuns.currency);

    const usageRows = await this.db.select({
      day: sql<string>`to_char(date_trunc('day', ${agentRuns.startedAt}), 'YYYY-MM-DD')`,
      runs: sql<number>`count(*)::int`,
    }).from(agentRuns).where(where).groupBy(sql`date_trunc('day', ${agentRuns.startedAt})`).orderBy(sql`date_trunc('day', ${agentRuns.startedAt}) desc`).limit(367);

    const modelRows = await this.db.select({
      provider: agentRuns.provider,
      model: agentRuns.model,
      runs: sql<number>`count(*)::int`,
      estimatedCost: sql<string | null>`sum(${agentRuns.estimatedTotalCost}) filter (where ${agentRuns.costStatus} = 'estimated')`,
      currency: sql<string | null>`min(${agentRuns.currency}) filter (where ${agentRuns.costStatus} = 'estimated')`,
    }).from(agentRuns).where(where).groupBy(agentRuns.provider, agentRuns.model).orderBy(sql`count(*) desc`).limit(20);

    const agentRows = await this.db.select({
      agent: agentRuns.agentName,
      runs: sql<number>`count(*)::int`,
    }).from(agentRuns).where(where).groupBy(agentRuns.agentName).orderBy(sql`count(*) desc`).limit(20);

    const priced = currencies.filter((row) => row.currency);
    return {
      totalRuns: Number(totals?.totalRuns ?? 0),
      successfulRuns: Number(totals?.successfulRuns ?? 0),
      failedRuns: Number(totals?.failedRuns ?? 0),
      runningRuns: Number(totals?.runningRuns ?? 0),
      inputTokens: nullableNumber(totals?.inputTokens),
      outputTokens: nullableNumber(totals?.outputTokens),
      totalTokens: nullableNumber(totals?.totalTokens),
      usageUnavailableRuns: Number(totals?.usageUnavailableRuns ?? 0),
      estimatedCost: priced.length === 1 ? priced[0].estimatedCost : null,
      currency: priced.length === 1 ? priced[0].currency : null,
      mixedCurrencies: priced.length > 1,
      pricingNotConfiguredRuns: Number(totals?.pricingNotConfiguredRuns ?? 0),
      averageDurationMs: totals?.averageDurationMs === null || totals?.averageDurationMs === undefined ? null : Math.round(Number(totals.averageDurationMs)),
      usageOverTime: usageRows.slice(0, 366).reverse().map((row) => ({ day: row.day, runs: Number(row.runs) })),
      usageOverTimeTruncated: usageRows.length > 366,
      costByModel: modelRows.map((row) => ({
        provider: row.provider,
        model: row.model,
        runs: Number(row.runs),
        estimatedCost: row.estimatedCost,
        currency: row.currency,
      })),
      runsByAgent: agentRows.map((row) => ({ agent: row.agent, runs: Number(row.runs) })),
    };
  }

  private where(scope: MonitoringScope, query: MonitoringQuery): SQL | undefined {
    return and(
      eq(agentRuns.tenantId, scope.tenantId),
      scope.userId ? eq(agentRuns.userId, scope.userId) : undefined,
      query.from ? gte(agentRuns.startedAt, query.from) : undefined,
      query.to ? lte(agentRuns.startedAt, query.to) : undefined,
      query.agent ? eq(agentRuns.agentName, query.agent) : undefined,
      query.provider ? eq(agentRuns.provider, query.provider) : undefined,
      query.model ? eq(agentRuns.model, query.model) : undefined,
      query.status ? eq(agentRuns.status, query.status) : undefined,
    );
  }
}

function present(row: typeof agentRuns.$inferSelect): AgentRunView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    agentName: row.agentName,
    correlationId: row.correlationId,
    parentRunId: row.parentRunId,
    providerExecutionId: row.providerExecutionId,
    provider: row.provider,
    model: row.model,
    status: row.status as AgentRunView['status'],
    usageStatus: row.usageStatus as AgentRunView['usageStatus'],
    usageNote: row.usageNote,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    costStatus: row.costStatus as AgentRunView['costStatus'],
    estimatedInputCost: row.estimatedInputCost,
    estimatedOutputCost: row.estimatedOutputCost,
    estimatedTotalCost: row.estimatedTotalCost,
    currency: row.currency,
    pricingSource: row.pricingSource,
    pricingEffectiveDate: row.pricingEffectiveDate,
    durationMs: row.durationMs,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    errorCode: row.errorCode,
    errorSummary: row.errorSummary,
  };
}

function nullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
