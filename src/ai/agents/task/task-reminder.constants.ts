export const TASK_REMINDER_JOB_NAME = 'process-task-reminder';

export const TASK_REMINDER_JOB_ATTEMPTS = 3;

export const TASK_REMINDER_BACKOFF_MS = 2000;

export const TASK_REMINDER_TYPES = ['upcoming', 'overdue'] as const;

export type TaskReminderType = (typeof TASK_REMINDER_TYPES)[number];

export const TASK_REMINDER_STATUSES = [
  'pending',
  'processing',
  'sent',
  'skipped',
  'failed',
  'cancelled',
  'disabled',
] as const;

export type TaskReminderStatus = (typeof TASK_REMINDER_STATUSES)[number];

export const TASK_REMINDER_API_STATUSES = [
  'scheduled',
  'processing',
  'sent',
  'failed',
  'cancelled',
  'disabled',
] as const;

export type TaskReminderApiStatus = (typeof TASK_REMINDER_API_STATUSES)[number];

export const TASK_REMINDER_API_TYPES = ['before_due', 'overdue'] as const;

export type TaskReminderApiType = (typeof TASK_REMINDER_API_TYPES)[number];

export const DEFAULT_TASK_REMINDER_MINUTES_BEFORE = 30;

export const ACTIVE_REMINDER_STATUSES: TaskReminderStatus[] = [
  'pending',
  'processing',
];

export const CLAIMABLE_REMINDER_STATUSES: TaskReminderStatus[] = [
  'pending',
  'failed',
  'processing',
];

export const TERMINAL_SUCCESS_STATUSES: TaskReminderStatus[] = ['sent'];

export type TaskReminderJobPayload = {
  tenantId: string;
  taskId: string;
  reminderId: string;
  userId?: string;
  reminderType?: TaskReminderType;
  scheduledAt?: string;
};

export type TaskReminderSummary = {
  id: string;
  type: TaskReminderType;
  status: TaskReminderStatus;
  scheduledAt: Date | string;
  processedAt?: Date | string | null;
  channel?: 'gmail' | 'audit' | null;
  attemptCount?: number;
};

export type TaskReminderApiItem = {
  id: string;
  type: TaskReminderApiType;
  scheduledAt: string;
  status: TaskReminderApiStatus;
  channel: 'gmail' | 'audit' | null;
  sentAt: string | null;
  failedAt: string | null;
  attemptCount: number;
};

export function toApiReminderStatus(
  status: TaskReminderStatus,
): TaskReminderApiStatus {
  if (status === 'pending') {
    return 'scheduled';
  }
  if (status === 'skipped') {
    return 'cancelled';
  }
  if (
    status === 'processing' ||
    status === 'sent' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'disabled'
  ) {
    return status;
  }
  return 'scheduled';
}

export function fromApiReminderStatus(
  status: string,
): TaskReminderStatus[] {
  const normalized = status.toLowerCase();
  if (normalized === 'scheduled' || normalized === 'pending') {
    return ['pending'];
  }
  if (normalized === 'cancelled') {
    return ['cancelled', 'skipped'];
  }
  if (
    normalized === 'processing' ||
    normalized === 'sent' ||
    normalized === 'failed' ||
    normalized === 'disabled'
  ) {
    return [normalized];
  }
  return [];
}

export function toApiReminderType(type: TaskReminderType): TaskReminderApiType {
  return type === 'upcoming' ? 'before_due' : 'overdue';
}

export function toReminderApiItem(row: {
  id: string;
  reminderType: TaskReminderType;
  scheduledAt: Date | string;
  status: TaskReminderStatus;
  channel?: string | null;
  processedAt?: Date | string | null;
  attemptCount?: number;
}): TaskReminderApiItem {
  const status = toApiReminderStatus(row.status);
  const processedAt =
    row.processedAt instanceof Date
      ? row.processedAt.toISOString()
      : row.processedAt ?? null;
  const scheduledAt =
    row.scheduledAt instanceof Date
      ? row.scheduledAt.toISOString()
      : String(row.scheduledAt);

  return {
    id: row.id,
    type: toApiReminderType(row.reminderType),
    scheduledAt,
    status,
    channel: row.channel === 'gmail' || row.channel === 'audit' ? row.channel : null,
    sentAt: status === 'sent' ? processedAt : null,
    failedAt: status === 'failed' ? processedAt : null,
    attemptCount: row.attemptCount ?? 0,
  };
}
