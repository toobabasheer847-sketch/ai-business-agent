import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { TaskService } from '../../ai/agents/task/task.service';
import { ExceptionService } from '../exceptions/exception.service';
import type { ExceptionDraft } from '../exceptions/exception.types';
import { acceptDraftText } from '../omnichannel/communication-rules';
import { WorkflowService } from '../workflows/workflow.service';
import { CustomerRetentionRepository } from './customer-retention.repository';
import {
  DEFAULT_THRESHOLDS,
  assessRelationship,
  exceptionDraftFor,
  explicitFeedback,
  recommend,
  retentionDraft,
  shouldOpenRecommendation,
  signalFingerprint,
  summarizeRetention,
  taskMarker,
  validateThresholds,
  type HealthClass,
  type RetentionSignal,
  type RetentionThresholds,
} from './retention-rules';

type Actor = { tenantId: string; userId: string; role?: string };

@Injectable()
export class CustomerRetentionService {
  constructor(
    private readonly records: CustomerRetentionRepository,
    @Optional() private readonly tasks?: TaskService,
    @Optional() private readonly exceptions?: ExceptionService,
    @Optional() private readonly workflows?: WorkflowService,
  ) {}

  async getPolicy(tenantId: string) {
    const saved = await this.records.policy(tenantId);
    return {
      saved: Boolean(saved),
      ...(saved
        ? {
          inactivityDays: saved.inactivityDays,
          unansweredDays: saved.unansweredDays,
          stalledProposalDays: saved.stalledProposalDays,
          unresolvedConversationDays: saved.unresolvedConversationDays,
          followUpDueDays: saved.followUpDueDays,
        }
        : DEFAULT_THRESHOLDS),
      note: 'These day counts are the tenant policy. They are not a universal definition of churn.',
    };
  }

  async savePolicy(actor: Actor, input: Partial<RetentionThresholds>) {
    const parsed = validateThresholds(input);
    if (!parsed.ok) throw new BadRequestException(parsed.error);
    const saved = await this.records.savePolicy(actor.tenantId, actor.userId, parsed.value);
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'retention.policy_updated',
      entityType: 'retention_policy',
      entityId: saved.id,
      description: 'Retention thresholds updated.',
    });
    return this.getPolicy(actor.tenantId);
  }

  async refresh(actor: Actor) {
    const policy = await this.getPolicy(actor.tenantId);
    const thresholds: RetentionThresholds = {
      inactivityDays: policy.inactivityDays,
      unansweredDays: policy.unansweredDays,
      stalledProposalDays: policy.stalledProposalDays,
      unresolvedConversationDays: policy.unresolvedConversationDays,
      followUpDueDays: policy.followUpDueDays,
    };
    const { customers, truncated } = await this.records.evidence(actor.tenantId);
    const existingKeys = new Set((await this.records.recommendationKeys(actor.tenantId)).map((row) => row.signalKey));
    const exceptionDrafts: ExceptionDraft[] = [];
    let changed = 0;
    for (const customer of customers) {
      const assessment = assessRelationship(customer, thresholds);
      const fingerprint = signalFingerprint(assessment.signals).slice(0, 2000);
      const previous = await this.records.account(actor.tenantId, customer.companyId);
      const changedAssessment = !previous || previous.classification !== assessment.classification || previous.signalFingerprint !== fingerprint;
      await this.records.upsertAccount({
        tenantId: actor.tenantId,
        companyId: customer.companyId,
        classification: assessment.classification,
        confidence: assessment.confidence,
        dataSufficiency: assessment.dataSufficiency,
        explanation: assessment.explanation.slice(0, 800),
        signalFingerprint: fingerprint,
        signals: assessment.signals,
        lastInteractionAt: assessment.lastInteractionAt ? new Date(assessment.lastInteractionAt) : null,
        assessedAt: customer.now,
      });
      if (changedAssessment) {
        changed += 1;
        await this.records.addAssessment({
          tenantId: actor.tenantId,
          companyId: customer.companyId,
          classification: assessment.classification,
          confidence: assessment.confidence,
          dataSufficiency: assessment.dataSufficiency,
          explanation: assessment.explanation.slice(0, 800),
          signals: assessment.signals,
          assessedAt: customer.now,
        });
        await this.emitChanges(actor.tenantId, customer.companyId, previous?.classification, assessment.classification, assessment.signals);
      }
      const drafts = recommend(assessment);
      const currentKeys = new Set(drafts.map((draft) => draft.signalKey));
      for (const open of await this.records.recommendations(actor.tenantId, customer.companyId)) {
        if (open.status === 'open' && !currentKeys.has(open.signalKey)) {
          await this.records.updateRecommendation(actor.tenantId, open.id, { status: 'no_longer_observed' });
        }
      }
      for (const draft of drafts) {
        if (!shouldOpenRecommendation([...existingKeys], draft.signalKey)) continue;
        const created = await this.records.insertRecommendation({
          tenantId: actor.tenantId,
          companyId: customer.companyId,
          signalKey: draft.signalKey,
          title: draft.title,
          explanation: draft.explanation,
          action: draft.action,
          priority: draft.priority,
          confidence: draft.confidence,
          status: 'open',
          sourceType: draft.sourceType,
          sourceId: draft.sourceId,
          evidence: draft.evidence.slice(0, 800),
        });
        if (created) existingKeys.add(draft.signalKey);
      }
      for (const signal of assessment.signals) {
        const exception = exceptionDraftFor(customer.companyId, customer.companyName, signal);
        if (exception) exceptionDrafts.push(exception);
      }
      for (const message of customer.messages) {
        const feedback = explicitFeedback(message);
        if (!feedback) continue;
        await this.records.insertFeedback({
          tenantId: actor.tenantId,
          companyId: customer.companyId,
          messageId: message.id,
          polarity: feedback.polarity,
          excerpt: feedback.excerpt.slice(0, 200),
          method: 'explicit_phrase',
          reviewStatus: 'unreviewed',
          observedAt: message.createdAt,
        });
      }
    }
    if (exceptionDrafts.length) {
      await this.exceptions?.recordDrafts(actor.tenantId, exceptionDrafts).catch(() => undefined);
    }
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'retention.assessed',
      entityType: 'retention_account',
      description: `Assessed ${customers.length} companies with an accepted proposal.`,
    });
    return {
      assessed: customers.length,
      changed,
      truncated,
      method: 'heuristic' as const,
      predictiveModel: false,
      note: truncated
        ? 'Only the first 100 companies with an accepted proposal were assessed.'
        : 'Every company with an accepted proposal in this tenant was assessed from stored records.',
    };
  }

  async list(tenantId: string, classification: string | undefined, page: number, limit: number) {
    const result = await this.records.listAccounts(tenantId, classification, page, limit);
    return {
      data: result.data.map((row) => ({
        ...presentAccount(row.account),
        companyName: row.companyName,
      })),
      total: result.total,
      page,
      limit,
      method: 'heuristic' as const,
      churnProbability: null,
    };
  }

  async detail(tenantId: string, companyId: string) {
    const account = await this.records.account(tenantId, companyId);
    if (!account) throw new NotFoundException('No retention assessment is stored for this company.');
    const [recommendations, plans, feedback, history] = await Promise.all([
      this.records.recommendations(tenantId, companyId),
      this.records.plans(tenantId, companyId),
      this.records.feedback(tenantId, companyId),
      this.records.history(tenantId, companyId),
    ]);
    return {
      account: presentAccount(account),
      recommendations,
      plans,
      feedback,
      history,
      method: 'heuristic' as const,
      predictiveModel: false,
    };
  }

  async analytics(tenantId: string) {
    const counts = await this.records.counts(tenantId);
    const inactive = counts.accounts.filter((row) => JSON.stringify(row.signals).includes('"inactivity"')).length;
    const overdueFollowUps = counts.accounts.filter((row) => JSON.stringify(row.signals).includes('"overdue_task"')).length;
    const unresolvedConversations = counts.accounts.filter((row) => JSON.stringify(row.signals).includes('"unresolved_conversation"')).length;
    const completedPlans = counts.plans.find((row) => row.status === 'completed')?.total ?? 0;
    const openPlans = counts.plans.filter((row) => row.status !== 'completed' && row.status !== 'cancelled').reduce((sum, row) => sum + Number(row.total), 0);
    return summarizeRetention({
      classifications: counts.accounts.map((row) => row.classification as HealthClass),
      inactive,
      openRecommendations: counts.openRecommendations,
      completedPlans: Number(completedPlans),
      openPlans,
      overdueFollowUps,
      unresolvedConversations,
      truncated: false,
    });
  }

  listRecommendations(tenantId: string) {
    return this.records.recommendations(tenantId);
  }

  listPlans(tenantId: string) {
    return this.records.plans(tenantId);
  }

  async setRecommendationStatus(actor: Actor, id: string, status: 'acknowledged' | 'dismissed' | 'completed') {
    const row = await this.records.updateRecommendation(actor.tenantId, id, { status });
    if (!row) throw new NotFoundException('Recommendation was not found.');
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'retention.recommendation_updated',
      entityType: 'retention_recommendation',
      entityId: id,
      description: `Recommendation marked ${status}.`,
    });
    return row;
  }

  async createFollowUp(actor: Actor, recommendationId: string, assignedUserId?: string) {
    if (!this.tasks) throw new BadRequestException('Task service is unavailable.');
    const recommendation = await this.records.recommendation(actor.tenantId, recommendationId);
    if (!recommendation) throw new NotFoundException('Recommendation was not found.');
    if (assignedUserId && !(await this.records.userInTenant(actor.tenantId, assignedUserId))) {
      throw new BadRequestException('Assignee is not an active user in this tenant.');
    }
    const marker = taskMarker(recommendation.id);
    const existing = recommendation.taskId
      ? { id: recommendation.taskId }
      : await this.records.taskForMarker(actor.tenantId, marker);
    if (existing) return { taskId: existing.id, duplicate: true };
    const policy = await this.getPolicy(actor.tenantId);
    const dueAt = new Date(Date.now() + policy.followUpDueDays * 24 * 60 * 60 * 1000).toISOString();
    const task = await this.tasks.createTask({
      title: recommendation.title.slice(0, 255),
      description: `${recommendation.explanation}\n\n${marker}`,
      priority: recommendation.priority === 'high' ? 'high' : 'medium',
      companyId: recommendation.companyId,
      assignedTo: assignedUserId,
      dueAt,
    }, { tenantId: actor.tenantId, userId: actor.userId, role: actor.role });
    await this.records.updateRecommendation(actor.tenantId, recommendation.id, { taskId: task.id, assignedUserId: assignedUserId ?? null });
    await this.workflows?.dispatchEvent(actor.tenantId, 'follow_up_due', `retention-task:${task.id}`).catch(() => undefined);
    return { taskId: task.id, duplicate: false };
  }

  async createPlan(actor: Actor, input: {
    companyId: string;
    title: string;
    objective: string;
    issue: string;
    priority: 'low' | 'medium' | 'high';
    assignedUserId?: string;
    dueAt?: string;
    evidence: string;
    expectedOutcome: string;
    recommendationId?: string;
  }) {
    const account = await this.records.account(actor.tenantId, input.companyId);
    if (!account) throw new BadRequestException('Assess the company before creating an action plan.');
    if (input.assignedUserId && !(await this.records.userInTenant(actor.tenantId, input.assignedUserId))) {
      throw new BadRequestException('Assignee is not an active user in this tenant.');
    }
    const plan = await this.records.insertPlan({
      tenantId: actor.tenantId,
      companyId: input.companyId,
      recommendationId: input.recommendationId ?? null,
      title: input.title,
      objective: input.objective,
      issue: input.issue,
      priority: input.priority,
      status: 'open',
      assignedUserId: input.assignedUserId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      evidence: input.evidence,
      expectedOutcome: input.expectedOutcome,
      createdBy: actor.userId,
    });
    await this.workflows?.dispatchEvent(actor.tenantId, 'retention_plan_created', `retention-plan:${plan.id}`).catch(() => undefined);
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'retention.plan_created',
      entityType: 'retention_action_plan',
      entityId: plan.id,
      description: 'Retention action plan created.',
    });
    return plan;
  }

  async completePlan(actor: Actor, id: string, actualOutcome: string) {
    if (!actualOutcome.trim()) throw new BadRequestException('Record what actually happened. A completed plan is not proof that churn was prevented.');
    const plan = await this.records.updatePlan(actor.tenantId, id, { status: 'completed', actualOutcome: actualOutcome.trim().slice(0, 500) });
    if (!plan) throw new NotFoundException('Action plan was not found.');
    await this.workflows?.dispatchEvent(actor.tenantId, 'retention_action_completed', `retention-plan:${plan.id}`).catch(() => undefined);
    return plan;
  }

  async correctFeedback(actor: Actor, id: string, polarity: 'explicit_positive' | 'explicit_negative' | 'explicit_concern' | 'not_feedback') {
    const row = await this.records.updateFeedback(actor.tenantId, id, polarity, 'corrected', actor.userId);
    if (!row) throw new NotFoundException('Feedback row was not found.');
    return row;
  }

  async draft(actor: Actor, companyId: string) {
    const account = await this.records.account(actor.tenantId, companyId);
    if (!account) throw new NotFoundException('No retention assessment is stored for this company.');
    const companyName = (await this.records.companyName(actor.tenantId, companyId)) ?? 'there';
    const signals = Array.isArray(account.signals) ? account.signals as RetentionSignal[] : [];
    const draft = retentionDraft({
      companyName,
      classification: account.classification as HealthClass,
      evidence: signals.map((signal) => signal.summary),
    });
    const accepted = acceptDraftText(draft.body, { companyName });
    return {
      ...(accepted.ok ? draft : retentionDraft({ companyName: 'there', classification: account.classification as HealthClass, evidence: [] })),
      sent: false,
      approvalRequiredToSend: true,
    };
  }

  private async emitChanges(tenantId: string, companyId: string, previous: string | undefined, next: string, signals: RetentionSignal[]) {
    if (!this.workflows) return;
    const codes = new Set(signals.map((signal) => signal.code));
    const emit = (trigger: string, reference: string) => this.workflows?.dispatchEvent(tenantId, trigger, reference).catch(() => undefined);
    if (previous && previous !== next) await emit('relationship_health_changed', `health:${companyId}:${next}`);
    if (next === 'at_risk') await emit('customer_at_risk', `at-risk:${companyId}:${next}`);
    if (codes.has('inactivity')) await emit('customer_inactivity_detected', `inactive:${companyId}`);
    if (codes.has('unanswered_message')) await emit('unanswered_message_detected', `unanswered:${companyId}`);
    if (codes.has('explicit_complaint')) await emit('customer_complaint', `retention-complaint:${companyId}`);
    if (codes.has('explicit_complaint') || codes.has('explicit_concern')) await emit('customer_feedback_received', `feedback:${companyId}`);
  }
}

function presentAccount(row: {
  id: string;
  companyId: string;
  classification: string;
  confidence: string;
  dataSufficiency: string;
  explanation: string;
  signals: unknown;
  lastInteractionAt: Date | null;
  assessedAt: Date;
}) {
  return {
    id: row.id,
    companyId: row.companyId,
    classification: row.classification,
    confidence: row.confidence,
    dataSufficiency: row.dataSufficiency,
    explanation: row.explanation,
    signals: row.signals,
    lastInteractionAt: row.lastInteractionAt?.toISOString() ?? null,
    assessedAt: row.assessedAt.toISOString(),
    method: 'heuristic' as const,
    predictiveModel: false,
    churnProbability: null,
  };
}
