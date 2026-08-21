export const TASK_REMINDER_JOB_NAME = 'process-task-reminder';

export const TASK_REMINDER_TYPES = ['upcoming', 'overdue'] as const;

export type TaskReminderType = (typeof TASK_REMINDER_TYPES)[number];

export const TASK_REMINDER_STATUSES = [
  'pending',
  'sent',
  'skipped',
  'failed',
] as const;

export type TaskReminderStatus = (typeof TASK_REMINDER_STATUSES)[number];

export const DEFAULT_TASK_REMINDER_MINUTES_BEFORE = 30;

export type TaskReminderJobPayload = {
  tenantId: string;
  taskId: string;
  userId: string;
  reminderId: string;
  reminderType: TaskReminderType;
  scheduledAt: string;
};

export type TaskReminderSummary = {
  id: string;
  type: TaskReminderType;
  status: TaskReminderStatus;
  scheduledAt: Date | string;
  processedAt?: Date | string | null;
};
