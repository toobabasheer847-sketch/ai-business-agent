import { apiClient } from '@/lib/api'
import type {
  CreateTaskRequest,
  DeleteTaskResponse,
  Task,
  TaskListQuery,
  TaskNaturalLanguageResponse,
  UpdateTaskRequest,
  TaskActivityResponse,
} from '@/features/tasks/types/task.types'

function toListParams(query?: TaskListQuery) {
  if (!query) return undefined

  const params: Record<string, string> = {}
  if (query.status) params.status = query.status
  if (query.priority) params.priority = query.priority
  if (query.search?.trim()) params.search = query.search.trim()
  if (query.companyId) params.companyId = query.companyId
  if (query.prospectId) params.prospectId = query.prospectId
  if (query.leadId) params.leadId = query.leadId
  if (query.overdue) params.overdue = 'true'
  if (query.dueFrom) params.dueFrom = query.dueFrom
  if (query.dueTo) params.dueTo = query.dueTo
  if (query.openOnly) params.openOnly = 'true'

  return Object.keys(params).length > 0 ? params : undefined
}

export const tasksApi = {
  list(query?: TaskListQuery) {
    return apiClient
      .get<Task[]>('/ai/task', { params: toListParams(query) })
      .then((r) => r.data)
  },

  getById(taskId: string) {
    return apiClient.get<Task>(`/ai/task/${taskId}`).then((r) => r.data)
  },

  create(payload: CreateTaskRequest) {
    return apiClient.post<Task>('/ai/task', payload).then((r) => r.data)
  },

  update(taskId: string, payload: UpdateTaskRequest) {
    return apiClient
      .post<Task>(`/ai/task/${taskId}`, payload)
      .then((r) => r.data)
  },

  complete(taskId: string) {
    return apiClient
      .post<Task>(`/ai/task/${taskId}/complete`)
      .then((r) => r.data)
  },

  cancel(taskId: string) {
    return apiClient
      .post<Task>(`/ai/task/${taskId}/cancel`)
      .then((r) => r.data)
  },

  remove(taskId: string) {
    return apiClient
      .delete<DeleteTaskResponse>(`/ai/task/${taskId}`)
      .then((r) => r.data)
  },

  processNaturalLanguage(message: string) {
    return apiClient
      .post<TaskNaturalLanguageResponse>('/ai/task/natural-language', {
        message,
      })
      .then((r) => r.data)
  },

  activity(taskId: string, params?: { page?: number; limit?: number }) {
    return apiClient
      .get<TaskActivityResponse>(`/ai/task/${taskId}/activity`, { params })
      .then((r) => r.data)
  },
}
