import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { AppLogger } from '../../../infrastructure/logging/logger.service.js';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.module.js';
import { GmailService } from '../communication/gmail/gmail.service.js';
import { UserRepository } from '../../../modules/user/user.repository.js';
import type { TaskActivityEventType } from './task-activity.constants.js';
import {
  ACTIVE_REMINDER_STATUSES,
  DEFAULT_TASK_REMINDER_MINUTES_BEFORE,
  TASK_REMINDER_BACKOFF_MS,
  TASK_REMINDER_JOB_ATTEMPTS,
  TASK_REMINDER_JOB_NAME,
  toReminderApiItem,
  type TaskReminderApiItem,
  type TaskReminderJobPayload,
  type TaskReminderType,
} from './task-reminder.constants.js';
import { TaskReminderRepository } from './task-reminder.repository.js';
import { TaskActivityRepository } from './task-activity.repository.js';
import { computeIsOverdue, isClosedTaskStatus } from './task-overdue.js';
import { TaskRepository } from './task.repository.js';
import { TaskDependencyRepository } from './task-dependency.repository.js';
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
    @Optional()
    private readonly dependencies?: TaskDependencyRepository,
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

  async listReminders(task: TaskRecord): Promise<{
    taskId: string;
    reminders: TaskReminderApiItem[];
  }> {
    const rows = await this.reminderRepository.findAllByTaskAndTenant(
      task.id,
      task.tenantId,
    );

    return {
      taskId: task.id,
      reminders: rows.map((row) =>
        toReminderApiItem({
          id: row.id,
          reminderType: row.reminderType,
          scheduledAt: row.scheduledAt,
          status: row.status,
          channel: row.channel,
          processedAt: row.processedAt,
          attemptCount: row.attemptCount,
        }),
      ),
    };
  }

  async enableReminders(task: TaskRecord, actorUserId?: string | null): Promise<{
    taskId: string;
    reminders: TaskReminderApiItem[];
  }> {
    this.assertOpenTaskWithDueAt(task);
    const enqueued = await this.scheduleForTask(task);
    await this.recordActivity({
      tenantId: task.tenantId,
      taskId: task.id,
      actorUserId: actorUserId ?? null,
      eventType: 'REMINDER_ENABLED',
      metadata: { enqueued },
    });
    return this.listReminders(task);
  }

  async disableReminders(
    task: TaskRecord,
    actorUserId?: string | null,
    reason = 'disabled',
  ): Promise<{
    taskId: string;
    reminders: TaskReminderApiItem[];
  }> {
    const active = await this.reminderRepository.findActiveByTaskAndTenant(
      task.id,
      task.tenantId,
    );

    for (const reminder of active) {
      await this.reminderRepository.updateStatus(
        reminder.id,
        task.tenantId,
        reason === 'cancelled' ? 'cancelled' : 'disabled',
        { lastError: reason, processedAt: new Date() },
      );
      await this.removeReminderJob(task.id, reminder.reminderType, reminder.scheduledAt);
    }

    if (active.length > 0) {
      await this.recordActivity({
        tenantId: task.tenantId,
        taskId: task.id,
        actorUserId: actorUserId ?? null,
        eventType: 'REMINDER_DISABLED',
        metadata: { count: active.length, reason },
      });
    }

    return this.listReminders(task);
  }

  async rescheduleUpcoming(
    task: TaskRecord,
    scheduledAtRaw: string,
    actorUserId?: string | null,
  ): Promise<{
    taskId: string;
    reminders: TaskReminderApiItem[];
  }> {
    this.assertOpenTaskWithDueAt(task);
    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO datetime');
    }

    const dueAt = new Date(task.dueAt as Date | string);
    if (!(scheduledAt.getTime() < dueAt.getTime())) {
      throw new BadRequestException('scheduledAt must be before dueAt');
    }

    const recipientId = task.assignedTo || task.createdBy;
    if (!recipientId) {
      throw new BadRequestException('Task has no reminder recipient');
    }

    const previous = await this.reminderRepository.findActiveByTaskAndTenant(
      task.id,
      task.tenantId,
    );
    for (const reminder of previous.filter((row) => row.reminderType === 'upcoming')) {
      await this.reminderRepository.updateStatus(
        reminder.id,
        task.tenantId,
        'cancelled',
        { lastError: 'rescheduled', processedAt: new Date() },
      );
      await this.removeReminderJob(task.id, reminder.reminderType, reminder.scheduledAt);
    }

    const now = new Date();
    await this.enqueueType(
      task,
      recipientId,
      'upcoming',
      scheduledAt,
      dueAt,
      now,
    );
    await this.enqueueType(task, recipientId, 'overdue', dueAt, dueAt, now);

    await this.recordActivity({
      tenantId: task.tenantId,
      taskId: task.id,
      actorUserId: actorUserId ?? null,
      eventType: 'REMINDER_RESCHEDULED',
      metadata: {
        scheduledAt: normalizeScheduledAt(scheduledAt).toISOString(),
        dueAt: dueAt.toISOString(),
      },
    });

    return this.listReminders(task);
  }

  async processReminder(
    payload: TaskReminderJobPayload,
    attempt: { current: number; max: number } = {
      current: 1,
      max: TASK_REMINDER_JOB_ATTEMPTS,
    },
  ): Promise<void> {
    if (!this.hasTrustedContext(payload)) {
      this.logger.error(
        'Task reminder job missing trusted worker context; failing closed',
        undefined,
        { requestId: `task-reminder:${payload?.taskId ?? 'unknown'}` },
        { job: 'task-reminder-process', payloadKeys: Object.keys(payload ?? {}) },
      );
      if (payload?.tenantId && payload.taskId) {
        await this.recordActivity({
          tenantId: payload.tenantId,
          taskId: payload.taskId,
          actorUserId: null,
          eventType: 'REMINDER_FAILED',
          metadata: { reason: 'missing_trusted_context' },
        });
      }
      return;
    }

    const reminder = await this.reminderRepository.findByIdAndTenant(
      payload.reminderId,
      payload.tenantId,
    );

    if (!reminder || reminder.taskId !== payload.taskId) {
      this.logger.warn(
        'Task reminder row was not found for trusted tenant; failing closed',
        { tenantId: payload.tenantId },
        { taskId: payload.taskId, reminderId: payload.reminderId },
      );
      return;
    }

    if (reminder.status === 'sent') {
      return;
    }

    if (
      reminder.status === 'disabled' ||
      reminder.status === 'cancelled' ||
      reminder.status === 'skipped'
    ) {
      return;
    }

    const claimed = await this.reminderRepository.claimForProcessing(
      reminder.id,
      payload.tenantId,
    );

    if (!claimed) {
      return;
    }

    await this.recordActivity({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorUserId: null,
      eventType: 'REMINDER_PROCESSING',
      metadata: {
        reminderId: reminder.id,
        attempt: claimed.attemptCount,
      },
    });

    const recipientUserId = reminder.userId || payload.userId;
    const task = await this.taskRepository.findByIdAndTenantAndUser(
      payload.taskId,
      payload.tenantId,
      recipientUserId || reminder.userId,
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

    if (await this.isBlockedByDependency(task)) {
      await this.finish(
        reminder.id,
        payload.tenantId,
        'skipped',
        'blocked_by_dependency',
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

    const reminderType = payload.reminderType ?? reminder.reminderType;
    const now = new Date();
    if (reminderType === 'upcoming' && computeIsOverdue(task.status, dueAt, now)) {
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

    if (reminderType === 'overdue' && !computeIsOverdue(task.status, dueAt, now)) {
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

    const delivered = await this.deliver(task, recipient.email, {
      ...payload,
      reminderType,
      userId: recipientId,
    });

    if (delivered.status === 'failed') {
      const retryable = attempt.current < attempt.max;
      if (retryable) {
        await this.reminderRepository.updateStatus(
          reminder.id,
          payload.tenantId,
          'failed',
          {
            lastError: delivered.error ?? 'communication_provider_failure',
            channel: delivered.channel,
            processedAt: new Date(),
          },
        );
        await this.recordActivity({
          tenantId: payload.tenantId,
          taskId: payload.taskId,
          actorUserId: null,
          eventType: 'REMINDER_RETRY',
          metadata: {
            reminderId: reminder.id,
            attempt: attempt.current,
            maxAttempts: attempt.max,
            channel: delivered.channel,
          },
        });
        throw new Error(delivered.error ?? 'Task reminder delivery failed');
      }

      await this.finish(
        reminder.id,
        payload.tenantId,
        'failed',
        delivered.error,
        payload,
        task,
        { channel: delivered.channel },
      );
      throw new Error(delivered.error ?? 'Task reminder delivery failed');
    }

    await this.finish(
      reminder.id,
      payload.tenantId,
      'sent',
      null,
      payload,
      task,
      { channel: delivered.channel },
    );
  }

  private async scheduleForTask(
    task: TaskRecord,
    now: Date = new Date(),
  ): Promise<number> {
    if (!task.dueAt || isClosedTaskStatus(task.status)) {
      return 0;
    }

    if (await this.isBlockedByDependency(task)) {
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
    const { reminder: insertedRow, inserted } = await this.reminderRepository.insertPending({
      tenantId: task.tenantId,
      taskId: task.id,
      userId,
      reminderType,
      scheduledAt: normalized,
      dueAtSnapshot: dueAt,
    });

    let reminder = insertedRow;
    let shouldEnqueue = inserted;

    if (
      !inserted &&
      (reminder.status === 'disabled' ||
        reminder.status === 'cancelled' ||
        reminder.status === 'failed')
    ) {
      await this.reminderRepository.updateStatus(
        reminder.id,
        task.tenantId,
        'pending',
        { lastError: null, processedAt: null },
      );
      reminder = { ...reminder, status: 'pending', lastError: null };
      shouldEnqueue = true;
    }

    if (inserted || shouldEnqueue) {
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

    if (!ACTIVE_REMINDER_STATUSES.includes(reminder.status) && reminder.status !== 'pending') {
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
      reminderId: reminder.id,
      userId,
      reminderType,
      scheduledAt: normalized.toISOString(),
    };

    try {
      await this.reminderQueue.add(TASK_REMINDER_JOB_NAME, payload, {
        jobId: reminderJobId(task.id, reminderType, normalized),
        delay,
        attempts: TASK_REMINDER_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: TASK_REMINDER_BACKOFF_MS,
        },
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
      payload?.tenantId && payload.taskId && payload.reminderId,
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
    eventType: TaskActivityEventType;
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

  private async isBlockedByDependency(task: TaskRecord): Promise<boolean> {
    if (!this.dependencies) {
      return false;
    }
    const blockers = await this.dependencies.listIncompleteBlockers(
      task.tenantId,
      task.id,
    );
    return blockers.length > 0;
  }

  private assertOpenTaskWithDueAt(task: TaskRecord): void {
    if (isClosedTaskStatus(task.status)) {
      throw new BadRequestException(
        `Reminders cannot be active on a ${task.status} task`,
      );
    }
    if (!task.dueAt) {
      throw new BadRequestException('Task must have a due date to use reminders');
    }
  }

  private async removeReminderJob(
    taskId: string,
    reminderType: TaskReminderType,
    scheduledAt: Date,
  ): Promise<void> {
    if (!this.reminderQueue) {
      return;
    }

    const jobId = reminderJobId(taskId, reminderType, scheduledAt);
    try {
      const job = await this.reminderQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      this.logger.warn(
        'Failed to remove task reminder job (non-fatal)',
        { requestId: `task-reminder-remove:${jobId}` },
        {
          taskId,
          reminderType,
          error: error instanceof Error ? error.message : String(error),
        },
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
