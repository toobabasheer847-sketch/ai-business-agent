import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { auditLogs } from '../../../database/drizzle/schema/audit-log.schema.js';
import { taskReminders } from '../../../database/drizzle/schema/task-reminder.schema.js';
import type {
  TaskReminderStatus,
  TaskReminderSummary,
  TaskReminderType,
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
  }): Promise<TaskReminderRecord> {
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
      return this.mapRow(row);
    }

    const existing = await this.findByIdempotencyKey(
      input.taskId,
      input.reminderType,
      input.scheduledAt,
    );

    if (!existing) {
      throw new Error('Task reminder insert conflicted but no existing row was found');
    }

    return existing;
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

    for (const row of rows) {
      if (latest.has(row.taskId)) {
        continue;
      }

      latest.set(row.taskId, {
        id: row.id,
        type: row.reminderType as TaskReminderType,
        status: row.status as TaskReminderStatus,
        scheduledAt: row.scheduledAt,
        processedAt: row.processedAt,
      });
    }

    return latest;
  }

  async markProcessed(
    reminderId: string,
    tenantId: string,
    status: TaskReminderStatus,
    lastError?: string | null,
  ): Promise<void> {
    await this.db
      .update(taskReminders)
      .set({
        status,
        lastError: lastError ?? null,
        processedAt: new Date(),
      })
      .where(
        and(eq(taskReminders.id, reminderId), eq(taskReminders.tenantId, tenantId)),
      );
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
      createdAt: row.createdAt,
      processedAt: row.processedAt ?? null,
    };
  }
}
