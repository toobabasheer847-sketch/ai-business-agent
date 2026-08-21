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
  data: Task | Task[] | null
  message?: string
}
