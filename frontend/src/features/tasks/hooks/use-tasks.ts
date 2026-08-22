import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { tasksApi } from '@/features/tasks/api/tasks.api'
import type {
  CreateTaskRequest,
  TaskAnalyticsQuery,
  TaskListQuery,
  UpdateTaskRequest,
} from '@/features/tasks/types/task.types'

function normalizeListQuery(query?: TaskListQuery): TaskListQuery | undefined {
  if (!query) return undefined

  const normalized: TaskListQuery = {
    status: query.status || undefined,
    priority: query.priority || undefined,
    search: query.search?.trim() || undefined,
    companyId: query.companyId || undefined,
    prospectId: query.prospectId || undefined,
    leadId: query.leadId || undefined,
    overdue: query.overdue || undefined,
    dueFrom: query.dueFrom || undefined,
    dueTo: query.dueTo || undefined,
    openOnly: query.openOnly || undefined,
    reminderStatus: query.reminderStatus || undefined,
    hasReminder: query.hasReminder || undefined,
    reminderFrom: query.reminderFrom || undefined,
    reminderTo: query.reminderTo || undefined,
    assigneeId: query.assigneeId || undefined,
  }

  if (
    !normalized.status &&
    !normalized.priority &&
    !normalized.search &&
    !normalized.companyId &&
    !normalized.prospectId &&
    !normalized.leadId &&
    !normalized.assigneeId &&
    !normalized.overdue &&
    !normalized.dueFrom &&
    !normalized.dueTo &&
    !normalized.openOnly &&
    !normalized.reminderStatus &&
    normalized.hasReminder == null &&
    !normalized.reminderFrom &&
    !normalized.reminderTo
  ) {
    return undefined
  }

  return normalized
}

function normalizeAnalyticsQuery(
  query?: TaskAnalyticsQuery,
): TaskAnalyticsQuery | undefined {
  if (!query) return undefined

  const normalized: TaskAnalyticsQuery = {
    from: query.from || undefined,
    to: query.to || undefined,
    status: query.status || undefined,
    priority: query.priority || undefined,
    companyId: query.companyId || undefined,
    prospectId: query.prospectId || undefined,
    leadId: query.leadId || undefined,
    assigneeId: query.assigneeId || undefined,
    groupBy: query.groupBy || undefined,
  }

  if (
    !normalized.from &&
    !normalized.to &&
    !normalized.status &&
    !normalized.priority &&
    !normalized.companyId &&
    !normalized.prospectId &&
    !normalized.leadId &&
    !normalized.assigneeId &&
    !normalized.groupBy
  ) {
    return undefined
  }

  return normalized
}

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (query?: TaskListQuery) =>
    [...taskKeys.lists(), normalizeListQuery(query) ?? {}] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  activities: (id: string) => [...taskKeys.all, 'activity', id] as const,
  reminders: (id: string) => [...taskKeys.all, 'reminders', id] as const,
  analytics: (query?: TaskAnalyticsQuery) =>
    [...taskKeys.all, 'analytics', normalizeAnalyticsQuery(query) ?? {}] as const,
  analyticsTrends: (query?: TaskAnalyticsQuery) =>
    [...taskKeys.all, 'analytics-trends', normalizeAnalyticsQuery(query) ?? {}] as const,
}

async function invalidateTaskQueries(queryClient: QueryClient, taskId?: string) {
  await queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
  await queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'analytics'] })
  await queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'analytics-trends'] })
  if (taskId) {
    await queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
    await queryClient.invalidateQueries({ queryKey: taskKeys.activities(taskId) })
    await queryClient.invalidateQueries({ queryKey: taskKeys.reminders(taskId) })
  }
}

export function useTasks(query?: TaskListQuery) {
  const normalized = normalizeListQuery(query)

  return useQuery({
    queryKey: taskKeys.list(normalized),
    queryFn: () => tasksApi.list(normalized),
  })
}

export function useTask(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => tasksApi.getById(id!),
    enabled: Boolean(id) && enabled,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateTaskRequest) => tasksApi.create(payload),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateTaskRequest
    }) => tasksApi.update(id, payload),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.id)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.id)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.cancel(id),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.id)
      queryClient.setQueryData(taskKeys.detail(data.id), data)
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: async (_data, id) => {
      await invalidateTaskQueries(queryClient)
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) })
    },
  })
}

export function useTaskActivity(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: taskKeys.activities(taskId ?? ''),
    queryFn: () => tasksApi.activity(taskId!, { limit: 50 }),
    enabled: Boolean(taskId) && enabled,
  })
}

export function useTaskReminders(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: taskKeys.reminders(taskId ?? ''),
    queryFn: () => tasksApi.reminders(taskId!),
    enabled: Boolean(taskId) && enabled,
  })
}

export function useEnableTaskReminders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.enableReminders(taskId),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.taskId)
    },
  })
}

export function useDisableTaskReminders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.disableReminders(taskId),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.taskId)
    },
  })
}

export function useRescheduleTaskReminders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      scheduledAt,
    }: {
      taskId: string
      scheduledAt: string
    }) => tasksApi.rescheduleReminders(taskId, scheduledAt),
    onSuccess: async (data) => {
      await invalidateTaskQueries(queryClient, data.taskId)
    },
  })
}

export function useTaskAnalytics(query?: TaskAnalyticsQuery) {
  const normalized = normalizeAnalyticsQuery(query)

  return useQuery({
    queryKey: taskKeys.analytics(normalized),
    queryFn: () => tasksApi.analytics(normalized),
  })
}

export function useTaskAnalyticsTrends(query?: TaskAnalyticsQuery) {
  const normalized = normalizeAnalyticsQuery(query)

  return useQuery({
    queryKey: taskKeys.analyticsTrends(normalized),
    queryFn: () => tasksApi.analyticsTrends(normalized),
  })
}

export function useExportTaskAnalyticsCsv() {
  return useMutation({
    mutationFn: (query?: TaskAnalyticsQuery) => tasksApi.exportAnalyticsCsv(query),
  })
}
