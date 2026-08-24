import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { auditLogs } from '../../../database/drizzle/schema/audit-log.schema.js';
import { taskReminders } from '../../../database/drizzle/schema/task-reminder.schema.js';
import {
  ACTIVE_REMINDER_STATUSES,
  CLAIMABLE_REMINDER_STATUSES,
  type TaskReminderStatus,
  type TaskReminderSummary,
  type TaskReminderType,
} from './task-reminder.constants.js';

export type TaskReminderRecord = {
  id: string;
  tenantId: string;
  taskId: string;
  userId: string;
  reminderType: TaskReminderType;
  scheduledAt: Date;
  dueAtSnapshot: Date;
  status: TaskReminderStatus;
  lastError: string | null;
  channel: string | null;
  attemptCount: number;
  createdAt: Date;
  processedAt: Date | null;
};

@Injectable()
export class TaskReminderRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async insertPending(input: {
    tenantId: string;
    taskId: string;
    userId: string;
    reminderType: TaskReminderType;
    scheduledAt: Date;
    dueAtSnapshot: Date;
  }): Promise<{ reminder: TaskReminderRecord; inserted: boolean }> {
    const [row] = await this.db
      .insert(taskReminders)
      .values({
        tenantId: input.tenantId,
        taskId: input.taskId,
        userId: input.userId,
        reminderType: input.reminderType,
        scheduledAt: input.scheduledAt,
        dueAtSnapshot: input.dueAtSnapshot,
        status: 'pending',
        attemptCount: 0,
      })
      .onConflictDoNothing({
        target: [
          taskReminders.taskId,
          taskReminders.reminderType,
          taskReminders.scheduledAt,
        ],
      })
      .returning();

    if (row) {
      return { reminder: this.mapRow(row), inserted: true };
    }

    const existing = await this.findByIdempotencyKey(
      input.taskId,
      input.reminderType,
      input.scheduledAt,
    );

    if (!existing) {
      throw new Error('Task reminder insert conflicted but no existing row was found');
    }

    return { reminder: existing, inserted: false };
  }

  async findByIdAndTenant(
    reminderId: string,
    tenantId: string,
  ): Promise<TaskReminderRecord | null> {
    const [row] = await this.db
      .select()
      .from(taskReminders)
      .where(
        and(eq(taskReminders.id, reminderId), eq(taskReminders.tenantId, tenantId)),
      )
      .limit(1);

    return row ? this.mapRow(row) : null;
  }

  async findByIdempotencyKey(
    taskId: string,
    reminderType: TaskReminderType,
    scheduledAt: Date,
  ): Promise<TaskReminderRecord | null> {
    const [row] = await this.db
      .select()
      .from(taskReminders)
      .where(
        and(
          eq(taskReminders.taskId, taskId),
          eq(taskReminders.reminderType, reminderType),
          eq(taskReminders.scheduledAt, scheduledAt),
        ),
      )
      .limit(1);

    return row ? this.mapRow(row) : null;
  }

  async findAllByTaskAndTenant(
    taskId: string,
    tenantId: string,
  ): Promise<TaskReminderRecord[]> {
    const rows = await this.db
      .select()
      .from(taskReminders)
      .where(
        and(eq(taskReminders.taskId, taskId), eq(taskReminders.tenantId, tenantId)),
      )
      .orderBy(desc(taskReminders.createdAt));

    return rows.map((row) => this.mapRow(row));
  }

  async findActiveByTaskAndTenant(
    taskId: string,
    tenantId: string,
  ): Promise<TaskReminderRecord[]> {
    const rows = await this.db
      .select()
      .from(taskReminders)
      .where(
        and(
          eq(taskReminders.taskId, taskId),
          eq(taskReminders.tenantId, tenantId),
          inArray(taskReminders.status, ACTIVE_REMINDER_STATUSES),
        ),
      )
      .orderBy(desc(taskReminders.createdAt));

    return rows.map((row) => this.mapRow(row));
  }

  async findLatestByTaskIds(
    taskIds: string[],
  ): Promise<Map<string, TaskReminderSummary>> {
    const latest = new Map<string, TaskReminderSummary>();
    if (taskIds.length === 0) {
      return latest;
    }

    const rows = await this.db
      .select()
      .from(taskReminders)
      .where(inArray(taskReminders.taskId, taskIds))
      .orderBy(desc(taskReminders.createdAt));

    const rank: Record<string, number> = {
      processing: 0,
      pending: 1,
      failed: 2,
      disabled: 3,
      cancelled: 4,
      skipped: 5,
      sent: 6,
    };

    for (const row of rows) {
      const mapped = this.mapRow(row);
      const current = latest.get(row.taskId);
      if (!current) {
        latest.set(row.taskId, this.toSummary(mapped));
        continue;
      }
      if ((rank[mapped.status] ?? 99) < (rank[current.status] ?? 99)) {
        latest.set(row.taskId, this.toSummary(mapped));
      }
    }

    return latest;
  }

  async claimForProcessing(
    reminderId: string,
    tenantId: string,
  ): Promise<TaskReminderRecord | null> {
    const [row] = await this.db
      .update(taskReminders)
      .set({
        status: 'processing',
        attemptCount: sql`${taskReminders.attemptCount} + 1`,
      })
      .where(
        and(
          eq(taskReminders.id, reminderId),
          eq(taskReminders.tenantId, tenantId),
          inArray(taskReminders.status, CLAIMABLE_REMINDER_STATUSES),
        ),
      )
      .returning();

    return row ? this.mapRow(row) : null;
  }

  async updateStatus(
    reminderId: string,
    tenantId: string,
    status: TaskReminderStatus,
    extra?: {
      lastError?: string | null;
      channel?: string | null;
      processedAt?: Date | null;
    },
  ): Promise<void> {
    await this.db
      .update(taskReminders)
      .set({
        status,
        lastError: extra?.lastError ?? null,
        ...(extra && 'channel' in extra ? { channel: extra.channel } : {}),
        processedAt: extra?.processedAt === undefined ? new Date() : extra.processedAt,
      })
      .where(
        and(eq(taskReminders.id, reminderId), eq(taskReminders.tenantId, tenantId)),
      );
  }

  async markProcessed(
    reminderId: string,
    tenantId: string,
    status: TaskReminderStatus,
    lastError?: string | null,
  ): Promise<void> {
    await this.updateStatus(reminderId, tenantId, status, {
      lastError: lastError ?? null,
    });
  }

  async writeAuditLog(input: {
    tenantId: string;
    userId?: string | null;
    action: string;
    entityId?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: 'task_reminder',
      entityId: input.entityId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    });
  }

  private toSummary(row: TaskReminderRecord): TaskReminderSummary {
    return {
      id: row.id,
      type: row.reminderType,
      status: row.status,
      scheduledAt: row.scheduledAt,
      processedAt: row.processedAt,
      channel: row.channel === 'gmail' || row.channel === 'audit' ? row.channel : null,
      attemptCount: row.attemptCount,
    };
  }

  private mapRow(row: typeof taskReminders.$inferSelect): TaskReminderRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      taskId: row.taskId,
      userId: row.userId,
      reminderType: row.reminderType as TaskReminderType,
      scheduledAt: row.scheduledAt,
      dueAtSnapshot: row.dueAtSnapshot,
      status: row.status as TaskReminderStatus,
      lastError: row.lastError ?? null,
      channel: row.channel ?? null,
      attemptCount: row.attemptCount ?? 0,
      createdAt: row.createdAt,
      processedAt: row.processedAt ?? null,
    };
  }
}
