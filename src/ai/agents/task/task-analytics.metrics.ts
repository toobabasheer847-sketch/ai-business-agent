import {
  addUtcDays,
  endOfUtcDay,
  startOfUtcDay,
  startOfUtcMonth,
  startOfUtcWeek,
} from './parse-task-datetime.js';
import type {
  TaskAnalyticsActivity,
  TaskAnalyticsCrm,
  TaskAnalyticsGroupBy,
  TaskAnalyticsPriority,
  TaskAnalyticsReminders,
  TaskAnalyticsResult,
  TaskAnalyticsSummary,
  TaskAnalyticsTrendPoint,
} from './types/task.types.js';

export const TREND_MAX_DAYS: Record<TaskAnalyticsGroupBy, number> = {
  day: 366,
  week: 735,
  month: 1826,
};

export function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

export function toCount(value: unknown): number {
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }

  return Math.trunc(n);
}

export function emptySummary(): TaskAnalyticsSummary {
  return {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    dueToday: 0,
    dueTomorrow: 0,
    highPriorityOpen: 0,
    urgentOpen: 0,
    withReminders: 0,
  };
}

export function emptyPriority(): TaskAnalyticsPriority {
  return { low: 0, medium: 0, high: 0, urgent: 0 };
}

export function emptyCrm(): TaskAnalyticsCrm {
  return { company: 0, prospect: 0, lead: 0, unlinked: 0 };
}

export function emptyReminders(): TaskAnalyticsReminders {
  return {
    scheduled: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    disabled: 0,
  };
}

export function emptyActivity(): TaskAnalyticsActivity {
  return {
    created: 0,
    updated: 0,
    completed: 0,
    cancelled: 0,
    reopened: 0,
    crmLinked: 0,
    crmUnlinked: 0,
    reminderEnabled: 0,
    reminderDisabled: 0,
    reminderSent: 0,
    reminderFailed: 0,
  };
}

export function buildAnalyticsResult(input: {
  summary: TaskAnalyticsSummary;
  priority: TaskAnalyticsPriority;
  crm: TaskAnalyticsCrm;
  reminders: TaskAnalyticsReminders;
  activity: TaskAnalyticsActivity;
}): TaskAnalyticsResult {
  const { summary, priority, crm, reminders, activity } = input;
  const reminderDecided = reminders.sent + reminders.failed;

  return {
    summary,
    completionRate: percent(summary.completed, summary.total),
    overdueRate: percent(summary.overdue, summary.total),
    reminderSuccessRate: percent(reminders.sent, reminderDecided),
    reminderFailureRate: percent(reminders.failed, reminderDecided),
    priority,
    crm,
    reminders,
    activity,
  };
}

export function parseOptionalIsoDate(
  value?: string,
): { ok: true; date?: Date } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, date: undefined };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: 'from and to must be valid dates' };
  }

  return { ok: true, date };
}

export function resolveAnalyticsRange(input: {
  from?: string;
  to?: string;
  now?: Date;
  required?: boolean;
  maxDays?: number;
}):
  | { ok: true; from?: Date; to?: Date }
  | { ok: false; message: string } {
  const now = input.now ?? new Date();
  const parsedFrom = parseOptionalIsoDate(input.from);
  if (!parsedFrom.ok) {
    return parsedFrom;
  }
  const parsedTo = parseOptionalIsoDate(input.to);
  if (!parsedTo.ok) {
    return parsedTo;
  }

  let from = parsedFrom.date;
  let to = parsedTo.date;

  if (input.required) {
    to = to ?? now;
    from = from ?? addUtcDays(to, -29);
  }

  if (from && to && from.getTime() > to.getTime()) {
    return { ok: false, message: 'from must be before or equal to to' };
  }

  if (from && to && input.maxDays != null) {
    const spanMs = to.getTime() - from.getTime();
    const maxMs = input.maxDays * 24 * 60 * 60 * 1000;
    if (spanMs > maxMs) {
      return {
        ok: false,
        message: `Date range cannot exceed ${input.maxDays} days for this grouping`,
      };
    }
  }

  return { ok: true, from, to };
}

export function formatTrendPeriod(
  value: Date | string,
  _groupBy: TaskAnalyticsGroupBy,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export function trendBucketStart(
  date: Date,
  groupBy: TaskAnalyticsGroupBy,
): Date {
  if (groupBy === 'week') {
    return startOfUtcWeek(date);
  }
  if (groupBy === 'month') {
    return startOfUtcMonth(date);
  }
  return startOfUtcDay(date);
}

export function nextTrendBucket(
  date: Date,
  groupBy: TaskAnalyticsGroupBy,
): Date {
  if (groupBy === 'week') {
    return addUtcDays(date, 7);
  }
  if (groupBy === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }
  return addUtcDays(date, 1);
}

export function iterateTrendPeriods(
  from: Date,
  to: Date,
  groupBy: TaskAnalyticsGroupBy,
): string[] {
  const periods: string[] = [];
  let cursor = trendBucketStart(from, groupBy);
  const end = trendBucketStart(to, groupBy);

  while (cursor.getTime() <= end.getTime()) {
    periods.push(formatTrendPeriod(cursor, groupBy));
    cursor = nextTrendBucket(cursor, groupBy);
  }

  return periods;
}

export function mergeTrendRows(
  periods: string[],
  created: Array<{ period: string; count: number }>,
  completed: Array<{ period: string; count: number }>,
  overdue: Array<{ period: string; count: number }>,
): TaskAnalyticsTrendPoint[] {
  const createdBy = Object.fromEntries(created.map((row) => [row.period, row.count]));
  const completedBy = Object.fromEntries(
    completed.map((row) => [row.period, row.count]),
  );
  const overdueBy = Object.fromEntries(overdue.map((row) => [row.period, row.count]));

  return periods.map((period) => ({
    period,
    created: createdBy[period] ?? 0,
    completed: completedBy[period] ?? 0,
    overdue: overdueBy[period] ?? 0,
  }));
}

export const TASK_DATE_PRESETS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'last_30_days',
  'last_90_days',
  'custom',
] as const;

export type TaskDatePreset = (typeof TASK_DATE_PRESETS)[number];

export function resolveDatePreset(
  preset: TaskDatePreset,
  now: Date = new Date(),
): { from: Date; to: Date } | null {
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);

  if (preset === 'custom') {
    return null;
  }
  if (preset === 'today') {
    return { from: todayStart, to: todayEnd };
  }
  if (preset === 'yesterday') {
    const yesterday = addUtcDays(now, -1);
    return { from: startOfUtcDay(yesterday), to: endOfUtcDay(yesterday) };
  }
  if (preset === 'this_week') {
    return { from: startOfUtcWeek(now), to: todayEnd };
  }
  if (preset === 'last_week') {
    const thisWeek = startOfUtcWeek(now);
    return {
      from: addUtcDays(thisWeek, -7),
      to: new Date(thisWeek.getTime() - 1),
    };
  }
  if (preset === 'this_month') {
    return { from: startOfUtcMonth(now), to: todayEnd };
  }
  if (preset === 'last_month') {
    const thisMonth = startOfUtcMonth(now);
    const lastMonthStart = new Date(
      Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 1),
    );
    return { from: lastMonthStart, to: new Date(thisMonth.getTime() - 1) };
  }
  if (preset === 'last_90_days') {
    return { from: startOfUtcDay(addUtcDays(now, -89)), to: todayEnd };
  }
  return { from: startOfUtcDay(addUtcDays(now, -29)), to: todayEnd };
}

export const TASK_CSV_HEADERS = [
  'Title',
  'Status',
  'Priority',
  'Due date',
  'Completed date',
  'Company',
  'Prospect',
  'Lead',
  'Assignee',
  'Reminder status',
  'Created date',
] as const;

export type TaskCsvRow = {
  title: string;
  status: string;
  priority: string;
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  company?: string | null;
  prospect?: string | null;
  lead?: string | null;
  assignee?: string | null;
  reminderStatus?: string | null;
  createdAt?: Date | string | null;
};

export function formatCsvDate(value?: Date | string | null): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTaskCsv(rows: TaskCsvRow[]): string {
  const lines = [
    TASK_CSV_HEADERS.join(','),
    ...rows.map((row) =>
      [
        csvEscape(row.title ?? ''),
        csvEscape(row.status ?? ''),
        csvEscape(row.priority ?? ''),
        csvEscape(formatCsvDate(row.dueAt)),
        csvEscape(formatCsvDate(row.completedAt)),
        csvEscape(row.company ?? ''),
        csvEscape(row.prospect ?? ''),
        csvEscape(row.lead ?? ''),
        csvEscape(row.assignee ?? ''),
        csvEscape(row.reminderStatus ?? ''),
        csvEscape(formatCsvDate(row.createdAt)),
      ].join(','),
    ),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
