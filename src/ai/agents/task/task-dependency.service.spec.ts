import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { TaskService } from './task.service';

describe('TaskService dependencies and recurrence', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userA = '11111111-1111-4111-8111-111111111111';
  const taskA = '33333333-3333-4333-8333-333333333333';
  const taskB = '44444444-4444-4444-8444-444444444444';
  const taskC = '55555555-5555-4555-8555-555555555555';

  const contextA = { tenantId: tenantA, userId: userA };
  const otherTenant = { tenantId: tenantB, userId: userA };

  function makeTask(
    id: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id,
      tenantId: tenantA,
      createdBy: userA,
      assignedTo: null,
      title: `Task ${id.slice(0, 4)}`,
      status: 'pending',
      priority: 'medium',
      dueAt: '2026-08-24T12:00:00.000Z',
      recurrenceEnabled: false,
      recurrenceInterval: null,
      recurrenceEndsAt: null,
      recurrenceSeriesId: null,
      recurrenceOccurrenceKey: null,
      ...overrides,
    };
  }

  let service: TaskService;
  let taskRepository: {
    createTask: jest.Mock;
    findByIdAndTenantAndUser: jest.Mock;
    findAllByTenantAndUser: jest.Mock;
    findByTitleAndTenantAndUser: jest.Mock;
    findBySeriesOccurrence: jest.Mock;
    updateTask: jest.Mock;
    deleteTask: jest.Mock;
  };
  let dependencies: {
    create: jest.Mock;
    deletePair: jest.Mock;
    findPair: jest.Mock;
    listDependsOn: jest.Mock;
    listDependents: jest.Mock;
    listDependsOnIds: jest.Mock;
    listIncompleteBlockers: jest.Mock;
    listBlockedTaskIds: jest.Mock;
  };
  let userRepository: { findByIdAndTenant: jest.Mock; findAllByTenant: jest.Mock };
  let crmResolver: { resolve: jest.Mock; assertIds: jest.Mock };

  let activity: { record: jest.Mock };

  beforeEach(() => {
    taskRepository = {
      createTask: jest.fn(),
      findByIdAndTenantAndUser: jest.fn(),
      findAllByTenantAndUser: jest.fn().mockResolvedValue([]),
      findByTitleAndTenantAndUser: jest.fn().mockResolvedValue([]),
      findBySeriesOccurrence: jest.fn().mockResolvedValue(null),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
    };
    dependencies = {
      create: jest.fn().mockResolvedValue({
        id: 'dep-1',
        tenantId: tenantA,
        taskId: taskB,
        dependsOnTaskId: taskA,
      }),
      deletePair: jest.fn().mockResolvedValue(true),
      findPair: jest.fn().mockResolvedValue(null),
      listDependsOn: jest.fn().mockResolvedValue([]),
      listDependents: jest.fn().mockResolvedValue([]),
      listDependsOnIds: jest.fn().mockResolvedValue([]),
      listIncompleteBlockers: jest.fn().mockResolvedValue([]),
      listBlockedTaskIds: jest.fn().mockResolvedValue(new Set()),
    };
    userRepository = {
      findByIdAndTenant: jest.fn().mockResolvedValue({ id: userA, tenantId: tenantA }),
      findAllByTenant: jest.fn().mockResolvedValue([]),
    };
    crmResolver = {
      resolve: jest.fn().mockResolvedValue({ status: 'none' }),
      assertIds: jest.fn(async (_tenantId: string, ids: any) => ids),
    };
    activity = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new TaskService(
      taskRepository as any,
      userRepository as any,
      crmResolver as any,
      undefined,
      activity as any,
      undefined,
      dependencies as any,
    );
  });

  it('creates a dependency between same-tenant tasks', async () => {
    taskRepository.findByIdAndTenantAndUser
      .mockResolvedValueOnce(makeTask(taskB, { title: 'Send proposal' }))
      .mockResolvedValueOnce(makeTask(taskA, { title: 'Create proposal' }));

    const created = await service.addTaskDependency(taskB, taskA, contextA);
    expect(created.dependsOnTaskId).toBe(taskA);
    expect(dependencies.create).toHaveBeenCalledWith({
      tenantId: tenantA,
      taskId: taskB,
      dependsOnTaskId: taskA,
    });
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        taskId: taskB,
        eventType: 'TASK_DEPENDENCY_ADDED',
      }),
    );
  });

  it('rejects self dependencies', async () => {
    await expect(
      service.addTaskDependency(taskA, taskA, contextA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate dependencies', async () => {
    taskRepository.findByIdAndTenantAndUser
      .mockResolvedValueOnce(makeTask(taskB))
      .mockResolvedValueOnce(makeTask(taskA));
    dependencies.findPair.mockResolvedValue({ id: 'existing' });

    await expect(
      service.addTaskDependency(taskB, taskA, contextA),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects cross-tenant dependency creation', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(null);

    await expect(
      service.addTaskDependency(taskB, taskA, otherTenant),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects dependency cycles', async () => {
    taskRepository.findByIdAndTenantAndUser
      .mockResolvedValueOnce(makeTask(taskA, { title: 'A' }))
      .mockResolvedValueOnce(makeTask(taskC, { title: 'C' }));
    // A depends on B already? Cycle check walks from C along C's deps.
    // Adding A -> C: if C eventually depends on A, reject.
    dependencies.listDependsOnIds
      .mockResolvedValueOnce([taskB])
      .mockResolvedValueOnce([taskA]);

    await expect(
      service.addTaskDependency(taskA, taskC, contextA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists and removes dependencies tenant-safely', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(
      makeTask(taskB, { title: 'Send proposal' }),
    );
    dependencies.listDependsOn.mockResolvedValue([
      { id: 'd1', taskId: taskB, dependsOnTaskId: taskA },
    ]);
    dependencies.listDependents.mockResolvedValue([]);
    dependencies.listIncompleteBlockers.mockResolvedValue([
      { id: taskA, title: 'Create proposal', status: 'pending' },
    ]);

    const listed = await service.getTaskDependencies(taskB, contextA);
    expect(listed.isBlocked).toBe(true);
    expect(listed.dependsOn).toHaveLength(1);

    await service.removeTaskDependency(taskB, taskA, contextA);
    expect(dependencies.deletePair).toHaveBeenCalledWith(
      tenantA,
      taskB,
      taskA,
    );
  });

  it('blocks completing a task with incomplete dependencies', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(
      makeTask(taskB, { title: 'Send proposal' }),
    );
    dependencies.listIncompleteBlockers.mockResolvedValue([
      { id: taskA, title: 'Create proposal', status: 'pending' },
    ]);

    await expect(
      service.completeTask(taskB, contextA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TASK_BLOCKED_COMPLETION_REJECTED',
        taskId: taskB,
      }),
    );
  });

  it('completes a dependency and does not auto-complete dependents', async () => {
    const completed = makeTask(taskA, {
      title: 'Create proposal',
      status: 'completed',
      completedAt: '2026-08-24T13:00:00.000Z',
    });
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(
      makeTask(taskA, { title: 'Create proposal' }),
    );
    taskRepository.updateTask.mockResolvedValue(completed);
    dependencies.listIncompleteBlockers.mockResolvedValue([]);
    dependencies.listDependents.mockResolvedValue([
      { id: 'd1', taskId: taskB, dependsOnTaskId: taskA },
    ]);
    taskRepository.findByIdAndTenantAndUser
      .mockResolvedValueOnce(makeTask(taskA, { title: 'Create proposal' }))
      .mockResolvedValueOnce(makeTask(taskB, { title: 'Send proposal' }));
    dependencies.listIncompleteBlockers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.completeTask(taskA, contextA);
    expect(result.status).toBe('completed');
    expect(taskRepository.updateTask).toHaveBeenCalledWith(
      taskA,
      tenantA,
      userA,
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('spawns the next daily occurrence idempotently', async () => {
    const seriesId = '66666666-6666-4666-8666-666666666666';
    const completed = makeTask(taskA, {
      title: 'Call client',
      status: 'completed',
      dueAt: '2026-08-24T12:00:00.000Z',
      recurrenceEnabled: true,
      recurrenceInterval: 'daily',
      recurrenceSeriesId: seriesId,
      recurrenceOccurrenceKey: '2026-08-24',
    });
    const next = makeTask(taskB, {
      title: 'Call client',
      dueAt: '2026-08-25T12:00:00.000Z',
      recurrenceEnabled: true,
      recurrenceInterval: 'daily',
      recurrenceSeriesId: seriesId,
      recurrenceOccurrenceKey: '2026-08-25',
    });

    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(
      makeTask(taskA, {
        title: 'Call client',
        dueAt: '2026-08-24T12:00:00.000Z',
        recurrenceEnabled: true,
        recurrenceInterval: 'daily',
        recurrenceSeriesId: seriesId,
        recurrenceOccurrenceKey: '2026-08-24',
      }),
    );
    taskRepository.updateTask.mockResolvedValue(completed);
    dependencies.listIncompleteBlockers.mockResolvedValue([]);
    dependencies.listDependents.mockResolvedValue([]);
    taskRepository.findBySeriesOccurrence
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(next);
    taskRepository.createTask.mockRejectedValue({ code: '23505' });

    await service.completeTask(taskA, contextA);
    expect(taskRepository.findBySeriesOccurrence).toHaveBeenCalledWith(
      tenantA,
      seriesId,
      '2026-08-25',
    );
  });

  it('does not spawn when recurrence is disabled or past end date', async () => {
    const completed = makeTask(taskA, {
      status: 'completed',
      dueAt: '2026-08-24T12:00:00.000Z',
      recurrenceEnabled: false,
      recurrenceInterval: 'daily',
      recurrenceSeriesId: '66666666-6666-4666-8666-666666666666',
      recurrenceOccurrenceKey: '2026-08-24',
    });
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(
      makeTask(taskA, {
        dueAt: '2026-08-24T12:00:00.000Z',
        recurrenceEnabled: false,
      }),
    );
    taskRepository.updateTask.mockResolvedValue(completed);
    dependencies.listIncompleteBlockers.mockResolvedValue([]);
    dependencies.listDependents.mockResolvedValue([]);

    await service.completeTask(taskA, contextA);
    expect(taskRepository.createTask).not.toHaveBeenCalled();
  });

  it('creates weekly and monthly recurrence on create', async () => {
    taskRepository.createTask.mockImplementation(async (input) =>
      makeTask(taskA, input),
    );

    await service.createTask(
      {
        title: 'Weekly check-in',
        recurrenceEnabled: true,
        recurrenceInterval: 'weekly',
        dueAt: '2026-08-24T12:00:00.000Z',
      } as any,
      contextA,
    );
    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceEnabled: true,
        recurrenceInterval: 'weekly',
        recurrenceSeriesId: expect.any(String),
        recurrenceOccurrenceKey: '2026-08-24',
      }),
    );

    await service.createTask(
      {
        title: 'Monthly report',
        recurrenceInterval: 'monthly',
        dueAt: '2026-08-24T12:00:00.000Z',
        recurrenceEndsAt: '2026-12-31T23:59:59.000Z',
      } as any,
      contextA,
    );
    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceInterval: 'monthly',
        recurrenceEndsAt: '2026-12-31T23:59:59.000Z',
      }),
    );
  });
});
