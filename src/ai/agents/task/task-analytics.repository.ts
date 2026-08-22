import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  eq,
  exists,
  gte,
  isNotNull,
  lte,
  or,
  SQL,
  sql,
  type SQLWrapper,
} from 'drizzle-orm';

import { DRIZZLE_DB } from '../../../database/database.module.js';
import type { DrizzleDb } from '../../../database/database.service.js';
import { auditLogs } from '../../../database/drizzle/schema/audit-log.schema.js';
import { tasks } from '../../../database/drizzle/schema/task.schema.js';
import { taskReminders } from '../../../database/drizzle/schema/task-reminder.schema.js';
import { addUtcDays, endOfUtcDay, startOfUtcDay } from './parse-task-datetime.js';
import {
  buildAnalyticsResult,
  emptyActivity,
  emptyCrm,
  emptyPriority,
  emptyReminders,
  emptySummary,
  formatTrendPeriod,
  iterateTrendPeriods,
  mergeTrendRows,
  toCount,
} from './task-analytics.metrics.js';
import { TASK_ACTIVITY_ENTITY_TYPE } from './task-activity.constants.js';
import type {
  TaskAnalyticsActivity,
  TaskAnalyticsFilters,
  TaskAnalyticsGroupBy,
  TaskAnalyticsResult,
  TaskAnalyticsTrendPoint,
  TaskPriority,
  TaskStatus,
} from './types/task.types.js';

@Injectable()
export class TaskAnalyticsRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async getSummary(
    tenantId: string,
    userId: string,
    filters: TaskAnalyticsFilters,
    now: Date = new Date(),
  ): Promise<TaskAnalyticsResult> {
    const clauses = this.taskFilterClauses(tenantId, userId, filters);
    const todayStart = startOfUtcDay(now);
    const todayEnd = endOfUtcDay(now);
    const tomorrowStart = addUtcDays(now, 1);
    const tomorrowEnd = endOfUtcDay(tomorrowStart);
    const openSql = sql`${tasks.status} not in ('completed', 'cancelled')`;

    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${tasks.status} = 'pending')::int`,
        inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
        cancelled: sql<number>`count(*) filter (where ${tasks.status} = 'cancelled')::int`,
        overdue: sql<number>`count(*) filter (where ${openSql} and ${tasks.dueAt} is not null and ${tasks.dueAt} < ${now})::int`,
        dueToday: sql<number>`count(*) filter (where ${tasks.dueAt} is not null and ${tasks.dueAt} >= ${todayStart} and ${tasks.dueAt} <= ${todayEnd})::int`,
        dueTomorrow: sql<number>`count(*) filter (where ${tasks.dueAt} is not null and ${tasks.dueAt} >= ${tomorrowStart} and ${tasks.dueAt} <= ${tomorrowEnd})::int`,
        highPriorityOpen: sql<number>`count(*) filter (where ${tasks.priority} = 'high' and ${openSql})::int`,
        urgentOpen: sql<number>`count(*) filter (where ${tasks.priority} = 'urgent' and ${openSql})::int`,
        low: sql<number>`count(*) filter (where ${tasks.priority} = 'low')::int`,
        medium: sql<number>`count(*) filter (where ${tasks.priority} = 'medium')::int`,
        high: sql<number>`count(*) filter (where ${tasks.priority} = 'high')::int`,
        urgent: sql<number>`count(*) filter (where ${tasks.priority} = 'urgent')::int`,
        company: sql<number>`count(*) filter (where ${tasks.companyId} is not null)::int`,
        prospect: sql<number>`count(*) filter (where ${tasks.prospectId} is not null)::int`,
        lead: sql<number>`count(*) filter (where ${tasks.leadId} is not null)::int`,
        unlinked: sql<number>`count(*) filter (where ${tasks.companyId} is null and ${tasks.prospectId} is null and ${tasks.leadId} is null)::int`,
      })
      .from(tasks)
      .where(and(...clauses));

    const [reminders, activity] = await Promise.all([
      this.getReminderStats(clauses),
      this.getActivityStats(clauses),
    ]);

    return buildAnalyticsResult({
      summary: {
        ...emptySummary(),
        total: toCount(row?.total),
        pending: toCount(row?.pending),
        inProgress: toCount(row?.inProgress),
        completed: toCount(row?.completed),
        cancelled: toCount(row?.cancelled),
        overdue: toCount(row?.overdue),
        dueToday: toCount(row?.dueToday),
        dueTomorrow: toCount(row?.dueTomorrow),
        highPriorityOpen: toCount(row?.highPriorityOpen),
        urgentOpen: toCount(row?.urgentOpen),
      },
      priority: {
        ...emptyPriority(),
        low: toCount(row?.low),
        medium: toCount(row?.medium),
        high: toCount(row?.high),
        urgent: toCount(row?.urgent),
      },
      crm: {
        ...emptyCrm(),
        company: toCount(row?.company),
        prospect: toCount(row?.prospect),
        lead: toCount(row?.lead),
        unlinked: toCount(row?.unlinked),
      },
      reminders,
      activity,
    });
  }

  async getTrends(
    tenantId: string,
    userId: string,
    filters: TaskAnalyticsFilters,
    groupBy: TaskAnalyticsGroupBy,
    from: Date,
    to: Date,
    now: Date = new Date(),
  ): Promise<TaskAnalyticsTrendPoint[]> {
    const clauses = this.taskFilterClauses(tenantId, userId, {
      ...filters,
      from: undefined,
      to: undefined,
    });
    const createdTrunc = this.dateTruncSql(groupBy, tasks.createdAt);
    const completedTrunc = this.dateTruncSql(groupBy, tasks.completedAt);
    const dueTrunc = this.dateTruncSql(groupBy, tasks.dueAt);
    const openSql = sql`${tasks.status} not in ('completed', 'cancelled')`;

    const [createdRows, completedRows, overdueRows] = await Promise.all([
      this.db
        .select({
          period: createdTrunc,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            ...clauses,
            gte(tasks.createdAt, from),
            lte(tasks.createdAt, to),
          ),
        )
        .groupBy(createdTrunc),
      this.db
        .select({
          period: completedTrunc,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            ...clauses,
            isNotNull(tasks.completedAt),
            gte(tasks.completedAt, from),
            lte(tasks.completedAt, to),
          ),
        )
        .groupBy(completedTrunc),
      this.db
        .select({
          period: dueTrunc,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            ...clauses,
            openSql,
            isNotNull(tasks.dueAt),
            sql`${tasks.dueAt} < ${now}`,
            gte(tasks.dueAt, from),
            lte(tasks.dueAt, to),
          ),
        )
        .groupBy(dueTrunc),
    ]);

    const mapRows = (
      rows: Array<{ period: unknown; count: unknown }>,
    ): Array<{ period: string; count: number }> =>
      rows
        .filter((row) => row.period != null)
        .map((row) => ({
          period: formatTrendPeriod(row.period as Date | string, groupBy),
          count: toCount(row.count),
        }));

    return mergeTrendRows(
      iterateTrendPeriods(from, to, groupBy),
      mapRows(createdRows),
      mapRows(completedRows),
      mapRows(overdueRows),
    );
  }

  private async getReminderStats(
    taskClauses: SQL[],
  ): Promise<ReturnType<typeof emptyReminders>> {
    const [row] = await this.db
      .select({
        scheduled: sql<number>`count(*) filter (where ${taskReminders.status} = 'pending')::int`,
        processing: sql<number>`count(*) filter (where ${taskReminders.status} = 'processing')::int`,
        sent: sql<number>`count(*) filter (where ${taskReminders.status} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${taskReminders.status} = 'failed')::int`,
        cancelled: sql<number>`count(*) filter (where ${taskReminders.status} in ('cancelled', 'skipped'))::int`,
        disabled: sql<number>`count(*) filter (where ${taskReminders.status} = 'disabled')::int`,
      })
      .from(taskReminders)
      .innerJoin(tasks, eq(taskReminders.taskId, tasks.id))
      .where(and(...taskClauses));

    return {
      ...emptyReminders(),
      scheduled: toCount(row?.scheduled),
      processing: toCount(row?.processing),
      sent: toCount(row?.sent),
      failed: toCount(row?.failed),
      cancelled: toCount(row?.cancelled),
      disabled: toCount(row?.disabled),
    };
  }

  private async getActivityStats(
    taskClauses: SQL[],
  ): Promise<TaskAnalyticsActivity> {
    const rows = await this.db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .innerJoin(tasks, eq(auditLogs.entityId, tasks.id))
      .where(
        and(
          eq(auditLogs.entityType, TASK_ACTIVITY_ENTITY_TYPE),
          eq(auditLogs.tenantId, tasks.tenantId),
          ...taskClauses,
        ),
      )
      .groupBy(auditLogs.action);

    const activity = emptyActivity();
    const mapped: Record<string, keyof TaskAnalyticsActivity> = {
      TASK_CREATED: 'created',
      TASK_UPDATED: 'updated',
      TASK_COMPLETED: 'completed',
      TASK_CANCELLED: 'cancelled',
      TASK_REOPENED: 'reopened',
      TASK_CRM_LINKED: 'crmLinked',
      TASK_CRM_UNLINKED: 'crmUnlinked',
      REMINDER_ENABLED: 'reminderEnabled',
      REMINDER_DISABLED: 'reminderDisabled',
      REMINDER_SENT: 'reminderSent',
      REMINDER_FAILED: 'reminderFailed',
    };

    for (const row of rows) {
      const key = mapped[row.action];
      if (key) {
        activity[key] += toCount(row.count);
      }
    }

    return activity;
  }

  private taskFilterClauses(
    tenantId: string,
    userId: string,
    filters: TaskAnalyticsFilters,
  ): SQL[] {
    const clauses: SQL[] = [this.accessFilter(tenantId, userId)];
    const rangeField = filters.rangeField === 'completedAt' ? tasks.completedAt : tasks.createdAt;

    if (filters.status) {
      clauses.push(eq(tasks.status, filters.status as TaskStatus));
    }
    if (filters.priority) {
      clauses.push(eq(tasks.priority, filters.priority as TaskPriority));
    }
    if (filters.companyId) {
      clauses.push(eq(tasks.companyId, filters.companyId));
    }
    if (filters.prospectId) {
      clauses.push(eq(tasks.prospectId, filters.prospectId));
    }
    if (filters.leadId) {
      clauses.push(eq(tasks.leadId, filters.leadId));
    }
    if (filters.assigneeId) {
      clauses.push(eq(tasks.assignedTo, filters.assigneeId));
    }
    if (filters.from) {
      clauses.push(gte(rangeField, filters.from));
    }
    if (filters.to) {
      clauses.push(lte(rangeField, filters.to));
    }
    if (filters.hasReminder) {
      clauses.push(
        exists(
          this.db
            .select({ id: taskReminders.id })
            .from(taskReminders)
            .where(eq(taskReminders.taskId, tasks.id)),
        ),
      );
    }

    return clauses;
  }

  private accessFilter(tenantId: string, userId: string) {
    return and(
      eq(tasks.tenantId, tenantId),
      or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId))!,
    )!;
  }

  private dateTruncSql(groupBy: TaskAnalyticsGroupBy, column: SQLWrapper) {
    if (groupBy === 'week') {
      return sql`date_trunc('week', ${column})`;
    }
    if (groupBy === 'month') {
      return sql`date_trunc('month', ${column})`;
    }
    return sql`date_trunc('day', ${column})`;
  }
}
