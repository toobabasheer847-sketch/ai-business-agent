import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, inArray, lt } from 'drizzle-orm';
import { Inject } from '@nestjs/common';

import { ApprovalService } from '../../ai/approvals/approval.service';
import { TaskService } from '../../ai/agents/task/task.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.service';
import { operationalExceptions } from '../../database/drizzle/schema/operational-exception.schema';
import { tasks } from '../../database/drizzle/schema/task.schema';
import { LeadService } from '../lead/lead.service';
import { LeadStatus } from '../lead/dto/create-lead.dto';
import type {
  ActionOutcome,
  ConditionContext,
  WorkflowStep,
} from './workflow.types';

const LEAD_STATUS = new Set(Object.values(LeadStatus));

@Injectable()
export class WorkflowActionRegistry {
  constructor(
    private readonly tasks: TaskService,
    private readonly leads: LeadService,
    private readonly approvals: ApprovalService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async run(input: {
    tenantId: string;
    userId: string;
    role?: string;
    executionId: string;
    step: WorkflowStep;
    context: ConditionContext;
  }): Promise<ActionOutcome> {
    try {
      return await this.dispatch(input);
    } catch (error) {
      return classify(error);
    }
  }

  private async dispatch(input: {
    tenantId: string;
    userId: string;
    role?: string;
    executionId: string;
    step: WorkflowStep;
    context: ConditionContext;
  }): Promise<ActionOutcome> {
    const { step, context } = input;
    const fields = step.inputSnapshot;
    if (step.actionType === 'send_email' || step.actionType === 'send_sms') {
      return this.requestSend(input);
    }
    if (
      step.actionType === 'create_task' ||
      step.actionType === 'create_proposal_reminder'
    ) {
      const title =
        step.actionType === 'create_proposal_reminder'
          ? `Proposal reminder: ${fields.title ?? 'Follow up'}`
          : fields.title;
      if (!title) throw new BadRequestException('A task title is required.');
      const created = await this.tasks.createTask(
        {
          title,
          description: fields.description,
          priority: fields.priority,
          assignedTo: fields.assignedTo,
          dueAt: fields.dueAt,
          companyId: fields.companyId,
          leadId:
            fields.useTriggerLead === 'true' ? context.leadId : fields.leadId,
          prospectId: fields.prospectId,
        },
        { tenantId: input.tenantId, userId: input.userId, role: input.role },
      );
      return {
        status: 'completed',
        output: { taskId: created.id, delivered: false },
      };
    }
    if (
      step.actionType === 'update_task' ||
      step.actionType === 'assign_task'
    ) {
      const updated = await this.tasks.updateTask(
        fields.taskId || context.taskId || '',
        {
          title: fields.title,
          status: fields.status,
          assignedTo: fields.assignedTo,
        },
        { tenantId: input.tenantId, userId: input.userId, role: input.role },
      );
      return {
        status: 'completed',
        output: { taskId: updated.id, delivered: false },
      };
    }
    if (step.actionType === 'update_lead') {
      const leadId =
        fields.useTriggerLead === 'true' ? context.leadId : fields.leadId;
      if (!leadId) throw new BadRequestException('A lead is required.');
      if (fields.status && !LEAD_STATUS.has(fields.status as LeadStatus)) {
        throw new BadRequestException('Lead status is not supported.');
      }
      const updated = await this.leads.update(input.tenantId, leadId, {
        status: fields.status as LeadStatus | undefined,
        notes: fields.notes,
      });
      return {
        status: 'completed',
        output: { leadId: updated?.id ?? leadId, delivered: false },
      };
    }
    if (step.actionType === 'generate_business_summary') {
      const summary = await this.summary(
        input.tenantId,
        fields.topic || 'business',
      );
      return { status: 'completed', output: { ...summary, delivered: false } };
    }
    return {
      status: 'completed',
      output: {
        delivered: false,
        draft: true,
        message:
          fields.message || fields.body || fields.topic || fields.title || '',
      },
    };
  }

  private async requestSend(input: {
    tenantId: string;
    userId: string;
    role?: string;
    step: WorkflowStep;
  }): Promise<ActionOutcome> {
    const fields = input.step.inputSnapshot;
    const actionType =
      input.step.actionType === 'send_email' ? 'email.send' : 'sms.send';
    const proposed = await this.approvals.propose({
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      actionType,
      title: actionType === 'email.send' ? 'Workflow email' : 'Workflow SMS',
      description:
        'A workflow is waiting for a person to approve this customer message.',
      targetEntityType: 'workflow_step',
      targetEntityId: input.step.id,
      payload: fields,
      agentName: 'workflow',
    });
    if (!proposed.required || !proposed.approval) {
      return {
        status: 'failed',
        retryable: false,
        errorCode: 'approval_required',
        error:
          'Sensitive actions stay blocked until the Approval Center accepts them.',
      };
    }
    return {
      status: 'waiting',
      approvalId: proposed.approval.id,
      output: { approvalId: proposed.approval.id, delivered: false },
    };
  }

  private async summary(tenantId: string, topic: string) {
    const [overdue] = await this.db
      .select({ total: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          inArray(tasks.status, ['pending', 'in_progress']),
          lt(tasks.dueAt, new Date()),
        ),
      );
    const [open] = await this.db
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
      );
    const overdueTasks = Number(overdue?.total ?? 0);
    const openExceptions = Number(open?.total ?? 0);
    return {
      topic,
      overdueTasks,
      openExceptions,
      source: 'rule',
      text: `Rule summary, not a forecast: ${overdueTasks} overdue tasks and ${openExceptions} open exceptions.`,
    };
  }
}

function classify(error: unknown): ActionOutcome {
  if (error instanceof NotFoundException) {
    return {
      status: 'failed',
      retryable: false,
      errorCode: 'not_found',
      error: error.message,
    };
  }
  if (error instanceof BadRequestException) {
    return {
      status: 'failed',
      retryable: false,
      errorCode: 'invalid_input',
      error: error.message,
    };
  }
  const message = error instanceof Error ? error.message : 'Action failed.';
  const timeout = /timeout|timed out/i.test(message);
  const retryable =
    timeout || /unavailable|ECONNRESET|ETIMEDOUT/i.test(message);
  return {
    status: 'failed',
    retryable,
    errorCode: timeout ? 'provider_timeout' : 'action_failed',
    error: message.slice(0, 300),
  };
}
