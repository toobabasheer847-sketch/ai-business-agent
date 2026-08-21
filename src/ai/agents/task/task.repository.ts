import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, SQL } from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { companies } from '../../../database/drizzle/schema/company.schema.js';
import { leads } from '../../../database/drizzle/schema/lead.schema.js';
import { prospects } from '../../../database/drizzle/schema/prospect.schema.js';
import { tasks } from '../../../database/drizzle/schema/task.schema.js';
import { TaskRecord, TaskPriority, TaskStatus } from './types/task.types.js';

type TaskCrmWrite = {
  companyId?: string | null;
  prospectId?: string | null;
  leadId?: string | null;
};

@Injectable()
export class TaskRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async createTask(input: {
    tenantId: string;
    createdBy: string;
    assignedTo?: string | null;
    companyId?: string | null;
    prospectId?: string | null;
    leadId?: string | null;
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
        companyId: input.companyId ?? null,
        prospectId: input.prospectId ?? null,
        leadId: input.leadId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'pending',
        priority: input.priority ?? 'medium',
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      })
      .returning({ id: tasks.id });

    return (await this.findByIdAndTenantAndUser(
      row.id,
      input.tenantId,
      input.createdBy,
    ))!;
  }

  async findByIdAndTenantAndUser(
    taskId: string,
    tenantId: string,
    userId: string,
  ): Promise<TaskRecord | null> {
    const [row] = await this.crmQuery()
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
      clauses.push(this.searchFilter(filters.search));
    }

    const rows = await this.crmQuery()
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
    const rows = await this.crmQuery()
      .where(
        and(
          this.accessFilter(tenantId, userId),
          this.searchFilter(title),
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
      > &
        TaskCrmWrite
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
      .returning({ id: tasks.id });

    if (!row) {
      return null;
    }

    return this.findByIdAndTenantAndUser(row.id, tenantId, userId);
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

  private crmQuery() {
    return this.db
      .select({
        id: tasks.id,
        tenantId: tasks.tenantId,
        createdBy: tasks.createdBy,
        assignedTo: tasks.assignedTo,
        companyId: tasks.companyId,
        prospectId: tasks.prospectId,
        leadId: tasks.leadId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        companyName: companies.name,
        leadFirstName: leads.firstName,
        leadLastName: leads.lastName,
        prospectFirstName: prospects.firstName,
        prospectLastName: prospects.lastName,
      })
      .from(tasks)
      .leftJoin(companies, eq(tasks.companyId, companies.id))
      .leftJoin(leads, eq(tasks.leadId, leads.id))
      .leftJoin(prospects, eq(tasks.prospectId, prospects.id));
  }

  private searchFilter(search: string) {
    const pattern = `%${search}%`;
    return or(
      ilike(tasks.title, pattern),
      ilike(tasks.description, pattern),
      ilike(companies.name, pattern),
      ilike(leads.firstName, pattern),
      ilike(leads.lastName, pattern),
      ilike(leads.email, pattern),
      ilike(prospects.firstName, pattern),
      ilike(prospects.lastName, pattern),
      ilike(prospects.email, pattern),
    )!;
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
      companyId: row.companyId ?? null,
      prospectId: row.prospectId ?? null,
      leadId: row.leadId ?? null,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueAt: row.dueAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      company:
        row.companyId && row.companyName
          ? { id: row.companyId, name: row.companyName }
          : null,
      prospect:
        row.prospectId
          ? {
              id: row.prospectId,
              name: formatPersonName(row.prospectFirstName, row.prospectLastName),
            }
          : null,
      lead: row.leadId
        ? {
            id: row.leadId,
            name: formatPersonName(row.leadFirstName, row.leadLastName),
          }
        : null,
    };
  }
}

function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}
