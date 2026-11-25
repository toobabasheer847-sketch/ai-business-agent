import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { agentRuns } from '../../database/drizzle/schema/agent-run.schema';
import { aiApprovals } from '../../database/drizzle/schema/ai-approval.schema';
import { operationalExceptions } from '../../database/drizzle/schema/operational-exception.schema';
import { prospects } from '../../database/drizzle/schema/prospect.schema';
import {
  businessGoalSnapshots,
  businessGoals,
  strategicActionPlans,
  strategicActionSteps,
  strategicPlanMilestones,
  strategicPlans,
} from '../../database/drizzle/schema/strategic-decision.schema';
import { tasks } from '../../database/drizzle/schema/task.schema';
import { workflowExecutionSteps, workflowExecutions } from '../../database/drizzle/schema/workflow.schema';
import { BusinessIntelligenceService } from '../business-intelligence/business-intelligence.service';
import { GOAL_METRICS, goalProgress, isGoalMetric } from '../strategic-decisions/strategic-decision';
import {
  dayKey,
  periodKey,
  windowsOverlap,
  type ActionObservation,
  type BottleneckSignals,
  type MetricObservation,
  type PlanObservation,
} from './continuous-improvement';

const DAY_MS = 24 * 60 * 60 * 1000;

export type GoalFact = {
  id: string;
  name: string;
  metricKey: string;
  direction: 'higher' | 'lower';
  baseline: number | null;
  current: number | null;
  target: number | null;
  progress: number | null;
  note: string;
  behind: boolean;
  startDate: string;
  targetDate: string;
};

export type ImprovementSnapshot = {
  generatedAt: string;
  periodKey: string;
  dayKey: string;
  windowLabel: string;
  metrics: MetricObservation[];
  plans: PlanObservation[];
  signals: BottleneckSignals;
  goals: GoalFact[];
  actions: ActionObservation[];
  completedActions: number;
  failedActions: number;
  previousOverdue: number | null;
};

@Injectable()
export class ImprovementMetricsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly intelligence: BusinessIntelligenceService,
  ) {}

  async load(tenantId: string, measurementDays: number): Promise<ImprovementSnapshot> {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * DAY_MS);
    const previousFrom = new Date(now.getTime() - 60 * DAY_MS);
    const previousTo = from;
    const facts = await this.intelligence.decisionMetrics(tenantId);
    const [
      duration,
      previousDuration,
      previousWorkflowFailures,
      failedSteps,
      retrying,
      providerFailures,
      approvalDelays,
      staleProspects,
      overdueGroups,
      goals,
      snapshots,
      plans,
      milestones,
      actionPlans,
      steps,
      repeated,
    ] = await Promise.all([
      this.duration(tenantId, from, now),
      this.duration(tenantId, previousFrom, previousTo),
      this.workflowFailures(tenantId, previousFrom, previousTo),
      this.countSteps(tenantId, from, 'failed'),
      this.countExecutions(tenantId, from, ['retrying']),
      this.countAgentFailures(tenantId, from, now),
      this.countApprovalDelays(tenantId, now),
      this.countStaleProspects(tenantId, now),
      this.overdueGroups(tenantId, now),
      this.db.select().from(businessGoals).where(eq(businessGoals.tenantId, tenantId)).limit(100),
      this.db
        .select()
        .from(businessGoalSnapshots)
        .where(eq(businessGoalSnapshots.tenantId, tenantId))
        .orderBy(desc(businessGoalSnapshots.snapshotDate))
        .limit(500),
      this.db
        .select()
        .from(strategicPlans)
        .where(and(eq(strategicPlans.tenantId, tenantId), inArray(strategicPlans.status, ['ACTIVE', 'ON_HOLD', 'APPROVED'])))
        .limit(100),
      this.db.select().from(strategicPlanMilestones).where(eq(strategicPlanMilestones.tenantId, tenantId)).limit(400),
      this.db.select().from(strategicActionPlans).where(eq(strategicActionPlans.tenantId, tenantId)).limit(100),
      this.db.select().from(strategicActionSteps).where(eq(strategicActionSteps.tenantId, tenantId)).limit(400),
      this.db
        .select()
        .from(operationalExceptions)
        .where(
          and(
            eq(operationalExceptions.tenantId, tenantId),
            inArray(operationalExceptions.status, ['open', 'acknowledged', 'in_progress']),
          ),
        )
        .limit(100),
    ]);

    const goalFacts = goals.map((goal) => this.goalFact(goal, now));
    const metrics = this.metrics({
      facts,
      duration,
      previousDuration,
      previousWorkflowFailures,
      goals: goalFacts,
      snapshots,
      from,
      previousFrom,
    });
    const planRows = plans.map((plan) => this.planFact(plan, milestones, actionPlans, steps, goalFacts));
    const overdueShare = this.share(overdueGroups);
    const incompleteMilestonePlans = planRows.filter((plan) =>
      plan.milestones.some((item) => item.status !== 'completed' && item.dueDate && new Date(item.dueDate).getTime() < now.getTime()),
    ).length;
    const blocked = steps.filter((step) => step.status === 'failed' || step.status === 'awaiting_approval');
    const waitingPlans = new Set(
      blocked
        .filter((step) => step.status === 'awaiting_approval')
        .map((step) => actionPlans.find((plan) => plan.id === step.actionPlanId)?.planId)
        .filter((id): id is string => Boolean(id)),
    );
    const signals: BottleneckSignals = {
      inactiveLeads: facts.staleNewLeads,
      staleProspects,
      oldPendingProposals: facts.oldPendingProposals,
      overdueTasks: facts.overdueTasks,
      openTasks: facts.overdueTasks + facts.dueNext7Days,
      overdueShare,
      openExceptions: facts.openExceptions,
      repeatedExceptions: repeated
        .filter((item) => item.occurrenceCount >= 2)
        .map((item) => ({ id: item.id, title: item.title, count: item.occurrenceCount })),
      workflowFailures: facts.workflowFailures,
      failedSteps,
      approvalDelays,
      providerFailures,
      retryingExecutions: retrying,
      incompleteMilestonePlans,
      goalsWithoutProgress: goalFacts.filter((goal) => goal.progress === 0).length,
      blockedSteps: blocked.length,
      plansWaitingApproval: waitingPlans.size,
    };
    const actions = this.actions(actionPlans, plans, snapshots, now, measurementDays);
    const previousOverdue = this.previousOverdue(goals, snapshots, previousTo);
    return {
      generatedAt: now.toISOString(),
      periodKey: periodKey(now),
      dayKey: dayKey(now),
      windowLabel: 'previous_30d',
      metrics,
      plans: planRows,
      signals,
      goals: goalFacts,
      actions,
      completedActions: actionPlans.filter((plan) => plan.status === 'completed').length,
      failedActions: actionPlans.filter((plan) => plan.status === 'failed').length,
      previousOverdue,
    };
  }

  private metrics(input: {
    facts: Awaited<ReturnType<BusinessIntelligenceService['decisionMetrics']>>;
    duration: { average: number | null; sample: number };
    previousDuration: { average: number | null; sample: number };
    previousWorkflowFailures: number;
    goals: GoalFact[];
    snapshots: Array<{ goalId: string; metricValue: string | null; snapshotDate: Date }>;
    from: Date;
    previousFrom: Date;
  }): MetricObservation[] {
    const metrics: MetricObservation[] = [
      countMetric('leads_created', 'Leads created', 'higher', input.facts.leadsCreated, input.facts.previousLeads, input.facts.leadsCreated + input.facts.previousLeads, 'Lead rows created in the current 30 days compared with the previous 30 days.'),
      rateMetric(
        'proposal_acceptance_rate',
        'Proposal acceptance rate',
        input.facts.acceptanceRate,
        input.facts.previousAcceptanceRate,
        input.facts.acceptanceSample,
        'Acceptance rate uses decided proposals in each 30-day window. The change is in percentage points.',
      ),
      countMetric('workflow_failure_count', 'Workflow failures', 'lower', input.facts.workflowFailures, input.previousWorkflowFailures, input.facts.workflowFailures + input.previousWorkflowFailures, 'Failed and partially completed workflow executions in the current 30 days compared with the previous 30 days.'),
    ];
    if (input.duration.sample >= 3 && input.previousDuration.sample >= 3) {
      metrics.push(countMetric('task_completion_hours', 'Task completion duration', 'lower', input.duration.average, input.previousDuration.average, input.duration.sample, 'Average hours from task creation to completion. Periods with fewer than three completions are omitted.', 'hours'));
    }
    for (const goal of input.goals) {
      const history = input.snapshots.filter((row) => row.goalId === goal.id);
      const previous = history.length > 1 ? num(history[1]?.metricValue) : null;
      metrics.push({
        key: `goal:${goal.id}`,
        name: goal.name,
        unit: goal.metricKey.includes('rate') ? 'rate' : 'count',
        direction: goal.direction,
        current: goal.current,
        baseline: goal.baseline,
        previous,
        target: goal.target,
        expected: null,
        sample: history.length,
        currency: null,
        expectedCurrency: null,
        comparisonPeriod: 'goal_snapshots',
        evidence: `Goal "${goal.name}" uses ${goal.metricKey}. ${goal.note}`,
      });
    }
    return metrics.filter((metric) => metric.current !== null);
  }

  private goalFact(goal: typeof businessGoals.$inferSelect, now: Date): GoalFact {
    const direction = goal.metricDirection === 'higher' ? 'higher' : 'lower';
    const baseline = num(goal.baselineValue);
    const current = num(goal.currentValue);
    const target = num(goal.targetValue);
    const progress = goalProgress({ direction, baseline, current, target });
    const start = new Date(goal.startDate).getTime();
    const end = new Date(goal.targetDate).getTime();
    const midpointPassed = Number.isFinite(start) && Number.isFinite(end) && now.getTime() > start + (end - start) / 2;
    const behind =
      goal.status === 'active' &&
      midpointPassed &&
      current !== null &&
      target !== null &&
      (direction === 'higher' ? current < target : current > target);
    return {
      id: goal.id,
      name: goal.name,
      metricKey: goal.metricKey,
      direction,
      baseline,
      current,
      target,
      progress: progress.progress,
      note: progress.reason ?? `${progress.progress}% of the way from the baseline to the target.`,
      behind,
      startDate: new Date(goal.startDate).toISOString(),
      targetDate: new Date(goal.targetDate).toISOString(),
    };
  }

  private planFact(
    plan: typeof strategicPlans.$inferSelect,
    milestones: Array<typeof strategicPlanMilestones.$inferSelect>,
    actionPlans: Array<typeof strategicActionPlans.$inferSelect>,
    steps: Array<typeof strategicActionSteps.$inferSelect>,
    goals: GoalFact[],
  ): PlanObservation {
    const metric = isGoalMetric(plan.metricKey) ? plan.metricKey : null;
    const goal = goals.find((item) => item.metricKey === plan.metricKey);
    const linked = actionPlans.filter((item) => item.planId === plan.id);
    const linkedSteps = steps.filter((step) => linked.some((item) => item.id === step.actionPlanId));
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      planKind: plan.planKind,
      targetDate: plan.targetDate ? new Date(plan.targetDate).toISOString() : null,
      createdAt: new Date(plan.createdAt).toISOString(),
      updatedAt: new Date(plan.updatedAt).toISOString(),
      metricKey: metric,
      direction: metric ? (GOAL_METRICS[metric].direction as 'higher' | 'lower') : null,
      baseline: num(plan.baselineValue),
      current: goal?.current ?? null,
      target: num(plan.targetValue),
      milestones: milestones
        .filter((item) => item.planId === plan.id)
        .map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          dueDate: item.dueDate ? new Date(item.dueDate).toISOString() : null,
        })),
      steps: linkedSteps.map((step) => ({
        id: step.id,
        title: step.title,
        status: step.status,
        completedAt: step.completedAt ? new Date(step.completedAt).toISOString() : null,
      })),
    };
  }

  private actions(
    actionPlans: Array<typeof strategicActionPlans.$inferSelect>,
    plans: Array<typeof strategicPlans.$inferSelect>,
    snapshots: Array<{ goalId: string; metricValue: string | null; snapshotDate: Date }>,
    now: Date,
    measurementDays: number,
  ): ActionObservation[] {
    const built = actionPlans.map((action) => {
      const plan = plans.find((item) => item.id === action.planId) ?? null;
      const metricKey = plan && isGoalMetric(plan.metricKey) ? plan.metricKey : null;
      const completedAt = action.status === 'completed' ? new Date(action.updatedAt) : null;
      const periodStart = completedAt ? completedAt.toISOString() : null;
      const periodEnd = completedAt ? new Date(completedAt.getTime() + measurementDays * DAY_MS).toISOString() : null;
      const goalSnapshots = plan?.relatedGoalId
        ? snapshots.filter((row) => row.goalId === plan.relatedGoalId)
        : [];
      const measured = this.measured(goalSnapshots, periodStart, periodEnd, now);
      return {
        actionPlanId: action.id,
        title: action.title,
        status: action.status,
        metricKey,
        goalId: plan?.relatedGoalId ?? null,
        direction: metricKey ? (GOAL_METRICS[metricKey].direction as 'higher' | 'lower') : 'lower',
        baseline: num(plan?.baselineValue),
        measured,
        completedAt: periodStart,
        periodStart,
        periodEnd,
        overlapping: false,
      } satisfies ActionObservation;
    });
    return built.map((action) => ({
      ...action,
      overlapping: built.some(
        (other) =>
          other.actionPlanId !== action.actionPlanId &&
          other.status === 'completed' &&
          action.status === 'completed' &&
          action.periodStart &&
          action.periodEnd &&
          other.periodStart &&
          other.periodEnd &&
          action.metricKey &&
          windowsOverlap(
            { start: action.periodStart, end: action.periodEnd, metricKey: action.metricKey },
            { start: other.periodStart, end: other.periodEnd, metricKey: other.metricKey ?? '' },
          ),
      ),
    }));
  }

  private measured(
    snapshots: Array<{ metricValue: string | null; snapshotDate: Date }>,
    periodStart: string | null,
    periodEnd: string | null,
    now: Date,
  ) {
    if (!periodStart || !periodEnd || now.getTime() < new Date(periodEnd).getTime()) return null;
    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    const matches = snapshots.filter((row) => {
      const time = new Date(row.snapshotDate).getTime();
      return time >= start && time <= end;
    });
    if (matches.length === 0) return null;
    matches.sort((left, right) => new Date(right.snapshotDate).getTime() - new Date(left.snapshotDate).getTime());
    return num(matches[0]?.metricValue);
  }

  private previousOverdue(
    goals: Array<typeof businessGoals.$inferSelect>,
    snapshots: Array<{ goalId: string; metricValue: string | null; snapshotDate: Date }>,
    previousTo: Date,
  ) {
    const goal = goals.find((item) => item.metricKey === 'overdue_task_count');
    if (!goal) return null;
    const prior = snapshots
      .filter((row) => row.goalId === goal.id && new Date(row.snapshotDate).getTime() <= previousTo.getTime())
      .sort((left, right) => new Date(right.snapshotDate).getTime() - new Date(left.snapshotDate).getTime());
    return num(prior[0]?.metricValue);
  }

  private share(groups: Array<{ total: number }>) {
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    if (total === 0) return null;
    const largest = Math.max(...groups.map((group) => group.total));
    return largest / total;
  }

  private async duration(tenantId: string, from: Date, to: Date) {
    const [row] = await this.db
      .select({
        average: sql<number | null>`avg(extract(epoch from (${tasks.completedAt} - ${tasks.createdAt})) / 3600)`,
        total: count(),
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.status, 'completed'),
          isNotNull(tasks.completedAt),
          gte(tasks.completedAt, from),
          lte(tasks.completedAt, to),
        ),
      );
    return { average: num(row?.average), sample: num(row?.total) ?? 0 };
  }

  private async workflowFailures(tenantId: string, from: Date, to: Date) {
    const [row] = await this.db
      .select({ total: count() })
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.tenantId, tenantId),
          inArray(workflowExecutions.status, ['failed', 'partially_completed']),
          gte(workflowExecutions.startedAt, from),
          lt(workflowExecutions.startedAt, to),
        ),
      );
    return num(row?.total) ?? 0;
  }

  private async countSteps(tenantId: string, from: Date, status: string) {
    const [row] = await this.db
      .select({ total: count() })
      .from(workflowExecutionSteps)
      .where(
        and(
          eq(workflowExecutionSteps.tenantId, tenantId),
          eq(workflowExecutionSteps.status, status),
          gte(workflowExecutionSteps.createdAt, from),
        ),
      );
    return num(row?.total) ?? 0;
  }

  private async countExecutions(tenantId: string, from: Date, statuses: string[]) {
    const [row] = await this.db
      .select({ total: count() })
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.tenantId, tenantId),
          inArray(workflowExecutions.status, statuses),
          gte(workflowExecutions.startedAt, from),
        ),
      );
    return num(row?.total) ?? 0;
  }

  private async countAgentFailures(tenantId: string, from: Date, to: Date) {
    const [row] = await this.db
      .select({ total: count() })
      .from(agentRuns)
      .where(
        and(eq(agentRuns.tenantId, tenantId), eq(agentRuns.status, 'failed'), gte(agentRuns.startedAt, from), lte(agentRuns.startedAt, to)),
      );
    return num(row?.total) ?? 0;
  }

  private async countApprovalDelays(tenantId: string, now: Date) {
    const [row] = await this.db
      .select({ total: count() })
      .from(aiApprovals)
      .where(
        and(
          eq(aiApprovals.tenantId, tenantId),
          eq(aiApprovals.status, 'pending'),
          lt(aiApprovals.createdAt, new Date(now.getTime() - 3 * DAY_MS)),
        ),
      );
    return num(row?.total) ?? 0;
  }

  private async countStaleProspects(tenantId: string, now: Date) {
    const [row] = await this.db
      .select({ total: count() })
      .from(prospects)
      .where(
        and(
          eq(prospects.tenantId, tenantId),
          inArray(prospects.status, ['new', 'contacted']),
          lt(prospects.updatedAt, new Date(now.getTime() - 14 * DAY_MS)),
        ),
      );
    return num(row?.total) ?? 0;
  }

  private async overdueGroups(tenantId: string, now: Date) {
    const rows = await this.db
      .select({ total: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          inArray(tasks.status, ['pending', 'in_progress']),
          isNotNull(tasks.dueAt),
          lt(tasks.dueAt, now),
        ),
      )
      .groupBy(tasks.assignedTo);
    return rows.map((row) => ({ total: num(row.total) ?? 0 }));
  }
}

function countMetric(
  key: string,
  name: string,
  direction: 'higher' | 'lower',
  current: number | null,
  previous: number | null,
  sample: number,
  evidence: string,
  unit: MetricObservation['unit'] = 'count',
): MetricObservation {
  return {
    key,
    name,
    unit,
    direction,
    current,
    baseline: previous,
    previous,
    target: null,
    expected: null,
    sample,
    currency: null,
    expectedCurrency: null,
    comparisonPeriod: 'previous_30d',
    evidence,
  };
}

function rateMetric(
  key: string,
  name: string,
  current: number | null,
  previous: number | null,
  sample: number,
  evidence: string,
): MetricObservation {
  return {
    key,
    name,
    unit: 'rate',
    direction: 'higher',
    current,
    baseline: previous,
    previous,
    target: null,
    expected: null,
    sample,
    currency: null,
    expectedCurrency: null,
    comparisonPeriod: 'previous_30d',
    evidence,
  };
}

function num(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
