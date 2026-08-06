import { Injectable } from '@nestjs/common';
import { and, desc, eq, SQL, sql } from 'drizzle-orm';

import { db } from '../../../database/drizzle/index.js';
import { tasks } from '../../../database/drizzle/schema/task.schema.js';
import { TaskRecord, TaskPriority, TaskStatus } from './types/task.types.js';

@Injectable()
export class TaskRepository {
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
    const [row] = await db.insert(tasks).values({
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      assignedTo: input.assignedTo ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'pending',
      priority: input.priority ?? 'medium',
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    }).returning();

    return this.mapRow(row);
  }

  async getTask(taskId: string, tenantId: string): Promise<TaskRecord | null> {
    const [row] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId))).limit(1);
    return row ? this.mapRow(row) : null;
  }

  async listTasks(tenantId: string, filters?: { status?: TaskStatus; priority?: TaskPriority; search?: string }): Promise<TaskRecord[]> {
    const clauses: SQL[] = [eq(tasks.tenantId, tenantId)];

    if (filters?.status) {
      clauses.push(eq(tasks.status, filters.status));
    }

    if (filters?.priority) {
      clauses.push(eq(tasks.priority, filters.priority));
    }

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      clauses.push(sql`${tasks.title} ILIKE ${pattern} OR ${tasks.description} ILIKE ${pattern}`);
    }

    const rows = await db.select().from(tasks).where(and(...clauses)).orderBy(desc(tasks.createdAt));
    return rows.map((row) => this.mapRow(row));
  }

  async updateTask(taskId: string, tenantId: string, input: Partial<Pick<TaskRecord, 'title' | 'description' | 'status' | 'priority' | 'assignedTo' | 'dueAt' | 'completedAt'>>): Promise<TaskRecord | null> {
    const [row] = await db.update(tasks)
      .set({
        ...input,
        dueAt: input.dueAt ? new Date(input.dueAt) : input.dueAt === null ? null : undefined,
        completedAt: input.completedAt ? new Date(input.completedAt) : input.completedAt === null ? null : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
      .returning();

    return row ? this.mapRow(row) : null;
  }

  async deleteTask(taskId: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
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
