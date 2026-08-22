import { TaskReminderService } from './task-reminder.service';

describe('TaskReminderService', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  const taskId = '33333333-3333-4333-8333-333333333333';
  const reminderId = '44444444-4444-4444-8444-444444444444';
  const dueAt = new Date('2027-08-21T15:00:00.000Z');

  const pendingTask = {
    id: taskId,
    tenantId: tenantA,
    createdBy: userA,
    assignedTo: userB,
    title: 'Follow up with ABC',
    status: 'pending',
    priority: 'medium',
    dueAt,
  };

  const payload = {
    tenantId: tenantA,
    taskId,
    userId: userB,
    reminderId,
    reminderType: 'upcoming' as const,
    scheduledAt: '2027-08-21T14:30:00.000Z',
  };

  const pendingReminderRow = {
    id: reminderId,
    tenantId: tenantA,
    taskId,
    userId: userB,
    reminderType: 'upcoming' as const,
    scheduledAt: new Date(payload.scheduledAt),
    dueAtSnapshot: dueAt,
    status: 'pending' as const,
    attemptCount: 0,
  };

  let service: TaskReminderService;
  let taskRepository: {
    findByIdAndTenantAndUser: jest.Mock;
    findOpenTasksDueOnOrBefore: jest.Mock;
  };
  let reminderRepository: {
    insertPending: jest.Mock;
    findByIdAndTenant: jest.Mock;
    findLatestByTaskIds: jest.Mock;
    findAllByTaskAndTenant: jest.Mock;
    findActiveByTaskAndTenant: jest.Mock;
    claimForProcessing: jest.Mock;
    updateStatus: jest.Mock;
    markProcessed: jest.Mock;
    writeAuditLog: jest.Mock;
  };
  let userRepository: { findByIdAndTenant: jest.Mock };
  let reminderQueue: { add: jest.Mock; getJob: jest.Mock };
  let activity: { record: jest.Mock };
  let gmailService: {
    findActiveCredentialsForTenant: jest.Mock;
    mailOperations: { sendEmail: jest.Mock };
    refreshAndSave: jest.Mock;
  };

  beforeEach(() => {
    taskRepository = {
      findByIdAndTenantAndUser: jest.fn().mockResolvedValue(pendingTask),
      findOpenTasksDueOnOrBefore: jest.fn().mockResolvedValue([pendingTask]),
    };
    reminderRepository = {
      insertPending: jest.fn().mockResolvedValue({
        reminder: pendingReminderRow,
        inserted: true,
      }),
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: reminderId,
        tenantId: tenantA,
        taskId,
        userId: userB,
        reminderType: 'upcoming',
        scheduledAt: new Date(payload.scheduledAt),
        dueAtSnapshot: dueAt,
        status: 'pending',
      }),
      findLatestByTaskIds: jest.fn().mockResolvedValue(new Map()),
      findAllByTaskAndTenant: jest.fn().mockResolvedValue([pendingReminderRow]),
      findActiveByTaskAndTenant: jest.fn().mockResolvedValue([pendingReminderRow]),
      claimForProcessing: jest.fn().mockResolvedValue({
        ...pendingReminderRow,
        status: 'processing',
        attemptCount: 1,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      writeAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: userB,
        tenantId: tenantA,
        email: 'assignee@example.com',
      }),
    };
    reminderQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    gmailService = {
      findActiveCredentialsForTenant: jest.fn().mockResolvedValue(null),
      mailOperations: { sendEmail: jest.fn() },
      refreshAndSave: jest.fn(),
    };

    service = new TaskReminderService(
      taskRepository as any,
      reminderRepository as any,
      userRepository as any,
      { get: jest.fn().mockReturnValue(30) } as any,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
      reminderQueue as any,
      gmailService as any,
      activity as any,
    );
  });

  it('schedules reminders for the selected task and assigned recipient', async () => {
    await service.scheduleReminder(pendingTask as any);

    expect(reminderRepository.insertPending).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        taskId,
        userId: userB,
        reminderType: 'upcoming',
      }),
    );
    expect(reminderQueue.add).toHaveBeenCalled();
    const jobPayload = reminderQueue.add.mock.calls[0][1];
    expect(jobPayload.tenantId).toBe(tenantA);
    expect(jobPayload.userId).toBe(userB);
    expect(jobPayload.taskId).toBe(taskId);
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'REMINDER_SCHEDULED',
        tenantId: tenantA,
        taskId,
        actorUserId: null,
      }),
    );
  });

  it('does not enqueue a duplicate reminder job', async () => {
    reminderRepository.insertPending.mockResolvedValue({
      reminder: {
        ...pendingReminderRow,
        status: 'sent',
      },
      inserted: false,
    });

    await service.scheduleReminder(pendingTask as any);

    expect(reminderQueue.add).not.toHaveBeenCalled();
  });

  it('treats an already-queued BullMQ job as idempotent', async () => {
    reminderQueue.add.mockRejectedValue(new Error('Job task-reminder:x already exists'));

    await expect(service.scheduleReminder(pendingTask as any)).resolves.toBeUndefined();
  });

  it('sends to the assigned user when the trusted worker context matches', async () => {
    await service.processReminder(payload);

    expect(taskRepository.findByIdAndTenantAndUser).toHaveBeenCalledWith(
      taskId,
      tenantA,
      userB,
    );
    expect(userRepository.findByIdAndTenant).toHaveBeenCalledWith(userB, tenantA);
    expect(reminderRepository.markProcessed).toHaveBeenCalledWith(
      reminderId,
      tenantA,
      'sent',
      null,
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'REMINDER_SENT',
        metadata: expect.objectContaining({
          channel: 'audit',
          recipientUserId: userB,
        }),
      }),
    );
  });

  it('does not send a reminder for a completed task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue({
      ...pendingTask,
      status: 'completed',
    });

    await service.processReminder(payload);

    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(reminderRepository.markProcessed).toHaveBeenCalledWith(
      reminderId,
      tenantA,
      'skipped',
      'task_completed',
    );
  });

  it('does not send a reminder for a cancelled task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue({
      ...pendingTask,
      status: 'cancelled',
    });

    await service.processReminder(payload);

    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(reminderRepository.markProcessed).toHaveBeenCalledWith(
      reminderId,
      tenantA,
      'skipped',
      'task_cancelled',
    );
  });

  it('handles a missing recipient without throwing', async () => {
    userRepository.findByIdAndTenant.mockResolvedValue({
      id: userB,
      tenantId: tenantA,
      email: null,
    });

    await expect(service.processReminder(payload)).resolves.toBeUndefined();
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(reminderRepository.markProcessed).toHaveBeenCalledWith(
      reminderId,
      tenantA,
      'skipped',
      'missing_recipient',
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'REMINDER_FAILED' }),
    );
  });

  it('fails closed when trusted worker context is missing', async () => {
    await service.processReminder({} as any);

    expect(taskRepository.findByIdAndTenantAndUser).not.toHaveBeenCalled();
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(reminderRepository.markProcessed).not.toHaveBeenCalled();
  });

  it('does not process a cross-tenant task', async () => {
    await service.processReminder({
      ...payload,
      tenantId: tenantB,
    });

    expect(taskRepository.findByIdAndTenantAndUser).toHaveBeenCalledWith(
      taskId,
      tenantB,
      userB,
    );
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the current user cannot access the task', async () => {
    taskRepository.findByIdAndTenantAndUser.mockResolvedValue(null);

    await service.processReminder(payload);

    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(reminderRepository.markProcessed).toHaveBeenCalledWith(
      reminderId,
      tenantA,
      'skipped',
      'task_not_accessible',
    );
  });

  it('records REMINDER_RETRY for a transient Gmail failure', async () => {
    gmailService.findActiveCredentialsForTenant.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
    });
    gmailService.mailOperations.sendEmail.mockRejectedValue(new Error('gmail_down'));

    await expect(
      service.processReminder(payload, { current: 1, max: 3 }),
    ).rejects.toThrow('gmail_down');
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'REMINDER_RETRY' }),
    );
    expect(reminderRepository.updateStatus).toHaveBeenCalledWith(
      reminderId,
      tenantA,
      'failed',
      expect.objectContaining({ channel: 'gmail' }),
    );
    expect(JSON.stringify(activity.record.mock.calls)).not.toMatch(/token|refresh/i);
  });

  it('records REMINDER_FAILED on the last retry attempt', async () => {
    gmailService.findActiveCredentialsForTenant.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
    });
    gmailService.mailOperations.sendEmail.mockRejectedValue(new Error('gmail_down'));

    await expect(
      service.processReminder(payload, { current: 3, max: 3 }),
    ).rejects.toThrow('gmail_down');
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'REMINDER_FAILED',
        metadata: expect.objectContaining({ channel: 'gmail' }),
      }),
    );
  });

  it('does not execute a disabled reminder', async () => {
    reminderRepository.findByIdAndTenant.mockResolvedValue({
      ...pendingReminderRow,
      status: 'disabled',
    });

    await service.processReminder(payload);

    expect(reminderRepository.claimForProcessing).not.toHaveBeenCalled();
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
    expect(reminderRepository.markProcessed).not.toHaveBeenCalled();
  });

  it('does not send a reminder twice after it was already sent', async () => {
    reminderRepository.findByIdAndTenant.mockResolvedValue({
      ...pendingReminderRow,
      status: 'sent',
    });

    await service.processReminder(payload);
    await service.processReminder(payload);

    expect(reminderRepository.claimForProcessing).not.toHaveBeenCalled();
    expect(gmailService.mailOperations.sendEmail).not.toHaveBeenCalled();
  });

  it('rejects enabling reminders on a completed task', async () => {
    await expect(
      service.enableReminders({ ...pendingTask, status: 'completed' } as any),
    ).rejects.toThrow(/completed/);
    expect(reminderRepository.insertPending).not.toHaveBeenCalled();
  });

  it('rejects enabling reminders on a cancelled task', async () => {
    await expect(
      service.enableReminders({ ...pendingTask, status: 'cancelled' } as any),
    ).rejects.toThrow(/cancelled/);
  });

  it('rejects a reminder scheduled at or after dueAt', async () => {
    await expect(
      service.rescheduleUpcoming(pendingTask as any, dueAt.toISOString()),
    ).rejects.toThrow(/before dueAt/);
  });

  it('rejects an invalid reminder datetime', async () => {
    await expect(
      service.rescheduleUpcoming(pendingTask as any, 'tomorrow'),
    ).rejects.toThrow(/ISO datetime/);
  });
});
