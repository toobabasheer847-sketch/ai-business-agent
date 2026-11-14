import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { tasks } from '../../../database/drizzle/schema/task.schema.js';
import { users } from '../../../database/drizzle/schema/user.schema.js';

export const TEAM_UPCOMING_DAYS = 7;
export const TEAM_DEADLINE_LIMIT = 20;
export const TEAM_ACTIVITY_LIMIT = 8;

export type TaskCountRow = {
  assigned: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  upcoming: number;
};

export type EmployeeWorkloadRow = TaskCountRow & {
  employeeId: string;
  employeeName: string;
  email: string;
};

export type UnassignedTaskCounts = TaskCountRow;

export type TeamDeadlineRow = {
  id: string;
  title: string;
  status: string;
  dueAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

export type TeamActivityRow = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  assigneeName: string | null;
};

const taskCounts = {
  assigned: sql<number>`count(${tasks.id})::int`,
  pending: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'pending')::int`,
  inProgress: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'in_progress')::int`,
  completed: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'completed')::int`,
  cancelled: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'cancelled')::int`,
  overdue: sql<number>`count(${tasks.id}) filter (where ${tasks.status} not in ('completed', 'cancelled') and ${tasks.dueAt} is not null and ${tasks.dueAt} < now())::int`,
  upcoming: sql<number>`count(${tasks.id}) filter (where ${tasks.status} not in ('completed', 'cancelled') and ${tasks.dueAt} is not null and ${tasks.dueAt} >= now() and ${tasks.dueAt} < now() + interval '7 days')::int`,
};

const OPEN_OVERDUE = sql`${tasks.status} not in ('completed', 'cancelled') and ${tasks.dueAt} is not null and ${tasks.dueAt} < now()`;
const OPEN_UPCOMING = sql`${tasks.status} not in ('completed', 'cancelled') and ${tasks.dueAt} is not null and ${tasks.dueAt} >= now() and ${tasks.dueAt} < now() + interval '7 days'`;

@Injectable()
export class TeamAnalyticsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  async employeeWorkload(tenantId: string): Promise<EmployeeWorkloadRow[]> {
    this.assertTenant(tenantId);
    const rows = await this.db
      .select({
        employeeId: users.id,
        employeeName: users.name,
        email: users.email,
        ...taskCounts,
      })
      .from(users)
      .leftJoin(
        tasks,
        and(eq(tasks.assignedTo, users.id), eq(tasks.tenantId, users.tenantId)),
      )
      .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
      .groupBy(users.id, users.name, users.email)
      .orderBy(asc(users.name));

    return rows.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      email: row.email,
      ...this.counts(row),
    }));
  }

  async unassignedCounts(tenantId: string): Promise<UnassignedTaskCounts> {
    this.assertTenant(tenantId);
    const [row] = await this.db
      .select(taskCounts)
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), isNull(tasks.assignedTo)));
    return this.counts(row);
  }

  async deadlines(tenantId: string, kind: 'overdue' | 'upcoming'): Promise<TeamDeadlineRow[]> {
    this.assertTenant(tenantId);
    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        dueAt: tasks.dueAt,
        assigneeId: tasks.assignedTo,
        assigneeName: users.name,
        assigneeActive: users.isActive,
      })
      .from(tasks)
      .leftJoin(users, and(eq(users.id, tasks.assignedTo), eq(users.tenantId, tasks.tenantId)))
      .where(and(eq(tasks.tenantId, tenantId), kind === 'overdue' ? OPEN_OVERDUE : OPEN_UPCOMING))
      .orderBy(asc(tasks.dueAt))
      .limit(TEAM_DEADLINE_LIMIT);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : '',
      assigneeId: row.assigneeId,
      assigneeName: !row.assigneeId
        ? null
        : row.assigneeActive === false
          ? null
          : row.assigneeName,
    }));
  }

  async recentTaskUpdates(tenantId: string): Promise<TeamActivityRow[]> {
    this.assertTenant(tenantId);
    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        updatedAt: tasks.updatedAt,
        assigneeName: users.name,
        assigneeActive: users.isActive,
      })
      .from(tasks)
      .leftJoin(users, and(eq(users.id, tasks.assignedTo), eq(users.tenantId, tasks.tenantId)))
      .where(eq(tasks.tenantId, tenantId))
      .orderBy(desc(tasks.updatedAt))
      .limit(TEAM_ACTIVITY_LIMIT);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updatedAt: new Date(row.updatedAt).toISOString(),
      assigneeName: row.assigneeActive === false ? null : row.assigneeName,
    }));
  }

  private counts(row: Partial<TaskCountRow> | undefined): TaskCountRow {
    return {
      assigned: this.number(row?.assigned),
      pending: this.number(row?.pending),
      inProgress: this.number(row?.inProgress),
      completed: this.number(row?.completed),
      cancelled: this.number(row?.cancelled),
      overdue: this.number(row?.overdue),
      upcoming: this.number(row?.upcoming),
    };
  }

  private number(value: number | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new UnauthorizedException('Tenant context is required');
    }
  }
}
