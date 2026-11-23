import { ConflictException, NotFoundException } from '@nestjs/common';

import { hasPermission, Permission } from '../authorization/permissions';
import {
  evaluateConditions,
  scheduleReference,
  scheduledDue,
} from './workflow-conditions';
import { validateDefinition } from './workflow-definition';
import {
  WorkflowEngine,
  type ActionRunner,
  type WorkflowStore,
} from './workflow-engine';
import { acceptModelProposal, interpretInstruction } from './workflow-generate';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowRecord,
  WorkflowStep,
} from './workflow.types';

const definition: WorkflowDefinition = {
  schemaVersion: 1,
  trigger: { type: 'manual' },
  conditions: [],
  actions: [
    { key: 'task', type: 'create_task', input: { title: 'Follow up' } },
  ],
  settings: { maxRetries: 1, timeoutMs: 5000 },
};

class MemoryStore implements WorkflowStore {
  workflows: WorkflowRecord[] = [];
  versions: Array<{ workflowId: string; version: number }> = [];
  executions: WorkflowExecution[] = [];
  stepRows: WorkflowStep[] = [];

  async insertWorkflow(row: WorkflowRecord) {
    await Promise.resolve();
    this.workflows.push(row);
    return row;
  }

  async saveWorkflow(row: WorkflowRecord) {
    await Promise.resolve();
    const index = this.workflows.findIndex(
      (item) => item.id === row.id && item.tenantId === row.tenantId,
    );
    this.workflows[index] = row;
    return row;
  }

  async findWorkflow(tenantId: string, id: string) {
    await Promise.resolve();
    return (
      this.workflows.find(
        (item) => item.tenantId === tenantId && item.id === id,
      ) ?? null
    );
  }

  async insertVersion(input: { workflowId: string; version: number }) {
    await Promise.resolve();
    this.versions.push({
      workflowId: input.workflowId,
      version: input.version,
    });
  }

  async insertExecution(row: WorkflowExecution) {
    await Promise.resolve();
    const existing = this.executions.find(
      (item) =>
        item.tenantId === row.tenantId &&
        item.workflowId === row.workflowId &&
        item.triggerReference === row.triggerReference,
    );
    if (existing) return { row: existing, created: false };
    this.executions.push(row);
    return { row, created: true };
  }

  async saveExecution(row: WorkflowExecution) {
    await Promise.resolve();
    const index = this.executions.findIndex(
      (item) => item.id === row.id && item.tenantId === row.tenantId,
    );
    this.executions[index] = row;
    return row;
  }

  async findExecution(tenantId: string, id: string) {
    await Promise.resolve();
    return (
      this.executions.find(
        (item) => item.tenantId === tenantId && item.id === id,
      ) ?? null
    );
  }

  async insertStep(row: WorkflowStep) {
    await Promise.resolve();
    this.stepRows.push(row);
    return row;
  }

  async saveStep(row: WorkflowStep) {
    await Promise.resolve();
    const index = this.stepRows.findIndex(
      (item) => item.id === row.id && item.tenantId === row.tenantId,
    );
    this.stepRows[index] = row;
    return row;
  }

  async steps(tenantId: string, executionId: string) {
    await Promise.resolve();
    return this.stepRows.filter(
      (item) => item.tenantId === tenantId && item.executionId === executionId,
    );
  }
}

function engine(run: ActionRunner['run']) {
  const store = new MemoryStore();
  return {
    store,
    engine: new WorkflowEngine(
      store,
      { run },
      () => new Date('2026-11-16T12:00:00.000Z'),
    ),
  };
}

async function active(subject: WorkflowEngine) {
  const draft = await subject.create({
    tenantId: 'tenant-a',
    userId: 'user-a',
    name: 'Follow up',
    description: 'Lead follow-up',
    definition,
  });
  return subject.activate('tenant-a', 'user-a', draft.id);
}

describe('workflow definition', () => {
  it('rejects unsupported actions and secrets', () => {
    const result = validateDefinition({
      ...definition,
      actions: [{ key: 'bad', type: 'run_sql', input: { password: 'x' } }],
    });
    expect(result.ok).toBe(false);
  });

  it('accepts a manual task workflow', () => {
    expect(validateDefinition(definition).ok).toBe(true);
  });
});

describe('workflow generation', () => {
  it('maps an uncontacted lead instruction to a validated draft', () => {
    const result = interpretInstruction(
      'When a lead has not been contacted for three days, create a follow-up task.',
    );
    expect(result.valid).toBe(true);
    expect(result.proposal?.trigger.type).toBe('scheduled');
    expect(result.proposal?.actions[0].type).toBe('create_task');
    expect(result.summary).toContain('not active');
  });

  it('rejects an unsafe model proposal', () => {
    const result = acceptModelProposal({
      schemaVersion: 1,
      trigger: { type: 'manual' },
      actions: [{ key: 'x', type: 'drop_table', input: {} }],
    });
    expect(result.valid).toBe(false);
    expect(result.source).toBe('model');
  });

  it('asks for the missing email instead of inventing one', () => {
    const result = interpretInstruction(
      'Send an email to the customer about the proposal.',
    );
    expect(result.proposal).toBeNull();
    expect(result.missing).toContain('recipient email');
  });
});

describe('workflow conditions and schedule', () => {
  it('fails closed when the trigger has no lead status', () => {
    expect(
      evaluateConditions(
        [{ field: 'lead.status', operator: 'eq', value: 'new' }],
        {},
      ).ok,
    ).toBe(false);
  });

  it('matches a scheduled hour and weekday', () => {
    const monday = new Date('2026-11-16T08:10:00.000Z');
    expect(scheduledDue({ hourUtc: 8, weekday: 1 }, monday)).toBe(true);
    expect(scheduleReference('wf-1', monday)).toBe(
      'schedule:wf-1:2026-11-16T08',
    );
  });
});

describe('workflow engine', () => {
  it('creates, activates, runs a task action, and ignores a duplicate trigger', async () => {
    const calls: string[] = [];
    const { engine: subject, store } = engine(async (input) => {
      await Promise.resolve();
      calls.push(input.step.actionType);
      return { status: 'completed', output: { taskId: 'task-1' } };
    });
    const workflow = await active(subject);
    const first = await subject.execute({
      tenantId: 'tenant-a',
      userId: 'user-a',
      workflowId: workflow.id,
      triggerSource: 'manual',
      triggerReference: 'manual:1',
      context: {},
    });
    const second = await subject.execute({
      tenantId: 'tenant-a',
      userId: 'user-a',
      workflowId: workflow.id,
      triggerSource: 'manual',
      triggerReference: 'manual:1',
      context: {},
    });
    expect(first.status).toBe('completed');
    expect(second.id).toBe(first.id);
    expect(calls).toEqual(['create_task']);
    expect(store.stepRows[0].outputSnapshot).toEqual({ taskId: 'task-1' });
    expect(store.versions).toEqual([{ workflowId: workflow.id, version: 1 }]);
  });

  it('does not run a paused workflow or another tenant row', async () => {
    const { engine: subject } = engine(async () => {
      await Promise.resolve();
      return { status: 'completed', output: {} };
    });
    const workflow = await active(subject);
    await subject.pause('tenant-a', 'user-a', workflow.id);
    await expect(
      subject.execute({
        tenantId: 'tenant-a',
        userId: 'user-a',
        workflowId: workflow.id,
        triggerSource: 'manual',
        triggerReference: 'manual:2',
        context: {},
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      subject.pause('tenant-b', 'user-b', workflow.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pauses for approval and resumes without repeating the completed step', async () => {
    const seen: string[] = [];
    const { engine: subject } = engine(async (input) => {
      await Promise.resolve();
      seen.push(input.step.stepKey);
      if (input.step.actionType === 'send_email') {
        return {
          status: 'waiting',
          approvalId: 'approval-1',
          output: { approvalId: 'approval-1' },
        };
      }
      return { status: 'completed', output: { taskId: 'task-2' } };
    });
    const draft = await subject.create({
      tenantId: 'tenant-a',
      userId: 'user-a',
      name: 'Mail',
      description: 'Send after a task',
      definition: {
        ...definition,
        actions: [
          {
            key: 'task',
            type: 'create_task',
            input: { title: 'Prepare notes' },
          },
          {
            key: 'mail',
            type: 'send_email',
            input: {
              to: 'ada@example.com',
              subject: 'Hello',
              body: 'Checking in',
            },
          },
        ],
      },
    });
    const workflow = await subject.activate('tenant-a', 'user-a', draft.id);
    const waiting = await subject.execute({
      tenantId: 'tenant-a',
      userId: 'user-a',
      workflowId: workflow.id,
      triggerSource: 'manual',
      triggerReference: 'manual:mail',
      context: {},
    });
    expect(waiting.status).toBe('waiting_for_approval');
    const resumed = await subject.resumeApproval({
      tenantId: 'tenant-a',
      userId: 'user-a',
      executionId: waiting.id,
      approval: { id: 'approval-1', status: 'executed', reference: 'msg-1' },
    });
    expect(resumed.status).toBe('completed');
    expect(seen.filter((key) => key === 'task')).toEqual(['task']);
  });

  it('fails the execution when approval is rejected or expired', async () => {
    const { engine: subject } = engine(async () => {
      await Promise.resolve();
      return {
        status: 'waiting' as const,
        approvalId: 'approval-2',
        output: {},
      };
    });
    const draft = await subject.create({
      tenantId: 'tenant-a',
      userId: 'user-a',
      name: 'Mail',
      description: 'Send',
      definition: {
        ...definition,
        actions: [
          {
            key: 'mail',
            type: 'send_email',
            input: {
              to: 'ada@example.com',
              subject: 'Hello',
              body: 'Checking in',
            },
          },
        ],
      },
    });
    const workflow = await subject.activate('tenant-a', 'user-a', draft.id);
    const waiting = await subject.execute({
      tenantId: 'tenant-a',
      userId: 'user-a',
      workflowId: workflow.id,
      triggerSource: 'manual',
      triggerReference: 'manual:reject',
      context: {},
    });
    const rejected = await subject.resumeApproval({
      tenantId: 'tenant-a',
      userId: 'user-a',
      executionId: waiting.id,
      approval: { id: 'approval-2', status: 'rejected', reference: null },
    });
    expect(rejected.status).toBe('failed');
    expect(rejected.errorCode).toBe('approval_rejected');
    const again = await subject.resumeApproval({
      tenantId: 'tenant-a',
      userId: 'user-a',
      executionId: waiting.id,
      approval: { id: 'approval-2', status: 'expired', reference: null },
    });
    expect(again.status).toBe('failed');
  });

  it('retries a retryable task failure and does not retry a timeout', async () => {
    let attempts = 0;
    const { engine: subject, store } = engine(async () => {
      await Promise.resolve();
      attempts += 1;
      if (attempts === 1)
        return {
          status: 'failed',
          retryable: true,
          errorCode: 'unavailable',
          error: 'database timeout',
        };
      return { status: 'completed', output: { taskId: 'task-3' } };
    });
    const workflow = await active(subject);
    const retried = await subject.execute({
      tenantId: 'tenant-a',
      userId: 'user-a',
      workflowId: workflow.id,
      triggerSource: 'event',
      triggerReference: 'lead:1',
      context: {},
    });
    expect(retried.status).toBe('completed');
    expect(store.stepRows[0].attemptCount).toBe(2);

    const timeout = engine(async () => {
      await Promise.resolve();
      return {
        status: 'failed' as const,
        retryable: false,
        errorCode: 'provider_timeout',
        error: 'provider timeout',
      };
    });
    const second = await active(timeout.engine);
    const failed = await timeout.engine.execute({
      tenantId: 'tenant-a',
      userId: 'user-a',
      workflowId: second.id,
      triggerSource: 'manual',
      triggerReference: 'manual:timeout',
      context: {},
    });
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('provider_timeout');
    expect(timeout.store.stepRows[0].attemptCount).toBe(1);
  });

  it('cancels a waiting execution and blocks self-triggering', async () => {
    const { engine: subject } = engine(async () => {
      await Promise.resolve();
      return {
        status: 'waiting' as const,
        approvalId: 'approval-3',
        output: {},
      };
    });
    const draft = await subject.create({
      tenantId: 'tenant-a',
      userId: 'user-a',
      name: 'Mail',
      description: 'Send',
      definition: {
        ...definition,
        actions: [
          {
            key: 'mail',
            type: 'send_email',
            input: {
              to: 'ada@example.com',
              subject: 'Hello',
              body: 'Checking in',
            },
          },
        ],
      },
    });
    const workflow = await subject.activate('tenant-a', 'user-a', draft.id);
    const waiting = await subject.execute({
      tenantId: 'tenant-a',
      userId: 'user-a',
      workflowId: workflow.id,
      triggerSource: 'manual',
      triggerReference: 'manual:cancel',
      context: {},
    });
    const cancelled = await subject.cancel('tenant-a', 'user-a', waiting.id);
    expect(cancelled.status).toBe('cancelled');
    await expect(
      subject.execute({
        tenantId: 'tenant-a',
        userId: 'user-a',
        workflowId: workflow.id,
        triggerSource: 'event',
        triggerReference: `workflow:${workflow.id}:again`,
        context: {},
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps workflow management off the member role', () => {
    expect(hasPermission('owner', Permission.WorkflowManage)).toBe(true);
    expect(hasPermission('admin', Permission.WorkflowManage)).toBe(true);
    expect(hasPermission('member', Permission.WorkflowManage)).toBe(false);
  });
});
