import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { AppLogger } from '../../../infrastructure/logging/logger.service.js';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.module.js';
import { GmailService } from '../communication/gmail/gmail.service.js';
import { UserRepository } from '../../../modules/user/user.repository.js';
import {
  DEFAULT_TASK_REMINDER_MINUTES_BEFORE,
  TASK_REMINDER_JOB_NAME,
  type TaskReminderJobPayload,
  type TaskReminderType,
} from './task-reminder.constants.js';
import { TaskReminderRepository } from './task-reminder.repository.js';
import { TaskActivityRepository } from './task-activity.repository.js';
import { computeIsOverdue, isClosedTaskStatus } from './task-overdue.js';
import { TaskRepository } from './task.repository.js';
import type { TaskRecord } from './types/task.types.js';

@Injectable()
export class TaskReminderService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly reminderRepository: TaskReminderRepository,
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
    @Optional()
    @InjectQueue(QUEUE_NAMES.TASK_REMINDER)
    private readonly reminderQueue?: Queue<TaskReminderJobPayload>,
    @Optional()
    private readonly gmailService?: GmailService,
    @Optional()
    private readonly activity?: TaskActivityRepository,
  ) {}

  reminderMinutesBefore(): number {
    const raw = this.configService.get<number | string>(
      'TASK_REMINDER_MINUTES_BEFORE',
    );
    const parsed = Number(raw ?? DEFAULT_TASK_REMINDER_MINUTES_BEFORE);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return DEFAULT_TASK_REMINDER_MINUTES_BEFORE;
    }

    return parsed;
  }

  async attachReminderStatus(tasks: TaskRecord[]): Promise<TaskRecord[]> {
    const latest = await this.reminderRepository.findLatestByTaskIds(
      tasks.map((task) => task.id),
    );

    return tasks.map((task) => {
      const reminder = latest.get(task.id);
      return reminder ? { ...task, reminder } : task;
    });
  }

  async scheduleReminder(task: TaskRecord): Promise<void> {
    try {
      await this.scheduleForTask(task);
    } catch (error) {
      this.logger.error(
        'Failed to schedule task reminder',
        error instanceof Error ? error.stack : undefined,
        { tenantId: task.tenantId, userId: task.createdBy },
        { taskId: task.id, job: 'task-reminder-schedule' },
      );
    }
  }

  async enqueueDueReminders(now: Date = new Date()): Promise<{
    scanned: number;
    enqueued: number;
  }> {
    const upcomingUntil = new Date(
      now.getTime() + this.reminderMinutesBefore() * 60 * 1000,
    );
    const candidates =
      await this.taskRepository.findOpenTasksDueOnOrBefore(upcomingUntil);

    let enqueued = 0;
    for (const task of candidates) {
      const before = await this.scheduleForTask(task, now);
      enqueued += before;
    }

    this.logger.log(
      'Task reminder scan completed',
      { requestId: `cron:task-reminders:${now.toISOString()}` },
      {
        job: 'task-reminder-scan',
        scanned: candidates.length,
        enqueued,
      },
    );

    return { scanned: candidates.length, enqueued };
  }

  async processReminder(payload: TaskReminderJobPayload): Promise<void> {
    if (!this.hasTrustedContext(payload)) {
      this.logger.error(
        'Task reminder job missing trusted worker context; failing closed',
        undefined,
        { requestId: `task-reminder:${payload?.taskId ?? 'unknown'}` },
        { job: 'task-reminder-process', payloadKeys: Object.keys(payload ?? {}) },
      );
      return;
    }

    const reminder = await this.reminderRepository.findByIdAndTenant(
      payload.reminderId,
      payload.tenantId,
    );

    if (!reminder) {
      this.logger.warn(
        'Task reminder row was not found for trusted tenant; failing closed',
        { tenantId: payload.tenantId, userId: payload.userId },
        { taskId: payload.taskId, reminderId: payload.reminderId },
      );
      return;
    }

    if (reminder.status === 'sent' || reminder.status === 'skipped') {
      return;
    }

    const task = await this.taskRepository.findByIdAndTenantAndUser(
      payload.taskId,
      payload.tenantId,
      payload.userId,
    );

    if (!task || task.tenantId !== payload.tenantId) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        'task_not_accessible',
        payload,
      );
      return;
    }

    if (isClosedTaskStatus(task.status)) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        `task_${task.status}`,
        payload,
        task,
      );
      return;
    }

    if (!task.dueAt) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        'missing_due_at',
        payload,
        task,
      );
      return;
    }

    const dueAt = new Date(task.dueAt);
    if (
      Math.floor(dueAt.getTime() / 1000) !==
      Math.floor(new Date(reminder.dueAtSnapshot).getTime() / 1000)
    ) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        'stale_due_at',
        payload,
        task,
      );
      return;
    }

    const now = new Date();
    if (payload.reminderType === 'upcoming' && computeIsOverdue(task.status, dueAt, now)) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        'already_overdue',
        payload,
        task,
      );
      return;
    }

    if (payload.reminderType === 'overdue' && !computeIsOverdue(task.status, dueAt, now)) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        'not_overdue',
        payload,
        task,
      );
      return;
    }

    const recipientId = task.assignedTo || task.createdBy;
    const recipient = await this.userRepository.findByIdAndTenant(
      recipientId,
      payload.tenantId,
    );

    if (!recipient?.email) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        'missing_recipient',
        payload,
        task,
      );
      return;
    }

    const delivered = await this.deliver(task, recipient.email, payload);

    await this.finish(
      reminder.id,
      payload.tenantId,
      delivered.status,
      delivered.error,
      payload,
      task,
      {
        recipientEmail: recipient.email,
        channel: delivered.channel,
      },
    );

    if (delivered.status === 'failed') {
      throw new Error(delivered.error ?? 'Task reminder delivery failed');
    }
  }

  private async scheduleForTask(
    task: TaskRecord,
    now: Date = new Date(),
  ): Promise<number> {
    if (!task.dueAt || isClosedTaskStatus(task.status)) {
      return 0;
    }

    const dueAt = new Date(task.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      this.logger.warn(
        'Skipping reminder schedule because dueAt is invalid',
        { tenantId: task.tenantId, userId: task.createdBy },
        { taskId: task.id },
      );
      return 0;
    }

    const recipientId = task.assignedTo || task.createdBy;
    if (!recipientId) {
      this.logger.warn(
        'Skipping reminder schedule because no recipient is available',
        { tenantId: task.tenantId },
        { taskId: task.id },
      );
      return 0;
    }

    const upcomingAt = new Date(
      dueAt.getTime() - this.reminderMinutesBefore() * 60 * 1000,
    );

    let enqueued = 0;
    enqueued += await this.enqueueType(task, recipientId, 'upcoming', upcomingAt, dueAt, now);
    enqueued += await this.enqueueType(task, recipientId, 'overdue', dueAt, dueAt, now);
    return enqueued;
  }

  private async enqueueType(
    task: TaskRecord,
    userId: string,
    reminderType: TaskReminderType,
    scheduledAt: Date,
    dueAt: Date,
    now: Date,
  ): Promise<number> {
    const normalized = normalizeScheduledAt(scheduledAt);
    const { reminder, inserted } = await this.reminderRepository.insertPending({
      tenantId: task.tenantId,
      taskId: task.id,
      userId,
      reminderType,
      scheduledAt: normalized,
      dueAtSnapshot: dueAt,
    });

    if (inserted) {
      await this.recordActivity({
        tenantId: task.tenantId,
        taskId: task.id,
        actorUserId: null,
        eventType: 'REMINDER_SCHEDULED',
        metadata: {
          reminderType,
          scheduledAt: normalized.toISOString(),
          recipientUserId: userId,
        },
      });
    }

    if (reminder.status === 'sent' || reminder.status === 'skipped') {
      return 0;
    }

    if (!this.reminderQueue) {
      this.logger.warn(
        'Task reminder queue is unavailable; reminder stored as pending',
        { tenantId: task.tenantId, userId },
        { taskId: task.id, reminderId: reminder.id, reminderType },
      );
      return 0;
    }

    const delay = Math.max(0, normalized.getTime() - now.getTime());
    const payload: TaskReminderJobPayload = {
      tenantId: task.tenantId,
      taskId: task.id,
      userId,
      reminderId: reminder.id,
      reminderType,
      scheduledAt: normalized.toISOString(),
    };

    try {
      await this.reminderQueue.add(TASK_REMINDER_JOB_NAME, payload, {
        jobId: reminderJobId(task.id, reminderType, normalized),
        delay,
      });
      return 1;
    } catch (error) {
      if (isDuplicateJobError(error)) {
        return 0;
      }
      this.logger.error(
        'Failed to enqueue task reminder job',
        error instanceof Error ? error.stack : undefined,
        { tenantId: task.tenantId, userId },
        { taskId: task.id, reminderId: reminder.id, reminderType },
      );
      return 0;
    }
  }

  private hasTrustedContext(
    payload: TaskReminderJobPayload | undefined,
  ): boolean {
    return Boolean(
      payload?.tenantId &&
        payload.taskId &&
        payload.userId &&
        payload.reminderId &&
        payload.reminderType,
    );
  }

  private async deliver(
    task: TaskRecord,
    recipientEmail: string,
    payload: TaskReminderJobPayload,
  ): Promise<{
    status: 'sent' | 'failed';
    channel: 'gmail' | 'audit';
    error?: string;
  }> {
    const subject =
      payload.reminderType === 'overdue'
        ? `Overdue task: ${task.title}`
        : `Task reminder: ${task.title}`;
    const dueLabel = task.dueAt ? new Date(task.dueAt).toISOString() : 'unspecified';
    const body = [
      `Task: ${task.title}`,
      `Due at (UTC): ${dueLabel}`,
      `Status: ${task.status}`,
      payload.reminderType === 'overdue'
        ? 'This task is overdue.'
        : 'This task is due soon.',
    ].join('\n');

    try {
      const creds = await this.gmailService?.findActiveCredentialsForTenant(
        payload.tenantId,
      );

      if (creds && this.gmailService) {
        await this.gmailService.mailOperations.sendEmail({
          to: recipientEmail,
          subject,
          body,
          contentType: 'text/plain',
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          tokenExpiry: creds.tokenExpiry,
          refreshAccessToken: (refreshed) =>
            this.gmailService!.refreshAndSave(creds, refreshed),
        });

        return { status: 'sent', channel: 'gmail' };
      }

      this.logger.log(
        'Task reminder delivered via audit log because Gmail is not configured',
        { tenantId: payload.tenantId, userId: payload.userId },
        {
          taskId: task.id,
          reminderType: payload.reminderType,
          recipientEmail,
          channel: 'audit',
        },
      );
      return { status: 'sent', channel: 'audit' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'communication_provider_failure';
      this.logger.error(
        'Task reminder communication provider failed',
        error instanceof Error ? error.stack : undefined,
        { tenantId: payload.tenantId, userId: payload.userId },
        { taskId: task.id, reminderType: payload.reminderType },
      );
      return { status: 'failed', channel: 'gmail', error: message };
    }
  }

  private async finish(
    reminderId: string,
    tenantId: string,
    status: 'sent' | 'skipped' | 'failed',
    lastError: string | null | undefined,
    payload: TaskReminderJobPayload,
    task?: TaskRecord,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    await this.reminderRepository.markProcessed(
      reminderId,
      tenantId,
      status,
      lastError ?? null,
    );

    try {
      await this.reminderRepository.writeAuditLog({
        tenantId,
        userId: payload.userId,
        action: `task.reminder.${status}`,
        entityId: task?.id ?? payload.taskId,
        description: `Task reminder ${status}`,
        metadata: {
          reminderId,
          reminderType: payload.reminderType,
          lastError: lastError ?? null,
          channel: extra?.channel,
        },
      });
    } catch (error) {
      this.logger.error(
        'Task reminder audit write failed (non-fatal)',
        error instanceof Error ? error.stack : undefined,
        { tenantId, userId: payload.userId },
        { reminderId, taskId: payload.taskId },
      );
    }

    if (status === 'sent') {
      await this.recordActivity({
        tenantId,
        taskId: task?.id ?? payload.taskId,
        actorUserId: null,
        eventType: 'REMINDER_SENT',
        metadata: {
          channel: extra?.channel ?? 'audit',
          scheduledAt: payload.scheduledAt,
          recipientUserId: payload.userId,
          reminderType: payload.reminderType,
        },
      });
    } else if (status === 'failed' || lastError === 'missing_recipient') {
      await this.recordActivity({
        tenantId,
        taskId: task?.id ?? payload.taskId,
        actorUserId: null,
        eventType: 'REMINDER_FAILED',
        metadata: {
          channel: extra?.channel ?? 'audit',
          scheduledAt: payload.scheduledAt,
          recipientUserId: payload.userId,
          reminderType: payload.reminderType,
          reason: lastError ?? 'failed',
        },
      });
    }

    const logContext = { tenantId, userId: payload.userId };
    const extraFields = {
      reminderId,
      taskId: payload.taskId,
      reminderType: payload.reminderType,
      status,
      lastError: lastError ?? null,
      ...extra,
    };

    if (status === 'failed') {
      this.logger.error(
        'Task reminder failed',
        undefined,
        logContext,
        extraFields,
      );
    } else if (status === 'skipped') {
      this.logger.warn('Task reminder skipped', logContext, extraFields);
    } else {
      this.logger.log('Task reminder processed', logContext, extraFields);
    }
  }

  private async recordActivity(input: {
    tenantId: string;
    taskId: string;
    actorUserId: string | null;
    eventType: 'REMINDER_SCHEDULED' | 'REMINDER_SENT' | 'REMINDER_FAILED';
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (!this.activity) {
      return;
    }

    try {
      await this.activity.record(input);
    } catch (error) {
      this.logger.error(
        'Task reminder activity write failed (non-fatal)',
        error instanceof Error ? error.stack : undefined,
        { tenantId: input.tenantId },
        { taskId: input.taskId, eventType: input.eventType },
      );
    }
  }
}

export function reminderJobId(
  taskId: string,
  reminderType: TaskReminderType,
  scheduledAt: Date,
): string {
  return `task-reminder:${taskId}:${reminderType}:${scheduledAt.getTime()}`;
}

export function normalizeScheduledAt(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already exists|duplicat/i.test(error.message);
}
