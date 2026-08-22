/** Backend TaskStatus values — do not invent others */
export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/** Backend TaskPriority values — do not invent others */
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export type TaskCrmEntity = {
  id: string
  name: string
  email?: string | null
}

/**
 * Matches GET/POST /api/ai/task and related mutation responses.
 * tenantId and createdBy are response-only; never send them from the client.
 */
export type Task = {
  id: string
  tenantId: string
  createdBy: string
  assignedTo: string | null
  companyId: string | null
  prospectId: string | null
  leadId: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueAt: string | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  isOverdue?: boolean
  reminder?: {
    id: string
    type: 'upcoming' | 'overdue' | 'before_due'
    status:
      | 'pending'
      | 'processing'
      | 'sent'
      | 'skipped'
      | 'failed'
      | 'cancelled'
      | 'disabled'
    scheduledAt: string
    processedAt?: string | null
    channel?: 'gmail' | 'audit' | null
    attemptCount?: number
  } | null
  company?: TaskCrmEntity | null
  prospect?: TaskCrmEntity | null
  lead?: TaskCrmEntity | null
}

/** Matches POST /api/ai/task body — never include tenantId or createdBy */
export type CreateTaskRequest = {
  title: string
  description?: string
  priority?: TaskPriority
  assignedTo?: string
  companyId?: string
  prospectId?: string
  leadId?: string
  dueAt?: string
}

/** Matches POST /api/ai/task/:taskId body — never include tenantId or createdBy */
export type UpdateTaskRequest = {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignedTo?: string
  companyId?: string | null
  prospectId?: string | null
  leadId?: string | null
  dueAt?: string
}

/** Matches DELETE /api/ai/task/:taskId response */
export type DeleteTaskResponse = {
  message: string
  id: string
}

/** Matches GET /api/ai/task query — backend-supported filters only */
export type TaskListQuery = {
  status?: TaskStatus | string
  priority?: TaskPriority | string
  search?: string
  companyId?: string
  prospectId?: string
  leadId?: string
  overdue?: boolean
  dueFrom?: string
  dueTo?: string
  openOnly?: boolean
  reminderStatus?: string
  hasReminder?: boolean
  reminderFrom?: string
  reminderTo?: string
}

/** Matches POST /api/ai/task/natural-language response */
export type TaskNaturalLanguageResponse = {
  action:
    | 'create'
    | 'get'
    | 'list'
    | 'update'
    | 'complete'
    | 'cancel'
    | 'clarify'
    | 'activity'
    | 'reminder_list'
    | 'reminder_enable'
    | 'reminder_disable'
    | 'reminder_reschedule'
  data: Task | Task[] | null
  message?: string
}

export const TASK_ACTIVITY_EVENTS = [
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_COMPLETED',
  'TASK_CANCELLED',
  'TASK_REOPENED',
  'TASK_CRM_LINKED',
  'TASK_CRM_UNLINKED',
  'REMINDER_SCHEDULED',
  'REMINDER_ENABLED',
  'REMINDER_DISABLED',
  'REMINDER_RESCHEDULED',
  'REMINDER_PROCESSING',
  'REMINDER_SENT',
  'REMINDER_FAILED',
  'REMINDER_RETRY',
] as const

export type TaskActivityEventType = (typeof TASK_ACTIVITY_EVENTS)[number]

export type TaskActivityActor = {
  id: string
  name: string
} | null

export type TaskActivityItem = {
  id: string
  eventType: TaskActivityEventType
  actor: TaskActivityActor
  metadata: Record<string, unknown>
  createdAt: string
}

export type TaskActivityResponse = {
  taskId: string
  activities: TaskActivityItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type TaskReminderApiStatus =
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled'
  | 'disabled'

export type TaskReminderItem = {
  id: string
  type: 'before_due' | 'overdue'
  scheduledAt: string
  status: TaskReminderApiStatus
  channel: 'gmail' | 'audit' | null
  sentAt: string | null
  failedAt: string | null
  attemptCount: number
}

export type TaskReminderListResponse = {
  taskId: string
  reminders: TaskReminderItem[]
}
