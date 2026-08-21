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

export interface TaskAgentResponse {
  action:
    | 'create'
    | 'get'
    | 'list'
    | 'update'
    | 'complete'
    | 'cancel'
    | 'clarify'
    | 'activity';
  data: TaskRecord | TaskRecord[] | null;
  message?: string;
}
