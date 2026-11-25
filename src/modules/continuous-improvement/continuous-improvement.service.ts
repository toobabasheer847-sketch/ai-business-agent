import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import { AgentRunTracker } from '../../ai/monitoring/agent-run.tracker';
import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import {
  businessBottlenecks,
  businessImprovementReviews,
  businessPerformanceDeviations,
  improvementOutcomeEvaluations,
} from '../../database/drizzle/schema/continuous-improvement.schema';
import {
  businessGoals,
  recommendationFeedback,
  strategicPlanEvents,
  strategicPlanMilestones,
  strategicPlans,
  strategicRecommendations,
} from '../../database/drizzle/schema/strategic-decision.schema';
import { tenants } from '../../database/drizzle/schema/tenant.schema';
import { users } from '../../database/drizzle/schema/user.schema';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { hasPermission, Permission } from '../authorization/permissions';
import {
  assertPlanMove,
  GOAL_METRICS,
  isGoalMetric,
  type GoalMetricKey,
  type PlanStatus,
} from '../strategic-decisions/strategic-decision';
import {
  dayKey,
  executionPolicy,
  improvementJobId,
  parseThresholds,
  queueFailureReport,
  rejectForeignTenant,
  summarizeReview,
  type RecommendationDraft,
  type Thresholds,
} from './continuous-improvement';
import {
  BottleneckDetectionService,
  buildReview,
  ImprovementCycleService,
  ImprovementEvidenceService,
  ImprovementOpportunityService,
  ImprovementRecommendationService,
  OutcomeAnalysisService,
  PerformanceEvaluationService,
  PlanProgressMonitoringService,
} from './improvement-engines';
import { ImprovementHistoryService } from './improvement-history.service';
import { ImprovementMetricsService, type ImprovementSnapshot } from './improvement-metrics.service';

const DAY_MS = 24 * 60 * 60 * 1000;
export const IMPROVEMENT_MONITOR_JOB = 'monitor-tenant';

type Actor = { tenantId: string; userId: string; role?: string };

type MonitorResult = {
  deviations: number;
  bottlenecks: number;
  recommendations: number;
  executed: number;
};

type PlanInput = {
  title: string;
  objective: string;
  description: string;
  category: string;
  metricKey: string;
  targetValue: number;
  targetDate: string;
  ownerId?: string;
  goalId?: string;
  recommendationId?: string;
  reviewSchedule?: 'weekly' | 'monthly' | 'custom';
  milestones?: string[];
  approvalRequired?: boolean;
};

@Injectable()
export class ContinuousImprovementService {
  private readonly running = new Map<string, Promise<MonitorResult>>();

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly configService: ConfigService,
    private readonly metrics: ImprovementMetricsService,
    private readonly history: ImprovementHistoryService,
    private readonly cycle: ImprovementCycleService,
    private readonly evaluation: PerformanceEvaluationService,
    private readonly planMonitor: PlanProgressMonitoringService,
    private readonly bottlenecks: BottleneckDetectionService,
    private readonly opportunities: ImprovementOpportunityService,
    private readonly recommendations: ImprovementRecommendationService,
    private readonly evidence: ImprovementEvidenceService,
    private readonly outcomes: OutcomeAnalysisService,
    @InjectQueue(QUEUE_NAMES.CONTINUOUS_IMPROVEMENT) private readonly queue: Queue,
    @Optional() private readonly tracker?: AgentRunTracker,
  ) {}

  schedulerAvailable() {
    return Boolean(this.configService.get<string>('REDIS_URL') || this.configService.get<string>('redis.url'));
  }

  async overview(actor: Actor) {
    this.allow(actor);
    const picture = await this.picture(actor.tenantId);
    const [savedOutcomes, completedReviews] = await Promise.all([
      this.db
        .select()
        .from(improvementOutcomeEvaluations)
        .where(eq(improvementOutcomeEvaluations.tenantId, actor.tenantId))
        .orderBy(desc(improvementOutcomeEvaluations.evaluatedAt))
        .limit(8),
      this.db
        .select({ total: count() })
        .from(businessImprovementReviews)
        .where(and(eq(businessImprovementReviews.tenantId, actor.tenantId), eq(businessImprovementReviews.status, 'completed'))),
    ]);
    return {
      ...picture.view,
      outcomes: savedOutcomes,
      schedule: this.scheduleNote(),
      cycle: this.cycle.stage({
        hasMetrics: picture.snapshot.metrics.length > 0,
        hasFindings: picture.view.deviations.length + picture.view.bottlenecks.length > 0,
        hasRecommendations: picture.view.recommendations.length > 0,
        hasActivePlan: picture.view.activePlans.length > 0,
        hasPendingApproval: picture.snapshot.signals.approvalDelays + picture.snapshot.signals.plansWaitingApproval > 0,
        hasExecution: picture.snapshot.completedActions + picture.snapshot.failedActions > 0,
        hasPendingMeasurement: picture.evaluated.some((item) => item.status === 'PENDING_MEASUREMENT'),
        hasEvaluation: picture.evaluated.some((item) => item.status !== 'NOT_EVALUATED' && item.status !== 'PENDING_MEASUREMENT'),
        hasCompletedReview: Number(completedReviews[0]?.total ?? 0) > 0,
      }),
      classification: {
        observed: 'Counts and assessments come from stored records.',
        causal: 'Observed changes are not described as caused by an action.',
        execution: 'No sensitive action is executed from this overview.',
      },
    };
  }

  async deviations(actor: Actor, query: { page: number; limit: number; metricKey?: string; deviationType?: string; from?: Date; to?: Date }) {
    this.allow(actor);
    const filters = [eq(businessPerformanceDeviations.tenantId, actor.tenantId)];
    if (query.metricKey) filters.push(eq(businessPerformanceDeviations.metricKey, query.metricKey));
    if (query.deviationType) filters.push(eq(businessPerformanceDeviations.deviationType, query.deviationType));
    if (query.from) filters.push(gte(businessPerformanceDeviations.detectedAt, query.from));
    if (query.to) filters.push(lte(businessPerformanceDeviations.detectedAt, query.to));
    const where = and(...filters);
    const [rows, total] = await Promise.all([
      this.db.select().from(businessPerformanceDeviations).where(where).orderBy(desc(businessPerformanceDeviations.detectedAt)).limit(query.limit).offset((query.page - 1) * query.limit),
      this.db.select({ total: count() }).from(businessPerformanceDeviations).where(where),
    ]);
    return { data: rows, total: Number(total[0]?.total ?? 0), page: query.page, limit: query.limit };
  }

  async bottleneckList(actor: Actor, query: { page: number; limit: number; status?: string; category?: string }) {
    this.allow(actor);
    const filters = [eq(businessBottlenecks.tenantId, actor.tenantId)];
    if (query.status) filters.push(eq(businessBottlenecks.status, query.status));
    if (query.category) filters.push(eq(businessBottlenecks.category, query.category));
    const where = and(...filters);
    const [rows, total] = await Promise.all([
      this.db.select().from(businessBottlenecks).where(where).orderBy(desc(businessBottlenecks.detectedAt)).limit(query.limit).offset((query.page - 1) * query.limit),
      this.db.select({ total: count() }).from(businessBottlenecks).where(where),
    ]);
    return { data: rows, total: Number(total[0]?.total ?? 0), page: query.page, limit: query.limit };
  }

  async reviewBottleneck(actor: Actor, id: string) {
    this.allow(actor);
    const row = await this.requireBottleneck(actor.tenantId, id);
    if (row.status === 'resolved') throw new ConflictException('A resolved bottleneck stays in history.');
    const rows = await this.db
      .update(businessBottlenecks)
      .set({ status: 'reviewed', updatedAt: new Date() })
      .where(and(eq(businessBottlenecks.id, id), eq(businessBottlenecks.tenantId, actor.tenantId), eq(businessBottlenecks.status, 'open')))
      .returning();
    if (!rows[0]) throw new ConflictException('Only an open bottleneck can be marked reviewed.');
    await this.history.record(actor.tenantId, {
      eventType: 'bottleneck_reviewed',
      relatedEntityType: 'business_bottleneck',
      relatedEntityId: id,
      actorId: actor.userId,
      metadata: { status: 'reviewed' },
    });
    return rows[0];
  }

  async resolveBottleneck(actor: Actor, id: string) {
    this.allow(actor);
    const row = await this.requireBottleneck(actor.tenantId, id);
    if (row.status === 'resolved') return row;
    const rows = await this.db
      .update(businessBottlenecks)
      .set({ status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(businessBottlenecks.id, id), eq(businessBottlenecks.tenantId, actor.tenantId)))
      .returning();
    await this.history.record(actor.tenantId, {
      eventType: 'bottleneck_resolved',
      relatedEntityType: 'business_bottleneck',
      relatedEntityId: id,
      actorId: actor.userId,
      metadata: { status: 'resolved' },
    });
    return rows[0];
  }

  async recommendationList(actor: Actor, page: number, limit: number, status?: string) {
    this.allow(actor);
    const filters = [eq(strategicRecommendations.tenantId, actor.tenantId), eq(strategicRecommendations.category, 'improvement')];
    if (status) filters.push(eq(strategicRecommendations.status, status));
    const where = and(...filters);
    const [rows, total] = await Promise.all([
      this.db.select().from(strategicRecommendations).where(where).orderBy(desc(strategicRecommendations.priorityScore)).limit(limit).offset((page - 1) * limit),
      this.db.select({ total: count() }).from(strategicRecommendations).where(where),
    ]);
    return { data: rows.map((row) => this.presentRecommendation(row)), total: Number(total[0]?.total ?? 0), page, limit };
  }

  async recommendation(actor: Actor, id: string) {
    this.allow(actor);
    return this.presentRecommendation(await this.requireImprovementRecommendation(actor.tenantId, id));
  }

  async refresh(actor: Actor) {
    this.allow(actor);
    const result = await this.monitor(actor.tenantId, actor.userId);
    return { ...result, executed: 0 };
  }

  async monitor(tenantId: string, actorId?: string): Promise<MonitorResult> {
    const existing = this.running.get(tenantId);
    if (existing) return existing;
    const work = this.persistMonitoring(tenantId, actorId).finally(() => this.running.delete(tenantId));
    this.running.set(tenantId, work);
    return work;
  }

  async enqueueAll() {
    if (!this.schedulerAvailable()) {
      return {
        queued: 0,
        failed: 0,
        available: false,
        message: 'REDIS_URL is not configured. Scheduled monitoring was not queued. Manual refresh does not need Redis.',
      };
    }
    const rows = await this.db.select({ id: tenants.id }).from(tenants).limit(50);
    const day = dayKey(new Date());
    let queued = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.queue.add(
          IMPROVEMENT_MONITOR_JOB,
          { tenantId: row.id },
          { jobId: improvementJobId(row.id, day), attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
        );
        queued += 1;
      } catch (error) {
        if (queueFailureReport(error).duplicate) queued += 1;
        else failed += 1;
      }
    }
    return { queued, failed, available: true, capped: rows.length === 50 };
  }

  async feedback(actor: Actor, id: string, feedbackType: string, reason?: string) {
    this.allow(actor);
    const recommendation = await this.requireImprovementRecommendation(actor.tenantId, id);
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
        target: [recommendationFeedback.recommendationId, recommendationFeedback.userId],
        set: { feedbackType, feedbackReason: reason?.slice(0, 400) ?? null },
      });
    await this.history.record(actor.tenantId, {
      eventType: 'recommendation_feedback',
      relatedEntityType: 'strategic_recommendation',
      relatedEntityId: id,
      actorId: actor.userId,
      metadata: { feedbackType },
    });
    return { id, feedbackType };
  }

  async decide(actor: Actor, id: string, status: 'accepted' | 'rejected') {
    this.allow(actor);
    const recommendation = await this.requireImprovementRecommendation(actor.tenantId, id);
    if (recommendation.status !== 'open') throw new ConflictException('Only an open recommendation can be accepted or rejected.');
    if (new Date(recommendation.expiresAt).getTime() <= Date.now()) {
      throw new ConflictException('This recommendation has expired. Refresh before acting on it.');
    }
    if (status === 'accepted') await this.assertRecommendationCurrent(actor.tenantId, recommendation.recommendationKey);
    const rows = await this.db
      .update(strategicRecommendations)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(strategicRecommendations.id, id), eq(strategicRecommendations.tenantId, actor.tenantId), eq(strategicRecommendations.status, 'open')))
      .returning();
    await this.history.record(actor.tenantId, {
      eventType: status === 'accepted' ? 'recommendation_accepted' : 'recommendation_rejected',
      relatedEntityType: 'strategic_recommendation',
      relatedEntityId: id,
      actorId: actor.userId,
      metadata: { status },
    });
    return this.presentRecommendation(rows[0]);
  }

  async plans(actor: Actor) {
    this.allow(actor);
    const rows = await this.db
      .select()
      .from(strategicPlans)
      .where(and(eq(strategicPlans.tenantId, actor.tenantId), eq(strategicPlans.planKind, 'improvement')))
      .orderBy(desc(strategicPlans.createdAt))
      .limit(50);
    const picture = await this.picture(actor.tenantId);
    const ids = rows.map((plan) => plan.id);
    const milestones = ids.length
      ? await this.db
          .select()
          .from(strategicPlanMilestones)
          .where(and(eq(strategicPlanMilestones.tenantId, actor.tenantId), inArray(strategicPlanMilestones.planId, ids)))
      : [];
    return {
      data: rows.map((plan) => ({
        ...plan,
        milestones: milestones.filter((item) => item.planId === plan.id),
        assessment: picture.assessments.find((item) => item.planId === plan.id) ?? null,
      })),
    };
  }

  async createPlan(actor: Actor, input: PlanInput) {
    this.allow(actor);
    const metric = this.metricOrThrow(input.metricKey);
    const targetDate = this.futureDate(input.targetDate);
    await this.assertOwner(actor.tenantId, input.ownerId);
    if (input.goalId) await this.requireGoal(actor.tenantId, input.goalId);
    if (input.recommendationId) {
      const recommendation = await this.requireRecommendation(actor.tenantId, input.recommendationId);
      if (recommendation.category === 'improvement') {
        await this.assertRecommendationCurrent(actor.tenantId, recommendation.recommendationKey);
      }
    }
    const snapshot = await this.metrics.load(actor.tenantId, this.thresholds().measurementDays);
    const current = this.metricValue(snapshot, metric);
    if (current === null) {
      throw new BadRequestException(`${GOAL_METRICS[metric].label} cannot be measured yet, so a target was not saved.`);
    }
    const rows = await this.db
      .insert(strategicPlans)
      .values({
        tenantId: actor.tenantId,
        title: input.title.slice(0, 200),
        objective: input.objective.slice(0, 400),
        description: input.description.slice(0, 4000),
        category: input.category.slice(0, 40),
        metricKey: metric,
        baselineValue: current.toFixed(4),
        targetValue: input.targetValue.toFixed(4),
        targetDate,
        ownerId: input.ownerId ?? null,
        status: 'DRAFT',
        planKind: 'improvement',
        relatedGoalId: input.goalId ?? null,
        relatedRecommendationId: input.recommendationId ?? null,
        evidence: { approvalRequired: input.approvalRequired === true, lines: ['Baseline captured from stored records when the draft was saved.'] },
        reviewSchedule: input.reviewSchedule ?? null,
        nextReviewAt: this.nextReview(input.reviewSchedule),
        createdBy: actor.userId,
      })
      .returning();
    const plan = rows[0];
    for (const title of input.milestones ?? []) {
      await this.db.insert(strategicPlanMilestones).values({
        tenantId: actor.tenantId,
        planId: plan.id,
        title: title.slice(0, 200),
        description: 'Reviewable improvement step. It is complete only when a person marks it.',
        status: 'pending',
      });
    }
    await this.history.record(actor.tenantId, {
      eventType: 'improvement_plan_created',
      relatedEntityType: 'strategic_plan',
      relatedEntityId: plan.id,
      actorId: actor.userId,
      metadata: { status: 'DRAFT', metric },
    });
    await this.db.insert(strategicPlanEvents).values({
      tenantId: actor.tenantId,
      planId: plan.id,
      event: 'created',
      toStatus: 'DRAFT',
      actorId: actor.userId,
    });
    return plan;
  }

  async plan(actor: Actor, id: string) {
    this.allow(actor);
    const plan = await this.requireImprovementPlan(actor.tenantId, id);
    const milestones = await this.db
      .select()
      .from(strategicPlanMilestones)
      .where(and(eq(strategicPlanMilestones.tenantId, actor.tenantId), eq(strategicPlanMilestones.planId, id)));
    const events = await this.history.list(actor.tenantId, { page: 1, limit: 20, relatedEntityType: 'strategic_plan', relatedEntityId: id });
    const picture = await this.picture(actor.tenantId);
    return { ...plan, milestones, assessment: picture.assessments.find((item) => item.planId === id) ?? null, history: events.data };
  }

  async updatePlan(actor: Actor, id: string, input: Partial<PlanInput>) {
    this.allow(actor);
    const plan = await this.requireImprovementPlan(actor.tenantId, id);
    if (plan.status === 'ACTIVE' || plan.status === 'APPROVED' || plan.status === 'COMPLETED' || plan.status === 'CANCELLED') {
      throw new ConflictException('An active, approved, completed, or cancelled plan is not edited in place. Put an active plan on hold before changing it.');
    }
    const nextStatus = plan.status === 'REVIEW_REQUIRED' ? 'DRAFT' : plan.status;
    const rows = await this.db
      .update(strategicPlans)
      .set({
        title: input.title?.slice(0, 200) ?? plan.title,
        objective: input.objective?.slice(0, 400) ?? plan.objective,
        description: input.description?.slice(0, 4000) ?? plan.description,
        targetValue: input.targetValue !== undefined ? input.targetValue.toFixed(4) : plan.targetValue,
        targetDate: input.targetDate ? this.futureDate(input.targetDate) : plan.targetDate,
        ownerId: input.ownerId ?? plan.ownerId,
        reviewSchedule: input.reviewSchedule ?? plan.reviewSchedule,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(strategicPlans.id, id), eq(strategicPlans.tenantId, actor.tenantId), eq(strategicPlans.planKind, 'improvement')))
      .returning();
    await this.history.record(actor.tenantId, {
      eventType: 'improvement_plan_revised',
      relatedEntityType: 'strategic_plan',
      relatedEntityId: id,
      actorId: actor.userId,
      metadata: { fields: Object.keys(input).join(','), status: nextStatus },
    });
    return rows[0];
  }

  async movePlan(actor: Actor, id: string, status: PlanStatus) {
    this.allow(actor);
    const plan = await this.requireImprovementPlan(actor.tenantId, id);
    if (status === 'ACTIVE' && plan.status === 'DRAFT' && this.approvalRequired(plan.evidence)) {
      throw new ConflictException('This plan requires review and approval before it becomes active. No action was executed.');
    }
    if (status === 'COMPLETED') await this.assertCompletable(actor.tenantId, id);
    try {
      assertPlanMove(plan.status, status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid plan status.');
    }
    const rows = await this.db
      .update(strategicPlans)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(strategicPlans.id, id), eq(strategicPlans.tenantId, actor.tenantId), eq(strategicPlans.planKind, 'improvement')))
      .returning();
    const eventType = status === 'ACTIVE' ? 'improvement_plan_activated' : status === 'ON_HOLD' ? 'improvement_plan_held' : status === 'COMPLETED' ? 'improvement_plan_completed' : 'improvement_plan_status';
    await this.history.record(actor.tenantId, {
      eventType,
      relatedEntityType: 'strategic_plan',
      relatedEntityId: id,
      actorId: actor.userId,
      metadata: { from: plan.status, to: status, autoExecute: executionPolicy('review').autoExecute },
    });
    await this.db.insert(strategicPlanEvents).values({
      tenantId: actor.tenantId,
      planId: id,
      event: 'status',
      fromStatus: plan.status,
      toStatus: status,
      actorId: actor.userId,
    });
    return rows[0];
  }

  async completeMilestone(actor: Actor, planId: string, milestoneId: string) {
    this.allow(actor);
    await this.requireImprovementPlan(actor.tenantId, planId);
    const rows = await this.db
      .update(strategicPlanMilestones)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
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
    await this.history.record(actor.tenantId, {
      eventType: 'milestone_completed',
      relatedEntityType: 'strategic_plan_milestone',
      relatedEntityId: milestoneId,
      actorId: actor.userId,
      metadata: { planId },
    });
    return rows[0];
  }

  async outcomeList(actor: Actor, page: number, limit: number) {
    this.allow(actor);
    const where = eq(improvementOutcomeEvaluations.tenantId, actor.tenantId);
    const [rows, total] = await Promise.all([
      this.db.select().from(improvementOutcomeEvaluations).where(where).orderBy(desc(improvementOutcomeEvaluations.evaluatedAt)).limit(limit).offset((page - 1) * limit),
      this.db.select({ total: count() }).from(improvementOutcomeEvaluations).where(where),
    ]);
    return { data: rows, total: Number(total[0]?.total ?? 0), page, limit };
  }

  async outcome(actor: Actor, id: string) {
    this.allow(actor);
    const rows = await this.db
      .select()
      .from(improvementOutcomeEvaluations)
      .where(and(eq(improvementOutcomeEvaluations.id, id), eq(improvementOutcomeEvaluations.tenantId, actor.tenantId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Outcome evaluation not found.');
    return rows[0];
  }

  async evaluate(actor: Actor) {
    this.allow(actor);
    const thresholds = this.thresholds();
    const snapshot = await this.metrics.load(actor.tenantId, thresholds.measurementDays);
    const evaluated = this.outcomes.evaluate(snapshot.actions, new Date(snapshot.generatedAt), thresholds);
    let saved = 0;
    for (const item of evaluated) {
      if (!item.periodStart || !item.periodEnd || !item.metricKey) continue;
      if (item.status === 'NOT_EVALUATED') continue;
      await this.db
        .insert(improvementOutcomeEvaluations)
        .values({
          tenantId: actor.tenantId,
          actionPlanId: item.actionPlanId,
          goalId: item.goalId,
          metricKey: item.metricKey,
          baselineValue: decimal(item.baseline),
          measuredValue: decimal(item.measured),
          evaluationPeriodStart: new Date(item.periodStart),
          evaluationPeriodEnd: new Date(item.periodEnd),
          evaluationStatus: item.status,
          evidence: { statement: item.statement, causalClaim: false },
          evaluatedAt: new Date(snapshot.generatedAt),
        })
        .onConflictDoUpdate({
          target: [
            improvementOutcomeEvaluations.tenantId,
            improvementOutcomeEvaluations.actionPlanId,
            improvementOutcomeEvaluations.evaluationPeriodStart,
            improvementOutcomeEvaluations.evaluationPeriodEnd,
          ],
          set: {
            measuredValue: decimal(item.measured),
            evaluationStatus: item.status,
            evidence: { statement: item.statement, causalClaim: false },
            evaluatedAt: new Date(snapshot.generatedAt),
          },
        });
      saved += 1;
    }
    await this.history.record(actor.tenantId, {
      eventType: 'outcome_evaluated',
      relatedEntityType: 'improvement_outcome',
      actorId: actor.userId,
      metadata: { saved },
    });
    return { saved, executed: 0 };
  }

  async reviews(actor: Actor) {
    this.allow(actor);
    const rows = await this.db
      .select()
      .from(businessImprovementReviews)
      .where(eq(businessImprovementReviews.tenantId, actor.tenantId))
      .orderBy(desc(businessImprovementReviews.createdAt))
      .limit(30);
    return { data: rows };
  }

  async createReview(actor: Actor, input: { periodStart: string; periodEnd: string }) {
    this.allow(actor);
    const period = this.reviewPeriod(input.periodStart, input.periodEnd);
    const picture = await this.picture(actor.tenantId);
    const narrative = buildReview({
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      metrics: picture.snapshot.metrics,
      goals: picture.snapshot.goals.map((goal) => ({ name: goal.name, progress: goal.progress, note: goal.note })),
      plans: picture.assessments,
      completedActions: picture.snapshot.completedActions,
      failedActions: picture.snapshot.failedActions,
      bottlenecks: picture.liveBottlenecks,
      opportunities: picture.liveOpportunities,
      outcomes: picture.evaluated.map((item) => ({ title: item.title, status: item.status, statement: item.statement })),
    });
    const summary = await this.narrate(actor, narrative.summary);
    const rows = await this.db
      .insert(businessImprovementReviews)
      .values({
        tenantId: actor.tenantId,
        reviewPeriodStart: period.start,
        reviewPeriodEnd: period.end,
        summary: summary.summary,
        reviewMetrics: narrative.reviewMetrics,
        findings: { ...narrative.findings, summarySource: summary.source },
        status: 'draft',
        createdBy: actor.userId,
      })
      .returning();
    await this.history.record(actor.tenantId, {
      eventType: 'review_drafted',
      relatedEntityType: 'business_improvement_review',
      relatedEntityId: rows[0].id,
      actorId: actor.userId,
      metadata: { status: 'draft', summarySource: summary.source },
    });
    return rows[0];
  }

  async review(actor: Actor, id: string) {
    this.allow(actor);
    return this.requireReview(actor.tenantId, id);
  }

  async completeReview(actor: Actor, id: string, decision?: string) {
    this.allow(actor);
    const review = await this.requireReview(actor.tenantId, id);
    if (review.status === 'completed') throw new ConflictException('This review is already complete.');
    if (review.status !== 'draft') throw new ConflictException('Only a draft review can be completed.');
    const rows = await this.db
      .update(businessImprovementReviews)
      .set({
        status: 'completed',
        decision: decision?.slice(0, 800) ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(businessImprovementReviews.id, id), eq(businessImprovementReviews.tenantId, actor.tenantId), eq(businessImprovementReviews.status, 'draft')))
      .returning();
    if (!rows[0]) throw new ConflictException('The review could not be completed.');
    await this.history.record(actor.tenantId, {
      eventType: 'review_completed',
      relatedEntityType: 'business_improvement_review',
      relatedEntityId: id,
      actorId: actor.userId,
      metadata: { status: 'completed' },
    });
    return rows[0];
  }

  async historyList(actor: Actor, query: Parameters<ImprovementHistoryService['list']>[1]) {
    this.allow(actor);
    return this.history.list(actor.tenantId, query);
  }

  async answer(actor: Actor, message: string) {
    this.allow(actor);
    const picture = await this.picture(actor.tenantId);
    const stage = this.cycle.stage({
      hasMetrics: picture.snapshot.metrics.length > 0,
      hasFindings: picture.liveDeviations.length + picture.liveBottlenecks.length > 0,
      hasRecommendations: picture.liveRecommendations.length > 0,
      hasActivePlan: picture.view.activePlans.length > 0,
      hasPendingApproval: picture.snapshot.signals.approvalDelays + picture.snapshot.signals.plansWaitingApproval > 0,
      hasExecution: picture.snapshot.completedActions + picture.snapshot.failedActions > 0,
      hasPendingMeasurement: picture.evaluated.some((item) => item.status === 'PENDING_MEASUREMENT'),
      hasEvaluation: picture.evaluated.some((item) => item.status !== 'NOT_EVALUATED' && item.status !== 'PENDING_MEASUREMENT'),
      hasCompletedReview: false,
    }).current;
    const lines = [
      'Continuous improvement uses stored records. Observed changes are not described as caused by an action. No plan was changed and no sensitive action was executed.',
      `Current cycle stage from stored records: ${stage}.`,
    ];
    if (/goals? not progressing|business goals/i.test(message)) {
      lines.push(
        picture.snapshot.goals.length === 0
          ? 'No business goals are saved, so goal progress cannot be judged.'
          : picture.snapshot.goals.map((goal) => `${goal.name}: ${goal.note}`).join(' '),
      );
    }
    if (/process|bottleneck|operations/i.test(message)) {
      lines.push(
        picture.liveBottlenecks.length === 0
          ? 'No bottleneck rule matched the stored records.'
          : picture.liveBottlenecks.map((item) => `${item.title}. ${item.recommendedInvestigation}`).join(' '),
      );
    }
    if (/measurable|outcome|results/i.test(message)) {
      lines.push(
        picture.evaluated.length === 0
          ? 'No completed action plan has a measurement window that can be evaluated.'
          : picture.evaluated.map((item) => `${item.status}: ${item.statement}`).join(' '),
      );
    }
    if (/priorit|improve next|this month/i.test(message)) {
      lines.push(
        picture.liveRecommendations.length === 0
          ? 'No improvement recommendation is supported by the current records.'
          : picture.liveRecommendations.slice(0, 3).map((item) => `${item.title}. ${item.evidence[0] ?? ''}`).join(' '),
      );
    }
    if (/strategic plans|active plan/i.test(message)) {
      lines.push(
        picture.assessments.length === 0
          ? 'No active or held plan is stored.'
          : picture.assessments.map((plan) => `${plan.title} is ${plan.progressStatus.replaceAll('_', ' ')}. ${plan.reason}`).join(' '),
      );
    }
    if (/last business review|what changed/i.test(message)) {
      const reviews = await this.reviews(actor);
      const latest = reviews.data.find((item) => item.status === 'completed');
      lines.push(latest ? `The latest completed review says: ${latest.summary}` : 'No completed business review is stored yet. A draft is not treated as a completed review.');
    }
    if (/recommendations were useful/i.test(message)) {
      const [row] = await this.db
        .select({ total: count() })
        .from(recommendationFeedback)
        .where(and(eq(recommendationFeedback.tenantId, actor.tenantId), eq(recommendationFeedback.feedbackType, 'useful')));
      lines.push(`${Number(row?.total ?? 0)} recommendation feedback rows are marked useful. Usefulness is a person's feedback, not a measured business result.`);
    }
    if (/task completion rate|create a plan/i.test(message)) {
      lines.push('A plan was not created from this answer. Open Continuous Improvement and save a draft if you want a task-completion plan. Saving a draft does not activate it.');
    }
    const summary = await this.narrate(actor, lines.join('\n'));
    return { summary: summary.summary, source: summary.source, executed: 0 };
  }

  private async persistMonitoring(tenantId: string, actorId?: string): Promise<MonitorResult> {
    const picture = await this.pictureFor(tenantId);
    const day = picture.snapshot.dayKey;
    for (const item of picture.liveDeviations) {
      const period = `${item.comparisonPeriod}_ending_${day}`;
      const inserted = await this.db
        .insert(businessPerformanceDeviations)
        .values({
          tenantId,
          metricKey: item.metricKey,
          metricName: item.metricName,
          deviationType: item.deviationType,
          currentValue: decimal(item.currentValue),
          baselineValue: decimal(item.baselineValue),
          targetValue: decimal(item.targetValue),
          deviationValue: decimal(item.deviationValue),
          deviationPercentage: item.deviationPercentage === null ? null : item.deviationPercentage.toFixed(2),
          comparisonPeriod: period,
          trendDirection: item.trendDirection,
          evidence: { lines: item.evidence, statisticalSignificance: false },
          confidenceLevel: item.confidenceLevel,
          detectedAt: new Date(item.detectedAt),
        })
        .onConflictDoUpdate({
          target: [
            businessPerformanceDeviations.tenantId,
            businessPerformanceDeviations.metricKey,
            businessPerformanceDeviations.deviationType,
            businessPerformanceDeviations.comparisonPeriod,
          ],
          set: {
            currentValue: decimal(item.currentValue),
            baselineValue: decimal(item.baselineValue),
            targetValue: decimal(item.targetValue),
            deviationValue: decimal(item.deviationValue),
            deviationPercentage: item.deviationPercentage === null ? null : item.deviationPercentage.toFixed(2),
            evidence: { lines: item.evidence, statisticalSignificance: false },
            confidenceLevel: item.confidenceLevel,
            detectedAt: new Date(item.detectedAt),
          },
        })
        .returning({ id: businessPerformanceDeviations.id, inserted: sql<boolean>`(xmax = 0)` });
      if (wasInserted(inserted[0]?.inserted)) {
        await this.history.record(tenantId, {
          eventType: 'deviation_detected',
          relatedEntityType: 'business_performance_deviation',
          relatedEntityId: inserted[0].id,
          actorId: actorId ?? null,
          metadata: { metricKey: item.metricKey, deviationType: item.deviationType },
        });
      }
    }
    for (const item of picture.liveBottlenecks) {
      const existing = await this.db
        .select()
        .from(businessBottlenecks)
        .where(and(eq(businessBottlenecks.tenantId, tenantId), eq(businessBottlenecks.fingerprint, item.fingerprint)))
        .limit(1);
      if (existing[0]?.status === 'resolved') continue;
      const saved = await this.db
        .insert(businessBottlenecks)
        .values({
          tenantId,
          fingerprint: item.fingerprint,
          category: item.category,
          title: item.title,
          description: item.description,
          affectedProcess: item.affectedProcess,
          evidence: { lines: item.evidence, metrics: item.supportingMetrics, cause: 'not_confirmed' },
          relatedEntityType: item.relatedEntityType,
          relatedEntityId: item.relatedEntityId,
          severity: item.severity,
          detectionMethod: item.detectionMethod,
          recommendedInvestigation: item.recommendedInvestigation,
          confidenceLevel: item.confidenceLevel,
          status: 'open',
          detectedAt: new Date(picture.snapshot.generatedAt),
        })
        .onConflictDoUpdate({
          target: [businessBottlenecks.tenantId, businessBottlenecks.fingerprint],
          set: {
            description: item.description,
            evidence: { lines: item.evidence, metrics: item.supportingMetrics, cause: 'not_confirmed' },
            severity: item.severity,
            recommendedInvestigation: item.recommendedInvestigation,
            confidenceLevel: item.confidenceLevel,
            detectedAt: new Date(picture.snapshot.generatedAt),
            updatedAt: new Date(),
          },
          setWhere: eq(businessBottlenecks.status, 'open'),
        })
        .returning({ id: businessBottlenecks.id });
      if (!existing[0] && saved[0]) {
        await this.history.record(tenantId, {
          eventType: 'bottleneck_detected',
          relatedEntityType: 'business_bottleneck',
          relatedEntityId: saved[0].id,
          actorId: actorId ?? null,
          metadata: { fingerprint: item.fingerprint },
        });
      }
    }
    const expiresAt = new Date(Date.now() + 14 * DAY_MS);
    for (const draft of picture.liveRecommendations) {
      const known = await this.db
        .select({ id: strategicRecommendations.id })
        .from(strategicRecommendations)
        .where(and(eq(strategicRecommendations.tenantId, tenantId), eq(strategicRecommendations.recommendationKey, draft.key)))
        .limit(1);
      await this.db
        .insert(strategicRecommendations)
        .values({
          tenantId,
          recommendationKey: draft.key,
          title: draft.title,
          description: draft.description,
          category: 'improvement',
          priorityScore: draft.priority,
          confidenceLevel: draft.confidence,
          evidence: recommendationEvidence(draft),
          reasoning: draft.reasoning,
          suggestedAction: draft.suggestedImprovement,
          expectedOutcome: draft.expectedOutcome,
          status: 'open',
          periodStart: new Date(Date.now() - 30 * DAY_MS),
          periodEnd: new Date(),
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [strategicRecommendations.tenantId, strategicRecommendations.recommendationKey],
          set: {
            title: draft.title,
            description: draft.description,
            priorityScore: draft.priority,
            confidenceLevel: draft.confidence,
            evidence: recommendationEvidence(draft),
            reasoning: draft.reasoning,
            suggestedAction: draft.suggestedImprovement,
            expectedOutcome: draft.expectedOutcome,
            expiresAt,
            updatedAt: new Date(),
          },
          setWhere: eq(strategicRecommendations.status, 'open'),
        });
      if (!known[0]) {
        await this.history.record(tenantId, {
          eventType: 'recommendation_generated',
          relatedEntityType: 'strategic_recommendation',
          actorId: actorId ?? null,
          metadata: { key: draft.key },
        });
      }
    }
    await this.history.record(tenantId, {
      eventType: 'monitoring_completed',
      relatedEntityType: 'continuous_improvement',
      actorId: actorId ?? null,
      metadata: {
        deviations: picture.liveDeviations.length,
        bottlenecks: picture.liveBottlenecks.length,
        recommendations: picture.liveRecommendations.length,
        executed: 0,
      },
    });
    return {
      deviations: picture.liveDeviations.length,
      bottlenecks: picture.liveBottlenecks.length,
      recommendations: picture.liveRecommendations.length,
      executed: 0,
    };
  }

  private async picture(actorTenant: string) {
    return this.pictureFor(actorTenant);
  }

  private async pictureFor(tenantId: string) {
    const thresholds = this.thresholds();
    const snapshot = await this.metrics.load(tenantId, thresholds.measurementDays);
    const now = new Date(snapshot.generatedAt);
    const liveDeviations = this.evaluation.detect(snapshot.metrics, thresholds, snapshot.generatedAt);
    const assessments = this.planMonitor.assess(snapshot.plans, now, thresholds);
    const liveBottlenecks = this.bottlenecks.detect(snapshot.signals, thresholds, snapshot.periodKey);
    const liveOpportunities = this.opportunities.discover({
      workflowFailures: snapshot.signals.workflowFailures,
      overdueTasks: snapshot.signals.overdueTasks,
      previousOverdueTasks: snapshot.previousOverdue,
      oldPendingProposals: snapshot.signals.oldPendingProposals,
      goalsBehindTarget: snapshot.goals.filter((goal) => goal.behind).length,
      repeatedExceptions: snapshot.signals.repeatedExceptions.length,
    });
    const liveRecommendations = this.recommendations.draft({
      plans: assessments,
      deviations: liveDeviations,
      bottlenecks: liveBottlenecks,
      opportunities: liveOpportunities,
    });
    const evaluated = this.outcomes.evaluate(snapshot.actions, now, thresholds);
    const activePlans = assessments
      .map((plan, index) => ({ ...plan, planKind: snapshot.plans[index]?.planKind ?? 'strategic' }))
      .filter((plan) => plan.planKind === 'improvement' && plan.storedStatus === 'ACTIVE');
    return {
      snapshot,
      assessments,
      liveDeviations,
      liveBottlenecks,
      liveOpportunities,
      liveRecommendations,
      evaluated,
      view: {
        activePlans,
        goalsAtRisk: snapshot.goals.filter((goal) => goal.behind),
        deviations: liveDeviations,
        bottlenecks: liveBottlenecks,
        recommendations: liveRecommendations,
        opportunities: liveOpportunities,
        planProgress: assessments,
      },
    };
  }

  private async assertRecommendationCurrent(tenantId: string, key: string) {
    const picture = await this.pictureFor(tenantId);
    const keys = picture.liveRecommendations.map((item) => item.key);
    if (!this.evidence.stillCurrent(key, keys)) {
      throw new ConflictException('The evidence for this recommendation is no longer present, so it was not accepted or turned into a plan.');
    }
  }

  private async narrate(actor: Actor, deterministic: string) {
    const apiKey = this.configService.get<string>('GOOGLE_GENAI_API_KEY');
    if (!apiKey) return summarizeReview(deterministic, null);
    try {
      const { GoogleGenAI } = require('@google/genai');
      const client = new GoogleGenAI({ apiKey });
      const model = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
      const request = () =>
        client.models.generateContent({
          model,
          contents: [
            'Rewrite the following business review in plain sentences.',
            'Use only numbers that already appear. Do not add causes, savings, forecasts, names, or secrets.',
            deterministic.slice(0, 4000),
          ].join('\n'),
          config: { temperature: 0 },
        });
      const response = this.tracker
        ? await this.tracker.observe(
            { tenantId: actor.tenantId, userId: actor.userId, agentName: 'continuous-improvement', provider: 'google', model },
            request,
          )
        : await request();
      const text = typeof response?.text === 'function' ? response.text() : response?.text;
      return summarizeReview(deterministic, typeof text === 'string' ? text : null);
    } catch {
      return summarizeReview(deterministic, null);
    }
  }

  private allow(actor: Actor) {
    if (!hasPermission(actor.role, Permission.AnalyticsView)) {
      throw new ForbiddenException('Continuous improvement is limited to people who can view tenant analytics.');
    }
  }

  private thresholds(): Thresholds {
    return parseThresholds({
      IMPROVEMENT_STALLED_DAYS: this.configService.get<string>('IMPROVEMENT_STALLED_DAYS'),
      IMPROVEMENT_DEVIATION_PERCENT: this.configService.get<string>('IMPROVEMENT_DEVIATION_PERCENT'),
      IMPROVEMENT_RATE_POINTS: this.configService.get<string>('IMPROVEMENT_RATE_POINTS'),
      IMPROVEMENT_MIN_SAMPLE: this.configService.get<string>('IMPROVEMENT_MIN_SAMPLE'),
      IMPROVEMENT_MEASUREMENT_DAYS: this.configService.get<string>('IMPROVEMENT_MEASUREMENT_DAYS'),
    });
  }

  private scheduleNote() {
    return {
      mode: this.schedulerAvailable() ? 'bullmq' : 'manual_only',
      redisRequiredForSchedule: true,
      manualRefreshRequiresRedis: false,
      note: this.schedulerAvailable()
        ? 'Daily monitoring queues one job per tenant when scheduled jobs are enabled. The job does not send messages or execute actions. Manual refresh works without waiting for the queue.'
        : 'REDIS_URL is not configured, so scheduled monitoring is not queued. Manual refresh calculates and saves from stored records without Redis.',
    };
  }

  private metricOrThrow(value: string): GoalMetricKey {
    if (!isGoalMetric(value)) throw new BadRequestException('That metric is not available for an improvement plan.');
    return value;
  }

  private metricValue(snapshot: ImprovementSnapshot, key: GoalMetricKey) {
    if (key === 'overdue_task_count') return snapshot.signals.overdueTasks;
    if (key === 'stale_lead_count') return snapshot.signals.inactiveLeads;
    if (key === 'open_exception_count') return snapshot.signals.openExceptions;
    if (key === 'workflow_failure_count') return snapshot.signals.workflowFailures;
    if (key === 'proposal_acceptance_rate') return snapshot.metrics.find((metric) => metric.key === 'proposal_acceptance_rate')?.current ?? null;
    if (key === 'leads_created') return snapshot.metrics.find((metric) => metric.key === 'leads_created')?.current ?? null;
    return null;
  }

  private futureDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - DAY_MS) {
      throw new BadRequestException('The target date must be today or later.');
    }
    return date;
  }

  private reviewPeriod(start: string, end: string) {
    const from = new Date(start);
    const to = new Date(end);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('The review period is invalid.');
    }
    if (to.getTime() - from.getTime() > 366 * DAY_MS) {
      throw new BadRequestException('The review period cannot exceed 366 days.');
    }
    return { start: from, end: to };
  }

  private nextReview(schedule?: string) {
    if (schedule === 'weekly') return new Date(Date.now() + 7 * DAY_MS);
    if (schedule === 'monthly') return new Date(Date.now() + 30 * DAY_MS);
    return null;
  }

  private approvalRequired(evidence: unknown) {
    return Boolean(evidence && typeof evidence === 'object' && 'approvalRequired' in evidence && (evidence as { approvalRequired?: boolean }).approvalRequired);
  }

  private async assertCompletable(tenantId: string, planId: string) {
    const milestones = await this.db
      .select()
      .from(strategicPlanMilestones)
      .where(and(eq(strategicPlanMilestones.tenantId, tenantId), eq(strategicPlanMilestones.planId, planId)));
    if (milestones.length === 0) {
      throw new ConflictException('Add and complete a milestone before marking the plan completed. Completion was not inferred.');
    }
    if (milestones.some((item) => item.status !== 'completed')) {
      throw new ConflictException('Every milestone must be completed before the plan can be marked completed.');
    }
  }

  private async assertOwner(tenantId: string, ownerId?: string) {
    if (!ownerId) return;
    const rows = await this.db.select({ id: users.id }).from(users).where(and(eq(users.id, ownerId), eq(users.tenantId, tenantId))).limit(1);
    if (!rows[0]) throw new BadRequestException('The owner must belong to this tenant.');
  }

  private async requireGoal(tenantId: string, id: string) {
    const rows = await this.db.select({ id: businessGoals.id }).from(businessGoals).where(and(eq(businessGoals.id, id), eq(businessGoals.tenantId, tenantId))).limit(1);
    if (!rows[0]) throw new NotFoundException('Goal not found.');
  }

  private async requireRecommendation(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(strategicRecommendations)
      .where(and(eq(strategicRecommendations.id, id), eq(strategicRecommendations.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Recommendation not found.');
    return rows[0];
  }

  private async requireImprovementRecommendation(tenantId: string, id: string) {
    const row = await this.requireRecommendation(tenantId, id);
    if (row.category !== 'improvement') throw new NotFoundException('Improvement recommendation not found.');
    return row;
  }

  private async requireImprovementPlan(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(strategicPlans)
      .where(and(eq(strategicPlans.id, id), eq(strategicPlans.tenantId, tenantId), eq(strategicPlans.planKind, 'improvement')))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Improvement plan not found.');
    rejectForeignTenant(tenantId, rows[0].tenantId);
    return rows[0];
  }

  private async requireBottleneck(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(businessBottlenecks)
      .where(and(eq(businessBottlenecks.id, id), eq(businessBottlenecks.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Bottleneck not found.');
    return rows[0];
  }

  private async requireReview(tenantId: string, id: string) {
    const rows = await this.db
      .select()
      .from(businessImprovementReviews)
      .where(and(eq(businessImprovementReviews.id, id), eq(businessImprovementReviews.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('Improvement review not found.');
    return rows[0];
  }

  private presentRecommendation(row: typeof strategicRecommendations.$inferSelect) {
    const evidence = Array.isArray(row.evidence) ? row.evidence.filter((item): item is string => typeof item === 'string') : [];
    return {
      ...row,
      evidence,
      risks: evidence.find((line) => line.startsWith('Risk: ')) ?? 'A person must review this before any plan changes.',
      requiredPermission: 'analytics.view',
      approvalRequired: false,
      suggestedImprovement: row.suggestedAction,
    };
  }
}

function recommendationEvidence(draft: RecommendationDraft) {
  return [
    ...draft.evidence,
    `Risk: ${draft.risks}`,
    `Permission: ${draft.requiredPermission}`,
    'Approval required: no',
    draft.relatedEntityId ? `Related: ${draft.relatedEntityType} ${draft.relatedEntityId}` : 'Related: none',
  ];
}

function wasInserted(value: unknown) {
  return value === true || value === 't' || value === 'true';
}

function decimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(4);
}
