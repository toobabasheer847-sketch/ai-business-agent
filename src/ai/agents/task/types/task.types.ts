import type { TaskReminderSummary } from '../task-reminder.constants.js';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export interface TaskCrmEntity {
  id: string;
  name: string;
  email?: string | null;
}

export interface TaskRecord {
  id: string;
  tenantId: string;
  createdBy: string;
  assignedTo?: string | null;
  companyId?: string | null;
  prospectId?: string | null;
  leadId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  recurrenceEnabled?: boolean;
  recurrenceInterval?: string | null;
  recurrenceEndsAt?: Date | string | null;
  recurrenceSeriesId?: string | null;
  recurrenceOccurrenceKey?: string | null;
  isBlocked?: boolean;
  blockedBy?: Array<{ id: string; title: string; status: string }>;
  nextOccurrenceAt?: string | null;
  company?: TaskCrmEntity | null;
  prospect?: TaskCrmEntity | null;
  lead?: TaskCrmEntity | null;
  isOverdue?: boolean;
  reminder?: TaskReminderSummary | null;
}

export interface TaskContext {
  userId: string;
  tenantId: string;
  email?: string;
}

export type TaskAnalyticsGroupBy = 'day' | 'week' | 'month';
export type TaskAnalyticsRangeField = 'createdAt' | 'completedAt';
export type TaskNlAnalyticsFocus =
  | 'summary'
  | 'overdue'
  | 'completed'
  | 'priority'
  | 'reminders'
  | 'activity'
  | 'rate'
  | 'report'
  | 'trends';

export interface TaskAnalyticsFilters {
  from?: Date;
  to?: Date;
  rangeField?: TaskAnalyticsRangeField;
  status?: TaskStatus;
  priority?: TaskPriority;
  companyId?: string;
  prospectId?: string;
  leadId?: string;
  assigneeId?: string;
  hasReminder?: boolean;
}

export interface TaskAnalyticsSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  highPriorityOpen: number;
  urgentOpen: number;
  withReminders: number;
}

export interface TaskAnalyticsPriority {
  low: number;
  medium: number;
  high: number;
  urgent: number;
}

export interface TaskAnalyticsCrm {
  company: number;
  prospect: number;
  lead: number;
  unlinked: number;
}

export interface TaskAnalyticsReminders {
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
  disabled: number;
}

export interface TaskAnalyticsActivity {
  created: number;
  updated: number;
  completed: number;
  cancelled: number;
  reopened: number;
  crmLinked: number;
  crmUnlinked: number;
  reminderEnabled: number;
  reminderDisabled: number;
  reminderSent: number;
  reminderFailed: number;
}

export interface TaskAnalyticsResult {
  summary: TaskAnalyticsSummary;
  completionRate: number;
  overdueRate: number;
  reminderSuccessRate: number;
  reminderFailureRate: number;
  priority: TaskAnalyticsPriority;
  crm: TaskAnalyticsCrm;
  reminders: TaskAnalyticsReminders;
  activity: TaskAnalyticsActivity;
}

export interface TaskAnalyticsTrendPoint {
  period: string;
  created: number;
  completed: number;
  overdue: number;
}

export interface TaskAnalyticsTrendsResult {
  groupBy: TaskAnalyticsGroupBy;
  from: string;
  to: string;
  trends: TaskAnalyticsTrendPoint[];
}

export interface TaskAnalyticsReport extends TaskAnalyticsResult {
  groupBy: TaskAnalyticsGroupBy;
  from: string;
  to: string;
  trends: TaskAnalyticsTrendPoint[];
}

export interface TaskAgentResponse {
  action:
    | 'create'
    | 'get'
    | 'list'
    | 'update'
    | 'complete'
    | 'cancel'
    | 'clarify'
    | 'activity'
    | 'analytics'
    | 'reminder_list'
    | 'reminder_enable'
    | 'reminder_disable'
    | 'reminder_reschedule'
    | 'add_dependency'
    | 'remove_dependency'
    | 'list_blocked';
  data: TaskRecord | TaskRecord[] | TaskAnalyticsResult | null;
  message?: string;
}
