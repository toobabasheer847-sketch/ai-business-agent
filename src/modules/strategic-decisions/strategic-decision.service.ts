import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, inArray, lte, sql } from 'drizzle-orm';

import { TaskService } from '../../ai/agents/task/task.service';
import {
  evaluateApproval,
  parseExtraApprovalActions,
} from '../../ai/approvals/approval-policy';
import { ApprovalService } from '../../ai/approvals/approval.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { aiApprovals } from '../../database/drizzle/schema/ai-approval.schema';
import { auditLogs } from '../../database/drizzle/schema/audit-log.schema';
import {
  businessGoalSnapshots,
  businessGoals,
  recommendationFeedback,
  strategicActionPlans,
  strategicActionSteps,
  strategicPlanEvents,
  strategicPlanMilestones,
  strategicPlans,
  strategicRecommendations,
} from '../../database/drizzle/schema/strategic-decision.schema';
import { tasks } from '../../database/drizzle/schema/task.schema';
import { tenants } from '../../database/drizzle/schema/tenant.schema';
import { users } from '../../database/drizzle/schema/user.schema';
import { hasPermission, Permission } from '../authorization/permissions';
import { BusinessIntelligenceService } from '../business-intelligence/business-intelligence.service';
import {
  actionStepsFor,
  assertPlanMove,
  buildRecommendations,
  discoverOpportunities,
  evidenceIsCurrent,
  executionKind,
  GOAL_METRICS,
  goalProgress,
  isGoalMetric,
  outcomeWording,
  rankSignals,
  type GoalMetricKey,
  type PlanStatus,
} from './strategic-decision';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_TASKS = ['pending', 'in_progress'] as const;

type Actor = { tenantId: string; userId: string; role?: string };

@Injectable()
export class StrategicDecisionService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly intelligence: BusinessIntelligenceService,
    private readonly tasks: TaskService,
    private readonly configService: ConfigService,
    private readonly approvals: ApprovalService,
  ) {}

  async overview(tenantId: string) {
    const metrics = await this.metrics(tenantId);
    const [plans, goals, recommendations] = await Promise.all([
      this.db
        .select()
        .from(strategicPlans)
        .where(
          and(
            eq(strategicPlans.tenantId, tenantId),
            eq(strategicPlans.status, 'ACTIVE'),
          ),
        )
        .limit(20),
      this.db
        .select()
        .from(businessGoals)
        .where(
          and(
            eq(businessGoals.tenantId, tenantId),
            eq(businessGoals.status, 'active'),
          ),
        )
        .limit(20),
      this.db
        .select()
        .from(strategicRecommendations)
        .where(eq(strategicRecommendations.tenantId, tenantId))
        .orderBy(desc(strategicRecommendations.priorityScore))
        .limit(20),
    ]);
    return {
      window: metrics.window,
      priorities: metrics.priorities.slice(0, 5),
      opportunities: metrics.opportunities,
      recommendations: recommendations
        .filter((row) => row.status === 'open')
        .slice(0, 5),
      plans: await Promise.all(
        plans.map(async (plan) => ({
          ...plan,
          ...(await this.planProgress(tenantId, plan.id)),
        })),
      ),
      goals: goals.map((goal) => this.withProgress(goal)),
      outcomes: this.outcomes(recommendations),
      schedule: {
        mode: 'in_process_cron',
        redisRequired: false,
        note: 'Daily refresh runs in the API process and does not send messages or execute steps. Manual refresh does not need Redis.',
      },
      classification: {
        facts: 'Counts come from stored records.',
        forecasts:
          'Forecasts stay in Business Intelligence and are not treated as results.',
        recommendations:
          'Recommendations are suggestions. They do not guarantee a business result.',
      },
    };
  }

  async recommendations(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: string,
  ) {
    const offset = (page - 1) * limit;
    const where = status
      ? and(
          eq(strategicRecommendations.tenantId, tenantId),
          eq(strategicRecommendations.status, status),
        )
      : eq(strategicRecommendations.tenantId, tenantId);
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(strategicRecommendations)
        .where(where)
        .orderBy(desc(strategicRecommendations.priorityScore))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(strategicRecommendations)
        .where(where),
    ]);
    return { data: rows, total: num(total[0]?.total), page, limit };
  }

  async recommendation(tenantId: string, id: string) {
    return this.requireRecommendation(tenantId, id);
  }

  async refresh(tenantId: string) {
    const metrics = await this.metrics(tenantId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * DAY_MS);
    const from = metrics.window.from ?? now;
    const to = metrics.window.to ?? now;
    for (const draft of metrics.recommendations) {
      await this.db
        .insert(strategicRecommendations)
        .values({
          tenantId,
          recommendationKey: draft.key,
          title: draft.title.slice(0, 200),
          description: draft.description.slice(0, 800),
          category: draft.category,
          priorityScore: draft.score,
          confidenceLevel: draft.confidence,
          evidence: draft.evidence,
          reasoning: draft.reasoning.slice(0, 800),
          suggestedAction: draft.action.slice(0, 400),
          expectedOutcome: draft.outcome.slice(0, 400),
          status: 'open',
          periodStart: from,
          periodEnd: to,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [
            strategicRecommendations.tenantId,
            strategicRecommendations.recommendationKey,
          ],
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            priorityScore: sql`excluded.priority_score`,
            confidenceLevel: sql`excluded.confidence_level`,
            evidence: sql`excluded.evidence`,
            reasoning: sql`excluded.reasoning`,
            suggestedAction: sql`excluded.suggested_action`,
            expectedOutcome: sql`excluded.expected_outcome`,
            periodStart: from,
            periodEnd: to,
            generatedAt: now,
            expiresAt,
            updatedAt: now,
          },
          setWhere: eq(strategicRecommendations.status, 'open'),
        });
    }
    await this.db
      .update(strategicRecommendations)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          eq(strategicRecommendations.tenantId, tenantId),
          eq(strategicRecommendations.status, 'open'),
          lte(strategicRecommendations.expiresAt, now),
        ),
      );
    const snapped = await this.snapshotGoals(tenantId, metrics.values);
    return {
      recommendations: metrics.recommendations.length,
      snapshots: snapped,
      executed: 0,
    };
  }

  async refreshScheduled() {
    const rows = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .limit(50);
    let refreshed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.refresh(row.id);
        refreshed += 1;
      } catch {
        failed += 1;
      }
    }
    return {
      tenants: rows.length,
      refreshed,
      failed,
      capped: rows.length === 50,
    };
  }

  async feedback(
    actor: Actor,
    id: string,
    feedbackType: string,
    reason?: string,
  ) {
    const recommendation = await this.requireRecommendation(actor.tenantId, id);
    await this.db
      .insert(recommendationFeedback)
      .values({
        tenantId: actor.tenantId,
        recommendationId: recommendation.id,
        userId: actor.userId,
        feedbackType,
        feedbackReason: reason?.slice(0, 400) ?? null,
      })
      .onConflictDoUpdate({
        target: [
          recommendationFeedback.recommendationId,
          recommendationFeedback.userId,
        ],
        set: { feedbackType, feedbackReason: reason?.slice(0, 400) ?? null },
      });
    return { id: recommendation.id, feedbackType };
  }

  async decide(actor: Actor, id: string, status: 'accepted' | 'rejected') {
    const recommendation = await this.requireRecommendation(actor.tenantId, id);
    this.assertFresh(recommendation.expiresAt);
    if (recommendation.status !== 'open') {
      throw new ConflictException(
        'Only an open recommendation can be accepted or rejected.',
      );
    }
    if (status === 'accepted')
      await this.assertCurrent(
        actor.tenantId,
        recommendation.recommendationKey,
      );
    const rows = await this.db
      .update(strategicRecommendations)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(strategicRecommendations.id, id),
          eq(strategicRecommendations.tenantId, actor.tenantId),
          eq(strategicRecommendations.status, 'open'),
        ),
      )
      .returning();
    await this.audit(
      actor,
      `strategic.recommendation.${status}`,
      'strategic_recommendation',
      id,
      recommendation.title,
    );
    return rows[0];
  }

  async plans(tenantId: string) {
    const rows = await this.db
      .select()
      .from(strategicPlans)
      .where(eq(strategicPlans.tenantId, tenantId))
      .orderBy(desc(strategicPlans.createdAt))
      .limit(50);
    return {
      data: await Promise.all(
        rows.map(async (plan) => ({
          ...plan,
          ...(await this.planProgress(tenantId, plan.id)),
        })),
      ),
    };
  }

  async createPlan(actor: Actor, input: PlanInput) {
    const metric = this.metricOrThrow(input.metricKey);
    const targetDate = this.futureDate(input.targetDate);
    await this.assertOwner(actor.tenantId, input.ownerId);
    const current = await this.metricValue(actor.tenantId, metric);
    if (current === null) {
      throw new BadRequestException(
        `${GOAL_METRICS[metric].label} cannot be measured yet, so a target was not saved.`,
      );
    }
    const rows = await this.db
      .insert(strategicPlans)
      .values({
        tenantId: actor.tenantId,
        title: input.title.slice(0, 200),
        objective: input.objective.slice(0, 400),
        description: input.description,
        category: input.category.slice(0, 40),
        metricKey: metric,
        baselineValue: current.toFixed(4),
        targetValue: input.targetValue.toFixed(4),
        targetDate,
        ownerId: input.ownerId ?? null,
        status: 'DRAFT',
        createdBy: actor.userId,
      })
      .returning();
    const plan = rows[0];
    await this.event(actor, plan.id, 'created', null, 'DRAFT');
    return { ...plan, ...(await this.planProgress(actor.tenantId, plan.id)) };
  }

  async plan(tenantId: string, id: string) {
    const plan = await this.requirePlan(tenantId, id);
    const milestones = await this.db
      .select()
      .from(strategicPlanMilestones)
      .where(
        and(
          eq(strategicPlanMilestones.tenantId, tenantId),
          eq(strategicPlanMilestones.planId, id),
        ),
      );
    const events = await this.db
      .select()
      .from(strategicPlanEvents)
      .where(
        and(
          eq(strategicPlanEvents.tenantId, tenantId),
          eq(strategicPlanEvents.planId, id),
        ),
      )
      .orderBy(desc(strategicPlanEvents.createdAt))
      .limit(50);
    return {
      ...plan,
      milestones,
      events,
      ...(await this.planProgress(tenantId, id)),
    };
  }

  async updatePlan(actor: Actor, id: string, input: Partial<PlanInput>) {
    const plan = await this.requirePlan(actor.tenantId, id);
    if (plan.status === 'COMPLETED' || plan.status === 'CANCELLED') {
      throw new ConflictException('A closed plan cannot be edited.');
    }
    if (input.ownerId) await this.assertOwner(actor.tenantId, input.ownerId);
    const targetDate = input.targetDate
      ? this.futureDate(input.targetDate)
      : undefined;
    const rows = await this.db
      .update(strategicPlans)
      .set({
        title: input.title?.slice(0, 200) ?? plan.title,
        objective: input.objective?.slice(0, 400) ?? plan.objective,
        description: input.description ?? plan.description,
        targetValue:
          input.targetValue === undefined
            ? plan.targetValue
            : input.targetValue.toFixed(4),
        targetDate: targetDate ?? plan.targetDate,
        ownerId: input.ownerId === undefined ? plan.ownerId : input.ownerId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(strategicPlans.id, id),
          eq(strategicPlans.tenantId, actor.tenantId),
        ),
      )
      .returning();
    await this.event(actor, id, 'updated', plan.status, plan.status);
    return rows[0];
  }

  async movePlan(actor: Actor, id: string, status: PlanStatus) {
    const plan = await this.requirePlan(actor.tenantId, id);
    try {
      assertPlanMove(plan.status, status);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid plan status.',
      );
    }
    const rows = await this.db
      .update(strategicPlans)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(strategicPlans.id, id),
          eq(strategicPlans.tenantId, actor.tenantId),
        ),
      )
      .returning();
    await this.event(actor, id, 'status', plan.status, status);
    return rows[0];
  }

  async addMilestone(
    actor: Actor,
    planId: string,
    title: string,
    description: string,
  ) {
    await this.requirePlan(actor.tenantId, planId);
    const rows = await this.db
      .insert(strategicPlanMilestones)
      .values({
        tenantId: actor.tenantId,
        planId,
        title: title.slice(0, 200),
        description: description.slice(0, 400),
        status: 'pending',
      })
      .returning();
    return rows[0];
  }

  async completeMilestone(actor: Actor, planId: string, milestoneId: string) {
    await this.requirePlan(actor.tenantId, planId);
    const rows = await this.db
      .update(strategicPlanMilestones)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(strategicPlanMilestones.id, milestoneId),
          eq(strategicPlanMilestones.planId, planId),
          eq(strategicPlanMilestones.tenantId, actor.tenantId),
          eq(strategicPlanMilestones.status, 'pending'),
        ),
      )
      .returning();
    if (!rows[0]) throw new NotFoundException('Milestone not found.');
    return rows[0];
  }

  async actionPlans(tenantId: string) {
    const rows = await this.db
      .select()
      .from(strategicActionPlans)
      .where(eq(strategicActionPlans.tenantId, tenantId))
      .orderBy(desc(strategicActionPlans.createdAt))
      .limit(50);
    const data = await Promise.all(
      rows.map((row) => this.actionPlan(tenantId, row.id)),
    );
    return { data };
  }

  async createActionPlan(
    actor: Actor,
    recommendationId: string,
    planId?: string,
  ) {
    const recommendation = await this.requireRecommendation(
      actor.tenantId,
      recommendationId,
    );
    if (recommendation.status !== 'accepted') {
      throw new ConflictException(
        'Accept the recommendation before creating an action plan.',
      );
    }
    this.assertFresh(recommendation.expiresAt);
    await this.assertCurrent(actor.tenantId, recommendation.recommendationKey);
    if (planId) await this.requirePlan(actor.tenantId, planId);
    const existing = await this.db
      .select()
      .from(strategicActionPlans)
      .where(
        and(
          eq(strategicActionPlans.tenantId, actor.tenantId),
          eq(strategicActionPlans.recommendationId, recommendationId),
        ),
      )
      .limit(1);
    if (existing[0]) return this.actionPlan(actor.tenantId, existing[0].id);
    const created = await this.db
      .insert(strategicActionPlans)
      .values({
        tenantId: actor.tenantId,
        recommendationId,
        planId: planId ?? null,
        title: recommendation.title,
        description: recommendation.suggestedAction,
        status: 'ready',
        createdBy: actor.userId,
      })
      .returning();
    const plan = created[0];
    const steps = actionStepsFor(recommendation.title);
    for (const [index, step] of steps.entries()) {
      await this.db.insert(strategicActionSteps).values({
        tenantId: actor.tenantId,
        actionPlanId: plan.id,
        position: index + 1,
        title: step.title,
        description: step.description,
        actionType: step.actionType,
        status: 'pending',
      });
    }
    await this.audit(
      actor,
      'strategic.action_plan.created',
      'strategic_action_plan',
      plan.id,
      plan.title,
    );
    return this.actionPlan(actor.tenantId, plan.id);
  }

  async actionPlan(tenantId: string, id: string) {
    const plan = await this.requireActionPlan(tenantId, id);
    const steps = await this.db
      .select()
      .from(strategicActionSteps)
      .where(
        and(
          eq(strategicActionSteps.tenantId, tenantId),
          eq(strategicActionSteps.actionPlanId, id),
        ),
      )
      .orderBy(strategicActionSteps.position);
    return { ...plan, steps };
  }

  async executeActionPlan(actor: Actor, id: string) {
    const plan = await this.actionPlan(actor.tenantId, id);
    if (plan.status === 'cancelled' || plan.status === 'completed') {
      throw new ConflictException('This action plan is closed.');
    }
    const recommendation = await this.requireRecommendation(
      actor.tenantId,
      plan.recommendationId,
    );
    this.assertFresh(recommendation.expiresAt);
    await this.assertCurrent(actor.tenantId, recommendation.recommendationKey);
    await this.db
      .update(strategicActionPlans)
      .set({ status: 'executing', updatedAt: new Date() })
      .where(
        and(
          eq(strategicActionPlans.id, id),
          eq(strategicActionPlans.tenantId, actor.tenantId),
        ),
      );
    for (const step of plan.steps) {
      if (
        step.status === 'completed' ||
        step.status === 'cancelled' ||
        step.status === 'awaiting_approval'
      )
        continue;
      await this.executeStep(actor, step, recommendation.title);
    }
    return this.finishActionPlan(actor.tenantId, id);
  }

  async cancelActionPlan(actor: Actor, id: string) {
    const plan = await this.requireActionPlan(actor.tenantId, id);
    if (plan.status === 'completed')
      throw new ConflictException('A completed action plan stays in history.');
    await this.db
      .update(strategicActionPlans)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(strategicActionPlans.id, id),
          eq(strategicActionPlans.tenantId, actor.tenantId),
        ),
      );
    await this.db
      .update(strategicActionSteps)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(strategicActionSteps.tenantId, actor.tenantId),
          eq(strategicActionSteps.actionPlanId, id),
          inArray(strategicActionSteps.status, ['pending', 'failed']),
        ),
      );
    return this.actionPlan(actor.tenantId, id);
  }

  async completeStep(actor: Actor, actionPlanId: string, stepId: string) {
    const step = await this.requireStep(actor.tenantId, actionPlanId, stepId);
    if (step.actionType !== 'review') {
      throw new BadRequestException(
        'Only the review step can be marked complete by hand.',
      );
    }
    if (step.status !== 'pending')
      throw new ConflictException('This step is not pending.');
    await this.db
      .update(strategicActionSteps)
      .set({
        status: 'completed',
        completedAt: new Date(),
        note: 'Marked complete by a person.',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(strategicActionSteps.id, stepId),
          eq(strategicActionSteps.tenantId, actor.tenantId),
        ),
      );
    return this.finishActionPlan(actor.tenantId, actionPlanId);
  }

  async goals(tenantId: string) {
    const rows = await this.db
      .select()
      .from(businessGoals)
      .where(eq(businessGoals.tenantId, tenantId))
      .orderBy(desc(businessGoals.createdAt))
      .limit(50);
    return { data: rows.map((goal) => this.withProgress(goal)) };
  }

  async createGoal(actor: Actor, input: GoalInput) {
    const metric = this.metricOrThrow(input.metricKey);
    const direction = GOAL_METRICS[metric].direction;
    const targetDate = this.futureDate(input.targetDate);
    await this.assertOwner(actor.tenantId, input.ownerId);
    const current = await this.metricValue(actor.tenantId, metric);
    if (current === null) {
      throw new BadRequestException(
        `${GOAL_METRICS[metric].label} cannot be measured yet.`,
      );
    }
    const rows = await this.db
      .insert(businessGoals)
      .values({
        tenantId: actor.tenantId,
        name: input.name.slice(0, 200),
        description: input.description.slice(0, 800),
        metricKey: metric,
        metricDirection: direction,
        baselineValue: current.toFixed(4),
        currentValue: current.toFixed(4),
        targetValue: input.targetValue.toFixed(4),
        startDate: new Date(),
        targetDate,
        ownerId: input.ownerId ?? null,
        status: 'active',
        createdBy: actor.userId,
      })
      .returning();
    await this.insertSnapshot(actor.tenantId, rows[0].id, current);
    return this.withProgress(rows[0]);
  }

  async goal(tenantId: string, id: string) {
    const goal = await this.requireGoal(tenantId, id);
    const current = await this.metricValue(
      tenantId,
      goal.metricKey as GoalMetricKey,
    );
    return this.withProgress({
      ...goal,
      currentValue: current === null ? goal.currentValue : current.toFixed(4),
    });
  }

  async updateGoal(actor: Actor, id: string, input: Partial<GoalInput>) {
    const goal = await this.requireGoal(actor.tenantId, id);
    if (goal.status !== 'active')
      throw new ConflictException('Only an active goal can be edited.');
    const rows = await this.db
      .update(businessGoals)
      .set({
        name: input.name?.slice(0, 200) ?? goal.name,
        description: input.description?.slice(0, 800) ?? goal.description,
        targetValue:
          input.targetValue === undefined
            ? goal.targetValue
            : input.targetValue.toFixed(4),
        targetDate: input.targetDate
          ? this.futureDate(input.targetDate)
          : goal.targetDate,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(businessGoals.id, id),
          eq(businessGoals.tenantId, actor.tenantId),
        ),
      )
      .returning();
    return this.withProgress(rows[0]);
  }

  async goalHistory(tenantId: string, id: string) {
    await this.requireGoal(tenantId, id);
    const rows = await this.db
      .select()
      .from(businessGoalSnapshots)
      .where(
        and(
          eq(businessGoalSnapshots.tenantId, tenantId),
          eq(businessGoalSnapshots.goalId, id),
        ),
      )
      .orderBy(desc(businessGoalSnapshots.snapshotDate))
      .limit(366);
    const oldest = rows[rows.length - 1];
    const newest = rows[0];
    return {
      data: rows,
      comparison:
        rows.length < 2
          ? 'A before-and-after comparison needs at least two snapshots.'
          : outcomeWording(
              oldest.metricValue === null ? null : Number(oldest.metricValue),
              newest.metricValue === null ? null : Number(newest.metricValue),
              'The goal metric',
            ),
    };
  }

  async answer(actor: Actor, message: string) {
    const metrics = await this.metrics(actor.tenantId);
    const lines = [
      'Strategic priorities for the last 30 days (UTC). Counts come from stored records. Recommendations are suggestions and were not executed.',
    ];
    if (metrics.priorities.length === 0) {
      lines.push('No configured priority rule matched this period.');
    }
    for (const priority of metrics.priorities.slice(0, 3)) {
      lines.push(
        `${priority.score}: ${priority.title}. ${priority.evidence} Suggested action: ${priority.action}`,
      );
    }
    for (const item of metrics.opportunities)
      lines.push(`Opportunity: ${item.name}. ${item.benefit}`);
    if (/plan to reduce overdue/i.test(message)) {
      const draft = await this.ensureOverdueDraft(
        actor,
        metrics.values.overdue_task_count,
      );
      lines.push(draft);
    }
    if (/goals progressing/i.test(message)) {
      const goals = await this.goals(actor.tenantId);
      lines.push(
        goals.data.length === 0
          ? 'No business goals are saved.'
          : goals.data
              .map(
                (goal) =>
                  `${goal.name}: ${goal.progressNote ?? `${goal.progress}%`}`,
              )
              .join(' '),
      );
    }
    if (/recommendations have been successful/i.test(message)) {
      const saved = await this.recommendations(actor.tenantId, 1, 50);
      const outcome = this.outcomes(saved.data);
      lines.push(outcome.summary);
    }
    return { summary: lines.join('\n') };
  }

  private async metrics(tenantId: string) {
    const facts = await this.intelligence.decisionMetrics(tenantId);
    const pending = await this.db
      .select({ total: count() })
      .from(aiApprovals)
      .where(
        and(
          eq(aiApprovals.tenantId, tenantId),
          eq(aiApprovals.status, 'pending'),
        ),
      );
    const signals = facts.risks.map((risk) => ({
      key: risk.key,
      title: risk.title,
      description: risk.evidence,
      severity: risk.severity,
      confidence: risk.confidence,
      evidence: risk.evidence,
      action: risk.action,
    }));
    const pendingCount = num(pending[0]?.total);
    if (pendingCount >= 1) {
      signals.push({
        key: 'pending_approvals',
        title: 'Approvals are waiting',
        description: `${pendingCount} approval requests are pending.`,
        severity: pendingCount >= 3 ? 'high' : 'medium',
        confidence: 'HIGH',
        evidence: `${pendingCount} approval requests are pending in the Approval Center.`,
        action:
          'Review the Approval Center. This screen does not approve them.',
      });
    }
    const priorities = rankSignals(signals);
    const opportunities = discoverOpportunities({
      staleNewLeads: facts.staleNewLeads,
      expiringProposals: facts.expiringProposals,
      leadsCreated: facts.leadsCreated,
      previousLeads: facts.previousLeads,
      acceptanceRate: facts.acceptanceRate,
      previousAcceptanceRate: facts.previousAcceptanceRate,
      acceptanceSample: facts.acceptanceSample,
      previousAcceptanceSample: facts.previousAcceptanceSample,
      workflowFailures: facts.workflowFailures,
    });
    const values: Record<GoalMetricKey, number | null> = {
      overdue_task_count: facts.overdueTasks,
      stale_lead_count: facts.staleNewLeads,
      open_exception_count: facts.openExceptions,
      workflow_failure_count: facts.workflowFailures,
      proposal_acceptance_rate: facts.acceptanceRate,
      leads_created: facts.leadsCreated,
    };
    return {
      window: facts.window,
      priorities,
      opportunities,
      recommendations: buildRecommendations(priorities, opportunities),
      values,
      keys: [
        ...priorities.map((item) => item.key),
        ...opportunities.map((item) => item.key),
      ],
    };
  }

  private async executeStep(
    actor: Actor,
    step: typeof strategicActionSteps.$inferSelect,
    title: string,
  ) {
    const extra = parseExtraApprovalActions(
      this.configService.get<string>('AI_APPROVAL_EXTRA_ACTIONS'),
    );
    const approvalRequired =
      step.actionType === 'create_task' &&
      evaluateApproval('task.create', extra).required;
    const kind = executionKind(step.actionType, approvalRequired);
    if (kind === 'manual') return;
    if (kind === 'blocked_sensitive' || kind === 'unsupported') {
      await this.markStep(
        actor.tenantId,
        step.id,
        'failed',
        null,
        'This step is not executed from a recommendation.',
      );
      return;
    }
    if (kind === 'await_approval') {
      const proposed = await this.approvals.propose({
        tenantId: actor.tenantId,
        userId: actor.userId,
        role: actor.role,
        actionType: 'task.create',
        title: step.title.slice(0, 200),
        description:
          'Creating this task is on the configured approval list. It was not saved.',
        targetEntityType: 'strategic_action_step',
        targetEntityId: step.id,
        payload: { title: step.title, description: step.description },
        agentName: 'strategic-decision',
      });
      await this.markStep(
        actor.tenantId,
        step.id,
        'awaiting_approval',
        null,
        'Waiting in the Approval Center.',
        proposed.approval?.id ?? null,
      );
      return;
    }
    if (kind === 'start_workflow') {
      if (!hasPermission(actor.role, Permission.WorkflowManage)) {
        await this.markStep(
          actor.tenantId,
          step.id,
          'failed',
          null,
          'Workflow execution requires workflow.manage.',
        );
        return;
      }
      await this.markStep(
        actor.tenantId,
        step.id,
        'failed',
        null,
        'No workflow was named on this step, so none was started.',
      );
      return;
    }
    if (!hasPermission(actor.role, Permission.TaskCreate)) {
      await this.markStep(
        actor.tenantId,
        step.id,
        'failed',
        null,
        'Creating a task requires task.create.',
      );
      return;
    }
    const taskTitle = step.title.slice(0, 255);
    const existing = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, actor.tenantId),
          eq(tasks.title, taskTitle),
          inArray(tasks.status, OPEN_TASKS),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await this.markStep(
        actor.tenantId,
        step.id,
        'completed',
        existing[0].id,
        'An open task with this title already exists and was reused.',
      );
      return;
    }
    try {
      const created = await this.tasks.createTask(
        {
          title: taskTitle,
          description: `${step.description} Evidence: ${title}`.slice(0, 2000),
          priority: 'medium',
        },
        { tenantId: actor.tenantId, userId: actor.userId, role: actor.role },
      );
      await this.markStep(
        actor.tenantId,
        step.id,
        'completed',
        created.id,
        'Internal task created. No customer message was sent.',
      );
      await this.audit(
        actor,
        'strategic.task_created',
        'task',
        created.id,
        taskTitle,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Task creation failed.';
      await this.markStep(
        actor.tenantId,
        step.id,
        'failed',
        null,
        message.slice(0, 400),
      );
    }
  }

  private async finishActionPlan(tenantId: string, id: string) {
    const plan = await this.actionPlan(tenantId, id);
    const statuses = plan.steps.map((step) => step.status);
    let status = plan.status;
    if (
      statuses.every((item) => item === 'completed' || item === 'cancelled') &&
      statuses.some((item) => item === 'completed')
    )
      status = 'completed';
    else if (statuses.some((item) => item === 'failed')) status = 'failed';
    else if (
      statuses.some(
        (item) => item === 'awaiting_approval' || item === 'pending',
      )
    )
      status = 'executing';
    await this.db
      .update(strategicActionPlans)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(strategicActionPlans.id, id),
          eq(strategicActionPlans.tenantId, tenantId),
        ),
      );
    return this.actionPlan(tenantId, id);
  }

  private async markStep(
    tenantId: string,
    id: string,
    status: string,
    reference: string | null,
    note: string,
    approvalId?: string | null,
  ) {
    await this.db
      .update(strategicActionSteps)
      .set({
        status,
        executionReference: reference,
        approvalId: approvalId ?? null,
        note: note.slice(0, 400),
        completedAt: status === 'completed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(strategicActionSteps.id, id),
          eq(strategicActionSteps.tenantId, tenantId),
        ),
      );
  }

  private async snapshotGoals(
    tenantId: string,
    values: Record<GoalMetricKey, number | null>,
  ) {
    const goals = await this.db
      .select()
      .from(businessGoals)
      .where(
        and(
          eq(businessGoals.tenantId, tenantId),
          eq(businessGoals.status, 'active'),
        ),
      );
    let saved = 0;
    for (const goal of goals) {
      if (!isGoalMetric(goal.metricKey)) continue;
      const value = values[goal.metricKey];
      if (value === null) continue;
      await this.db
        .update(businessGoals)
        .set({ currentValue: value.toFixed(4), updatedAt: new Date() })
        .where(
          and(
            eq(businessGoals.id, goal.id),
            eq(businessGoals.tenantId, tenantId),
          ),
        );
      await this.insertSnapshot(tenantId, goal.id, value);
      saved += 1;
    }
    return saved;
  }

  private async insertSnapshot(
    tenantId: string,
    goalId: string,
    value: number,
  ) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    await this.db
      .insert(businessGoalSnapshots)
      .values({
        tenantId,
        goalId,
        metricValue: value.toFixed(4),
        snapshotDate: day,
      })
      .onConflictDoNothing();
  }

  private async ensureOverdueDraft(actor: Actor, baseline: number | null) {
    if (baseline === null)
      return 'A draft plan was not created because the overdue count is unavailable.';
    const existing = await this.db
      .select()
      .from(strategicPlans)
      .where(
        and(
          eq(strategicPlans.tenantId, actor.tenantId),
          eq(strategicPlans.title, 'Reduce overdue tasks'),
          inArray(strategicPlans.status, ['DRAFT', 'ACTIVE', 'ON_HOLD']),
        ),
      )
      .limit(1);
    if (existing[0])
      return `Draft plan "${existing[0].title}" already exists and was not activated.`;
    await this.createPlan(actor, {
      title: 'Reduce overdue tasks',
      objective: 'Reduce the current overdue task count.',
      description: `The baseline is ${baseline} overdue open tasks. The target is the same number until you set a lower target. The plan is a draft and was not activated.`,
      category: 'operations',
      metricKey: 'overdue_task_count',
      targetValue: baseline,
      targetDate: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    });
    return `A draft plan "Reduce overdue tasks" was saved with baseline ${baseline}. It was not activated, and no tasks were created.`;
  }

  private async metricValue(tenantId: string, metric: GoalMetricKey) {
    const metrics = await this.metrics(tenantId);
    return metrics.values[metric];
  }

  private withProgress(goal: typeof businessGoals.$inferSelect) {
    const direction = goal.metricDirection === 'lower' ? 'lower' : 'higher';
    const result = goalProgress({
      direction,
      baseline: goal.baselineValue === null ? null : Number(goal.baselineValue),
      current: goal.currentValue === null ? null : Number(goal.currentValue),
      target: goal.targetValue === null ? null : Number(goal.targetValue),
    });
    return {
      ...goal,
      progress: result.progress,
      progressNote:
        result.reason ??
        `${result.progress}% of the gap from the baseline to the target. This is not a cause.`,
    };
  }

  private outcomes(rows: Array<{ status: string }>) {
    const accepted = rows.filter((row) => row.status === 'accepted').length;
    const rejected = rows.filter((row) => row.status === 'rejected').length;
    const decided = accepted + rejected;
    return {
      accepted,
      rejected,
      acceptanceRate:
        decided === 0 ? null : Math.round((accepted / decided) * 1000) / 10,
      summary:
        decided === 0
          ? 'No recommendation has been accepted or rejected yet. That is not a business result.'
          : `${accepted} of ${decided} decided recommendations were accepted. This is user feedback, not a measured business result.`,
    };
  }

  private async planProgress(tenantId: string, planId: string) {
    const rows = await this.db
      .select()
      .from(strategicPlanMilestones)
      .where(
        and(
          eq(strategicPlanMilestones.tenantId, tenantId),
          eq(strategicPlanMilestones.planId, planId),
        ),
      );
    if (rows.length === 0)
      return {
        progress: null,
        progressNote: 'Add milestones before progress can be calculated.',
      };
    const done = rows.filter((row) => row.status === 'completed').length;
    return {
      progress: Math.round((done / rows.length) * 100),
      progressNote: `${done} of ${rows.length} milestones are complete.`,
    };
  }

  private async assertCurrent(tenantId: string, key: string) {
    const metrics = await this.metrics(tenantId);
    if (
      !evidenceIsCurrent(
        key,
        metrics.keys,
        new Date(Date.now() + DAY_MS),
        new Date(),
      )
    ) {
      throw new ConflictException(
        'The evidence for this recommendation is no longer present, so it was not executed.',
      );
    }
  }

  private assertFresh(expiresAt: Date) {
    if (expiresAt.getTime() <= Date.now())
      throw new ConflictException(
        'This recommendation has expired. Refresh before acting on it.',
      );
  }

  private metricOrThrow(value: string): GoalMetricKey {
    if (!isGoalMetric(value))
      throw new BadRequestException('That metric is not available for a goal.');
    return value;
  }

  private futureDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - DAY_MS) {
      throw new BadRequestException('The target date must be today or later.');
    }
    return date;
  }

  private async assertOwner(tenantId: string, ownerId?: string) {
    if (!ownerId) return;
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, ownerId), eq(users.tenantId, tenantId)))
      .limit(1);
    if (!rows[0])
      throw new BadRequestException('The owner must belong to this tenant.');
  }

  private async requireRecommendation(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(strategicRecommendations)
      .where(
        and(
          eq(strategicRecommendations.id, id),
          eq(strategicRecommendations.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Recommendation not found.');
    return rows[0];
  }

  private async requirePlan(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(strategicPlans)
      .where(
        and(eq(strategicPlans.id, id), eq(strategicPlans.tenantId, tenantId)),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Plan not found.');
    return rows[0];
  }

  private async requireActionPlan(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(strategicActionPlans)
      .where(
        and(
          eq(strategicActionPlans.id, id),
          eq(strategicActionPlans.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Action plan not found.');
    return rows[0];
  }

  private async requireStep(
    tenantId: string,
    actionPlanId: string,
    stepId: string,
  ) {
    const rows = await this.db
      .select()
      .from(strategicActionSteps)
      .where(
        and(
          eq(strategicActionSteps.id, stepId),
          eq(strategicActionSteps.actionPlanId, actionPlanId),
          eq(strategicActionSteps.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Action step not found.');
    return rows[0];
  }

  private async requireGoal(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(businessGoals)
      .where(
        and(eq(businessGoals.id, id), eq(businessGoals.tenantId, tenantId)),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Goal not found.');
    return rows[0];
  }

  private async event(
    actor: Actor,
    planId: string,
    event: string,
    fromStatus: string | null,
    toStatus: string,
  ) {
    await this.db.insert(strategicPlanEvents).values({
      tenantId: actor.tenantId,
      planId,
      event,
      fromStatus,
      toStatus,
      actorId: actor.userId,
    });
  }

  private async audit(
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    description: string,
  ) {
    await this.db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action,
      entityType,
      entityId,
      description: description.slice(0, 500),
      metadata: {},
    });
  }
}

type PlanInput = {
  title: string;
  objective: string;
  description: string;
  category: string;
  metricKey: string;
  targetValue: number;
  targetDate: string;
  ownerId?: string;
};

type GoalInput = {
  name: string;
  description: string;
  metricKey: string;
  targetValue: number;
  targetDate: string;
  ownerId?: string;
};

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
