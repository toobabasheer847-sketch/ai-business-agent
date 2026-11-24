import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { agentRuns } from '../../database/drizzle/schema/agent-run.schema';
import {
  businessForecasts,
  forecastEvaluations,
  predictiveInsights,
} from '../../database/drizzle/schema/business-intelligence.schema';
import { companies } from '../../database/drizzle/schema/company.schema';
import { leads } from '../../database/drizzle/schema/lead.schema';
import { operationalExceptions } from '../../database/drizzle/schema/operational-exception.schema';
import { proposals } from '../../database/drizzle/schema/proposal.schema';
import { prospects } from '../../database/drizzle/schema/prospect.schema';
import { tasks } from '../../database/drizzle/schema/task.schema';
import { users } from '../../database/drizzle/schema/user.schema';
import { workflowExecutions } from '../../database/drizzle/schema/workflow.schema';
import {
  acceptanceRate,
  businessRisks,
  conversionReport,
  fillWeeks,
  forecastWeekly,
  insightsFrom,
  parseBusinessQuery,
  percentageError,
  pipelineForecast,
  workloadSummary,
  type ForecastResult,
  type MoneyBucket,
} from './business-intelligence';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_TASKS = ['pending', 'in_progress'] as const;
const PENDING_PROPOSALS = ['sent', 'viewed'] as const;

type Query = ReturnType<typeof parseBusinessQuery>;

@Injectable()
export class BusinessIntelligenceService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async overview(tenantId: string, raw: Record<string, string | undefined>) {
    const picture = await this.picture(tenantId, raw);
    return {
      window: picture.query.window,
      horizonDays: picture.query.horizon,
      history: picture.history,
      pipeline: picture.pipeline,
      workload: picture.workload,
      risks: picture.risks,
      forecasts: picture.forecasts,
      classification: {
        facts: 'Counts and amounts come from stored rows.',
        forecasts: 'Forecasts are moving-average estimates and can be wrong.',
        revenue: 'Accepted proposal value is not recognized revenue.',
      },
    };
  }

  async salesForecast(
    tenantId: string,
    raw: Record<string, string | undefined>,
  ) {
    const picture = await this.picture(tenantId, raw);
    return {
      window: picture.query.window,
      horizonDays: picture.query.horizon,
      forecasts: picture.forecasts,
    };
  }

  async leadInsights(
    tenantId: string,
    raw: Record<string, string | undefined>,
  ) {
    const picture = await this.picture(tenantId, raw);
    return {
      window: picture.query.window,
      conversion: picture.history.conversion,
      statuses: picture.history.leadStatuses,
    };
  }

  async revenuePipeline(
    tenantId: string,
    raw: Record<string, string | undefined>,
  ) {
    const picture = await this.picture(tenantId, raw);
    return {
      window: picture.query.window,
      pipeline: picture.pipeline,
      note: 'Pending value includes sent and viewed proposals only. Rejected value is not pipeline. Currencies are not combined.',
    };
  }

  async workloadForecast(
    tenantId: string,
    raw: Record<string, string | undefined>,
  ) {
    const picture = await this.picture(tenantId, raw);
    return {
      window: picture.query.window,
      workload: picture.workload,
      completionForecast:
        picture.forecasts.find((item) => item.metric === 'task_completions') ??
        null,
    };
  }

  async risks(tenantId: string, raw: Record<string, string | undefined>) {
    const picture = await this.picture(tenantId, raw);
    return { window: picture.query.window, risks: picture.risks };
  }

  async insights(tenantId: string, raw: Record<string, string | undefined>) {
    const picture = await this.picture(tenantId, raw);
    const saved = await this.db
      .select()
      .from(predictiveInsights)
      .where(
        and(
          eq(predictiveInsights.tenantId, tenantId),
          eq(predictiveInsights.periodStart, picture.query.window.from as Date),
          eq(predictiveInsights.periodEnd, picture.query.window.to as Date),
        ),
      )
      .limit(50);
    return {
      window: picture.query.window,
      insights: picture.insights,
      saved,
      note: 'Displayed insights are calculated from stored records. Saved copies are written by refresh and are suggestions, not new facts.',
    };
  }

  async forecast(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(businessForecasts)
      .where(
        and(
          eq(businessForecasts.id, id),
          eq(businessForecasts.tenantId, tenantId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException('Forecast not found.');
    const evaluations = await this.db
      .select()
      .from(forecastEvaluations)
      .where(
        and(
          eq(forecastEvaluations.forecastId, id),
          eq(forecastEvaluations.tenantId, tenantId),
        ),
      )
      .limit(1);
    return { forecast: row, evaluation: evaluations[0] ?? null };
  }

  async refresh(tenantId: string, raw: Record<string, string | undefined>) {
    const picture = await this.picture(tenantId, raw);
    const from = picture.query.window.from as Date;
    const to = picture.query.window.to as Date;
    const forecastStart = to;
    const forecastEnd = new Date(to.getTime() + picture.query.horizon * DAY_MS);
    for (const forecast of picture.forecasts) {
      await this.db
        .insert(businessForecasts)
        .values({
          tenantId,
          metricKey: forecast.metric,
          forecastMethod: forecast.method ?? 'insufficient_data',
          historicalPeriodStart: from,
          historicalPeriodEnd: to,
          forecastPeriodStart: forecastStart,
          forecastPeriodEnd: forecastEnd,
          predictedValue:
            forecast.predicted === null ? null : forecast.predicted.toFixed(4),
          lowerBound:
            forecast.lower === null ? null : forecast.lower.toFixed(4),
          upperBound:
            forecast.upper === null ? null : forecast.upper.toFixed(4),
          confidenceLevel: forecast.confidence,
          modelMetadata: {
            weeks: forecast.weeks,
            observations: forecast.observations,
            warnings: forecast.warnings,
            holdout: forecast.holdout,
            status: forecast.status,
            currency:
              forecast.metric === 'accepted_value' ? picture.currency : null,
          },
        })
        .onConflictDoNothing();
    }
    for (const insight of picture.insights) {
      const key = `${insight.key}:${from.toISOString()}:${to.toISOString()}`;
      await this.db
        .insert(predictiveInsights)
        .values({
          tenantId,
          insightKey: key,
          category: insight.category,
          severity: insight.severity,
          title: insight.title,
          description: insight.description,
          evidence: insight.evidence,
          confidenceLevel: insight.confidence,
          recommendation: insight.recommendation,
          status: 'open',
          periodStart: from,
          periodEnd: to,
        })
        .onConflictDoUpdate({
          target: [predictiveInsights.tenantId, predictiveInsights.insightKey],
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            evidence: sql`excluded.evidence`,
            severity: sql`excluded.severity`,
            confidenceLevel: sql`excluded.confidence_level`,
            recommendation: sql`excluded.recommendation`,
            generatedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }
    const evaluated = await this.evaluateDueForecasts(tenantId);
    return {
      savedForecasts: picture.forecasts.length,
      savedInsights: picture.insights.length,
      evaluated,
    };
  }

  async brief(tenantId: string) {
    const picture = await this.picture(tenantId, {
      range: '30d',
      horizon: '7',
    });
    const lines = [
      'Business intelligence for the last 30 days (UTC). Figures come from stored records. Forecasts are estimates, not guaranteed results. No business records were changed.',
      `Leads created: ${picture.history.leadsCreated}. Previous period: ${picture.history.previousLeads}.`,
      picture.history.conversion.explanation,
      ...picture.pipeline.map(
        (bucket) =>
          `${bucket.currency} accepted proposal value ${bucket.accepted}; pending pipeline ${bucket.pending}; rejected ${bucket.rejected}.`,
      ),
      `Open tasks ${picture.workload.open}. Overdue now ${picture.workload.overdue}. Due within seven days ${picture.workload.dueNext7Days}.`,
    ];
    for (const forecast of picture.forecasts) {
      lines.push(
        forecast.status === 'forecast'
          ? `${forecast.metric} estimate ${forecast.predicted} (range ${forecast.lower} to ${forecast.upper}, confidence ${forecast.confidence}, method weekly moving average).`
          : `${forecast.metric}: INSUFFICIENT_DATA. ${forecast.warnings.join(' ')}`,
      );
    }
    if (picture.risks.length === 0)
      lines.push('No configured risk rule matched this period.');
    for (const risk of picture.risks)
      lines.push(`Risk: ${risk.title}. ${risk.evidence}`);
    return { summary: lines.join('\n') };
  }

  private async picture(
    tenantId: string,
    raw: Record<string, string | undefined>,
  ) {
    const query = parseBusinessQuery(raw);
    const from = query.window.from as Date;
    const to = query.window.to as Date;
    const now = new Date();
    const [history, pipelineInputs, workload, operations, weeks] =
      await Promise.all([
        this.history(tenantId, query),
        this.pipelineInputs(tenantId, query),
        this.workload(tenantId, now),
        this.operations(tenantId, from, to),
        this.weeks(tenantId, from, to),
      ]);
    const acceptance = acceptanceRate(
      pipelineInputs.acceptedDecisions,
      pipelineInputs.rejectedDecisions,
      pipelineInputs.expiredDecisions,
    );
    const previousAcceptance = acceptanceRate(
      pipelineInputs.previousAccepted,
      pipelineInputs.previousRejected,
      pipelineInputs.previousExpired,
    );
    const pipeline = pipelineForecast({
      buckets: pipelineInputs.buckets,
      acceptanceRate: acceptance.rate,
      acceptanceSample: acceptance.decided,
    });
    const risks = businessRisks({
      staleNewLeads: history.staleNewLeads,
      expiringProposals: pipelineInputs.expiring,
      oldPendingProposals: pipelineInputs.oldPending,
      currentAcceptance: acceptance.rate,
      previousAcceptance: previousAcceptance.rate,
      currentDecided: acceptance.decided,
      previousDecided: previousAcceptance.decided,
      overdueTasks: workload.overdue,
      workflowFailures: operations.failures,
      workflowTerminal: operations.terminal,
      openExceptions: operations.openExceptions,
      failedAgentRuns: operations.failedAgentRuns,
      unpricedAgentRuns: operations.unpricedAgentRuns,
    });
    const pendingLabel = pipeline
      .filter((bucket) => Number(bucket.pending) > 0)
      .map(
        (bucket) =>
          `${bucket.currency} ${bucket.pending} across ${bucket.pendingCount} sent or viewed proposals`,
      )
      .join('; ');
    const insights = insightsFrom({
      leadsCreated: history.leadsCreated,
      previousLeads: history.previousLeads,
      acceptance: acceptance.rate,
      previousAcceptance: previousAcceptance.rate,
      pendingValueLabel: pendingLabel || null,
      overdueTasks: workload.overdue,
      dueNext7Days: workload.dueNext7Days,
      workflowFailures: operations.failures,
      openExceptions: operations.openExceptions,
      risks,
    });
    const forecasts = [
      forecastWeekly({
        metric: 'lead_volume',
        weeks: weeks.leads,
        horizonDays: query.horizon,
        integer: true,
      }),
      forecastWeekly({
        metric: 'proposal_volume',
        weeks: weeks.proposals,
        horizonDays: query.horizon,
        integer: true,
      }),
      forecastWeekly({
        metric: 'accepted_count',
        weeks: weeks.accepted,
        horizonDays: query.horizon,
        integer: true,
      }),
      weeks.acceptedValue
        ? forecastWeekly({
            metric: 'accepted_value',
            weeks: weeks.acceptedValue,
            horizonDays: query.horizon,
            integer: false,
          })
        : insufficient(
            'accepted_value',
            query.horizon,
            'Accepted proposal value cannot be forecast because the period has more than one currency or no priced acceptances.',
          ),
      forecastWeekly({
        metric: 'task_completions',
        weeks: weeks.completions,
        horizonDays: query.horizon,
        integer: true,
      }),
    ];
    return {
      query,
      currency: weeks.currency,
      history: { ...history, acceptance, previousAcceptance },
      pipeline,
      workload,
      risks,
      insights,
      forecasts,
      operations,
      expiringProposals: pipelineInputs.expiring,
      oldPendingProposals: pipelineInputs.oldPending,
    };
  }

  async decisionMetrics(tenantId: string) {
    const picture = await this.picture(tenantId, {
      range: '30d',
      horizon: '7',
    });
    return {
      window: picture.query.window,
      staleNewLeads: picture.history.staleNewLeads,
      leadsCreated: picture.history.leadsCreated,
      previousLeads: picture.history.previousLeads,
      acceptanceRate: picture.history.acceptance.rate,
      acceptanceSample: picture.history.acceptance.decided,
      previousAcceptanceRate: picture.history.previousAcceptance.rate,
      previousAcceptanceSample: picture.history.previousAcceptance.decided,
      overdueTasks: picture.workload.overdue,
      dueNext7Days: picture.workload.dueNext7Days,
      workflowFailures: picture.operations.failures,
      openExceptions: picture.operations.openExceptions,
      expiringProposals: picture.expiringProposals,
      risks: picture.risks,
    };
  }

  private async history(tenantId: string, query: Query) {
    const from = query.window.from as Date;
    const to = query.window.to as Date;
    const previousFrom = query.previous.from;
    const previousTo = query.previous.to;
    const sevenAgo = new Date(Date.now() - 7 * DAY_MS);
    const [
      created,
      previous,
      prospectsCreated,
      companiesCreated,
      statuses,
      terminal,
      withTask,
      stale,
    ] = await Promise.all([
      this.countRows(
        leads,
        leads.tenantId,
        leads.createdAt,
        tenantId,
        from,
        to,
      ),
      this.countRows(
        leads,
        leads.tenantId,
        leads.createdAt,
        tenantId,
        previousFrom,
        previousTo,
      ),
      this.countRows(
        prospects,
        prospects.tenantId,
        prospects.createdAt,
        tenantId,
        from,
        to,
      ),
      this.countRows(
        companies,
        companies.tenantId,
        companies.createdAt,
        tenantId,
        from,
        to,
      ),
      this.db
        .select({ status: leads.status, total: count() })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            gte(leads.createdAt, from),
            lte(leads.createdAt, to),
          ),
        )
        .groupBy(leads.status),
      this.db
        .select({
          converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')`,
          lost: sql<number>`count(*) filter (where ${leads.status} = 'lost')`,
          open: sql<number>`count(*) filter (where ${leads.status} not in ('converted', 'lost'))`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            gte(leads.createdAt, from),
            lte(leads.createdAt, to),
          ),
        ),
      this.db
        .select({
          converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')`,
          lost: sql<number>`count(*) filter (where ${leads.status} = 'lost')`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            gte(leads.createdAt, from),
            lte(leads.createdAt, to),
            sql`exists (select 1 from tasks follow_up where follow_up.tenant_id = ${leads.tenantId} and follow_up.lead_id = ${leads.id})`,
          ),
        ),
      this.db
        .select({ total: count() })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            eq(leads.status, 'new'),
            lte(leads.createdAt, sevenAgo),
          ),
        ),
    ]);
    const outcome = terminal[0];
    const followed = withTask[0];
    const converted = num(outcome?.converted);
    const lost = num(outcome?.lost);
    const followedConverted = num(followed?.converted);
    const followedLost = num(followed?.lost);
    const leadStatuses: Record<string, number> = {};
    for (const row of statuses) leadStatuses[row.status] = num(row.total);
    return {
      leadsCreated: created,
      previousLeads: previous,
      prospectsCreated,
      companiesCreated,
      leadStatuses,
      staleNewLeads: num(stale[0]?.total),
      conversion: conversionReport({
        created,
        converted,
        lost,
        open: num(outcome?.open),
        withTask: { converted: followedConverted, lost: followedLost },
        withoutTask: {
          converted: Math.max(0, converted - followedConverted),
          lost: Math.max(0, lost - followedLost),
        },
      }),
    };
  }

  private async pipelineInputs(tenantId: string, query: Query) {
    const from = query.window.from as Date;
    const to = query.window.to as Date;
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * DAY_MS);
    const old = new Date(now.getTime() - 14 * DAY_MS);
    const [rows, decisions, previousDecisions, expiring, oldPending] =
      await Promise.all([
        this.db
          .select({
            currency: proposals.currency,
            status: proposals.status,
            total: count(),
            amount: sql<string>`coalesce(sum(${proposals.price}), 0)`,
            missing: sql<number>`count(*) filter (where ${proposals.price} is null)`,
          })
          .from(proposals)
          .where(
            and(
              eq(proposals.tenantId, tenantId),
              gte(proposals.createdAt, from),
              lte(proposals.createdAt, to),
            ),
          )
          .groupBy(proposals.currency, proposals.status),
        this.decisionCounts(tenantId, from, to),
        this.decisionCounts(tenantId, query.previous.from, query.previous.to),
        this.db
          .select({ total: count() })
          .from(proposals)
          .where(
            and(
              eq(proposals.tenantId, tenantId),
              inArray(proposals.status, PENDING_PROPOSALS),
              gte(proposals.validUntil, now),
              lte(proposals.validUntil, soon),
            ),
          ),
        this.db
          .select({ total: count() })
          .from(proposals)
          .where(
            and(
              eq(proposals.tenantId, tenantId),
              inArray(proposals.status, PENDING_PROPOSALS),
              lte(proposals.createdAt, old),
              isNull(proposals.acceptedAt),
              isNull(proposals.rejectedAt),
            ),
          ),
      ]);
    return {
      buckets: foldMoney(rows),
      acceptedDecisions: decisions.accepted,
      rejectedDecisions: decisions.rejected,
      expiredDecisions: decisions.expired,
      previousAccepted: previousDecisions.accepted,
      previousRejected: previousDecisions.rejected,
      previousExpired: previousDecisions.expired,
      expiring: num(expiring[0]?.total),
      oldPending: num(oldPending[0]?.total),
    };
  }

  private async decisionCounts(tenantId: string, from: Date, to: Date) {
    const rows = await this.db
      .select({
        accepted: sql<number>`count(*) filter (where ${proposals.acceptedAt} >= ${from} and ${proposals.acceptedAt} <= ${to})`,
        rejected: sql<number>`count(*) filter (where ${proposals.rejectedAt} >= ${from} and ${proposals.rejectedAt} <= ${to} and ${proposals.acceptedAt} is null)`,
        expired: sql<number>`count(*) filter (where ${proposals.status} = 'expired' and ${proposals.validUntil} >= ${from} and ${proposals.validUntil} <= ${to} and ${proposals.acceptedAt} is null and ${proposals.rejectedAt} is null)`,
      })
      .from(proposals)
      .where(eq(proposals.tenantId, tenantId));
    return {
      accepted: num(rows[0]?.accepted),
      rejected: num(rows[0]?.rejected),
      expired: num(rows[0]?.expired),
    };
  }

  private async workload(tenantId: string, now: Date) {
    const next = new Date(now.getTime() + 7 * DAY_MS);
    const [open, overdue, upcoming, people, duration] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(tasks)
        .where(
          and(eq(tasks.tenantId, tenantId), inArray(tasks.status, OPEN_TASKS)),
        ),
      this.db
        .select({ total: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            inArray(tasks.status, OPEN_TASKS),
            lte(tasks.dueAt, now),
          ),
        ),
      this.db
        .select({ total: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            inArray(tasks.status, OPEN_TASKS),
            gte(tasks.dueAt, now),
            lte(tasks.dueAt, next),
          ),
        ),
      this.db
        .select({
          userId: tasks.assignedTo,
          name: users.name,
          open: count(),
          overdue: sql<number>`count(*) filter (where ${tasks.dueAt} < ${now})`,
        })
        .from(tasks)
        .leftJoin(
          users,
          and(
            eq(users.id, tasks.assignedTo),
            eq(users.tenantId, tasks.tenantId),
          ),
        )
        .where(
          and(eq(tasks.tenantId, tenantId), inArray(tasks.status, OPEN_TASKS)),
        )
        .groupBy(tasks.assignedTo, users.name)
        .limit(20),
      this.db
        .select({
          sample: sql<number>`count(*) filter (where ${tasks.completedAt} >= ${tasks.createdAt})`,
          seconds: sql<
            number | null
          >`avg(extract(epoch from (${tasks.completedAt} - ${tasks.createdAt}))) filter (where ${tasks.completedAt} >= ${tasks.createdAt})`,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.status, 'completed'),
            gte(tasks.completedAt, new Date(now.getTime() - 90 * DAY_MS)),
          ),
        ),
    ]);
    return workloadSummary({
      open: num(open[0]?.total),
      overdue: num(overdue[0]?.total),
      dueNext7Days: num(upcoming[0]?.total),
      users: people.map((person) => ({
        userId: person.userId ?? 'unassigned',
        name: person.name ?? 'Unassigned',
        open: num(person.open),
        overdue: num(person.overdue),
      })),
      completionSample: num(duration[0]?.sample),
      averageCompletionMs:
        duration[0]?.seconds === null || duration[0]?.seconds === undefined
          ? null
          : Math.round(num(duration[0].seconds) * 1000),
    });
  }

  private async operations(tenantId: string, from: Date, to: Date) {
    const [executions, exceptions, failedRuns, unpriced] = await Promise.all([
      this.db
        .select({ status: workflowExecutions.status, total: count() })
        .from(workflowExecutions)
        .where(
          and(
            eq(workflowExecutions.tenantId, tenantId),
            gte(workflowExecutions.startedAt, from),
            lte(workflowExecutions.startedAt, to),
          ),
        )
        .groupBy(workflowExecutions.status),
      this.db
        .select({ total: count() })
        .from(operationalExceptions)
        .where(
          and(
            eq(operationalExceptions.tenantId, tenantId),
            inArray(operationalExceptions.status, [
              'open',
              'acknowledged',
              'in_progress',
            ]),
          ),
        ),
      this.db
        .select({ total: count() })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.tenantId, tenantId),
            eq(agentRuns.status, 'failed'),
            isNull(agentRuns.parentRunId),
            gte(agentRuns.startedAt, from),
            lte(agentRuns.startedAt, to),
          ),
        ),
      this.db
        .select({ total: count() })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.tenantId, tenantId),
            eq(agentRuns.costStatus, 'pricing_not_configured'),
            isNull(agentRuns.parentRunId),
            gte(agentRuns.startedAt, from),
            lte(agentRuns.startedAt, to),
          ),
        ),
    ]);
    const byStatus: Record<string, number> = {};
    for (const row of executions) byStatus[row.status] = num(row.total);
    const failed = (byStatus.failed ?? 0) + (byStatus.partially_completed ?? 0);
    const terminal = failed + (byStatus.completed ?? 0);
    return {
      failures: failed,
      terminal,
      openExceptions: num(exceptions[0]?.total),
      failedAgentRuns: num(failedRuns[0]?.total),
      unpricedAgentRuns: num(unpriced[0]?.total),
    };
  }

  private async weeks(tenantId: string, from: Date, to: Date) {
    const [leadRows, proposalRows, acceptedRows, completionRows, valueRows] =
      await Promise.all([
        this.weekCounts(
          leads,
          leads.tenantId,
          leads.createdAt,
          tenantId,
          from,
          to,
        ),
        this.weekCounts(
          proposals,
          proposals.tenantId,
          proposals.createdAt,
          tenantId,
          from,
          to,
        ),
        this.weekCounts(
          proposals,
          proposals.tenantId,
          proposals.acceptedAt,
          tenantId,
          from,
          to,
        ),
        this.weekCounts(
          tasks,
          tasks.tenantId,
          tasks.completedAt,
          tenantId,
          from,
          to,
        ),
        this.db
          .select({
            week: sql<string>`date_trunc('week', ${proposals.acceptedAt})`,
            currency: proposals.currency,
            value: sql<string>`coalesce(sum(${proposals.price}), 0)`,
          })
          .from(proposals)
          .where(
            and(
              eq(proposals.tenantId, tenantId),
              gte(proposals.acceptedAt, from),
              lte(proposals.acceptedAt, to),
            ),
          )
          .groupBy(
            sql`date_trunc('week', ${proposals.acceptedAt})`,
            proposals.currency,
          ),
      ]);
    const currencies = new Set(valueRows.map((row) => row.currency));
    const acceptedValue =
      currencies.size === 1
        ? fillWeeks(
            valueRows.map((row) => ({
              week: row.week,
              value: Number(row.value),
            })),
            from,
            to,
          )
        : null;
    return {
      leads: fillWeeks(leadRows, from, to),
      proposals: fillWeeks(proposalRows, from, to),
      accepted: fillWeeks(acceptedRows, from, to),
      completions: fillWeeks(completionRows, from, to),
      acceptedValue,
      currency: currencies.size === 1 ? [...currencies][0] : null,
    };
  }

  private async weekCounts(
    table: unknown,
    tenantColumn: unknown,
    timeColumn: unknown,
    tenantId: string,
    from: Date,
    to: Date,
  ) {
    const rows = await this.db
      .select({
        week: sql<string>`date_trunc('week', ${timeColumn as typeof leads.createdAt})`,
        value: count(),
      })
      .from(table as typeof leads)
      .where(
        and(
          eq(tenantColumn as typeof leads.tenantId, tenantId),
          gte(timeColumn as typeof leads.createdAt, from),
          lte(timeColumn as typeof leads.createdAt, to),
        ),
      )
      .groupBy(
        sql`date_trunc('week', ${timeColumn as typeof leads.createdAt})`,
      );
    return rows.map((row) => ({ week: row.week, value: num(row.value) }));
  }

  private async countRows(
    table: unknown,
    tenantColumn: unknown,
    timeColumn: unknown,
    tenantId: string,
    from: Date,
    to: Date,
  ) {
    const rows = await this.db
      .select({ total: count() })
      .from(table as typeof leads)
      .where(
        and(
          eq(tenantColumn as typeof leads.tenantId, tenantId),
          gte(timeColumn as typeof leads.createdAt, from),
          lte(timeColumn as typeof leads.createdAt, to),
        ),
      );
    return num(rows[0]?.total);
  }

  private async evaluateDueForecasts(tenantId: string) {
    const now = new Date();
    const rows = await this.db
      .select({
        forecast: businessForecasts,
        evaluationId: forecastEvaluations.id,
      })
      .from(businessForecasts)
      .leftJoin(
        forecastEvaluations,
        eq(forecastEvaluations.forecastId, businessForecasts.id),
      )
      .where(
        and(
          eq(businessForecasts.tenantId, tenantId),
          lte(businessForecasts.forecastPeriodEnd, now),
          isNull(forecastEvaluations.id),
        ),
      )
      .limit(20);
    let evaluated = 0;
    for (const row of rows) {
      if (row.forecast.predictedValue === null) continue;
      const actual = await this.actualFor(
        tenantId,
        row.forecast.metricKey,
        row.forecast.forecastPeriodStart,
        row.forecast.forecastPeriodEnd,
        row.forecast.modelMetadata,
      );
      if (actual === null) continue;
      const predicted = Number(row.forecast.predictedValue);
      await this.db
        .insert(forecastEvaluations)
        .values({
          tenantId,
          forecastId: row.forecast.id,
          actualValue: actual.toFixed(4),
          absoluteError: Math.abs(predicted - actual).toFixed(4),
          percentageError:
            percentageError(predicted, actual)?.toFixed(2) ?? null,
          evaluationKind: 'completed_period',
        })
        .onConflictDoNothing();
      evaluated += 1;
    }
    return evaluated;
  }

  private async actualFor(
    tenantId: string,
    metric: string,
    from: Date,
    to: Date,
    metadata: unknown,
  ) {
    if (metric === 'lead_volume')
      return this.countRows(
        leads,
        leads.tenantId,
        leads.createdAt,
        tenantId,
        from,
        to,
      );
    if (metric === 'proposal_volume') {
      const rows = await this.db
        .select({ total: count() })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, tenantId),
            gte(proposals.createdAt, from),
            lte(proposals.createdAt, to),
          ),
        );
      return num(rows[0]?.total);
    }
    if (metric === 'accepted_count') {
      const rows = await this.db
        .select({ total: count() })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, tenantId),
            gte(proposals.acceptedAt, from),
            lte(proposals.acceptedAt, to),
          ),
        );
      return num(rows[0]?.total);
    }
    if (metric === 'task_completions') {
      const rows = await this.db
        .select({ total: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            gte(tasks.completedAt, from),
            lte(tasks.completedAt, to),
          ),
        );
      return num(rows[0]?.total);
    }
    if (metric === 'accepted_value') {
      const currency =
        metadata && typeof metadata === 'object' && 'currency' in metadata
          ? metadata.currency
          : null;
      if (typeof currency !== 'string') return null;
      const rows = await this.db
        .select({
          total: sql<string>`coalesce(sum(${proposals.price}), 0)`,
        })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, tenantId),
            eq(proposals.currency, currency),
            gte(proposals.acceptedAt, from),
            lte(proposals.acceptedAt, to),
          ),
        );
      return Number(rows[0]?.total ?? 0);
    }
    return null;
  }
}

function foldMoney(
  rows: Array<{
    currency: string;
    status: string;
    total: unknown;
    amount: string;
    missing: unknown;
  }>,
): MoneyBucket[] {
  const buckets = new Map<string, MoneyBucket>();
  for (const row of rows) {
    const bucket = buckets.get(row.currency) ?? {
      currency: row.currency,
      accepted: '0.00',
      pending: '0.00',
      rejected: '0.00',
      acceptedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      missingPrice: 0,
    };
    const amount = money(row.amount);
    const total = num(row.total);
    if (row.status === 'accepted') {
      bucket.accepted = addMoney(bucket.accepted, amount);
      bucket.acceptedCount += total;
    } else if (row.status === 'sent' || row.status === 'viewed') {
      bucket.pending = addMoney(bucket.pending, amount);
      bucket.pendingCount += total;
    } else if (row.status === 'rejected') {
      bucket.rejected = addMoney(bucket.rejected, amount);
      bucket.rejectedCount += total;
    }
    bucket.missingPrice += num(row.missing);
    buckets.set(row.currency, bucket);
  }
  return [...buckets.values()];
}

function insufficient(
  metric: string,
  horizonDays: number,
  warning: string,
): ForecastResult {
  return {
    metric,
    status: 'INSUFFICIENT_DATA',
    method: null,
    horizonDays,
    predicted: null,
    lower: null,
    upper: null,
    confidence: 'INSUFFICIENT_DATA',
    weeks: 0,
    observations: 0,
    warnings: [warning],
    holdout: null,
  };
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function addMoney(left: string, right: string) {
  return (Number(left) + Number(right)).toFixed(2);
}
