import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, SQL } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { tasks } from '../../../database/drizzle/schema/task.schema.js';
import { TaskRecord, TaskPriority, TaskStatus } from './types/task.types.js';

@Injectable()
export class TaskRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async createTask(input: {
    tenantId: string;
    createdBy: string;
    assignedTo?: string | null;
    title: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueAt?: Date | string | null;
  }): Promise<TaskRecord> {
    const [row] = await this.db
      .insert(tasks)
      .values({
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        assignedTo: input.assignedTo ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'pending',
        priority: input.priority ?? 'medium',
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      })
      .returning();

    return this.mapRow(row);
  }

  async findByIdAndTenantAndUser(
    taskId: string,
    tenantId: string,
    userId: string,
  ): Promise<TaskRecord | null> {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), this.accessFilter(tenantId, userId)))
      .limit(1);

    return row ? this.mapRow(row) : null;
  }

  async getTask(
    taskId: string,
    tenantId: string,
    userId: string,
  ): Promise<TaskRecord | null> {
    return this.findByIdAndTenantAndUser(taskId, tenantId, userId);
  }

  async findAllByTenantAndUser(
    tenantId: string,
    userId: string,
    filters?: { status?: TaskStatus; priority?: TaskPriority; search?: string },
  ): Promise<TaskRecord[]> {
    const clauses: SQL[] = [this.accessFilter(tenantId, userId)];

    if (filters?.status) {
      clauses.push(eq(tasks.status, filters.status));
    }

    if (filters?.priority) {
      clauses.push(eq(tasks.priority, filters.priority));
    }

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      clauses.push(
        or(
          ilike(tasks.title, pattern),
          ilike(tasks.description, pattern),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(...clauses))
      .orderBy(desc(tasks.createdAt));

    return rows.map((row) => this.mapRow(row));
  }

  async listTasks(
    tenantId: string,
    userId: string,
    filters?: { status?: TaskStatus; priority?: TaskPriority; search?: string },
  ): Promise<TaskRecord[]> {
    return this.findAllByTenantAndUser(tenantId, userId, filters);
  }

  async findAllByTenantAndUserAndStatus(
    tenantId: string,
    userId: string,
    status: TaskStatus,
  ): Promise<TaskRecord[]> {
    return this.findAllByTenantAndUser(tenantId, userId, { status });
  }

  async findByTitleAndTenantAndUser(
    title: string,
    tenantId: string,
    userId: string,
  ): Promise<TaskRecord[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          this.accessFilter(tenantId, userId),
          ilike(tasks.title, `%${title}%`),
        ),
      )
      .orderBy(desc(tasks.updatedAt));

    return rows.map((row) => this.mapRow(row));
  }

  async updateTask(
    taskId: string,
    tenantId: string,
    userId: string,
    input: Partial<
      Pick<
        TaskRecord,
        | 'title'
        | 'description'
        | 'status'
        | 'priority'
        | 'assignedTo'
        | 'dueAt'
        | 'completedAt'
      >
    >,
  ): Promise<TaskRecord | null> {
    const [row] = await this.db
      .update(tasks)
      .set({
        ...input,
        dueAt: input.dueAt
          ? new Date(input.dueAt)
          : input.dueAt === null
            ? null
            : undefined,
        completedAt: input.completedAt
          ? new Date(input.completedAt)
          : input.completedAt === null
            ? null
            : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), this.accessFilter(tenantId, userId)))
      .returning();

    return row ? this.mapRow(row) : null;
  }

  async deleteTask(
    taskId: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), this.accessFilter(tenantId, userId)));

    return (result.rowCount ?? 0) > 0;
  }

  private accessFilter(tenantId: string, userId: string) {
    return and(
      eq(tasks.tenantId, tenantId),
      or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId))!,
    )!;
  }

  private mapRow(row: any): TaskRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      createdBy: row.createdBy,
      assignedTo: row.assignedTo,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueAt: row.dueAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
