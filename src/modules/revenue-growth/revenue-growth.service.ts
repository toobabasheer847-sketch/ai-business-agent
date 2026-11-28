import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { TaskService } from '../../ai/agents/task/task.service';
import { ExceptionService } from '../exceptions/exception.service';
import { acceptDraftText } from '../omnichannel/communication-rules';
import { WorkflowService } from '../workflows/workflow.service';
import { RevenueGrowthRepository } from './revenue-growth.repository';
import {
  DEFAULT_GROWTH_THRESHOLDS,
  OPPORTUNITY_STATUSES,
  canTransitionOpportunity,
  discoverOpportunities,
  growthDraft,
  growthException,
  growthTaskMarker,
  monitorGrowth,
  priorityRank,
  shouldOpenGrowth,
  summarizeGrowth,
  validateGrowthThresholds,
  type DiscoveredOpportunity,
  type OpportunityStatus,
} from './growth-rules';

type Actor = { tenantId: string; userId: string; role?: string };
const TERMINAL_OUTCOMES = new Set<OpportunityStatus>([
  'converted',
  'won',
  'lost',
  'dismissed',
  'closed',
]);

@Injectable()
export class RevenueGrowthService {
  constructor(
    private readonly records: RevenueGrowthRepository,
    @Optional() private readonly tasks?: TaskService,
    @Optional() private readonly exceptions?: ExceptionService,
    @Optional() private readonly workflows?: WorkflowService,
  ) {}

  async getPolicy(tenantId: string) {
    const saved = await this.records.policy(tenantId);
    return {
      saved: Boolean(saved),
      leadQuietDays:
        saved?.leadQuietDays ?? DEFAULT_GROWTH_THRESHOLDS.leadQuietDays,
      proposalFollowUpDays:
        saved?.proposalFollowUpDays ??
        DEFAULT_GROWTH_THRESHOLDS.proposalFollowUpDays,
      scoring:
        'Rank 3 is an explicit stored request, rank 2 is a dated proposal follow-up or an overdue task, and rank 1 is a quiet lead or prospect. The rank is not a probability and not a currency amount.',
    };
  }

  async savePolicy(
    actor: Actor,
    input: { leadQuietDays: number; proposalFollowUpDays: number },
  ) {
    const checked = validateGrowthThresholds(input);
    if (!checked.ok) throw new BadRequestException(checked.error);
    const saved = await this.records.savePolicy(
      actor.tenantId,
      actor.userId,
      checked.value,
    );
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'growth.policy',
      description: 'Updated growth review windows.',
    });
    return saved;
  }

  async refresh(actor: Actor) {
    const policy = await this.getPolicy(actor.tenantId);
    const evidence = await this.records.evidence(actor.tenantId);
    const found = discoverOpportunities(evidence, policy);
    const stored = await this.records.stored(actor.tenantId);
    const keys = stored.map((row) => row.signalKey);
    let created = 0;
    let closed = 0;
    const current = new Set(found.opportunities.map((item) => item.signalKey));

    for (const item of found.opportunities) {
      if (!shouldOpenGrowth(keys, item.signalKey)) continue;
      const row = await this.records.insertOpportunity({
        tenantId: actor.tenantId,
        companyId: item.companyId,
        leadId: item.leadId,
        prospectId: item.prospectId,
        proposalId: item.proposalId,
        signalKey: item.signalKey,
        opportunityType: item.type,
        title: item.title,
        description: item.description,
        evidence: item.evidence,
        explicit: item.explicit,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        priority: item.priority,
        priorityRank: item.priorityRank,
        prioritySource: 'heuristic',
        confidence: item.confidence,
        status: 'identified',
        recommendedAction: item.action,
      });
      if (!row) continue;
      created += 1;
      await this.records.addEvent({
        tenantId: actor.tenantId,
        opportunityId: row.id,
        fromStatus: null,
        toStatus: 'identified',
        note: 'Identified from stored records.',
        actorId: actor.userId,
      });
      await this.emitIdentified(actor.tenantId, row.id, item);
    }

    for (const row of stored) {
      if (
        !['identified', 'needs_review'].includes(row.status) ||
        current.has(row.signalKey)
      )
        continue;
      const updated = await this.records.updateOpportunity(
        actor.tenantId,
        row.id,
        {
          status: 'closed',
          outcome:
            'The stored condition is no longer present. This is not a lost sale.',
          resolvedAt: new Date(),
        },
      );
      if (!updated) continue;
      closed += 1;
      await this.records.addEvent({
        tenantId: actor.tenantId,
        opportunityId: row.id,
        fromStatus: row.status,
        toStatus: 'closed',
        note: 'The stored condition is no longer present.',
        actorId: actor.userId,
      });
    }

    await this.records.saveScan(actor.tenantId, actor.userId, {
      insufficientLeads: found.insufficientLeads,
      truncated: evidence.truncated,
    });
    const snapshot = await this.records.snapshot(actor.tenantId);
    const planIds = new Set(snapshot.planRows.map((row) => row.opportunityId));
    const overdueIds = new Set(snapshot.overdueIds);
    const monitored = snapshot.rows.flatMap((row) =>
      monitorGrowth({
        id: row.id,
        signalKey: row.signalKey,
        type: row.type,
        title: row.title,
        evidence: row.evidence,
        priority: row.priority,
        status: row.status,
        assignedTo: row.assignedTo,
        companyId: row.companyId,
        hasPlan: planIds.has(row.id),
        taskOverdue: overdueIds.has(row.id),
      }),
    );
    const drafts = [
      ...found.opportunities
        .map((item) => growthException(item.companyId, item))
        .filter((item) => item !== null),
      ...monitored,
    ];
    await this.exceptions
      ?.recordDrafts(actor.tenantId, drafts)
      .catch(() => undefined);
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'growth.refresh',
      description: `Created ${created} growth opportunities and closed ${closed} that no longer match stored records.`,
    });
    return {
      created,
      closed,
      truncated: evidence.truncated,
      insufficientLeads: found.insufficientLeads,
    };
  }

  async list(
    tenantId: string,
    filter: {
      type?: string;
      status?: string;
      priority?: string;
      page: number;
      limit: number;
    },
  ) {
    const page = await this.records.list(tenantId, filter);
    return {
      ...page,
      page: filter.page,
      limit: filter.limit,
      data: page.data.map((row) =>
        this.present(row.opportunity, row.companyName),
      ),
    };
  }

  async detail(tenantId: string, id: string) {
    const row = await this.records.opportunity(tenantId, id);
    if (!row) throw new NotFoundException('Growth opportunity was not found.');
    const [events, plans] = await Promise.all([
      this.records.events(tenantId, id),
      this.records.plans(tenantId, id),
    ]);
    return {
      opportunity: this.present(row.opportunity, row.companyName),
      events,
      plans,
    };
  }

  async listPlans(tenantId: string) {
    return this.records.plans(tenantId);
  }

  async history(tenantId: string, id: string) {
    const row = await this.records.opportunity(tenantId, id);
    if (!row) throw new NotFoundException('Growth opportunity was not found.');
    return this.records.events(tenantId, id);
  }

  async updateStatus(
    actor: Actor,
    id: string,
    status: OpportunityStatus,
    outcome?: string,
  ) {
    if (!OPPORTUNITY_STATUSES.includes(status))
      throw new BadRequestException('Status is not recognized.');
    const row = await this.requireOpportunity(actor.tenantId, id);
    const from = row.opportunity.status as OpportunityStatus;
    if (from === status) return this.present(row.opportunity, row.companyName);
    if (!canTransitionOpportunity(from, status))
      throw new BadRequestException(`Cannot move from ${from} to ${status}.`);
    if (
      TERMINAL_OUTCOMES.has(status) &&
      (!outcome || outcome.trim().length < 3)
    ) {
      throw new BadRequestException(
        'Record an outcome of at least 3 characters.',
      );
    }
    if (
      status === 'won' &&
      !(await this.records.companyHasAccepted(
        actor.tenantId,
        row.opportunity.companyId,
      ))
    ) {
      throw new BadRequestException(
        'Won requires an accepted proposal already stored for this company.',
      );
    }
    if (status === 'converted') {
      if (!row.opportunity.leadId)
        throw new BadRequestException('Converted requires a related lead.');
      const leadStatus = await this.records.leadStatus(
        actor.tenantId,
        row.opportunity.leadId,
      );
      if (leadStatus !== 'converted')
        throw new BadRequestException('The lead is not converted in the CRM.');
    }
    const now = new Date();
    const updated = await this.records.updateOpportunity(actor.tenantId, id, {
      status,
      outcome: outcome?.trim().slice(0, 500) ?? row.opportunity.outcome,
      reviewedAt:
        status === 'needs_review' || status === 'qualified'
          ? now
          : row.opportunity.reviewedAt,
      resolvedAt: TERMINAL_OUTCOMES.has(status)
        ? now
        : row.opportunity.resolvedAt,
    });
    if (!updated)
      throw new NotFoundException('Growth opportunity was not found.');
    await this.records.addEvent({
      tenantId: actor.tenantId,
      opportunityId: id,
      fromStatus: from,
      toStatus: status,
      note: outcome?.trim().slice(0, 400) || `Status changed to ${status}.`,
      actorId: actor.userId,
    });
    const trigger =
      status === 'qualified'
        ? 'growth_opportunity_qualified'
        : 'growth_status_changed';
    await this.emit(actor.tenantId, trigger, `growth:${id}:${status}`, id);
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'growth.status',
      entityId: id,
      description: `Status ${from} to ${status}.`,
    });
    return this.present(updated, row.companyName);
  }

  async assign(actor: Actor, id: string, assignedTo: string) {
    if (!(await this.records.userInTenant(actor.tenantId, assignedTo))) {
      throw new BadRequestException(
        'Assignee is not an active user in this tenant.',
      );
    }
    const row = await this.requireOpportunity(actor.tenantId, id);
    const updated = await this.records.updateOpportunity(actor.tenantId, id, {
      assignedTo,
    });
    if (!updated)
      throw new NotFoundException('Growth opportunity was not found.');
    await this.records.addEvent({
      tenantId: actor.tenantId,
      opportunityId: id,
      fromStatus: row.opportunity.status,
      toStatus: row.opportunity.status,
      note: 'Assignee updated.',
      actorId: actor.userId,
    });
    await this.emit(
      actor.tenantId,
      'growth_opportunity_assigned',
      `growth-assign:${id}:${assignedTo}`,
      id,
    );
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'growth.assign',
      entityId: id,
      description: 'Assigned a growth opportunity.',
    });
    return this.present(updated, row.companyName);
  }

  async prioritize(
    actor: Actor,
    id: string,
    priority: 'high' | 'medium' | 'low',
  ) {
    const row = await this.requireOpportunity(actor.tenantId, id);
    const updated = await this.records.updateOpportunity(actor.tenantId, id, {
      priority,
      priorityRank: priorityRank(priority),
      prioritySource: 'manual',
    });
    if (!updated)
      throw new NotFoundException('Growth opportunity was not found.');
    if (row.opportunity.priority !== priority) {
      await this.emit(
        actor.tenantId,
        'growth_priority_changed',
        `growth-priority:${id}:${priority}`,
        id,
      );
    }
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'growth.priority',
      entityId: id,
      description: `Manual priority ${priority}. This is not a revenue value.`,
    });
    return this.present(updated, row.companyName);
  }

  async createTask(actor: Actor, id: string, assignedUserId?: string) {
    if (!this.tasks)
      throw new BadRequestException('Task service is unavailable.');
    const row = await this.requireOpportunity(actor.tenantId, id);
    if (
      assignedUserId &&
      !(await this.records.userInTenant(actor.tenantId, assignedUserId))
    ) {
      throw new BadRequestException(
        'Assignee is not an active user in this tenant.',
      );
    }
    const marker = growthTaskMarker(id);
    const existing = row.opportunity.taskId
      ? { id: row.opportunity.taskId }
      : await this.records.taskForMarker(actor.tenantId, marker);
    if (existing) return { taskId: existing.id, duplicate: true };
    const policy = await this.getPolicy(actor.tenantId);
    const dueAt = new Date(
      Date.now() + policy.proposalFollowUpDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const task = await this.tasks.createTask(
      {
        title: row.opportunity.title.slice(0, 255),
        description: `${row.opportunity.recommendedAction}\n\n${marker}`,
        priority: row.opportunity.priority === 'high' ? 'high' : 'medium',
        companyId: row.opportunity.companyId,
        prospectId: row.opportunity.prospectId ?? undefined,
        leadId: row.opportunity.leadId ?? undefined,
        assignedTo: assignedUserId,
        dueAt,
      },
      { tenantId: actor.tenantId, userId: actor.userId, role: actor.role },
    );
    await this.records.updateOpportunity(actor.tenantId, id, {
      taskId: task.id,
      assignedTo: assignedUserId ?? row.opportunity.assignedTo,
    });
    return { taskId: task.id, duplicate: false, sent: false };
  }

  async createPlan(
    actor: Actor,
    input: {
      opportunityId: string;
      objective: string;
      expectedOutcome: string;
      assignedUserId?: string;
      dueAt?: string;
    },
  ) {
    if (!this.tasks)
      throw new BadRequestException('Task service is unavailable.');
    const row = await this.requireOpportunity(
      actor.tenantId,
      input.opportunityId,
    );
    if (
      !['qualified', 'action_planned', 'in_progress'].includes(
        row.opportunity.status,
      )
    ) {
      throw new BadRequestException(
        'Qualify the opportunity before creating an action plan.',
      );
    }
    if (
      input.assignedUserId &&
      !(await this.records.userInTenant(actor.tenantId, input.assignedUserId))
    ) {
      throw new BadRequestException(
        'Assignee is not an active user in this tenant.',
      );
    }
    const task = await this.tasks.createTask(
      {
        title: input.objective.slice(0, 255),
        description: `${row.opportunity.evidence}\n\n${growthTaskMarker(row.opportunity.id)}`,
        priority: row.opportunity.priority === 'high' ? 'high' : 'medium',
        companyId: row.opportunity.companyId,
        prospectId: row.opportunity.prospectId ?? undefined,
        leadId: row.opportunity.leadId ?? undefined,
        assignedTo: input.assignedUserId,
        dueAt: input.dueAt,
      },
      { tenantId: actor.tenantId, userId: actor.userId, role: actor.role },
    );
    const plan = await this.records.insertPlan({
      tenantId: actor.tenantId,
      opportunityId: row.opportunity.id,
      companyId: row.opportunity.companyId,
      leadId: row.opportunity.leadId,
      taskId: task.id,
      objective: input.objective.slice(0, 500),
      expectedOutcome: input.expectedOutcome.slice(0, 500),
      priority: row.opportunity.priority,
      status: 'open',
      assignedTo: input.assignedUserId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      createdBy: actor.userId,
    });
    if (row.opportunity.status === 'qualified') {
      await this.records.updateOpportunity(actor.tenantId, row.opportunity.id, {
        status: 'action_planned',
        taskId: task.id,
      });
      await this.records.addEvent({
        tenantId: actor.tenantId,
        opportunityId: row.opportunity.id,
        fromStatus: 'qualified',
        toStatus: 'action_planned',
        note: 'Action plan created.',
        actorId: actor.userId,
      });
    }
    await this.emit(
      actor.tenantId,
      'growth_plan_created',
      `growth-plan:${plan.id}`,
      row.opportunity.id,
    );
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'growth.plan',
      entityId: row.opportunity.id,
      description: 'Created a growth action plan.',
    });
    return plan;
  }

  async updatePlan(
    actor: Actor,
    id: string,
    input: {
      objective?: string;
      expectedOutcome?: string;
      dueAt?: string;
      assignedUserId?: string;
    },
  ) {
    const plan = await this.records.plan(actor.tenantId, id);
    if (!plan) throw new NotFoundException('Action plan was not found.');
    if (plan.status !== 'open')
      throw new BadRequestException('Only an open action plan can be updated.');
    if (
      !input.objective &&
      !input.expectedOutcome &&
      !input.dueAt &&
      !input.assignedUserId
    ) {
      throw new BadRequestException('Provide a field to update.');
    }
    if (
      input.assignedUserId &&
      !(await this.records.userInTenant(actor.tenantId, input.assignedUserId))
    ) {
      throw new BadRequestException(
        'Assignee is not an active user in this tenant.',
      );
    }
    const patch: {
      objective?: string;
      expectedOutcome?: string;
      dueAt?: Date;
      assignedTo?: string;
    } = {};
    if (input.objective) patch.objective = input.objective.slice(0, 500);
    if (input.expectedOutcome)
      patch.expectedOutcome = input.expectedOutcome.slice(0, 500);
    if (input.dueAt) patch.dueAt = new Date(input.dueAt);
    if (input.assignedUserId) patch.assignedTo = input.assignedUserId;
    const updated = await this.records.updatePlan(actor.tenantId, id, patch);
    await this.records.audit({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'growth.plan_update',
      entityId: plan.opportunityId,
      description: 'Updated a growth action plan.',
    });
    return updated;
  }

  async completePlan(actor: Actor, id: string, actualOutcome: string) {
    const outcome = actualOutcome.trim();
    if (outcome.length < 3)
      throw new BadRequestException(
        'Record an actual outcome of at least 3 characters.',
      );
    const plan = await this.records.plan(actor.tenantId, id);
    if (!plan) throw new NotFoundException('Action plan was not found.');
    const updated = await this.records.updatePlan(actor.tenantId, id, {
      status: 'completed',
      actualOutcome: outcome.slice(0, 500),
      completedAt: new Date(),
    });
    const opportunity = await this.records.opportunity(
      actor.tenantId,
      plan.opportunityId,
    );
    if (opportunity?.opportunity.status === 'action_planned') {
      await this.records.updateOpportunity(actor.tenantId, plan.opportunityId, {
        status: 'in_progress',
      });
      await this.records.addEvent({
        tenantId: actor.tenantId,
        opportunityId: plan.opportunityId,
        fromStatus: 'action_planned',
        toStatus: 'in_progress',
        note: 'Action plan completed. This does not record a sale.',
        actorId: actor.userId,
      });
    }
    await this.emit(
      actor.tenantId,
      'growth_action_completed',
      `growth-plan-done:${id}`,
      plan.opportunityId,
    );
    return updated;
  }

  async draft(actor: Actor, id: string) {
    const row = await this.requireOpportunity(actor.tenantId, id);
    const companyName = row.companyName || 'there';
    const kind =
      row.opportunity.opportunityType === 'proposal_follow_up'
        ? 'proposal'
        : [
              'cross_sell',
              'upsell',
              'customer_expansion',
              'customer_requested_service',
            ].includes(row.opportunity.opportunityType)
          ? 'expansion'
          : 'general';
    const draft = growthDraft(companyName, kind);
    const accepted = acceptDraftText(draft.body, { companyName });
    const body = accepted.ok ? accepted.text : growthDraft('there', kind).body;
    return {
      body,
      sent: false as const,
      approvalRequiredToSend: true,
      consentRequiredToSend: true,
      authorKind: 'ai' as const,
      note: draft.note,
      internalSummary: row.opportunity.evidence,
      audience: 'internal-reviewer' as const,
    };
  }

  async analytics(tenantId: string) {
    const [policy, snapshot] = await Promise.all([
      this.records.policy(tenantId),
      this.records.snapshot(tenantId),
    ]);
    const openPlans = new Set(
      snapshot.planRows.map((row) => row.opportunityId),
    );
    const summary = summarizeGrowth({
      types: snapshot.rows.map((row) => row.type),
      statuses: snapshot.rows.map((row) => row.status),
      priorities: snapshot.rows.map((row) => row.priority),
      highPriority: snapshot.rows.filter(
        (row) =>
          row.priority === 'high' &&
          !['dismissed', 'closed', 'won', 'lost'].includes(row.status),
      ).length,
      awaitingReview: snapshot.rows.filter((row) =>
        ['identified', 'needs_review'].includes(row.status),
      ).length,
      withPlans: snapshot.rows.filter((row) => openPlans.has(row.id)).length,
      overdueLinked: new Set(snapshot.overdueIds).size,
      insufficientLeads: policy?.lastInsufficientLeads ?? 0,
    });
    return { ...summary, truncated: policy?.lastTruncated ?? false };
  }

  private async requireOpportunity(tenantId: string, id: string) {
    const row = await this.records.opportunity(tenantId, id);
    if (!row) throw new NotFoundException('Growth opportunity was not found.');
    return row;
  }

  private present(
    opportunity: {
      id: string;
      companyId: string;
      leadId: string | null;
      prospectId: string | null;
      proposalId: string | null;
      opportunityType: string;
      title: string;
      description: string;
      evidence: string;
      explicit: boolean;
      sourceType: string;
      sourceId: string;
      priority: string;
      priorityRank: number;
      prioritySource: string;
      confidence: string;
      status: string;
      recommendedAction: string;
      assignedTo: string | null;
      taskId: string | null;
      outcome: string | null;
      reviewedAt: Date | null;
      resolvedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    companyName: string,
  ) {
    return {
      ...opportunity,
      companyName,
      revenue: null,
      proposalValue: null,
      predictiveModel: false,
    };
  }

  private async emitIdentified(
    tenantId: string,
    id: string,
    item: DiscoveredOpportunity,
  ) {
    await this.emit(
      tenantId,
      'growth_opportunity_identified',
      `growth:${id}`,
      id,
    );
    if (item.type === 'proposal_follow_up')
      await this.emit(
        tenantId,
        'proposal_follow_up_required',
        `proposal-follow-up:${id}`,
        id,
      );
    if (item.type === 'stalled_sales' || item.type === 're_engagement')
      await this.emit(
        tenantId,
        'growth_opportunity_stalled',
        `stalled:${id}`,
        id,
      );
    if (item.type === 'lead_conversion')
      await this.emit(
        tenantId,
        'lead_conversion_recommended',
        `lead-review:${id}`,
        id,
      );
    if (
      item.type === 'cross_sell' ||
      item.type === 'upsell' ||
      item.type === 'customer_expansion' ||
      item.type === 'customer_requested_service'
    ) {
      await this.emit(
        tenantId,
        'customer_expansion_detected',
        `expansion:${id}`,
        id,
      );
    }
  }

  private async emit(
    tenantId: string,
    trigger: string,
    reference: string,
    sourceId: string,
  ) {
    if (!this.workflows) return;
    try {
      const result = await this.workflows.dispatchEvent(
        tenantId,
        trigger,
        reference,
      );
      if ((result?.failed ?? 0) > 0)
        await this.recordWorkflowFailure(tenantId, sourceId, trigger);
    } catch {
      await this.recordWorkflowFailure(tenantId, sourceId, trigger);
    }
  }

  private async recordWorkflowFailure(
    tenantId: string,
    sourceId: string,
    trigger: string,
  ) {
    await this.exceptions
      ?.recordDrafts(tenantId, [
        {
          exceptionKey: `growth:workflow:${sourceId}:${trigger}`,
          category: 'workflow',
          severity: 'medium',
          title: 'A growth workflow did not finish',
          description: `An active workflow for ${trigger} failed. The opportunity record was not rolled back.`,
          sourceType: 'growth_opportunity',
          sourceId,
          recommendedAction:
            'Open the workflow history and the growth opportunity.',
          recommendedActionType: 'review_workflow',
          metadata: { trigger },
        },
      ])
      .catch(() => undefined);
  }
}
