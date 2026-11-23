import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { evaluateConditions } from './workflow-conditions';
import { validateDefinition } from './workflow-definition';
import {
  SENSITIVE_ACTIONS,
  type ActionOutcome,
  type ConditionContext,
  type WorkflowDefinition,
  type WorkflowExecution,
  type WorkflowRecord,
  type WorkflowStatus,
  type WorkflowStep,
} from './workflow.types';

export type WorkflowStore = {
  insertWorkflow(row: WorkflowRecord): Promise<WorkflowRecord>;
  saveWorkflow(row: WorkflowRecord): Promise<WorkflowRecord>;
  findWorkflow(tenantId: string, id: string): Promise<WorkflowRecord | null>;
  insertVersion(input: {
    tenantId: string;
    workflowId: string;
    version: number;
    definition: WorkflowDefinition;
    createdBy: string | null;
  }): Promise<void>;
  insertExecution(
    row: WorkflowExecution,
  ): Promise<{ row: WorkflowExecution; created: boolean }>;
  saveExecution(row: WorkflowExecution): Promise<WorkflowExecution>;
  findExecution(
    tenantId: string,
    id: string,
  ): Promise<WorkflowExecution | null>;
  insertStep(row: WorkflowStep): Promise<WorkflowStep>;
  saveStep(row: WorkflowStep): Promise<WorkflowStep>;
  steps(tenantId: string, executionId: string): Promise<WorkflowStep[]>;
};

export type ActionRunner = {
  run(input: {
    tenantId: string;
    userId: string;
    role?: string;
    executionId: string;
    step: WorkflowStep;
    context: ConditionContext;
  }): Promise<ActionOutcome>;
};

const TERMINAL = new Set([
  'completed',
  'partially_completed',
  'failed',
  'cancelled',
]);

export class WorkflowEngine {
  constructor(
    private readonly store: WorkflowStore,
    private readonly actions: ActionRunner,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: {
    tenantId: string;
    userId: string;
    name: string;
    description: string;
    definition: unknown;
  }): Promise<WorkflowRecord> {
    const definition = this.requireDefinition(input.definition);
    const now = this.now();
    return this.store.insertWorkflow({
      id: randomUUID(),
      tenantId: input.tenantId,
      name: clip(input.name, 160),
      description: clip(input.description, 500),
      status: 'draft',
      triggerType: definition.trigger.type,
      definition,
      version: 1,
      createdBy: input.userId,
      updatedBy: input.userId,
      activatedAt: null,
      pausedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    patch: { name?: string; description?: string; definition?: unknown },
  ) {
    const row = await this.requireWorkflow(tenantId, id);
    if (row.status === 'active')
      throw new ConflictException('Pause the workflow before editing it.');
    const definition =
      patch.definition === undefined
        ? row.definition
        : this.requireDefinition(patch.definition);
    return this.store.saveWorkflow({
      ...row,
      name: patch.name === undefined ? row.name : clip(patch.name, 160),
      description:
        patch.description === undefined
          ? row.description
          : clip(patch.description, 500),
      definition,
      triggerType: definition.trigger.type,
      updatedBy: userId,
      updatedAt: this.now(),
    });
  }

  async activate(tenantId: string, userId: string, id: string) {
    const row = await this.requireWorkflow(tenantId, id);
    if (row.status === 'active') return row;
    const definition = this.requireDefinition(row.definition);
    const version = row.version + (row.activatedAt ? 1 : 0);
    await this.store.insertVersion({
      tenantId,
      workflowId: row.id,
      version,
      definition,
      createdBy: userId,
    });
    return this.store.saveWorkflow({
      ...row,
      status: 'active',
      definition,
      version,
      activatedAt: this.now(),
      pausedAt: null,
      updatedBy: userId,
      updatedAt: this.now(),
    });
  }

  async pause(tenantId: string, userId: string, id: string) {
    return this.move(tenantId, userId, id, 'active', 'paused');
  }

  async resume(tenantId: string, userId: string, id: string) {
    const row = await this.requireWorkflow(tenantId, id);
    if (row.status !== 'paused')
      throw new ConflictException(
        `Cannot move a workflow from ${row.status} to active.`,
      );
    return this.activate(tenantId, userId, id);
  }

  async execute(input: {
    tenantId: string;
    userId: string;
    role?: string;
    workflowId: string;
    triggerSource: WorkflowExecution['triggerSource'];
    triggerReference: string;
    context: ConditionContext;
  }): Promise<WorkflowExecution> {
    const workflow = await this.requireWorkflow(
      input.tenantId,
      input.workflowId,
    );
    if (workflow.status !== 'active')
      throw new ConflictException('Only an active workflow can run.');
    if (input.triggerReference.startsWith(`workflow:${workflow.id}`)) {
      throw new ConflictException('A workflow cannot trigger itself.');
    }
    const reference = clip(input.triggerReference, 160);
    const started = await this.store.insertExecution(
      this.freshExecution(workflow, input, reference),
    );
    if (!started.created) return started.row;
    return this.run(
      workflow,
      started.row,
      input.userId,
      input.role,
      input.context,
    );
  }

  async resumeApproval(input: {
    tenantId: string;
    userId: string;
    role?: string;
    executionId: string;
    approval: { id: string; status: string; reference: string | null };
  }): Promise<WorkflowExecution> {
    const execution = await this.requireExecution(
      input.tenantId,
      input.executionId,
    );
    if (execution.status !== 'waiting_for_approval') return execution;
    const steps = await this.store.steps(input.tenantId, execution.id);
    const step = steps.find((item) => item.approvalId === input.approval.id);
    if (!step)
      throw new NotFoundException(
        'The approval is not attached to this execution.',
      );
    if (step.status === 'completed') return execution;
    if (
      input.approval.status === 'pending' ||
      input.approval.status === 'approved' ||
      input.approval.status === 'executing'
    ) {
      return execution;
    }
    if (input.approval.status !== 'executed') {
      const failed = await this.store.saveStep({
        ...step,
        status: 'failed',
        errorCode: `approval_${input.approval.status}`,
        sanitizedError: clip(`Approval ${input.approval.status}.`, 300),
        completedAt: this.now(),
      });
      return this.finish(
        execution,
        [...steps.filter((item) => item.id !== failed.id), failed],
        'failed',
        failed.errorCode,
        failed.sanitizedError,
      );
    }
    const completed = await this.store.saveStep({
      ...step,
      status: 'completed',
      outputSnapshot: {
        ...step.outputSnapshot,
        reference: input.approval.reference,
        resumed: true,
      },
      completedAt: this.now(),
      errorCode: null,
      sanitizedError: null,
    });
    const workflow = await this.requireWorkflow(
      input.tenantId,
      execution.workflowId,
    );
    const merged = steps.map((item) =>
      item.id === completed.id ? completed : item,
    );
    return this.runRemaining(
      workflow,
      execution,
      merged,
      input.userId,
      input.role,
      execution.executionContext,
    );
  }

  async cancel(tenantId: string, _userId: string, executionId: string) {
    const execution = await this.requireExecution(tenantId, executionId);
    if (TERMINAL.has(execution.status))
      throw new ConflictException('This execution can no longer be cancelled.');
    const steps = await this.store.steps(tenantId, execution.id);
    for (const step of steps) {
      if (
        step.status === 'pending' ||
        step.status === 'waiting_for_approval' ||
        step.status === 'running'
      ) {
        await this.store.saveStep({
          ...step,
          status: 'cancelled',
          completedAt: this.now(),
        });
      }
    }
    return this.store.saveExecution({
      ...execution,
      status: 'cancelled',
      completedAt: this.now(),
      durationMs: this.now().getTime() - execution.startedAt.getTime(),
      sanitizedError: 'Cancelled by a manager.',
      updatedAt: this.now(),
    });
  }

  private async run(
    workflow: WorkflowRecord,
    execution: WorkflowExecution,
    userId: string,
    role: string | undefined,
    context: ConditionContext,
  ) {
    const decision = evaluateConditions(
      execution.definitionSnapshot.conditions,
      context,
    );
    if (!decision.ok) {
      return this.finish(
        execution,
        [],
        'completed',
        'conditions_not_met',
        decision.reason,
      );
    }
    const steps: WorkflowStep[] = [];
    for (const action of execution.definitionSnapshot.actions) {
      const step = await this.store.insertStep(
        this.freshStep(execution, action.key, action.type, action.input),
      );
      steps.push(step);
    }
    return this.runRemaining(workflow, execution, steps, userId, role, context);
  }

  private async runRemaining(
    workflow: WorkflowRecord,
    execution: WorkflowExecution,
    steps: WorkflowStep[],
    userId: string,
    role: string | undefined,
    context: ConditionContext,
  ) {
    const definition = execution.definitionSnapshot;
    let currentSteps = steps;
    for (const action of definition.actions) {
      const existing = currentSteps.find((step) => step.stepKey === action.key);
      if (
        !existing ||
        existing.status === 'completed' ||
        existing.status === 'skipped'
      )
        continue;
      if (existing.status === 'waiting_for_approval') {
        return this.finish(
          execution,
          currentSteps,
          'waiting_for_approval',
          null,
          null,
        );
      }
      const outcome = await this.attempt(
        existing,
        definition.settings.maxRetries,
        {
          tenantId: workflow.tenantId,
          userId,
          role,
          executionId: execution.id,
          context,
        },
      );
      currentSteps = currentSteps.map((step) =>
        step.id === outcome.id ? outcome : step,
      );
      if (outcome.status === 'waiting_for_approval') {
        return this.finish(
          execution,
          currentSteps,
          'waiting_for_approval',
          null,
          null,
        );
      }
      if (outcome.status === 'failed') {
        const anyCompleted = currentSteps.some(
          (step) => step.status === 'completed',
        );
        return this.finish(
          execution,
          currentSteps,
          anyCompleted ? 'partially_completed' : 'failed',
          outcome.errorCode,
          outcome.sanitizedError,
        );
      }
    }
    return this.finish(execution, currentSteps, 'completed', null, null);
  }

  private async attempt(
    step: WorkflowStep,
    maxRetries: number,
    scope: {
      tenantId: string;
      userId: string;
      role?: string;
      executionId: string;
      context: ConditionContext;
    },
  ): Promise<WorkflowStep> {
    let current = step;
    const retryableAction = !SENSITIVE_ACTIONS.has(step.actionType);
    const attempts = retryableAction ? maxRetries + 1 : 1;
    for (
      let attempt = current.attemptCount + 1;
      attempt <= attempts;
      attempt += 1
    ) {
      current = await this.store.saveStep({
        ...current,
        status: attempt > 1 ? 'running' : 'running',
        attemptCount: attempt,
        startedAt: current.startedAt ?? this.now(),
      });
      const result = await this.actions.run({ ...scope, step: current });
      if (result.status === 'completed') {
        return this.store.saveStep({
          ...current,
          status: 'completed',
          outputSnapshot: sanitizeOutput(result.output),
          completedAt: this.now(),
          errorCode: null,
          sanitizedError: null,
        });
      }
      if (result.status === 'waiting') {
        return this.store.saveStep({
          ...current,
          status: 'waiting_for_approval',
          approvalId: result.approvalId,
          outputSnapshot: sanitizeOutput(result.output),
        });
      }
      const failed: WorkflowStep = {
        ...current,
        status: 'failed',
        errorCode: clip(result.errorCode, 80),
        sanitizedError: clip(result.error, 300),
        completedAt: this.now(),
      };
      if (!result.retryable || !retryableAction || attempt >= attempts) {
        return this.store.saveStep(failed);
      }
      current = failed;
    }
    return current;
  }

  private async move(
    tenantId: string,
    userId: string,
    id: string,
    from: WorkflowStatus,
    to: WorkflowStatus,
  ) {
    const row = await this.requireWorkflow(tenantId, id);
    if (row.status !== from)
      throw new ConflictException(
        `Cannot move a workflow from ${row.status} to ${to}.`,
      );
    return this.store.saveWorkflow({
      ...row,
      status: to,
      pausedAt: to === 'paused' ? this.now() : null,
      updatedBy: userId,
      updatedAt: this.now(),
    });
  }

  private freshExecution(
    workflow: WorkflowRecord,
    input: {
      tenantId: string;
      userId: string;
      triggerSource: WorkflowExecution['triggerSource'];
      context: ConditionContext;
    },
    reference: string,
  ): WorkflowExecution {
    const now = this.now();
    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      triggerSource: input.triggerSource,
      triggerReference: reference,
      status: 'running',
      startedAt: now,
      completedAt: null,
      durationMs: null,
      errorCode: null,
      sanitizedError: null,
      executionContext: input.context,
      triggeredBy: input.userId,
      definitionSnapshot: workflow.definition,
      createdAt: now,
      updatedAt: now,
    };
  }

  private freshStep(
    execution: WorkflowExecution,
    key: string,
    type: WorkflowStep['actionType'],
    input: Record<string, string>,
  ): WorkflowStep {
    return {
      id: randomUUID(),
      tenantId: execution.tenantId,
      executionId: execution.id,
      stepKey: key,
      actionType: type,
      status: 'pending',
      inputSnapshot: input,
      outputSnapshot: {},
      approvalId: null,
      attemptCount: 0,
      startedAt: null,
      completedAt: null,
      errorCode: null,
      sanitizedError: null,
      createdAt: this.now(),
    };
  }

  private async finish(
    execution: WorkflowExecution,
    _steps: WorkflowStep[],
    status: WorkflowExecution['status'],
    errorCode: string | null,
    error: string | null,
  ) {
    const now = this.now();
    return this.store.saveExecution({
      ...execution,
      status,
      completedAt:
        status === 'waiting_for_approval' ||
        status === 'running' ||
        status === 'retrying'
          ? null
          : now,
      durationMs: now.getTime() - execution.startedAt.getTime(),
      errorCode,
      sanitizedError: error ? clip(error, 300) : null,
      updatedAt: now,
    });
  }

  private async requireWorkflow(tenantId: string, id: string) {
    const row = await this.store.findWorkflow(tenantId, id);
    if (!row || row.tenantId !== tenantId)
      throw new NotFoundException('Workflow not found.');
    return row;
  }

  private async requireExecution(tenantId: string, id: string) {
    const row = await this.store.findExecution(tenantId, id);
    if (!row || row.tenantId !== tenantId)
      throw new NotFoundException('Execution not found.');
    return row;
  }

  private requireDefinition(input: unknown): WorkflowDefinition {
    const result = validateDefinition(input);
    if (!result.ok) throw new BadRequestException(result.errors.join(' '));
    return result.definition;
  }
}

function sanitizeOutput(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/token|password|secret|api[_-]?key/i.test(key)) continue;
    if (typeof entry === 'string')
      output[key] = entry
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .slice(0, 300);
    else if (
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    )
      output[key] = entry;
  }
  return output;
}

function clip(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}
