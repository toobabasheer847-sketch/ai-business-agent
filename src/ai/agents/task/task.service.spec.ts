import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { TaskService } from './task.service';

describe('TaskService', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  const taskId = '33333333-3333-4333-8333-333333333333';

  const contextA = { tenantId: tenantA, userId: userA };
  const contextB = { tenantId: tenantA, userId: userB };
  const otherTenant = { tenantId: tenantB, userId: userA };

  const ownedTask = {
    id: taskId,
    tenantId: tenantA,
    createdBy: userA,
    assignedTo: null,
    title: 'Call Ahmed',
    status: 'pending',
    priority: 'medium',
  };

  let service: TaskService;
  let taskRepository: {
    createTask: jest.Mock;
    findByIdAndTenantAndUser: jest.Mock;
    findAllByTenantAndUser: jest.Mock;
    updateTask: jest.Mock;
    deleteTask: jest.Mock;
  };
  let userRepository: { findByIdAndTenant: jest.Mock };
  let crmResolver: { resolve: jest.Mock };

  beforeEach(() => {
    taskRepository = {
      createTask: jest.fn().mockResolvedValue(ownedTask),
      findByIdAndTenantAndUser: jest.fn().mockResolvedValue(ownedTask),
      findAllByTenantAndUser: jest.fn().mockResolvedValue([ownedTask]),
      updateTask: jest.fn().mockResolvedValue(ownedTask),
      deleteTask: jest.fn().mockResolvedValue(true),
    };
    userRepository = {
      findByIdAndTenant: jest.fn().mockResolvedValue({ id: userB, tenantId: tenantA }),
    };
    crmResolver = {
      resolve: jest.fn().mockResolvedValue({ status: 'none' }),
      assertIds: jest.fn(async (_tenantId: string, ids: any) => ids),
    };

    service = new TaskService(
      taskRepository as any,
      userRepository as any,
      crmResolver as any,
    );
  });

  it('creates a task with JWT tenant and user, not body ownership fields', async () => {
    await service.createTask(
      { title: 'Call Ahmed', assignedTo: userB } as any,
      contextA,
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        createdBy: userA,
        assignedTo: userB,
        title: 'Call Ahmed',
      }),
    );
    expect(crmResolver.assertIds).toHaveBeenCalledWith(tenantA, expect.any(Object));
  });

  it('creates a task linked to a same-tenant company', async () => {
    await service.createTask(
      { title: 'Follow up', companyId: 'company-1' } as any,
      contextA,
    );

    expect(crmResolver.assertIds).toHaveBeenCalledWith(
      tenantA,
      expect.objectContaining({ companyId: 'company-1' }),
    );
    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        tenantId: tenantA,
        createdBy: userA,
      }),
    );
  });

  it('rejects a cross-tenant company on create', async () => {
    crmResolver.assertIds.mockRejectedValue(
      new BadRequestException(
        'Company not found or does not belong to your tenant.',
      ),
    );

    await expect(
      service.createTask(
        { title: 'Follow up', companyId: 'company-b' } as any,
        contextA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant prospect on create', async () => {
    crmResolver.assertIds.mockRejectedValue(
      new BadRequestException(
        'Prospect not found or does not belong to your tenant.',
      ),
    );

    await expect(
      service.createTask(
        { title: 'Follow up', prospectId: 'prospect-b' } as any,
        contextA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a cross-tenant lead on create', async () => {
    crmResolver.assertIds.mockRejectedValue(
      new BadRequestException(
        'Lead not found or does not belong to your tenant.',
      ),
    );

    await expect(
      service.createTask(
        { title: 'Follow up', leadId: 'lead-b' } as any,
        contextA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a CRM relationship after tenant validation', async () => {
    taskRepository.updateTask.mockResolvedValue({
      ...ownedTask,
      companyId: 'company-2',
    });

    await service.updateTask(
      taskId,
      { companyId: 'company-2' } as any,
      contextA,
    );

    expect(crmResolver.assertIds).toHaveBeenCalledWith(
      tenantA,
      expect.objectContaining({ companyId: 'company-2' }),
    );
    expect(taskRepository.updateTask).toHaveBeenCalledWith(
      taskId,
      tenantA,
      userA,
      expect.objectContaining({ companyId: 'company-2' }),
    );
  });

  it('rejects assignment to a user in another tenant', async () => {
    userRepository.findByIdAndTenant.mockResolvedValue(undefined);

    await expect(
      service.createTask(
        { title: 'Call Ahmed', assignedTo: userB } as any,
        contextA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('does not allow another tenant to read a task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(undefined);

    await expect(service.getTask(taskId, otherTenant)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(taskRepository.findByIdAndTenantAndUser).toHaveBeenCalledWith(
      taskId,
      tenantB,
      userA,
    );
  });

  it('does not allow another user in the same tenant to read a private task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(undefined);

    await expect(service.getTask(taskId, contextB)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(taskRepository.findByIdAndTenantAndUser).toHaveBeenCalledWith(
      taskId,
      tenantA,
      userB,
    );
  });

  it('allows an assigned user to access a task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue({
      ...ownedTask,
      assignedTo: userB,
    });

    const task = await service.getTask(taskId, contextB);

    expect(task.assignedTo).toBe(userB);
  });

  it('does not allow another user to update a private task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(undefined);

    await expect(
      service.updateTask(taskId, { title: 'Hacked' } as any, contextB),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(taskRepository.updateTask).not.toHaveBeenCalled();
  });

  it('does not allow another user to delete a private task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(undefined);

    await expect(service.deleteTask(taskId, contextB)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(taskRepository.deleteTask).not.toHaveBeenCalled();
  });

  it('deletes an owned task', async () => {
    const result = await service.deleteTask(taskId, contextA);

    expect(taskRepository.deleteTask).toHaveBeenCalledWith(
      taskId,
      tenantA,
      userA,
    );
    expect(result).toEqual({
      message: 'Task deleted successfully',
      id: taskId,
    });
  });

  it('lists only the current user scope', async () => {
    await service.listTasks({}, contextA);

    expect(taskRepository.findAllByTenantAndUser).toHaveBeenCalledWith(
      tenantA,
      userA,
      expect.any(Object),
    );
  });

  it('passes JWT context into natural language and requires userId', async () => {
    await service.processNaturalLanguage('Show my pending tasks', contextA);

    expect(taskRepository.findAllByTenantAndUser).toHaveBeenCalledWith(
      tenantA,
      userA,
      expect.any(Object),
    );

    await expect(
      service.processNaturalLanguage('Show my pending tasks', {
        tenantId: tenantA,
        userId: '',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates a task from natural language using JWT tenant and user', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');

    await service.processNaturalLanguage(
      'Create a high priority task to call Ahmed tomorrow.',
      contextA,
      now,
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        createdBy: userA,
        title: 'Call Ahmed',
        priority: 'high',
        dueAt: '2026-08-21T00:00:00.000Z',
      }),
    );
  });

  it('ignores tenantId and createdBy mentioned in natural language', async () => {
    await service.processNaturalLanguage(
      'Create a task to call Ahmed tomorrow for tenant bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb createdBy attacker',
      contextA,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        createdBy: userA,
      }),
    );
    expect(taskRepository.createTask).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantB,
      }),
    );
  });

  it('completes, cancels, updates, and gets a unique title match', async () => {
    taskRepository.findAllByTenantAndUser.mockResolvedValue([
      { ...ownedTask, title: 'ABC follow-up' },
    ]);
    taskRepository.updateTask.mockResolvedValue({
      ...ownedTask,
      title: 'ABC follow-up',
      status: 'completed',
    });

    const completed = await service.processNaturalLanguage(
      'Mark my ABC follow-up task as completed.',
      contextA,
    );
    expect(completed.action).toBe('complete');
    expect(taskRepository.updateTask).toHaveBeenCalledWith(
      taskId,
      tenantA,
      userA,
      expect.objectContaining({ status: 'completed' }),
    );

    await service.processNaturalLanguage('Cancel my ABC follow-up task.', contextA);
    expect(taskRepository.updateTask).toHaveBeenCalledWith(
      taskId,
      tenantA,
      userA,
      expect.objectContaining({ status: 'cancelled' }),
    );

    await service.processNaturalLanguage(
      'Change my ABC task priority to high.',
      contextA,
    );
    expect(taskRepository.updateTask).toHaveBeenCalledWith(
      taskId,
      tenantA,
      userA,
      expect.objectContaining({ priority: 'high' }),
    );

    const found = await service.processNaturalLanguage(
      'Show my ABC follow-up task.',
      contextA,
    );
    expect(found.action).toBe('get');
    expect(found.data).toEqual(expect.objectContaining({ title: 'ABC follow-up' }));
  });

  it('asks for clarification when multiple tasks match', async () => {
    taskRepository.findAllByTenantAndUser.mockResolvedValue([
      { ...ownedTask, id: '44444444-4444-4444-8444-444444444444', title: 'Follow up with Ahmed' },
      { ...ownedTask, id: '55555555-5555-4555-8555-555555555555', title: 'Follow up with ABC' },
    ]);

    const result = await service.processNaturalLanguage(
      'Complete my follow-up task.',
      contextA,
    );

    expect(result.action).toBe('clarify');
    expect(result.message).toContain('I found 2 matching tasks');
    expect(taskRepository.updateTask).not.toHaveBeenCalled();
  });

  it('returns not found when no accessible task matches', async () => {
    taskRepository.findAllByTenantAndUser.mockResolvedValue([]);

    const result = await service.processNaturalLanguage(
      'Complete the task to call Ahmed.',
      contextA,
    );

    expect(result).toEqual({
      action: 'complete',
      data: null,
      message: 'Task not found.',
    });
    expect(taskRepository.updateTask).not.toHaveBeenCalled();
  });

  it('cannot complete another user or tenant private task through natural language', async () => {
    taskRepository.findAllByTenantAndUser.mockResolvedValue([]);

    await service.processNaturalLanguage(
      'Complete the task to call Ahmed.',
      contextB,
    );
    expect(taskRepository.findAllByTenantAndUser).toHaveBeenCalledWith(
      tenantA,
      userB,
    );

    await service.processNaturalLanguage(
      'Complete the task to call Ahmed.',
      otherTenant,
    );
    expect(taskRepository.findAllByTenantAndUser).toHaveBeenCalledWith(
      tenantB,
      userA,
    );
    expect(taskRepository.updateTask).not.toHaveBeenCalled();
  });

  it('does not create a task when the due date cannot be understood', async () => {
    const result = await service.processNaturalLanguage(
      'Create a task to call Ahmed tomorrow at 25:00',
      contextA,
    );

    expect(result.action).toBe('clarify');
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('persists companyId for follow-up text that names a unique company', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'resolved',
      company: { kind: 'company', id: 'company-1', name: 'ABC Technologies' },
    });

    await service.processNaturalLanguage(
      'Create a task to follow up with ABC tomorrow.',
      contextA,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        tenantId: tenantA,
        createdBy: userA,
      }),
    );
  });

  it('creates a task with a uniquely resolved company name', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'resolved',
      company: { kind: 'company', id: 'company-1', name: 'ABC Technologies' },
    });

    await service.processNaturalLanguage(
      'Create a task to follow up with ABC company tomorrow.',
      contextA,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(crmResolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        companyQuery: 'ABC',
        explicitCompany: true,
      }),
      tenantA,
    );
    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        createdBy: userA,
        title: 'Follow up with ABC Technologies',
        companyId: 'company-1',
      }),
    );
    expect(taskRepository.createTask.mock.calls[0][0].description).not.toBe(
      'Resolved CRM context: company ABC Technologies.',
    );
  });

  it('does not create a task when multiple companies match', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'ambiguous',
      kind: 'company',
      query: 'ABC',
      matches: ['ABC Solutions', 'ABC Technologies', 'ABC Trading'],
    });

    const result = await service.processNaturalLanguage(
      'Create a task to follow up with ABC company tomorrow.',
      contextA,
    );

    expect(result.action).toBe('clarify');
    expect(result.message).toContain('3 companies matching ABC');
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('does not invent a company when none match', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'missing',
      kind: 'company',
      query: 'ABC',
    });

    const result = await service.processNaturalLanguage(
      'Create a task to follow up with ABC company tomorrow.',
      contextA,
    );

    expect(result.action).toBe('clarify');
    expect(result.message).toContain("I couldn't find a company named ABC");
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('creates a task with a uniquely resolved prospect id', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'resolved',
      person: {
        kind: 'prospect',
        id: 'prospect-1',
        name: 'Ahmed Khan',
      },
    });

    await service.processNaturalLanguage(
      'Create a task to follow up with Ahmed tomorrow.',
      contextA,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        createdBy: userA,
        prospectId: 'prospect-1',
      }),
    );
  });

  it('creates a task for a uniquely resolved person', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'resolved',
      person: {
        kind: 'lead',
        id: 'lead-1',
        name: 'Ahmed Khan',
      },
    });

    await service.processNaturalLanguage(
      'Create a task to follow up with Ahmed tomorrow.',
      contextA,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        createdBy: userA,
        title: 'Follow up with Ahmed Khan',
        leadId: 'lead-1',
      }),
    );
  });

  it('persists prospect and company ids for a uniquely resolved person', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'resolved',
      company: { kind: 'company', id: 'company-1', name: 'ABC Technologies' },
      person: {
        kind: 'prospect',
        id: 'prospect-1',
        name: 'Ahmed Khan',
        companyId: 'company-1',
      },
    });

    await service.processNaturalLanguage(
      'Create a task for Ahmed from ABC tomorrow.',
      contextA,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        prospectId: 'prospect-1',
        tenantId: tenantA,
        createdBy: userA,
      }),
    );
  });

  it('asks which person when multiple people match', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'ambiguous',
      kind: 'person',
      query: 'Ahmed',
      matches: ['Ahmed Khan', 'Ahmed Ali'],
    });

    const result = await service.processNaturalLanguage(
      'Create a task to follow up with Ahmed.',
      contextA,
    );

    expect(result.action).toBe('clarify');
    expect(result.message).toContain('2 people matching Ahmed');
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('still creates a plain-text task when a person is not in CRM', async () => {
    crmResolver.resolve.mockResolvedValue({ status: 'none' });

    await service.processNaturalLanguage(
      'Create a task to call Ahmed tomorrow.',
      contextA,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Call Ahmed',
        tenantId: tenantA,
        createdBy: userA,
      }),
    );
  });

  it('persists a lead id for a unique email match', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'resolved',
      person: {
        kind: 'lead',
        id: 'lead-1',
        name: 'John Smith',
        email: 'john@example.com',
        companyId: 'c1',
      },
    });

    await service.processNaturalLanguage(
      'Create a task for john@example.com.',
      contextA,
    );

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        companyId: 'c1',
        tenantId: tenantA,
      }),
    );
  });

  it('resolves CRM using JWT tenant even if the text names another tenant', async () => {
    await service.processNaturalLanguage(
      'Create a task for ABC company in tenant-b createdBy attacker',
      contextA,
    );

    expect(crmResolver.resolve).toHaveBeenCalledWith(
      expect.any(Object),
      tenantA,
    );
    expect(crmResolver.resolve.mock.calls[0][1]).not.toBe('tenant-b');
  });

  it('does not let a shared company name open another user private task', async () => {
    crmResolver.resolve.mockResolvedValue({
      status: 'resolved',
      company: { kind: 'company', id: 'company-1', name: 'ABC Technologies' },
    });
    taskRepository.findAllByTenantAndUser.mockResolvedValue([]);

    const result = await service.processNaturalLanguage(
      'Complete the ABC follow-up task.',
      contextB,
    );

    expect(taskRepository.findAllByTenantAndUser).toHaveBeenCalledWith(
      tenantA,
      userB,
    );
    expect(result.message).toBe('Task not found.');
    expect(taskRepository.updateTask).not.toHaveBeenCalled();
  });

  it('rejects a missing tenant context', async () => {
    await expect(
      service.createTask({ title: 'Call Ahmed' } as any, {
        tenantId: '',
        userId: userA,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
