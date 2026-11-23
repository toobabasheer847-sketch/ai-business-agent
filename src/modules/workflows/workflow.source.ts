import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { aiApprovals } from '../../database/drizzle/schema/ai-approval.schema';
import { leads } from '../../database/drizzle/schema/lead.schema';
import { operationalExceptions } from '../../database/drizzle/schema/operational-exception.schema';
import { proposals } from '../../database/drizzle/schema/proposal.schema';
import { tasks } from '../../database/drizzle/schema/task.schema';
import { scheduleReference, scheduledDue } from './workflow-conditions';
import type { ConditionContext, WorkflowRecord } from './workflow.types';

const LIMIT = 50;

export type TriggerCandidate = {
  workflow: WorkflowRecord;
  reference: string;
  source: 'schedule' | 'event';
  context: ConditionContext;
};

@Injectable()
export class WorkflowTriggerSource {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async candidates(
    tenantId: string,
    rows: WorkflowRecord[],
    now: Date,
  ): Promise<TriggerCandidate[]> {
    const found: TriggerCandidate[] = [];
    for (const workflow of rows) {
      if (workflow.triggerType === 'manual') continue;
      if (workflow.triggerType === 'scheduled') {
        found.push(...(await this.scheduled(tenantId, workflow, now)));
      } else if (workflow.triggerType === 'new_lead') {
        found.push(...(await this.newLeads(tenantId, workflow, now)));
      } else if (workflow.triggerType === 'task_overdue') {
        found.push(...(await this.overdueTasks(tenantId, workflow, now)));
      } else if (workflow.triggerType === 'proposal_expiring') {
        found.push(...(await this.expiringProposals(tenantId, workflow, now)));
      } else if (workflow.triggerType === 'approval_completed') {
        found.push(...(await this.approvals(tenantId, workflow, now)));
      } else if (workflow.triggerType === 'exception_detected') {
        found.push(...(await this.exceptions(tenantId, workflow, now)));
      }
    }
    return found;
  }

  private async scheduled(
    tenantId: string,
    workflow: WorkflowRecord,
    now: Date,
  ): Promise<TriggerCandidate[]> {
    if (!scheduledDue(workflow.definition.trigger, now)) return [];
    const leadCondition = workflow.definition.conditions.find(
      (condition) =>
        condition.field === 'lead.status' && condition.operator === 'eq',
    );
    if (!leadCondition) {
      return [
        {
          workflow,
          reference: scheduleReference(workflow.id, now),
          source: 'schedule',
          context: {},
        },
      ];
    }
    const cutoff = new Date(now.getTime() - 3 * 86_400_000);
    const rows = await this.db
      .select({
        id: leads.id,
        status: leads.status,
        userId: leads.userId,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, leadCondition.value),
          lt(leads.createdAt, cutoff),
        ),
      )
      .orderBy(leads.createdAt)
      .limit(LIMIT);
    return rows.map((row) => ({
      workflow,
      reference: `lead:${row.id}:follow-up`,
      source: 'schedule' as const,
      context: {
        leadId: row.id,
        leadStatus: row.status,
        assignedUser: row.userId ?? undefined,
      },
    }));
  }

  private async newLeads(
    tenantId: string,
    workflow: WorkflowRecord,
    now: Date,
  ): Promise<TriggerCandidate[]> {
    const since = new Date(now.getTime() - 86_400_000);
    const rows = await this.db
      .select({ id: leads.id, status: leads.status, userId: leads.userId })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, 'new'),
          gte(leads.createdAt, since),
        ),
      )
      .orderBy(desc(leads.createdAt))
      .limit(LIMIT);
    return rows.map((row) => ({
      workflow,
      reference: `lead:${row.id}:new`,
      source: 'event' as const,
      context: {
        leadId: row.id,
        leadStatus: row.status,
        assignedUser: row.userId ?? undefined,
      },
    }));
  }

  private async overdueTasks(
    tenantId: string,
    workflow: WorkflowRecord,
    now: Date,
  ): Promise<TriggerCandidate[]> {
    const day = now.toISOString().slice(0, 10);
    const rows = await this.db
      .select({
        id: tasks.id,
        status: tasks.status,
        dueAt: tasks.dueAt,
        assignedTo: tasks.assignedTo,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          inArray(tasks.status, ['pending', 'in_progress']),
          lt(tasks.dueAt, now),
        ),
      )
      .orderBy(tasks.dueAt)
      .limit(LIMIT);
    return rows.map((row) => ({
      workflow,
      reference: `task:${row.id}:overdue:${day}`,
      source: 'event' as const,
      context: {
        taskId: row.id,
        taskStatus: row.status,
        taskDueAt: row.dueAt?.toISOString(),
        assignedUser: row.assignedTo ?? undefined,
      },
    }));
  }

  private async expiringProposals(
    tenantId: string,
    workflow: WorkflowRecord,
    now: Date,
  ): Promise<TriggerCandidate[]> {
    const days = workflow.definition.trigger.withinDays ?? 3;
    const until = new Date(now.getTime() + days * 86_400_000);
    const day = now.toISOString().slice(0, 10);
    const rows = await this.db
      .select({
        id: proposals.id,
        status: proposals.status,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.tenantId, tenantId),
          inArray(proposals.status, ['sent', 'viewed']),
          gte(proposals.validUntil, now),
          lt(proposals.validUntil, until),
        ),
      )
      .orderBy(proposals.validUntil)
      .limit(LIMIT);
    return rows.map((row) => ({
      workflow,
      reference: `proposal:${row.id}:expiring:${day}`,
      source: 'event' as const,
      context: { proposalId: row.id, proposalStatus: row.status },
    }));
  }

  private async approvals(
    tenantId: string,
    workflow: WorkflowRecord,
    now: Date,
  ): Promise<TriggerCandidate[]> {
    const since = new Date(now.getTime() - 2 * 86_400_000);
    const rows = await this.db
      .select({ id: aiApprovals.id, status: aiApprovals.status })
      .from(aiApprovals)
      .where(
        and(
          eq(aiApprovals.tenantId, tenantId),
          inArray(aiApprovals.status, ['executed', 'rejected', 'expired']),
          ne(aiApprovals.targetEntityType, 'workflow_step'),
          gte(aiApprovals.updatedAt, since),
        ),
      )
      .orderBy(desc(aiApprovals.updatedAt))
      .limit(LIMIT);
    return rows.map((row) => ({
      workflow,
      reference: `approval:${row.id}`,
      source: 'event' as const,
      context: { approvalId: row.id },
    }));
  }

  private async exceptions(
    tenantId: string,
    workflow: WorkflowRecord,
    now: Date,
  ): Promise<TriggerCandidate[]> {
    const since = new Date(now.getTime() - 2 * 86_400_000);
    const severity = workflow.definition.trigger.severity;
    const rows = await this.db
      .select({
        id: operationalExceptions.id,
        severity: operationalExceptions.severity,
      })
      .from(operationalExceptions)
      .where(
        and(
          eq(operationalExceptions.tenantId, tenantId),
          sql`${operationalExceptions.status} in ('open', 'acknowledged', 'in_progress')`,
          ne(operationalExceptions.sourceType, 'workflow_execution'),
          severity ? eq(operationalExceptions.severity, severity) : undefined,
          gte(operationalExceptions.lastDetectedAt, since),
        ),
      )
      .orderBy(desc(operationalExceptions.lastDetectedAt))
      .limit(LIMIT);
    return rows.map((row) => ({
      workflow,
      reference: `exception:${row.id}`,
      source: 'event' as const,
      context: { exceptionId: row.id, exceptionSeverity: row.severity },
    }));
  }
}
