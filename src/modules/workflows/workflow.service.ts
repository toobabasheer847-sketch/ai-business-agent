import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { AgentRunTracker } from '../../ai/monitoring/agent-run.tracker';
import { ApprovalService } from '../../ai/approvals/approval.service';
import type { ApprovalRecord } from '../../ai/approvals/approval.types';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.module';
import { hasPermission, Permission } from '../authorization/permissions';
import { ExceptionService } from '../exceptions/exception.service';
import type { ExceptionDraft } from '../exceptions/exception.types';
import { WorkflowEngine } from './workflow-engine';
import {
  acceptModelProposal,
  interpretInstruction,
  type GenerationResult,
} from './workflow-generate';
import { WorkflowActionRegistry } from './workflow.actions';
import { DrizzleWorkflowStore } from './workflow.store';
import { WorkflowTriggerSource } from './workflow.source';
import {
  WORKFLOW_STATUSES,
  type WorkflowExecution,
  type WorkflowRecord,
} from './workflow.types';

export const WORKFLOW_SCAN_JOB = 'scan-tenant';

@Injectable()
export class WorkflowService {
  private readonly engine: WorkflowEngine;
  private readonly running = new Map<string, Promise<unknown>>();

  constructor(
    private readonly records: DrizzleWorkflowStore,
    private readonly source: WorkflowTriggerSource,
    private readonly actions: WorkflowActionRegistry,
    private readonly approvals: ApprovalService,
    private readonly exceptions: ExceptionService,
    private readonly runs: AgentRunTracker,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_EXECUTION) private readonly queue: Queue,
  ) {
    this.engine = new WorkflowEngine(records, actions);
    this.approvals.onDecision((actor, record) =>
      this.continueAfterApproval(actor, record),
    );
  }

  schedulerAvailable() {
    return Boolean(
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('redis.url'),
    );
  }

  async list(
    tenantId: string,
    raw: { page?: string; limit?: string; search?: string; status?: string },
  ) {
    const page = numberIn(raw.page, 1, 1, 10_000);
    const limit = numberIn(raw.limit, 20, 1, 100);
    const status = raw.status?.trim();
    if (
      status &&
      !WORKFLOW_STATUSES.includes(status as (typeof WORKFLOW_STATUSES)[number])
    ) {
      throw new BadRequestException('status is not supported.');
    }
    const result = await this.records.list(tenantId, {
      search: raw.search?.trim().slice(0, 80) || undefined,
      status,
      limit,
      offset: (page - 1) * limit,
    });
    return {
      data: result.data.map(presentWorkflow),
      total: result.total,
      page,
      limit,
    };
  }

  async summary(tenantId: string) {
    const [counts, failures] = await Promise.all([
      this.records.summary(tenantId),
      this.records.recentFailures(tenantId),
    ]);
    return { ...counts, recentFailures: failures.map(presentExecution) };
  }

  async detail(tenantId: string, id: string) {
    const row = await this.records.findWorkflow(tenantId, id);
    if (!row) throw new NotFoundException('Workflow not found.');
    const history = await this.records.listExecutions(tenantId, id, 1, 0);
    return {
      ...presentWorkflow(row),
      lastExecution: history.data[0] ? presentExecution(history.data[0]) : null,
    };
  }

  create(
    actor: Actor,
    input: { name: string; description?: string; definition: unknown },
  ) {
    this.assertManager(actor.role);
    return this.engine
      .create({
        tenantId: actor.tenantId,
        userId: actor.userId,
        name: input.name,
        description: input.description ?? '',
        definition: input.definition,
      })
      .then(presentWorkflow);
  }

  update(
    actor: Actor,
    id: string,
    patch: { name?: string; description?: string; definition?: unknown },
  ) {
    this.assertManager(actor.role);
    return this.engine
      .update(actor.tenantId, actor.userId, id, patch)
      .then(presentWorkflow);
  }

  activate(actor: Actor, id: string) {
    this.assertManager(actor.role);
    return this.engine
      .activate(actor.tenantId, actor.userId, id)
      .then(presentWorkflow);
  }

  pause(actor: Actor, id: string) {
    this.assertManager(actor.role);
    return this.engine
      .pause(actor.tenantId, actor.userId, id)
      .then(presentWorkflow);
  }

  resume(actor: Actor, id: string) {
    this.assertManager(actor.role);
    return this.engine
      .resume(actor.tenantId, actor.userId, id)
      .then(presentWorkflow);
  }

  async generate(actor: Actor, instruction: string): Promise<GenerationResult> {
    this.assertManager(actor.role);
    const rules = interpretInstruction(instruction);
    const apiKey = this.configService
      .get<string>('GOOGLE_GENAI_API_KEY')
      ?.trim();
    if (!apiKey) return rules;
    try {
      const model =
        this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
      const response = await this.runs.observe(
        {
          tenantId: actor.tenantId,
          userId: actor.userId,
          agentName: 'workflow-generator',
          provider: 'google',
          model,
        },
        async () => {
          const { GoogleGenAI } = await import('@google/genai');
          const client = new GoogleGenAI({ apiKey });
          return client.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [{ text: generationPrompt(instruction) }],
              },
            ],
            config: { responseMimeType: 'application/json', temperature: 0 },
          });
        },
      );
      const text = response.text ?? '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end <= start) return rules;
      const accepted = acceptModelProposal(
        JSON.parse(text.slice(start, end + 1)),
      );
      if (accepted.valid) return accepted;
      return { ...rules, errors: [...accepted.errors, ...rules.errors] };
    } catch {
      return rules;
    }
  }

  async dispatchEvent(tenantId: string, triggerType: string, reference: string) {
    const listed = await this.records.list(tenantId, { status: 'active', limit: 50, offset: 0 });
    let started = 0;
    for (const workflow of listed.data) {
      if (workflow.triggerType !== triggerType || !workflow.createdBy) continue;
      try {
        await this.engine.execute({
          tenantId,
          userId: workflow.createdBy,
          role: 'member',
          workflowId: workflow.id,
          triggerSource: 'event',
          triggerReference: reference.slice(0, 160),
          context: {},
        });
        started += 1;
      } catch {
        // A workflow failure must not block the customer conversation.
      }
    }
    return { started };
  }

  async execute(actor: Actor, id: string) {
    this.assertManager(actor.role);
    const execution = await this.engine.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      role: actor.role,
      workflowId: id,
      triggerSource: 'manual',
      triggerReference: `manual:${randomUUID()}`,
      context: {},
    });
    await this.recordFailure(actor.tenantId, execution);
    return this.withSteps(actor.tenantId, execution);
  }

  async executions(
    tenantId: string,
    workflowId: string,
    raw: { page?: string; limit?: string },
  ) {
    const workflow = await this.records.findWorkflow(tenantId, workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found.');
    const page = numberIn(raw.page, 1, 1, 10_000);
    const limit = numberIn(raw.limit, 20, 1, 100);
    const result = await this.records.listExecutions(
      tenantId,
      workflowId,
      limit,
      (page - 1) * limit,
    );
    const data = await Promise.all(
      result.data.map((row) => this.withSteps(tenantId, row)),
    );
    return { data, total: result.total, page, limit };
  }

  async execution(tenantId: string, id: string) {
    const row = await this.records.findExecution(tenantId, id);
    if (!row) throw new NotFoundException('Execution not found.');
    return this.withSteps(tenantId, row);
  }

  async cancel(actor: Actor, id: string) {
    this.assertManager(actor.role);
    const current = await this.records.findExecution(actor.tenantId, id);
    if (!current) throw new NotFoundException('Execution not found.');
    const steps = await this.records.steps(actor.tenantId, id);
    const waiting = steps.find(
      (step) => step.status === 'waiting_for_approval' && step.approvalId,
    );
    if (waiting?.approvalId) {
      await this.approvals
        .cancel(
          { tenantId: actor.tenantId, userId: actor.userId, role: actor.role },
          waiting.approvalId,
        )
        .catch(() => undefined);
    }
    const cancelled = await this.engine.cancel(
      actor.tenantId,
      actor.userId,
      id,
    );
    return this.withSteps(actor.tenantId, cancelled);
  }

  async scanTenant(tenantId: string) {
    const existing = this.running.get(tenantId);
    if (existing) return existing;
    const work = this.scan(tenantId).finally(() =>
      this.running.delete(tenantId),
    );
    this.running.set(tenantId, work);
    return work;
  }

  async enqueueAll() {
    if (!this.schedulerAvailable()) {
      throw new ServiceUnavailableException(
        'Scheduled workflow execution is unavailable because REDIS_URL is not configured.',
      );
    }
    const tenantIds = await this.records.tenantIds();
    const hour = new Date().toISOString().slice(0, 13);
    let queued = 0;
    for (const tenantId of tenantIds) {
      try {
        await this.queue.add(
          WORKFLOW_SCAN_JOB,
          { tenantId },
          {
            jobId: `workflow-scan:${tenantId}:${hour}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );
        queued += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/already exists|duplicate job/i.test(message)) queued += 1;
      }
    }
    return { queued };
  }

  private async scan(tenantId: string) {
    await this.reconcileApprovals(tenantId);
    const active = await this.records.active(tenantId);
    const candidates = await this.source.candidates(
      tenantId,
      active,
      new Date(),
    );
    let started = 0;
    for (const candidate of candidates) {
      const userId = candidate.workflow.createdBy;
      if (!userId) continue;
      const startedAt = Date.now();
      const execution = await this.engine.execute({
        tenantId,
        userId,
        role: 'admin',
        workflowId: candidate.workflow.id,
        triggerSource: candidate.source,
        triggerReference: candidate.reference,
        context: candidate.context,
      });
      if (execution.createdAt.getTime() >= startedAt - 1000) {
        started += 1;
        await this.recordFailure(tenantId, execution);
      }
    }
    return {
      started,
      schedulerAvailable: this.schedulerAvailable(),
      sendsMessages: false as const,
    };
  }

  private async continueAfterApproval(
    actor: { tenantId: string; userId: string; role?: string },
    approval: ApprovalRecord,
  ) {
    const execution = await this.records.executionForApproval(
      actor.tenantId,
      approval.id,
    );
    if (!execution || execution.status !== 'waiting_for_approval') return;
    const resumed = await this.engine.resumeApproval({
      tenantId: actor.tenantId,
      userId: actor.userId,
      role: actor.role,
      executionId: execution.id,
      approval: {
        id: approval.id,
        status: approval.status,
        reference: approval.executionReference,
      },
    });
    await this.recordFailure(actor.tenantId, resumed);
  }

  private async reconcileApprovals(tenantId: string) {
    const waiting = await this.records.waiting(tenantId);
    for (const execution of waiting) {
      const steps = await this.records.steps(tenantId, execution.id);
      const step = steps.find(
        (item) => item.status === 'waiting_for_approval' && item.approvalId,
      );
      if (!step?.approvalId || !execution.triggeredBy) continue;
      const approval = await this.approvals
        .find(
          { tenantId, userId: execution.triggeredBy, role: 'admin' },
          step.approvalId,
        )
        .catch(() => null);
      if (!approval) continue;
      const resumed = await this.engine.resumeApproval({
        tenantId,
        userId: execution.triggeredBy,
        role: 'admin',
        executionId: execution.id,
        approval: {
          id: approval.id,
          status: approval.status,
          reference: approval.executionReference,
        },
      });
      await this.recordFailure(tenantId, resumed);
    }
  }

  private async recordFailure(tenantId: string, execution: WorkflowExecution) {
    if (
      execution.status !== 'failed' &&
      execution.status !== 'partially_completed'
    )
      return;
    const workflow = await this.records.findWorkflow(
      tenantId,
      execution.workflowId,
    );
    const draft: ExceptionDraft = {
      exceptionKey: `workflow:${execution.id}`,
      category: 'workflow',
      severity: 'high',
      title: `Workflow execution failed: ${clip(workflow?.name ?? 'Workflow', 120)}`,
      description: clip(
        execution.sanitizedError ?? 'A workflow execution failed.',
        500,
      ),
      sourceType: 'workflow_execution',
      sourceId: execution.id,
      recommendedAction:
        'Open the workflow execution and review the failed step before running it again.',
      recommendedActionType: 'review_workflow',
      metadata: {
        rule: 'execution-failed',
        workflowId: execution.workflowId,
        daysOverdue: 0,
      },
    };
    await this.exceptions
      .recordDrafts(tenantId, [draft])
      .catch(() => undefined);
  }

  private async withSteps(tenantId: string, execution: WorkflowExecution) {
    const steps = await this.records.steps(tenantId, execution.id);
    return { ...presentExecution(execution), steps: steps.map(presentStep) };
  }

  private assertManager(role: string | undefined) {
    if (!hasPermission(role, Permission.WorkflowManage)) {
      throw new ForbiddenException(
        'You do not have permission for this action.',
      );
    }
  }
}

type Actor = { tenantId: string; userId: string; role?: string };

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

function presentWorkflow(row: WorkflowRecord) {
  return {
    ...row,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function presentExecution(row: WorkflowExecution) {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function presentStep(
  row: Awaited<ReturnType<DrizzleWorkflowStore['steps']>>[number],
) {
  return {
    ...row,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function generationPrompt(instruction: string) {
  return [
    'Convert the instruction into one workflow JSON object.',
    'schemaVersion must be 1.',
    'trigger.type must be one of: manual, scheduled, new_lead, task_overdue, proposal_expiring, approval_completed, exception_detected.',
    'actions.type must be one of: create_task, update_task, assign_task, update_lead, create_internal_notification, generate_business_summary, create_email_draft, create_sms_draft, send_email, send_sms, create_proposal_reminder, prepare_proposal_follow_up.',
    'Do not invent email addresses, phone numbers, or ids.',
    'Do not include code, SQL, or secrets.',
    'Instruction:',
    instruction.slice(0, 1000),
  ].join('\n');
}

function clip(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max);
}
