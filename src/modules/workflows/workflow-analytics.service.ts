import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';

import {
  currentTaskWindows,
  resolveDashboardWindow,
  type DashboardWindow,
} from '../dashboard/dashboard-range';
import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { agentRuns } from '../../database/drizzle/schema/agent-run.schema';
import {
  workflowExecutions,
  workflowExecutionSteps,
  workflowRecommendations,
  workflows,
} from '../../database/drizzle/schema/workflow.schema';
import {
  addStatus,
  assertRecommendationStatus,
  buildRecommendations,
  emptyCounts,
  estimateSavings,
  executionRates,
  MAX_RANGE_MS,
  parseBaselines,
  summarizeWorkflowAi,
  workflowHealth,
  type RecommendationDraft,
  type StatusCounts,
} from './workflow-analytics';
import {
  EXECUTION_STATUSES,
  TRIGGER_TYPES,
  WORKFLOW_STATUSES,
} from './workflow.types';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class WorkflowAnalyticsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly configService: ConfigService,
  ) {}

  async overview(tenantId: string, raw: RawQuery) {
    const query = parseQuery(raw);
    const [
      executionCounts,
      duration,
      workflowCounts,
      steps,
      failures,
      ai,
      savingsWindows,
    ] = await Promise.all([
      this.executionCounts(tenantId, query),
      this.durations(tenantId, query),
      this.workflowCounts(tenantId, query),
      this.stepGroups(tenantId, query.window, query),
      this.failureGroups(tenantId, query),
      this.aiUsage(tenantId, query.window),
      this.savingsWindows(tenantId, query),
    ]);
    const rates = executionRates(executionCounts);
    const health = this.healthDistribution(
      await this.workflowAggregates(tenantId, query, 200, 0),
      failures,
      steps,
      await this.stepGroups(tenantId, previousWindow(query.window), query),
    );
    const savings = estimateSavings(
      sumActions(steps),
      this.baselines().seconds,
    );
    return {
      window: presentWindow(query.window),
      workflows: workflowCounts,
      executions: { ...executionCounts, total: rates.total },
      rates,
      duration,
      savings: {
        ...savings,
        baselineSource: this.baselines().source,
        ...savingsWindows,
      },
      ai,
      health,
      measured: false as const,
    };
  }

  async trends(tenantId: string, raw: RawQuery) {
    const query = parseQuery(raw);
    const [executionDays, savingDays, aiDays] = await Promise.all([
      this.executionDays(tenantId, query),
      this.savingDays(tenantId, query),
      this.aiDays(tenantId, query.window),
    ]);
    const baselines = this.baselines().seconds;
    const days = eachUtcDay(query.window).map((day) => {
      const execution = executionDays.get(day);
      const actions = savingDays.get(day) ?? [];
      const savings = estimateSavings(actions, baselines);
      const ai = aiDays.get(day);
      return {
        day,
        executions: execution?.executions ?? 0,
        completed: execution?.completed ?? 0,
        failed: execution?.failed ?? 0,
        partiallyCompleted: execution?.partial ?? 0,
        averageDurationMs: execution?.average ?? null,
        estimatedSavingsSeconds: savings.estimatedSeconds,
        savingsStatus: savings.status,
        aiRuns: ai?.runs ?? 0,
        estimatedAiCost: ai?.cost ?? null,
      };
    });
    return {
      window: presentWindow(query.window),
      days,
      timezone: 'UTC' as const,
    };
  }

  async workflows(tenantId: string, raw: RawQuery) {
    const query = parseQuery(raw);
    const [total, rows, failures, steps, prior] = await Promise.all([
      this.workflowTotal(tenantId, query),
      this.workflowAggregates(
        tenantId,
        query,
        query.limit,
        (query.page - 1) * query.limit,
      ),
      this.failureGroups(tenantId, query),
      this.stepGroups(tenantId, query.window, query),
      this.stepGroups(tenantId, previousWindow(query.window), query),
    ]);
    return {
      data: rows.map((row) =>
        this.presentWorkflow(row, failures, steps, prior),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async workflow(tenantId: string, id: string, raw: RawQuery) {
    if (!UUID.test(id))
      throw new BadRequestException('Workflow id is not valid.');
    const existing = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.id, id)))
      .limit(1);
    if (!existing[0]) throw new NotFoundException('Workflow not found.');
    const detail = await this.workflows(tenantId, {
      ...raw,
      workflowId: id,
      page: '1',
      limit: '1',
    });
    const row = detail.data[0];
    if (!row) throw new NotFoundException('Workflow not found.');
    const steps = await this.stepGroups(
      tenantId,
      parseQuery({ ...raw, workflowId: id }).window,
      parseQuery({ ...raw, workflowId: id }),
    );
    const recommendations = await this.optimizations(tenantId, {
      ...raw,
      workflowId: id,
    });
    return {
      ...row,
      steps: steps
        .filter((step) => step.workflowId === id)
        .map((step) => ({
          actionType: step.actionType,
          completed: step.completed,
          failed: step.failed,
          averageDurationMs: step.averageMs,
          retriedSteps: step.retried,
        })),
      recommendations: recommendations.data,
    };
  }

  async failures(tenantId: string, raw: RawQuery) {
    const query = parseQuery(raw);
    const [groups, steps, recent] = await Promise.all([
      this.failureGroups(tenantId, query),
      this.stepGroups(tenantId, query.window, query),
      this.recentFailures(tenantId, query),
    ]);
    const byWorkflow = new Map<
      string,
      { workflowId: string; name: string; count: number }
    >();
    const byCode = new Map<string, { errorCode: string; count: number }>();
    for (const group of groups) {
      const current = byWorkflow.get(group.workflowId) ?? {
        workflowId: group.workflowId,
        name: group.workflowName,
        count: 0,
      };
      current.count += group.count;
      byWorkflow.set(group.workflowId, current);
      const code = byCode.get(group.errorCode) ?? {
        errorCode: group.errorCode,
        count: 0,
      };
      code.count += group.count;
      byCode.set(group.errorCode, code);
    }
    const actions = new Map<string, number>();
    for (const step of steps)
      actions.set(
        step.actionType,
        (actions.get(step.actionType) ?? 0) + step.failed,
      );
    return {
      categories: [...byCode.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 20),
      workflows: [...byWorkflow.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 20),
      actions: [...actions.entries()]
        .filter((entry) => entry[1] > 0)
        .map(([actionType, failed]) => ({ actionType, failed }))
        .sort((left, right) => right.failed - left.failed),
      recent,
    };
  }

  async optimizations(tenantId: string, raw: RawQuery) {
    const query = parseQuery(raw);
    const [failures, steps, prior, aggregates] = await Promise.all([
      this.failureGroups(tenantId, query),
      this.stepGroups(tenantId, query.window, query),
      this.stepGroups(tenantId, previousWindow(query.window), query),
      this.workflowAggregates(tenantId, query, 200, 0),
    ]);
    const drafts = buildRecommendations({
      failures: failures.map((failure) => ({
        workflowId: failure.workflowId,
        workflowName: failure.workflowName,
        errorCode: failure.errorCode,
        count: failure.count,
      })),
      slow: slowFacts(steps, prior),
      approvals: approvalFacts(steps),
      unused: aggregates
        .filter(
          (row) =>
            row.status === 'active' &&
            row.executions === 0 &&
            row.activatedAt &&
            query.window.from &&
            row.activatedAt < query.window.from,
        )
        .map((row) => ({ workflowId: row.id, workflowName: row.name })),
      retries: steps.map((step) => ({
        workflowId: step.workflowId,
        workflowName: step.workflowName,
        actionType: step.actionType,
        retriedSteps: step.retried,
      })),
    });
    await this.saveRecommendations(tenantId, query.window, drafts);
    if (drafts.length === 0) return { data: [] };
    const rows = await this.db
      .select()
      .from(workflowRecommendations)
      .where(
        and(
          eq(workflowRecommendations.tenantId, tenantId),
          inArray(
            workflowRecommendations.recommendationKey,
            drafts.map((draft) => draft.key),
          ),
        ),
      );
    const names = new Map(aggregates.map((row) => [row.id, row.name]));
    return {
      data: rows.map((row) => ({
        id: row.id,
        workflowId: row.workflowId,
        workflowName: row.workflowId
          ? (names.get(row.workflowId) ?? null)
          : null,
        rule: row.rule,
        title: row.title,
        evidence: row.evidence,
        suggestion: row.suggestion,
        impact: row.impact,
        status: row.status,
        detectedAt: row.detectedAt.toISOString(),
        metrics: row.metrics,
      })),
    };
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    let next: ReturnType<typeof assertRecommendationStatus>;
    try {
      next = assertRecommendationStatus(status);
    } catch {
      throw new BadRequestException(
        'Recommendation status must be open, reviewed, dismissed, or applied.',
      );
    }
    const [row] = await this.db
      .update(workflowRecommendations)
      .set({ status: next, updatedAt: new Date() })
      .where(
        and(
          eq(workflowRecommendations.id, id),
          eq(workflowRecommendations.tenantId, tenantId),
        ),
      )
      .returning({
        id: workflowRecommendations.id,
        status: workflowRecommendations.status,
      });
    if (!row) throw new NotFoundException('Recommendation not found.');
    return row;
  }

  private baselines() {
    return parseBaselines(
      this.configService.get<string>('WORKFLOW_TIME_SAVINGS_BASELINES'),
    );
  }

  private async executionCounts(
    tenantId: string,
    query: AnalyticsQuery,
  ): Promise<StatusCounts> {
    const rows = await this.db
      .select({
        status: workflowExecutions.status,
        total: sql<number>`count(*)::int`,
      })
      .from(workflowExecutions)
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(executionWhere(tenantId, query))
      .groupBy(workflowExecutions.status);
    const counts = emptyCounts();
    for (const row of rows) addStatus(counts, row.status, Number(row.total));
    return counts;
  }

  private async durations(tenantId: string, query: AnalyticsQuery) {
    const [row] = await this.db
      .select({
        sample: sql<number>`count(${workflowExecutions.durationMs})::int`,
        average: sql<string | null>`avg(${workflowExecutions.durationMs})`,
        median: sql<
          string | null
        >`percentile_cont(0.5) within group (order by ${workflowExecutions.durationMs})`,
        p95: sql<
          string | null
        >`percentile_cont(0.95) within group (order by ${workflowExecutions.durationMs})`,
      })
      .from(workflowExecutions)
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(
        and(
          executionWhere(tenantId, query),
          sql`${workflowExecutions.durationMs} is not null`,
          sql`${workflowExecutions.durationMs} >= 0`,
        ),
      );
    const sample = Number(row?.sample ?? 0);
    return {
      sample,
      averageMs: row?.average == null ? null : Math.round(Number(row.average)),
      medianMs: row?.median == null ? null : Math.round(Number(row.median)),
      p95Ms:
        sample >= 5 && row?.p95 != null ? Math.round(Number(row.p95)) : null,
    };
  }

  private async workflowCounts(tenantId: string, query: AnalyticsQuery) {
    const rows = await this.db
      .select({
        status: workflows.status,
        total: sql<number>`count(*)::int`,
      })
      .from(workflows)
      .where(workflowWhere(tenantId, query))
      .groupBy(workflows.status);
    const counts = { total: 0, active: 0, draft: 0, paused: 0 };
    for (const row of rows) {
      const total = Number(row.total);
      counts.total += total;
      if (
        row.status === 'active' ||
        row.status === 'draft' ||
        row.status === 'paused'
      )
        counts[row.status] += total;
    }
    return counts;
  }

  private async workflowTotal(tenantId: string, query: AnalyticsQuery) {
    const [row] = await this.db
      .select({ total: count() })
      .from(workflows)
      .where(workflowWhere(tenantId, query));
    return Number(row?.total ?? 0);
  }

  private async workflowAggregates(
    tenantId: string,
    query: AnalyticsQuery,
    limit: number,
    offset: number,
  ) {
    const rows = await this.db
      .select({
        id: workflows.id,
        name: workflows.name,
        status: workflows.status,
        triggerType: workflows.triggerType,
        activatedAt: workflows.activatedAt,
        executions: sql<number>`count(${workflowExecutions.id})::int`,
        completed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'failed')::int`,
        partial: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'partially_completed')::int`,
        average: sql<
          string | null
        >`avg(${workflowExecutions.durationMs}) filter (where ${workflowExecutions.durationMs} is not null and ${workflowExecutions.durationMs} >= 0)`,
        lastStarted: sql<string | null>`max(${workflowExecutions.startedAt})`,
      })
      .from(workflows)
      .leftJoin(workflowExecutions, executionJoin(tenantId, query))
      .where(workflowWhere(tenantId, query))
      .groupBy(
        workflows.id,
        workflows.name,
        workflows.status,
        workflows.triggerType,
        workflows.activatedAt,
      )
      .orderBy(desc(sql`count(${workflowExecutions.id})`), workflows.name)
      .limit(limit)
      .offset(offset);
    return rows.map((row) => ({
      ...row,
      executions: Number(row.executions),
      completed: Number(row.completed),
      failed: Number(row.failed),
      partial: Number(row.partial),
      averageMs: row.average == null ? null : Math.round(Number(row.average)),
      lastStarted: row.lastStarted,
    }));
  }

  private async stepGroups(
    tenantId: string,
    window: DashboardWindow,
    query: AnalyticsQuery,
  ) {
    const rows = await this.db
      .select({
        workflowId: workflowExecutions.workflowId,
        workflowName: workflows.name,
        actionType: workflowExecutionSteps.actionType,
        completed: sql<number>`count(*) filter (where ${workflowExecutionSteps.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${workflowExecutionSteps.status} = 'failed')::int`,
        averageMs: sql<
          string | null
        >`avg(extract(epoch from (${workflowExecutionSteps.completedAt} - ${workflowExecutionSteps.startedAt})) * 1000) filter (where ${workflowExecutionSteps.startedAt} is not null and ${workflowExecutionSteps.completedAt} is not null and ${workflowExecutionSteps.completedAt} >= ${workflowExecutionSteps.startedAt})`,
        sample: sql<number>`count(*) filter (where ${workflowExecutionSteps.startedAt} is not null and ${workflowExecutionSteps.completedAt} is not null and ${workflowExecutionSteps.completedAt} >= ${workflowExecutionSteps.startedAt})::int`,
        retried: sql<number>`count(*) filter (where ${workflowExecutionSteps.attemptCount} > 1)::int`,
        approvalWaitMs: sql<
          string | null
        >`avg(extract(epoch from (${workflowExecutionSteps.completedAt} - ${workflowExecutionSteps.startedAt})) * 1000) filter (where ${workflowExecutionSteps.approvalId} is not null and ${workflowExecutionSteps.startedAt} is not null and ${workflowExecutionSteps.completedAt} is not null and ${workflowExecutionSteps.completedAt} >= ${workflowExecutionSteps.startedAt})`,
        approvalSample: sql<number>`count(*) filter (where ${workflowExecutionSteps.approvalId} is not null and ${workflowExecutionSteps.startedAt} is not null and ${workflowExecutionSteps.completedAt} is not null and ${workflowExecutionSteps.completedAt} >= ${workflowExecutionSteps.startedAt})::int`,
      })
      .from(workflowExecutionSteps)
      .innerJoin(
        workflowExecutions,
        and(
          eq(workflowExecutions.id, workflowExecutionSteps.executionId),
          eq(workflowExecutions.tenantId, tenantId),
        ),
      )
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(
        and(
          eq(workflowExecutionSteps.tenantId, tenantId),
          window.from
            ? gte(workflowExecutions.startedAt, window.from)
            : undefined,
          window.to ? lte(workflowExecutions.startedAt, window.to) : undefined,
          query.workflowId
            ? eq(workflowExecutions.workflowId, query.workflowId)
            : undefined,
          query.triggerType
            ? eq(workflows.triggerType, query.triggerType)
            : undefined,
        ),
      )
      .groupBy(
        workflowExecutions.workflowId,
        workflows.name,
        workflowExecutionSteps.actionType,
      )
      .limit(500);
    return rows.map((row) => ({
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      actionType: row.actionType,
      completed: Number(row.completed),
      failed: Number(row.failed),
      averageMs: row.averageMs == null ? null : Number(row.averageMs),
      sample: Number(row.sample),
      retried: Number(row.retried),
      approvalWaitMs:
        row.approvalWaitMs == null ? null : Number(row.approvalWaitMs),
      approvalSample: Number(row.approvalSample),
    }));
  }

  private async failureGroups(tenantId: string, query: AnalyticsQuery) {
    const rows = await this.db
      .select({
        workflowId: workflowExecutions.workflowId,
        workflowName: workflows.name,
        errorCode: workflowExecutions.errorCode,
        total: sql<number>`count(*)::int`,
      })
      .from(workflowExecutions)
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(
        and(
          executionWhere(tenantId, query),
          inArray(workflowExecutions.status, ['failed', 'partially_completed']),
          sql`${workflowExecutions.errorCode} is not null`,
        ),
      )
      .groupBy(
        workflowExecutions.workflowId,
        workflows.name,
        workflowExecutions.errorCode,
      )
      .orderBy(desc(sql`count(*)`))
      .limit(100);
    return rows.flatMap((row) =>
      row.errorCode
        ? [
            {
              workflowId: row.workflowId,
              workflowName: row.workflowName,
              errorCode: row.errorCode,
              count: Number(row.total),
            },
          ]
        : [],
    );
  }

  private async recentFailures(tenantId: string, query: AnalyticsQuery) {
    const rows = await this.db
      .select({
        id: workflowExecutions.id,
        workflowId: workflowExecutions.workflowId,
        name: workflows.name,
        errorCode: workflowExecutions.errorCode,
        sanitizedError: workflowExecutions.sanitizedError,
        startedAt: workflowExecutions.startedAt,
      })
      .from(workflowExecutions)
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(
        and(
          executionWhere(tenantId, query),
          inArray(workflowExecutions.status, ['failed', 'partially_completed']),
        ),
      )
      .orderBy(desc(workflowExecutions.startedAt))
      .limit(10);
    return rows.map((row) => ({
      executionId: row.id,
      workflowId: row.workflowId,
      workflowName: row.name,
      errorCode: row.errorCode,
      sanitizedError: row.sanitizedError,
      startedAt: row.startedAt.toISOString(),
    }));
  }

  private async executionDays(tenantId: string, query: AnalyticsQuery) {
    const rows = await this.db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${workflowExecutions.startedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        executions: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'failed')::int`,
        partial: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'partially_completed')::int`,
        average: sql<
          string | null
        >`avg(${workflowExecutions.durationMs}) filter (where ${workflowExecutions.durationMs} is not null and ${workflowExecutions.durationMs} >= 0)`,
      })
      .from(workflowExecutions)
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(executionWhere(tenantId, query))
      .groupBy(
        sql`date_trunc('day', ${workflowExecutions.startedAt} at time zone 'UTC')`,
      );
    return new Map(
      rows.map((row) => [
        row.day,
        {
          executions: Number(row.executions),
          completed: Number(row.completed),
          failed: Number(row.failed),
          partial: Number(row.partial),
          average: row.average == null ? null : Math.round(Number(row.average)),
        },
      ]),
    );
  }

  private async savingDays(tenantId: string, query: AnalyticsQuery) {
    const rows = await this.db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${workflowExecutions.startedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        actionType: workflowExecutionSteps.actionType,
        completed: sql<number>`count(*) filter (where ${workflowExecutionSteps.status} = 'completed')::int`,
      })
      .from(workflowExecutionSteps)
      .innerJoin(
        workflowExecutions,
        and(
          eq(workflowExecutions.id, workflowExecutionSteps.executionId),
          eq(workflowExecutions.tenantId, tenantId),
        ),
      )
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(
        and(
          eq(workflowExecutionSteps.tenantId, tenantId),
          executionWhere(tenantId, query),
        ),
      )
      .groupBy(
        sql`date_trunc('day', ${workflowExecutions.startedAt} at time zone 'UTC')`,
        workflowExecutionSteps.actionType,
      );
    const days = new Map<
      string,
      Array<{ actionType: string; completed: number }>
    >();
    for (const row of rows) {
      const list = days.get(row.day) ?? [];
      list.push({
        actionType: row.actionType,
        completed: Number(row.completed),
      });
      days.set(row.day, list);
    }
    return days;
  }

  private async aiUsage(tenantId: string, window: DashboardWindow) {
    const rows = await this.db
      .select({
        parentRunId: agentRuns.parentRunId,
        status: agentRuns.status,
        usageStatus: agentRuns.usageStatus,
        costStatus: agentRuns.costStatus,
        inputTokens: agentRuns.inputTokens,
        outputTokens: agentRuns.outputTokens,
        totalTokens: agentRuns.totalTokens,
        estimatedTotalCost: agentRuns.estimatedTotalCost,
        currency: agentRuns.currency,
        durationMs: agentRuns.durationMs,
      })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.tenantId, tenantId),
          eq(agentRuns.agentName, 'workflow-generator'),
          isNull(agentRuns.parentRunId),
          window.from ? gte(agentRuns.startedAt, window.from) : undefined,
          window.to ? lte(agentRuns.startedAt, window.to) : undefined,
        ),
      )
      .limit(1000);
    return summarizeWorkflowAi(
      rows.map((row) => ({
        ...row,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        totalTokens: row.totalTokens,
        estimatedTotalCost: row.estimatedTotalCost,
        durationMs: row.durationMs,
      })),
    );
  }

  private async aiDays(tenantId: string, window: DashboardWindow) {
    const rows = await this.db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${agentRuns.startedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        runs: sql<number>`count(*)::int`,
        cost: sql<
          string | null
        >`sum(${agentRuns.estimatedTotalCost}) filter (where ${agentRuns.costStatus} = 'estimated')`,
        currencies: sql<number>`count(distinct ${agentRuns.currency}) filter (where ${agentRuns.costStatus} = 'estimated' and ${agentRuns.currency} is not null)::int`,
      })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.tenantId, tenantId),
          eq(agentRuns.agentName, 'workflow-generator'),
          isNull(agentRuns.parentRunId),
          window.from ? gte(agentRuns.startedAt, window.from) : undefined,
          window.to ? lte(agentRuns.startedAt, window.to) : undefined,
        ),
      )
      .groupBy(
        sql`date_trunc('day', ${agentRuns.startedAt} at time zone 'UTC')`,
      );
    return new Map(
      rows.map((row) => [
        row.day,
        {
          runs: Number(row.runs),
          cost: Number(row.currencies) === 1 ? row.cost : null,
        },
      ]),
    );
  }

  private async savingsWindows(tenantId: string, query: AnalyticsQuery) {
    const now = new Date();
    const { todayStart, todayEnd, weekStart, weekEnd } =
      currentTaskWindows(now);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [today, week, month] = await Promise.all([
      this.completedActions(tenantId, query, todayStart, todayEnd),
      this.completedActions(tenantId, query, weekStart, weekEnd),
      this.completedActions(tenantId, query, monthStart, now),
    ]);
    const baselines = this.baselines().seconds;
    return {
      today: estimateSavings(today, baselines),
      week: estimateSavings(week, baselines),
      month: estimateSavings(month, baselines),
    };
  }

  private async completedActions(
    tenantId: string,
    query: AnalyticsQuery,
    from: Date,
    to: Date,
  ) {
    const rows = await this.db
      .select({
        actionType: workflowExecutionSteps.actionType,
        completed: sql<number>`count(*) filter (where ${workflowExecutionSteps.status} = 'completed')::int`,
      })
      .from(workflowExecutionSteps)
      .innerJoin(
        workflowExecutions,
        and(
          eq(workflowExecutions.id, workflowExecutionSteps.executionId),
          eq(workflowExecutions.tenantId, tenantId),
        ),
      )
      .innerJoin(
        workflows,
        and(
          eq(workflows.id, workflowExecutions.workflowId),
          eq(workflows.tenantId, tenantId),
        ),
      )
      .where(
        and(
          eq(workflowExecutionSteps.tenantId, tenantId),
          gte(workflowExecutions.startedAt, from),
          lte(workflowExecutions.startedAt, to),
          query.workflowId
            ? eq(workflowExecutions.workflowId, query.workflowId)
            : undefined,
          query.triggerType
            ? eq(workflows.triggerType, query.triggerType)
            : undefined,
        ),
      )
      .groupBy(workflowExecutionSteps.actionType);
    return rows.map((row) => ({
      actionType: row.actionType,
      completed: Number(row.completed),
    }));
  }

  private async saveRecommendations(
    tenantId: string,
    window: DashboardWindow,
    drafts: RecommendationDraft[],
  ) {
    if (drafts.length === 0) return;
    await this.db
      .insert(workflowRecommendations)
      .values(
        drafts.map((draft) => ({
          tenantId,
          workflowId: draft.workflowId,
          recommendationKey: draft.key,
          rule: draft.rule,
          title: clip(draft.title, 200),
          evidence: clip(draft.evidence, 800),
          suggestion: clip(draft.suggestion, 400),
          impact: clip(draft.impact, 300),
          status: 'open',
          metrics: draft.metrics,
          periodStart: window.from,
          periodEnd: window.to,
        })),
      )
      .onConflictDoUpdate({
        target: [
          workflowRecommendations.tenantId,
          workflowRecommendations.recommendationKey,
        ],
        set: {
          title: sql`excluded.title`,
          evidence: sql`excluded.evidence`,
          suggestion: sql`excluded.suggestion`,
          impact: sql`excluded.impact`,
          metrics: sql`excluded.metrics`,
          periodStart: sql`excluded.period_start`,
          periodEnd: sql`excluded.period_end`,
          detectedAt: new Date(),
          rule: sql`excluded.rule`,
          workflowId: sql`excluded.workflow_id`,
        },
      });
  }

  private healthDistribution(
    rows: Aggregate[],
    failures: FailureGroup[],
    steps: StepGroup[],
    prior: StepGroup[],
  ) {
    const labels = {
      healthy: 0,
      needsAttention: 0,
      unhealthy: 0,
      insufficientData: 0,
    };
    for (const row of rows) {
      const health = healthFor(row, failures, steps, prior);
      if (health.label === 'HEALTHY') labels.healthy += 1;
      else if (health.label === 'NEEDS_ATTENTION') labels.needsAttention += 1;
      else if (health.label === 'UNHEALTHY') labels.unhealthy += 1;
      else labels.insufficientData += 1;
    }
    return labels;
  }

  private presentWorkflow(
    row: Aggregate,
    failures: FailureGroup[],
    steps: StepGroup[],
    prior: StepGroup[],
  ) {
    const counts = emptyCounts();
    counts.completed = row.completed;
    counts.failed = row.failed;
    counts.partiallyCompleted = row.partial;
    const rates = executionRates(counts);
    const health = healthFor(row, failures, steps, prior);
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      triggerType: row.triggerType,
      executions: row.executions,
      successRate: rates.successRate,
      failureRate: rates.failureRate,
      averageDurationMs: row.averageMs,
      healthScore: health.score,
      healthLabel: health.label,
      healthFactors: health.factors,
      lastExecutionAt: row.lastStarted,
    };
  }
}

type RawQuery = {
  range?: string;
  from?: string;
  to?: string;
  workflowId?: string;
  workflowStatus?: string;
  executionStatus?: string;
  triggerType?: string;
  page?: string;
  limit?: string;
};

type AnalyticsQuery = {
  window: DashboardWindow;
  workflowId?: string;
  workflowStatus?: string;
  executionStatus?: string;
  triggerType?: string;
  page: number;
  limit: number;
};

type Aggregate = {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  activatedAt: Date | null;
  executions: number;
  completed: number;
  failed: number;
  partial: number;
  averageMs: number | null;
  lastStarted: string | null;
};

type StepGroup = {
  workflowId: string;
  workflowName: string;
  actionType: string;
  completed: number;
  failed: number;
  averageMs: number | null;
  sample: number;
  retried: number;
  approvalWaitMs: number | null;
  approvalSample: number;
};

type FailureGroup = {
  workflowId: string;
  workflowName: string;
  errorCode: string;
  count: number;
};

function parseQuery(raw: RawQuery): AnalyticsQuery {
  const range = raw.range?.trim() || '30d';
  if (range === 'lifetime')
    throw new BadRequestException(
      'Workflow analytics requires 7d, 30d, 90d, or custom.',
    );
  const window = resolveDashboardWindow({ range, from: raw.from, to: raw.to });
  if (
    window.from &&
    window.to &&
    window.to.getTime() - window.from.getTime() > MAX_RANGE_MS
  ) {
    throw new BadRequestException('Custom range cannot exceed 366 days.');
  }
  const workflowId = raw.workflowId?.trim();
  if (workflowId && !UUID.test(workflowId))
    throw new BadRequestException('Workflow id is not valid.');
  const workflowStatus = raw.workflowStatus?.trim();
  if (
    workflowStatus &&
    !WORKFLOW_STATUSES.includes(
      workflowStatus as (typeof WORKFLOW_STATUSES)[number],
    )
  ) {
    throw new BadRequestException('Workflow status is not supported.');
  }
  const executionStatus = raw.executionStatus?.trim();
  if (
    executionStatus &&
    !EXECUTION_STATUSES.includes(
      executionStatus as (typeof EXECUTION_STATUSES)[number],
    )
  ) {
    throw new BadRequestException('Execution status is not supported.');
  }
  const triggerType = raw.triggerType?.trim();
  if (
    triggerType &&
    !TRIGGER_TYPES.includes(triggerType as (typeof TRIGGER_TYPES)[number])
  ) {
    throw new BadRequestException('Trigger type is not supported.');
  }
  const page = numberIn(raw.page, 1, 1, 10_000);
  const limit = numberIn(raw.limit, 20, 1, 50);
  return {
    window,
    workflowId,
    workflowStatus,
    executionStatus,
    triggerType,
    page,
    limit,
  };
}

function executionWhere(tenantId: string, query: AnalyticsQuery) {
  return and(
    eq(workflowExecutions.tenantId, tenantId),
    query.window.from
      ? gte(workflowExecutions.startedAt, query.window.from)
      : undefined,
    query.window.to
      ? lte(workflowExecutions.startedAt, query.window.to)
      : undefined,
    query.workflowId
      ? eq(workflowExecutions.workflowId, query.workflowId)
      : undefined,
    query.executionStatus
      ? eq(workflowExecutions.status, query.executionStatus)
      : undefined,
    query.triggerType
      ? eq(workflows.triggerType, query.triggerType)
      : undefined,
  );
}

function executionJoin(tenantId: string, query: AnalyticsQuery) {
  return and(
    eq(workflowExecutions.workflowId, workflows.id),
    eq(workflowExecutions.tenantId, tenantId),
    query.window.from
      ? gte(workflowExecutions.startedAt, query.window.from)
      : undefined,
    query.window.to
      ? lte(workflowExecutions.startedAt, query.window.to)
      : undefined,
    query.executionStatus
      ? eq(workflowExecutions.status, query.executionStatus)
      : undefined,
  );
}

function workflowWhere(tenantId: string, query: AnalyticsQuery) {
  return and(
    eq(workflows.tenantId, tenantId),
    query.workflowId ? eq(workflows.id, query.workflowId) : undefined,
    query.workflowStatus
      ? eq(workflows.status, query.workflowStatus)
      : undefined,
    query.triggerType
      ? eq(workflows.triggerType, query.triggerType)
      : undefined,
  );
}

function previousWindow(window: DashboardWindow): DashboardWindow {
  if (!window.from || !window.to) return window;
  const length = window.to.getTime() - window.from.getTime();
  return {
    preset: window.preset,
    from: new Date(window.from.getTime() - length),
    to: window.from,
    timezone: 'UTC',
  };
}

function presentWindow(window: DashboardWindow) {
  return {
    preset: window.preset,
    from: window.from?.toISOString() ?? null,
    to: window.to?.toISOString() ?? null,
    timezone: 'UTC' as const,
  };
}

function eachUtcDay(window: DashboardWindow) {
  if (!window.from || !window.to) return [];
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(
      window.from.getUTCFullYear(),
      window.from.getUTCMonth(),
      window.from.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      window.to.getUTCFullYear(),
      window.to.getUTCMonth(),
      window.to.getUTCDate(),
    ),
  );
  while (cursor.getTime() <= end.getTime() && days.length < 367) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function healthFor(
  row: Aggregate,
  failures: FailureGroup[],
  steps: StepGroup[],
  prior: StepGroup[],
) {
  const counts = emptyCounts();
  counts.completed = row.completed;
  counts.failed = row.failed;
  counts.partiallyCompleted = row.partial;
  const rates = executionRates(counts);
  const evidence = buildRecommendations({
    failures: failures
      .filter((failure) => failure.workflowId === row.id)
      .map((failure) => ({
        workflowId: failure.workflowId,
        workflowName: failure.workflowName,
        errorCode: failure.errorCode,
        count: failure.count,
      })),
    slow: slowFacts(
      steps.filter((step) => step.workflowId === row.id),
      prior.filter((step) => step.workflowId === row.id),
    ),
    approvals: approvalFacts(
      steps.filter((step) => step.workflowId === row.id),
    ),
    unused: [],
    retries: [],
  });
  return workflowHealth({
    terminalEligible: rates.terminalEligible,
    successRate: rates.successRate,
    repeatedFailure: evidence.some((item) => item.rule === 'repeated_failure'),
    slowVersusPrior: evidence.some((item) => item.rule === 'slow_execution'),
    approvalBottleneck: evidence.some(
      (item) => item.rule === 'approval_bottleneck',
    ),
  });
}

function slowFacts(steps: StepGroup[], prior: StepGroup[]) {
  return steps.flatMap((step) => {
    const previous = prior.find(
      (item) =>
        item.workflowId === step.workflowId &&
        item.actionType === step.actionType,
    );
    if (step.averageMs == null || !previous || previous.averageMs == null)
      return [];
    return [
      {
        workflowId: step.workflowId,
        workflowName: step.workflowName,
        actionType: step.actionType,
        currentAvgMs: step.averageMs,
        priorAvgMs: previous.averageMs,
        sample: step.sample,
        priorSample: previous.sample,
      },
    ];
  });
}

function approvalFacts(steps: StepGroup[]) {
  const grouped = new Map<
    string,
    { workflowName: string; wait: number; sample: number }
  >();
  for (const step of steps) {
    if (step.approvalWaitMs == null || step.approvalSample === 0) continue;
    const current = grouped.get(step.workflowId) ?? {
      workflowName: step.workflowName,
      wait: 0,
      sample: 0,
    };
    current.wait += step.approvalWaitMs * step.approvalSample;
    current.sample += step.approvalSample;
    grouped.set(step.workflowId, current);
  }
  return [...grouped.entries()].map(([workflowId, value]) => ({
    workflowId,
    workflowName: value.workflowName,
    averageWaitMs: value.wait / value.sample,
    sample: value.sample,
  }));
}

function sumActions(steps: StepGroup[]) {
  const totals = new Map<string, number>();
  for (const step of steps)
    totals.set(
      step.actionType,
      (totals.get(step.actionType) ?? 0) + step.completed,
    );
  return [...totals.entries()].map(([actionType, completed]) => ({
    actionType,
    completed,
  }));
}

function numberIn(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(
      'page and limit must be integers inside the supported range.',
    );
  }
  return parsed;
}

function clip(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max);
}
