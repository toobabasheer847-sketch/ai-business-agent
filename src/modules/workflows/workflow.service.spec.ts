import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { WorkflowActionRegistry } from './workflow.actions';
import { WorkflowService } from './workflow.service';
import type { WorkflowStep } from './workflow.types';

function step(
  actionType: WorkflowStep['actionType'],
  input: Record<string, string>,
): WorkflowStep {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    executionId: '22222222-2222-4222-8222-222222222222',
    stepKey: 'task',
    actionType,
    status: 'running',
    inputSnapshot: input,
    outputSnapshot: {},
    approvalId: null,
    attemptCount: 1,
    startedAt: new Date(),
    completedAt: null,
    errorCode: null,
    sanitizedError: null,
    createdAt: new Date(),
  };
}

describe('WorkflowActionRegistry', () => {
  const tasks = { createTask: jest.fn(), updateTask: jest.fn() };
  const leads = { update: jest.fn() };
  const approvals = { propose: jest.fn() };
  const registry = new WorkflowActionRegistry(
    tasks as never,
    leads as never,
    approvals as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a task through the existing task service', async () => {
    tasks.createTask.mockResolvedValue({ id: 'task-1' });
    const outcome = await registry.run({
      tenantId: 'tenant-a',
      userId: 'user-1',
      role: 'admin',
      executionId: '22222222-2222-4222-8222-222222222222',
      step: step('create_task', { title: 'Follow up', useTriggerLead: 'true' }),
      context: { leadId: 'lead-1' },
    });
    expect(tasks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Follow up', leadId: 'lead-1' }),
      expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-1' }),
    );
    expect(outcome).toMatchObject({
      status: 'completed',
      output: { taskId: 'task-1', delivered: false },
    });
  });

  it('updates a lead through the existing lead service', async () => {
    leads.update.mockResolvedValue({ id: 'lead-1' });
    const outcome = await registry.run({
      tenantId: 'tenant-a',
      userId: 'user-1',
      role: 'admin',
      executionId: '22222222-2222-4222-8222-222222222222',
      step: step('update_lead', { leadId: 'lead-1', status: 'contacted' }),
      context: {},
    });
    expect(leads.update).toHaveBeenCalledWith('tenant-a', 'lead-1', {
      status: 'contacted',
      notes: undefined,
    });
    expect(outcome.status).toBe('completed');
  });

  it('asks the Approval Center before a customer email and does not send it', async () => {
    approvals.propose.mockResolvedValue({
      required: true,
      approval: { id: 'approval-1' },
    });
    const outcome = await registry.run({
      tenantId: 'tenant-a',
      userId: 'user-1',
      role: 'admin',
      executionId: '22222222-2222-4222-8222-222222222222',
      step: step('send_email', {
        to: 'a@example.com',
        subject: 'Hello',
        body: 'Draft',
      }),
      context: {},
    });
    expect(approvals.propose).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'email.send',
        targetEntityType: 'workflow_step',
      }),
    );
    expect(outcome).toMatchObject({
      status: 'waiting',
      approvalId: 'approval-1',
    });
  });

  it('blocks a sensitive action when approval is not required by the policy', async () => {
    approvals.propose.mockResolvedValue({ required: false, approval: null });
    const outcome = await registry.run({
      tenantId: 'tenant-a',
      userId: 'user-1',
      role: 'admin',
      executionId: '22222222-2222-4222-8222-222222222222',
      step: step('send_sms', {
        to: '+15550001',
        body: 'Hi',
        fromPhoneNumberId: '11111111-1111-4111-8111-111111111111',
      }),
      context: {},
    });
    expect(outcome).toMatchObject({
      status: 'failed',
      retryable: false,
      errorCode: 'approval_required',
    });
  });

  it('classifies a provider timeout without claiming delivery', async () => {
    tasks.createTask.mockRejectedValue(new Error('provider timeout'));
    const outcome = await registry.run({
      tenantId: 'tenant-a',
      userId: 'user-1',
      executionId: '22222222-2222-4222-8222-222222222222',
      step: step('create_task', { title: 'Follow up' }),
      context: {},
    });
    expect(outcome).toMatchObject({
      status: 'failed',
      errorCode: 'provider_timeout',
      retryable: true,
    });
  });
});

describe('WorkflowService scheduling and generation', () => {
  const config = { get: jest.fn() };
  const queue = { add: jest.fn() };
  const approvals = {
    onDecision: jest.fn(),
    find: jest.fn(),
    cancel: jest.fn(),
  };
  const service = new WorkflowService(
    {} as never,
    {} as never,
    {} as never,
    approvals as never,
    {} as never,
    {} as never,
    config as never,
    queue as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(undefined);
  });

  it('reports scheduled execution unavailable when Redis is not configured', async () => {
    await expect(service.enqueueAll()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('keeps natural-language generation on rules when Gemini is not configured', async () => {
    const result = await service.generate(
      { tenantId: 'tenant-a', userId: 'user-1', role: 'admin' },
      'When a new lead is created, create a follow-up task.',
    );
    expect(result.source).toBe('rule');
    expect(result.valid).toBe(true);
    expect(result.proposal?.trigger.type).toBe('new_lead');
  });

  it('refuses workflow generation for a member', async () => {
    await expect(
      service.generate(
        { tenantId: 'tenant-a', userId: 'user-1', role: 'member' },
        'When a new lead is created, create a follow-up task.',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
