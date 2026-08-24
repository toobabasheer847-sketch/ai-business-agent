import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { taskDependencies } from '../../../database/drizzle/schema/task-dependency.schema.js';
import { tasks } from '../../../database/drizzle/schema/task.schema.js';

export type TaskDependencyRow = {
  id: string;
  tenantId: string;
  taskId: string;
  dependsOnTaskId: string;
  createdAt: Date;
};

@Injectable()
export class TaskDependencyRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async create(input: {
    tenantId: string;
    taskId: string;
    dependsOnTaskId: string;
  }): Promise<TaskDependencyRow> {
    const [row] = await this.db
      .insert(taskDependencies)
      .values({
        tenantId: input.tenantId,
        taskId: input.taskId,
        dependsOnTaskId: input.dependsOnTaskId,
      })
      .returning();

    return row;
  }

  async deletePair(
    tenantId: string,
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<boolean> {
    const result = await this.db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.tenantId, tenantId),
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }

  async findPair(
    tenantId: string,
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<TaskDependencyRow | null> {
    const [row] = await this.db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.tenantId, tenantId),
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listDependsOn(
    tenantId: string,
    taskId: string,
  ): Promise<TaskDependencyRow[]> {
    return this.db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.tenantId, tenantId),
          eq(taskDependencies.taskId, taskId),
        ),
      );
  }

  async listDependents(
    tenantId: string,
    dependsOnTaskId: string,
  ): Promise<TaskDependencyRow[]> {
    return this.db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.tenantId, tenantId),
          eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
        ),
      );
  }

  async listDependsOnIds(
    tenantId: string,
    taskId: string,
  ): Promise<string[]> {
    const rows = await this.listDependsOn(tenantId, taskId);
    return rows.map((row) => row.dependsOnTaskId);
  }

  async listIncompleteBlockers(
    tenantId: string,
    taskId: string,
  ): Promise<Array<{ id: string; title: string; status: string }>> {
    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
      })
      .from(taskDependencies)
      .innerJoin(tasks, eq(tasks.id, taskDependencies.dependsOnTaskId))
      .where(
        and(
          eq(taskDependencies.tenantId, tenantId),
          eq(taskDependencies.taskId, taskId),
          eq(tasks.tenantId, tenantId),
          ne(tasks.status, 'completed'),
        ),
      );

    return rows;
  }

  async listBlockedTaskIds(
    tenantId: string,
    taskIds: string[],
  ): Promise<Set<string>> {
    if (taskIds.length === 0) {
      return new Set();
    }

    const rows = await this.db
      .select({
        taskId: taskDependencies.taskId,
      })
      .from(taskDependencies)
      .innerJoin(tasks, eq(tasks.id, taskDependencies.dependsOnTaskId))
      .where(
        and(
          eq(taskDependencies.tenantId, tenantId),
          inArray(taskDependencies.taskId, taskIds),
          eq(tasks.tenantId, tenantId),
          ne(tasks.status, 'completed'),
        ),
      );

    return new Set(rows.map((row) => row.taskId));
  }
}
